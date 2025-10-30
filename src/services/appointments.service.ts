import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

type CreateAppointmentPayload = {
  patientId: string;
  doctorId: string;
  specialtyId?: string;
  startAt: string; // ISO or parsable
  duration?: number; // minutes
  reason?: string;
};

export async function createAppointment(payload: CreateAppointmentPayload) {
  const { patientId, doctorId, specialtyId, startAt, duration = 30, reason } = payload;
  if (!patientId || !doctorId || !startAt) throw new Error('patientId, doctorId and startAt are required');

  const start = DateTime.fromISO(startAt, { zone: 'America/Bogota' }).toUTC();
  const end = start.plus({ minutes: duration });

  // Check overlap for the doctor (exclude CANCELLED)
  const conflict = await prisma.appointment.findFirst({
    where: ( {
      doctorId,
      status: { not: 'CANCELLED' },
      AND: [
        { startAt: { lt: end.toJSDate() } },
        { endAt: { gt: start.toJSDate() } },
      ],
    } as any ),
  });

  if (conflict) throw new Error('Appointment overlaps with an existing one for this doctor');

  const created = await prisma.appointment.create({
    data: ( {
      patientId,
      doctorId,
      specialtyId,
      reason,
      startAt: start.toJSDate(),
      endAt: end.toJSDate(),
      duration,
    } as any ),
  });

  return created;
}

export async function getAppointmentById(id: string) {
  return prisma.appointment.findUnique({ where: { id } });
}

// Basic availability calculator: returns array of slot start ISO strings
export async function getAvailability(doctorId: string, dateISO: string) {
  const date = DateTime.fromISO(dateISO, { zone: 'America/Bogota' });
  if (!date.isValid) throw new Error('Invalid date');

  const dayOfWeek = date.weekday % 7; // Luxon: 1=Mon..7=Sun -> convert to 0=Sun..6

  // Fetch schedule templates for this doctor and matching dayOfWeek
  const templates = await (prisma as any).scheduleTemplate.findMany({ where: { doctorId, dayOfWeek: dayOfWeek } });

  // Fetch exceptions for that date
  const startOfDay = date.startOf('day').toJSDate();
  const exceptions = await (prisma as any).scheduleException.findMany({ where: { doctorId, date: startOfDay } });

  // Fetch existing appointments for that doctor on that day
  const dayStartUTC = date.startOf('day').toUTC().toJSDate();
  const dayEndUTC = date.endOf('day').toUTC().toJSDate();
  const appointments = await prisma.appointment.findMany({
    where: ( {
      doctorId,
      AND: [
        { startAt: { gte: dayStartUTC } },
        { startAt: { lte: dayEndUTC } },
      ],
      status: { not: 'CANCELLED' },
    } as any ),
  });

  const slots: string[] = [];

  // For each template build slots
  for (const tpl of templates) {
    // tpl.startTime / tpl.endTime are "HH:MM" in local timezone
    const [sh, sm] = tpl.startTime.split(':').map(Number);
    const [eh, em] = tpl.endTime.split(':').map(Number);

    let slotStart = date.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
    const slotEndLimit = date.set({ hour: eh, minute: em, second: 0, millisecond: 0 });

    while (slotStart < slotEndLimit) {
      const slotEnd = slotStart.plus({ minutes: 30 }); // default 30
      // check against exceptions and appointments
      const utcStart = slotStart.toUTC().toJSDate();
      const utcEnd = slotEnd.toUTC().toJSDate();

      const isBlockedByException = exceptions.some(exc => exc.isBlocked && (!exc.startTime || !exc.endTime));

      const overlapsAppt = appointments.some(a => (a as any).startAt < utcEnd && (a as any).endAt > utcStart);

      if (!isBlockedByException && !overlapsAppt) {
        slots.push(slotStart.toISO());
      }

      slotStart = slotStart.plus({ minutes: 30 });
    }
  }

  // Deduplicate and sort
  return Array.from(new Set(slots)).sort();
}

export async function createTemplate(payload: { doctorId: string; dayOfWeek: number; startTime: string; endTime: string }) {
  const { doctorId, dayOfWeek, startTime, endTime } = payload;
  if (!doctorId) throw new Error('doctorId required');
  return (prisma as any).scheduleTemplate.create({ data: { doctorId, dayOfWeek, startTime, endTime } });
}

export async function createException(payload: { doctorId: string; date: string; startTime?: string; endTime?: string; isBlocked?: boolean; reason?: string }) {
  const { doctorId, date, startTime, endTime, isBlocked = true, reason } = payload;
  if (!doctorId || !date) throw new Error('doctorId and date required');
  const dateObj = DateTime.fromISO(date, { zone: 'America/Bogota' }).startOf('day').toJSDate();
  return (prisma as any).scheduleException.create({ data: { doctorId, date: dateObj, startTime, endTime, isBlocked, reason } });
}

export async function updateAppointmentStatus(id: string, status: string) {
  if (!id || !status) throw new Error('id and status required');
  return prisma.appointment.update({ where: { id }, data: { status } as any });
}
