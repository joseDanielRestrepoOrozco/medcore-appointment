import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

// Prisma client is generated to src/generated/prisma and exposes typed models
export async function joinTicket(doctorId: string, patientId: string, metadata?: any) {
  const created = await prisma.ticket.create({
    data: {
      doctorId,
      patientId,
      metadata,
    },
  });

  // position: number of waiting tickets created before this + 1
  const position = await prisma.ticket.count({
    where: {
      doctorId,
      status: 'WAITING',
      createdAt: { lt: created.createdAt },
    },
  });

  return { ticket: created, position: position + 1 };
}

export async function getCurrentForDoctor(doctorId: string) {
  // find the currently called ticket for a doctor
  const current = await prisma.ticket.findFirst({
    where: { doctorId, status: 'CALLED' },
    orderBy: { calledAt: 'asc' },
  });
  return current;
}

export async function callNext(doctorId: string) {
  // Use an optimistic-update loop to atomically claim the next ticket.
  // We avoid raw Mongo commands to keep compatibility with Prisma's type mapping.
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // find the earliest waiting ticket
    const next = await prisma.ticket.findFirst({
      where: { doctorId, status: 'WAITING' },
      orderBy: { createdAt: 'asc' },
    });
    if (!next) return null;

    // try to atomically update it only if still WAITING
    const updated = await prisma.ticket.updateMany({
      where: { id: next.id, status: 'WAITING' },
      data: { status: 'CALLED', calledAt: new Date() },
    });
    if (updated.count > 0) {
      const calledTicket = await prisma.ticket.findUnique({ where: { id: next.id } });
      const waiting = await prisma.ticket.count({ where: { doctorId, status: 'WAITING' } });
      return { calledTicket, waiting };
    }
    // someone else claimed it, retry
  }
  return null;
}

export async function completeTicket(ticketId: string) {
  const updated = await prisma.ticket.updateMany({
    where: { id: ticketId, status: 'CALLED' },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  return updated.count > 0;
}

export async function getTicketPosition(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;
  if (ticket.status !== 'WAITING') return { ticket, position: 0 };
  const positionBefore = await prisma.ticket.count({
    where: { doctorId: ticket.doctorId, status: 'WAITING', createdAt: { lt: ticket.createdAt } },
  });
  return { ticket, position: positionBefore + 1 };
}

export async function getTicketsForUser(userId: string, role: string) {
  if (String(role).toUpperCase() === 'MEDICO') {
    return prisma.ticket.findMany({ where: { doctorId: userId } });
  }
  // default: PACIENTE
  return prisma.ticket.findMany({ where: { patientId: userId } });
}
