import { type Request, type Response } from 'express';
import * as service from '../services/queue.service.js';

/**
 * POST /api/queue/join
 * Get the full queue for the authenticated doctor
 */
export async function join(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await service.join(user.id);
    return res.status(200).json({
      queue: result.queue,
      total: result.total,
    });
  } catch (err: any) {
    console.error('[queue.join] error', err);
    return res
      .status(400)
      .json({ error: err.message || 'Could not get queue' });
  }
}

/**
 * GET /api/queue/doctor/:doctorId/current
 * Get the current appointment being attended by a doctor
 */
export async function getCurrent(req: Request, res: Response) {
  try {
    const user = req.user;

    const current = await service.getCurrentForDoctor(user?.id ?? '');

    if (!current) {
      return res.json({
        appointment: null,
        message: 'No appointment currently in progress',
      });
    }

    return res.json({ appointment: current });
  } catch (err: any) {
    console.error('[queue.getCurrent] error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/queue/call-next
 * Call the next appointment in queue (CONFIRMED -> IN_PROGRESS)
 * Validations:
 * - Only CONFIRMED appointments can be called
 * - Cannot call if there's already an IN_PROGRESS appointment
 */
export async function callNext(req: Request, res: Response) {
  try {
    const user = req.user;

    const result = await service.callNext(user?.id ?? '');

    if (!result) {
      return res
        .status(404)
        .json({ error: 'No confirmed appointments waiting in queue' });
    }

    return res.json({
      appointment: result.appointment,
      waitingCount: result.waiting,
    });
  } catch (err: any) {
    console.error('[queue.callNext] error', err);

    // Handle specific error for already in progress
    if (
      err.message &&
      err.message.includes('already an appointment in progress')
    ) {
      return res.status(409).json({ error: err.message });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /api/queue/ticket/:ticketId/complete
 * Complete an appointment (IN_PROGRESS -> COMPLETED)
 * Validation: Only IN_PROGRESS appointments can be completed
 */
export async function completeTicket(req: Request, res: Response) {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    const ok = await service.completeAppointment(ticketId);

    if (!ok) {
      return res.status(400).json({
        error: 'Failed to complete appointment',
      });
    }

    return res.json({
      appointmentId: ticketId,
      status: 'COMPLETED',
    });
  } catch (err: any) {
    console.error('[queue.completeTicket] error', err);

    // Handle specific validation errors
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    if (err.message && err.message.includes('IN_PROGRESS')) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/queue/ticket/:ticketId/position
 * Get the position of a CONFIRMED appointment in the queue
 * Validation: Only CONFIRMED appointments have a queue position
 */
export async function getPosition(req: Request, res: Response) {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    const result = await service.getAppointmentPosition(ticketId);

    if (!result) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const response: any = {
      appointmentId: result.appointment.id,
      position: result.position,
      status: result.appointment.status,
      startAt: result.appointment.startAt,
    };

    // Add message if position is 0
    if ('message' in result) {
      response.message = result.message;
    }

    return res.json(response);
  } catch (err: any) {
    console.error('[queue.getPosition] error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/queue/me
 * List all appointments for the authenticated user
 */
export async function listMyTickets(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const appointments = await service.getAppointmentsForUser(
      user.id,
      user.role
    );

    return res.json({
      appointments,
      count: appointments.length,
    });
  } catch (err: any) {
    console.error('[queue.listMyTickets] error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/queue/ticket/:ticketId/no-show
 * Mark an appointment as NO_SHOW (patient didn't show up)
 * Only doctors can mark appointments as no-show
 */
export async function markNoShow(req: Request, res: Response) {
  try {
    const { ticketId } = req.params;
    const user = req.user;

    if (!ticketId) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    const updated = await service.markNoShow(ticketId, user?.id ?? '');

    return res.json({
      appointmentId: updated.id,
      status: updated.status,
      message: 'Appointment marked as NO_SHOW',
    });
  } catch (err: any) {
    console.error('[queue.markNoShow] error', err);

    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    if (
      err.message &&
      (err.message.includes('cancelled') || err.message.includes('completed'))
    ) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
