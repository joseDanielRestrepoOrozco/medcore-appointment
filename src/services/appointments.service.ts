import { PrismaClient, AppointmentStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import usersClient from '../libs/usersClient.js';
import { DEFAULT_TIMEZONE } from '../libs/config.js';
import redlock from '../libs/lock.js';
import { enqueueCalendarJob } from '../libs/queue.js';
import type { UserPayload } from '../types/express.js';

const prisma = new PrismaClient();

// Helper function to check if user has access to an appointment
async function checkAppointmentAccess(
  appointmentId: string,
  user?: UserPayload
): Promise<void> {
  if (!user) {
    throw new Error('Authentication required');
  }

  // Admin can access everything
  if (user.role === 'ADMIN') {
    return;
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { patientId: true, doctorId: true },
  });

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  // Check if user is the patient or the doctor
  const isPatient = appointment.patientId === user.id;
  const isDoctor = appointment.doctorId === user.id;

  if (!isPatient && !isDoctor) {
    throw new Error(
      'Access denied: you do not have permission to access this appointment'
    );
  }
}

type CreateAppointmentPayload = {
  patientId: string;
  doctorId: string;
  specialtyId?: string;
  startAt: string; // ISO or parsable in DEFAULT_TIMEZONE
  duration?: number; // minutes (will be validated as 30)
  reason?: string;
};

// Business rules enforced here:
// - duration must be exactly 30 minutes
// - start time must be in the future (DEFAULT_TIMEZONE by default)
// - start time must align to 00 or 30 minutes
// - no overlapping appointments for doctor or patient (exclude CANCELLED)
// - patient may have at most 3 upcoming active appointments
export async function createAppointment(
  payload: CreateAppointmentPayload,
  authHeader?: string
) {
  const {
    patientId,
    doctorId,
    specialtyId,
    startAt,
    duration = 30,
    reason,
  } = payload;
  if (!patientId || !doctorId || !startAt)
    throw new Error('patientId, doctorId and startAt are required');

  // Enforce fixed duration
  if (duration !== 30) throw new Error('Duration must be exactly 30 minutes');

  const zone = DEFAULT_TIMEZONE || 'America/Bogota';
  const startLocal = DateTime.fromISO(startAt, { zone });
  if (!startLocal.isValid) throw new Error('Invalid startAt date');

  // Do not allow scheduling in the past
  const nowLocal = DateTime.now().setZone(zone);
  if (startLocal <= nowLocal)
    throw new Error('Cannot schedule appointments in the past');

  // Slot alignment: minutes should be 0 or 30
  const minute = startLocal.minute;
  if (!(minute === 0 || minute === 30))
    throw new Error(
      'startAt must be aligned to 30-minute slots (minutes must be 00 or 30)'
    );

  // Validate doctor and patient exist (note: inter-service auth handled externally)
  const extraHeaders = authHeader ? { Authorization: authHeader } : undefined;

  // Allow skipping user validation in development by setting SKIP_USER_VALIDATION=true
  let doctorExists = false;
  let patientExists = false;
  if (process.env.SKIP_USER_VALIDATION === 'true') {
    doctorExists = true;
    patientExists = true;
  } else {
    [doctorExists, patientExists] = await Promise.all([
      usersClient.checkDoctorExists(doctorId, extraHeaders).catch(() => false),
      usersClient
        .checkPatientExists(patientId, extraHeaders)
        .catch(() => false),
    ]);
  }
  if (!doctorExists) throw new Error('Doctor not found');
  if (!patientExists) throw new Error('Patient not found');

  const startUTC = startLocal.toUTC();
  const endUTC = startUTC.plus({ minutes: duration });

  // Ensure the requested slot is part of the doctor's configured availability (templates/exceptions)
  try {
    const availableSlots = await getAvailability(
      doctorId,
      startLocal.toISODate()
    );
    // Compare ISO forms (with offset) to be robust
    const requestedIso = startLocal.toISO();
    if (!availableSlots.includes(requestedIso)) {
      throw new Error('Doctor is not available at the requested time');
    }
  } catch (e) {
    // If getAvailability throws, propagate as validation error
    if (e instanceof Error) throw e;
  }

  // Acquire distributed lock for doctor+patient to avoid race conditions
  const resources = [`locks:doctor:${doctorId}`, `locks:patient:${patientId}`];
  const ttl = 10000; // 10s
  const lock = await redlock.acquire(resources, ttl).catch(() => null);
  if (!lock) throw new Error('Could not acquire lock, try again');

  try {
    // Check overlap for the doctor (exclude CANCELLED)
    const doctorConflict = await prisma.appointment.findFirst({
      where: {
        doctorId,
        status: { not: 'CANCELLED' },
        AND: [
          { startAt: { lt: endUTC.toJSDate() } },
          { endAt: { gt: startUTC.toJSDate() } },
        ],
      } as any,
    });
    if (doctorConflict)
      throw new Error(
        'Appointment overlaps with an existing one for this doctor'
      );

    // Check overlap for the patient (exclude CANCELLED)
    const patientConflict = await prisma.appointment.findFirst({
      where: {
        patientId,
        status: { not: 'CANCELLED' },
        AND: [
          { startAt: { lt: endUTC.toJSDate() } },
          { endAt: { gt: startUTC.toJSDate() } },
        ],
      } as any,
    });
    if (patientConflict)
      throw new Error(
        'Patient has a conflicting appointment in that time range'
      );

    // Limit: max 3 upcoming active appointments per patient
    const activeStatuses = [
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.IN_PROGRESS,
    ];
    const upcomingCount = await prisma.appointment.count({
      where: {
        patientId,
        status: { in: activeStatuses },
        startAt: { gt: nowLocal.toUTC().toJSDate() },
      } as any,
    });
    if (upcomingCount >= 3)
      throw new Error(
        'Patient has reached the maximum number of active upcoming appointments (3)'
      );

    const created = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        specialtyId,
        reason,
        startAt: startUTC.toJSDate(),
        endAt: endUTC.toJSDate(),
        duration,
      } as any,
    });

    // Encolar sincronización con calendario (asíncrona)
    try {
      await enqueueCalendarJob({
        type: 'create',
        appointmentId: (created as any).id,
      });
    } catch (e) {
      console.warn('Could not enqueue calendar job', e);
    }

    return created;
  } finally {
    try {
      if (lock) {
        if (typeof (lock as any).release === 'function')
          await (lock as any).release();
        else if (typeof (lock as any).unlock === 'function')
          await (lock as any).unlock();
      }
    } catch (e) {
      // swallow
    }
  }
}

export async function getAppointmentById(id: string, user?: UserPayload) {
  await checkAppointmentAccess(id, user);
  return prisma.appointment.findUnique({ where: { id } });
}

export async function listAppointments() {
  return prisma.appointment.findMany({ orderBy: { startAt: 'asc' } } as any);
}

// Basic availability calculator: returns array of slot start ISO strings
export async function getAvailability(doctorId: string, dateISO: string) {
  const date = DateTime.fromISO(dateISO, { zone: 'America/Bogota' });
  if (!date.isValid) throw new Error('Invalid date');

  const dayOfWeek = date.weekday % 7; // Luxon: 1=Mon..7=Sun -> convert to 0=Sun..6

  // Fetch schedule templates for this doctor and matching dayOfWeek
  const templates = await (prisma as any).scheduleTemplate.findMany({
    where: { doctorId, dayOfWeek: dayOfWeek },
  });

  // Fetch exceptions for that date
  const startOfDay = date.startOf('day').toJSDate();
  const exceptions = await prisma.scheduleException.findMany({
    where: { doctorId, date: startOfDay },
  });

  // Fetch existing appointments for that doctor on that day
  const dayStartUTC = date.startOf('day').toUTC().toJSDate();
  const dayEndUTC = date.endOf('day').toUTC().toJSDate();
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      AND: [{ startAt: { gte: dayStartUTC } }, { startAt: { lte: dayEndUTC } }],
      status: { not: 'CANCELLED' },
    } as any,
  });

  const slots: string[] = [];

  // For each template build slots
  for (const tpl of templates) {
    // tpl.startTime / tpl.endTime are "HH:MM" in local timezone
    const [sh, sm] = tpl.startTime.split(':').map(Number);
    const [eh, em] = tpl.endTime.split(':').map(Number);

    let slotStart = date.set({
      hour: sh,
      minute: sm,
      second: 0,
      millisecond: 0,
    });
    const slotEndLimit = date.set({
      hour: eh,
      minute: em,
      second: 0,
      millisecond: 0,
    });

    while (slotStart < slotEndLimit) {
      const slotEnd = slotStart.plus({ minutes: 30 }); // default 30
      // check against exceptions and appointments
      const utcStart = slotStart.toUTC().toJSDate();
      const utcEnd = slotEnd.toUTC().toJSDate();

      const isBlockedByException = exceptions.some(
        exc => exc.isBlocked && (!exc.startTime || !exc.endTime)
      );

      const overlapsAppt = appointments.some(
        a => (a as any).startAt < utcEnd && (a as any).endAt > utcStart
      );

      if (!isBlockedByException && !overlapsAppt) {
        slots.push(slotStart.toISO());
      }

      slotStart = slotStart.plus({ minutes: 30 });
    }
  }

  // Deduplicate and sort
  return Array.from(new Set(slots)).sort();
}

export async function createTemplate(payload: {
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}) {
  const { doctorId, dayOfWeek, startTime, endTime } = payload;
  if (!doctorId) throw new Error('doctorId required');
  return (prisma as any).scheduleTemplate.create({
    data: { doctorId, dayOfWeek, startTime, endTime },
  });
}

export async function createException(payload: {
  doctorId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isBlocked?: boolean;
  reason?: string;
}) {
  const {
    doctorId,
    date,
    startTime,
    endTime,
    isBlocked = true,
    reason,
  } = payload;
  if (!doctorId || !date) throw new Error('doctorId and date required');
  const dateObj = DateTime.fromISO(date, { zone: 'America/Bogota' })
    .startOf('day')
    .toJSDate();
  return (prisma as any).scheduleException.create({
    data: { doctorId, date: dateObj, startTime, endTime, isBlocked, reason },
  });
}

async function updateAppointmentStatus(
  id: string,
  status: string,
  user?: UserPayload
) {
  if (!id || !status) throw new Error('id and status required');

  await checkAppointmentAccess(id, user);

  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt) throw new Error('Appointment not found');

  // Allowed transitions map
  const transitions: Record<string, string[]> = {
    SCHEDULED: ['CONFIRMED', 'CANCELLED', 'IN_PROGRESS'],
    CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'NO_SHOW'],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };

  const current = (appt as any).status as string;
  const desired = status as string;
  if (current === desired) return appt;
  const allowed = transitions[current] || [];
  if (!allowed.includes(desired))
    throw new Error(`Invalid state transition from ${current} to ${desired}`);

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: desired } as any,
  });
  try {
    await enqueueCalendarJob({ type: 'update', appointmentId: id });
  } catch (e) {
    console.warn('Could not enqueue calendar update job', e);
  }
  return updated;
}

export async function cancelAppointment(id: string, user?: UserPayload) {
  if (!id) throw new Error('id required');

  await checkAppointmentAccess(id, user);

  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt) throw new Error('Appointment not found');

  const zone = DEFAULT_TIMEZONE || 'America/Bogota';
  const startLocal = DateTime.fromJSDate((appt as any).startAt).setZone(zone);
  const nowLocal = DateTime.now().setZone(zone);

  // Must cancel at least 4 hours before start
  const hoursDiff = startLocal.diff(nowLocal, 'hours').hours;
  if (hoursDiff < 4)
    throw new Error(
      'Cancellations must be made at least 4 hours before the appointment'
    );

  // Use the state-machine validation implemented in updateAppointmentStatus
  // This enforces allowed transitions and also enqueues calendar jobs
  const updated = await updateAppointmentStatus(id, 'CANCELLED', user);
  return updated;
}

export async function reprogramAppointment(
  id: string,
  newStartAt: string,
  user?: UserPayload
) {
  if (!id || !newStartAt) throw new Error('id and newStartAt required');

  await checkAppointmentAccess(id, user);

  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt) throw new Error('Appointment not found');

  const zone = DEFAULT_TIMEZONE || 'America/Bogota';
  const nowLocal = DateTime.now().setZone(zone);
  const originalStartLocal = DateTime.fromJSDate((appt as any).startAt).setZone(
    zone
  );

  // Reprogramming requests must be made at least 24 hours before the original appointment
  const hoursBeforeOriginal = originalStartLocal.diff(nowLocal, 'hours').hours;
  if (hoursBeforeOriginal < 24)
    throw new Error(
      'Reprogramming must be requested at least 24 hours before the appointment'
    );

  const newStartLocal = DateTime.fromISO(newStartAt, { zone });
  if (!newStartLocal.isValid) throw new Error('Invalid newStartAt date');
  if (newStartLocal <= nowLocal)
    throw new Error('New start must be in the future');

  // New start must align to 00 or 30
  const minute = newStartLocal.minute;
  if (!(minute === 0 || minute === 30))
    throw new Error(
      'newStartAt must be aligned to 30-minute slots (minutes must be 00 or 30)'
    );

  const duration = (appt as any).duration || 30;
  // check overlaps for doctor and patient, excluding this appointment
  const newStartUTC = newStartLocal.toUTC();
  const newEndUTC = newStartUTC.plus({ minutes: duration });

  const doctorConflict = await prisma.appointment.findFirst({
    where: {
      doctorId: (appt as any).doctorId,
      id: { not: id },
      status: { not: 'CANCELLED' },
      AND: [
        { startAt: { lt: newEndUTC.toJSDate() } },
        { endAt: { gt: newStartUTC.toJSDate() } },
      ],
    } as any,
  });
  if (doctorConflict)
    throw new Error(
      'New time overlaps with existing appointment for this doctor'
    );

  const patientConflict = await prisma.appointment.findFirst({
    where: {
      patientId: (appt as any).patientId,
      id: { not: id },
      status: { not: 'CANCELLED' },
      AND: [
        { startAt: { lt: newEndUTC.toJSDate() } },
        { endAt: { gt: newStartUTC.toJSDate() } },
      ],
    } as any,
  });
  if (patientConflict)
    throw new Error(
      'New time overlaps with existing appointment for this patient'
    );

  // ensure patient won't exceed 3 active upcoming appointments
  const activeStatuses = [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.IN_PROGRESS,
  ];
  const upcomingCount = await prisma.appointment.count({
    where: {
      patientId: (appt as any).patientId,
      id: { not: id },
      status: { in: activeStatuses },
      startAt: { gt: nowLocal.toUTC().toJSDate() },
    } as any,
  });
  if (upcomingCount >= 3)
    throw new Error(
      'Patient has reached the maximum number of active upcoming appointments (3)'
    );

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      startAt: newStartUTC.toJSDate(),
      endAt: newEndUTC.toJSDate(),
    } as any,
  });
  try {
    await enqueueCalendarJob({ type: 'update', appointmentId: id });
  } catch (e) {
    console.warn('Could not enqueue calendar update job', e);
  }
  return updated;
}

export async function confirmAppointment(
  id: string,
  patientId: string,
  user?: UserPayload
) {
  if (!id) throw new Error('id required');

  await checkAppointmentAccess(id, user);

  const appt = await prisma.appointment.findUnique({ where: { id } });

  if (!appt) throw new Error('Appointment not found');
  if ((appt as any).status === 'CANCELLED')
    throw new Error('Cannot confirm a cancelled appointment');

  if ((appt as any).status === 'CONFIRMED') return appt;

  if (appt.patientId !== patientId) {
    throw new Error('Patient ID does not match appointment');
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: 'CONFIRMED' } as any,
  });
  try {
    await enqueueCalendarJob({ type: 'update', appointmentId: id });
  } catch (e) {
    console.warn('Could not enqueue calendar update job', e);
  }
  return updated;
}
