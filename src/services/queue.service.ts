import { PrismaClient } from '@prisma/client';
import { convertAppointmentToLocal } from '../libs/time.js';

const prisma = new PrismaClient();

/**
 * Join queue - Get all CONFIRMED and IN_PROGRESS appointments for a doctor, ordered by startAt
 * Only confirmed appointments are shown in the queue (patient has confirmed their appointment)
 * @param doctorId - The doctor's ID
 * @returns Array of appointments in queue with their positions
 */
export async function join(doctorId: string) {
  // Get all CONFIRMED and IN_PROGRESS appointments for this doctor, ordered by startAt
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: {
        in: ['CONFIRMED', 'IN_PROGRESS'],
      },
    },
    orderBy: {
      startAt: 'asc',
    },
  });

  // Add position to each appointment (only CONFIRMED ones get a position number)
  const queue = appointments.map((appointment, index) => {
    // IN_PROGRESS appointments get position 0 (currently being attended)
    const position = appointment.status === 'IN_PROGRESS' ? 0 : index + 1;
    return {
      ...convertAppointmentToLocal(appointment),
      position,
    };
  });

  return {
    queue,
    total: queue.length,
  };
}

/**
 * Get current appointment being attended by a doctor
 * @param doctorId - The doctor's ID
 * @returns The appointment currently IN_PROGRESS, or null
 */
export async function getCurrentForDoctor(doctorId: string) {
  const current = await prisma.appointment.findFirst({
    where: {
      doctorId,
      status: 'IN_PROGRESS',
    },
    orderBy: {
      startAt: 'asc',
    },
  });
  return convertAppointmentToLocal(current as any);
}

/**
 * Call next appointment in queue - Changes next CONFIRMED to IN_PROGRESS
 * Validations:
 * - Only CONFIRMED appointments can be called
 * - Cannot call next if there's already an IN_PROGRESS appointment
 * Uses optimistic locking to handle race conditions
 * @param doctorId - The doctor's ID
 * @returns The called appointment and count of waiting appointments, or null if none
 */
export async function callNext(doctorId: string) {
  // First, check if there's already an appointment IN_PROGRESS
  const inProgress = await prisma.appointment.findFirst({
    where: {
      doctorId,
      status: 'IN_PROGRESS',
    },
  });

  if (inProgress) {
    throw new Error(
      'Cannot call next: there is already an appointment in progress'
    );
  }

  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Find the earliest CONFIRMED appointment (not SCHEDULED)
    const next = await prisma.appointment.findFirst({
      where: {
        doctorId,
        status: 'CONFIRMED',
      },
      orderBy: {
        startAt: 'asc',
      },
    });

    if (!next) return null;

    // Try to atomically update it only if still CONFIRMED (prevents race conditions)
    const updated = await prisma.appointment.updateMany({
      where: {
        id: next.id,
        status: 'CONFIRMED',
      },
      data: {
        status: 'IN_PROGRESS',
      },
    });

    if (updated.count > 0) {
      // Successfully updated, fetch the appointment and count remaining
      const calledAppointment = await prisma.appointment.findUnique({
        where: { id: next.id },
      });

      const waiting = await prisma.appointment.count({
        where: {
          doctorId,
          status: 'CONFIRMED',
        },
      });

      return {
        appointment: convertAppointmentToLocal(calledAppointment as any),
        waiting,
      };
    }
    // Someone else claimed it, retry
  }

  return null;
}

/**
 * Complete an appointment - Changes IN_PROGRESS to COMPLETED
 * Validation: Only IN_PROGRESS appointments can be completed
 * @param appointmentId - The appointment ID
 * @returns True if updated successfully, false otherwise
 */
export async function completeAppointment(appointmentId: string) {
  // First verify the appointment exists and is IN_PROGRESS
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.status !== 'IN_PROGRESS') {
    throw new Error('Can only complete appointments that are IN_PROGRESS');
  }

  const updated = await prisma.appointment.updateMany({
    where: {
      id: appointmentId,
      status: 'IN_PROGRESS',
    },
    data: {
      status: 'COMPLETED',
    },
  });

  return updated.count > 0;
}

/**
 * Get position of a CONFIRMED appointment in the queue
 * Position is calculated by counting CONFIRMED appointments with earlier startAt
 * Validation: Only CONFIRMED appointments have a queue position
 * @param appointmentId - The appointment ID
 * @returns The appointment and its position, or null if not found
 */
export async function getAppointmentPosition(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) return null;

  // Only CONFIRMED appointments have a position in queue
  if (appointment.status !== 'CONFIRMED') {
    return {
      appointment,
      position: 0,
      message:
        appointment.status === 'IN_PROGRESS'
          ? 'Appointment is currently being attended'
          : appointment.status === 'COMPLETED'
          ? 'Appointment has been completed'
          : 'Appointment must be CONFIRMED to have a queue position',
    };
  }

  // Count CONFIRMED appointments before this one in the queue
  const positionBefore = await prisma.appointment.count({
    where: {
      doctorId: appointment.doctorId,
      status: 'CONFIRMED',
      startAt: { lt: appointment.startAt },
    },
  });

  return {
    appointment: convertAppointmentToLocal(appointment as any),
    position: positionBefore + 1,
  };
}

/**
 * Get all appointments for a user (doctor or patient)
 * @param userId - The user ID
 * @param role - The user role (MEDICO or PACIENTE)
 * @returns List of appointments ordered by startAt
 */
export async function getAppointmentsForUser(userId: string, role: string) {
  if (String(role).toUpperCase() === 'MEDICO') {
    const appts = await prisma.appointment.findMany({
      where: { doctorId: userId },
      orderBy: { startAt: 'asc' },
    });
    return appts.map(a => convertAppointmentToLocal(a));
  }

  // Default: PACIENTE
  const appts = await prisma.appointment.findMany({
    where: { patientId: userId },
    orderBy: { startAt: 'asc' },
  });
  return appts.map(a => convertAppointmentToLocal(a));
}

/**
 * Mark an appointment as NO_SHOW
 * Used when patient doesn't show up for their appointment
 * @param appointmentId - The appointment ID
 * @returns True if updated successfully, false otherwise
 */
export async function markNoShow(appointmentId: string, doctorId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId, doctorId },
  });

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.status !== 'IN_PROGRESS') {
    throw new Error(
      'Can only mark as NO_SHOW appointments that are IN_PROGRESS'
    );
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'NO_SHOW' },
  });

  return convertAppointmentToLocal(updated as any);
}
