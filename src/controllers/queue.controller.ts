import { type Request, type Response } from "express";
import * as service from "../services/queue.service.js";

/**
 * POST /api/queue/join
 * Get the full queue for the authenticated doctor
 */
export async function join(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const result = await service.join(user.id);
    return res.status(200).json({
      queue: result.queue,
      total: result.total,
    });
  } catch (err: any) {
    console.error("[queue.join] error", err);
    return res
      .status(400)
      .json({ error: err.message || "Could not get queue" });
  }
}

/**
 * GET /api/queue/doctor/:doctorId/current
 * Get the current appointment being attended by a doctor
 */
export async function getCurrent(req: Request, res: Response) {
  try {
    const user = req.user;

    const result = await service.getCurrentForDoctor(user?.id ?? "");

    return res.json({
      doctorId: result.doctorId,
      isPaused: result.isPaused,
      queueSize: result.queueSize,
      currentPatient: result.currentPatient,
      waitingPatients: result.waitingPatients,
    });
  } catch (err: any) {
    console.error("[queue.getCurrent] error", err);
    return res.status(500).json({ error: "Internal server error" });
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

    const result = await service.callNext(user?.id ?? "");

    if (!result) {
      return res
        .status(404)
        .json({ error: "No confirmed appointments waiting in queue" });
    }

    return res.json({
      appointment: result.appointment,
      waitingCount: result.waiting,
    });
  } catch (err: any) {
    console.error("[queue.callNext] error", err);

    // Handle doctor paused error
    if (err.message === "DOCTOR_PAUSED") {
      return res.status(400).json({
        error: "El médico está en pausa. No puede llamar pacientes",
        isPaused: true,
      });
    }

    // Handle specific error for already in progress
    if (
      err.message &&
      err.message.includes("already an appointment in progress")
    ) {
      return res.status(409).json({ error: err.message });
    }

    return res.status(500).json({ error: "Internal server error" });
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
      return res.status(400).json({ error: "Appointment ID is required" });
    }

    const ok = await service.completeAppointment(ticketId);

    if (!ok) {
      return res.status(400).json({
        error: "Failed to complete appointment",
      });
    }

    return res.json({
      appointmentId: ticketId,
      status: "COMPLETED",
    });
  } catch (err: any) {
    console.error("[queue.completeTicket] error", err);

    // Handle specific validation errors
    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }

    if (err.message && err.message.includes("IN_PROGRESS")) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: "Internal server error" });
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
      return res.status(400).json({ error: "Appointment ID is required" });
    }

    const result = await service.getAppointmentPosition(ticketId);

    if (!result) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const response: any = {
      appointmentId: result.appointment.id,
      position: result.position,
      status: result.appointment.status,
      startAt: result.appointment.startAt,
    };

    // Add message if position is 0
    if ("message" in result) {
      response.message = result.message;
    }

    return res.json(response);
  } catch (err: any) {
    console.error("[queue.getPosition] error", err);
    return res.status(500).json({ error: "Internal server error" });
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
      return res.status(401).json({ error: "Not authenticated" });
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
    console.error("[queue.listMyTickets] error", err);
    return res.status(500).json({ error: "Internal server error" });
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
      return res.status(400).json({ error: "Appointment ID is required" });
    }

    const updated = await service.markNoShow(ticketId, user?.id ?? "");

    return res.json({
      appointmentId: updated.id,
      status: updated.status,
      message: "Appointment marked as NO_SHOW",
    });
  } catch (err: any) {
    console.error("[queue.markNoShow] error", err);

    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }

    if (
      err.message &&
      (err.message.includes("cancelled") || err.message.includes("completed"))
    ) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/queue/my-appointments?date=YYYY-MM-DD
 * Get all appointments for the authenticated doctor on a specific date
 * Query parameter: date (required) - Format: YYYY-MM-DD
 */
export async function getMyAppointmentsByDate(req: Request, res: Response) {
  try {
    const user = req.user;
    const { date } = req.query;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!date || typeof date !== "string") {
      return res.status(400).json({
        error: "Date query parameter is required (format: YYYY-MM-DD)",
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD (e.g., 2025-11-12)",
      });
    }

    const appointments = await service.getAppointmentsByDate(user.id, date);

    return res.json({
      date,
      appointments,
      count: appointments.length,
    });
  } catch (err: any) {
    console.error("[queue.getMyAppointmentsByDate] error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function togglePause(req: Request, res: Response) {
  try {
    const { doctorId } = req.params;
    const { paused } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "No estas autenticado" });
    }

    if (!doctorId) {
      return res.status(400).json({ error: "El ID del Doctor es necesario" });
    }

    if (user.role !== "ADMINISTRADOR" && user.id !== doctorId) {
      return res.status(403).json({
        error: "Acceso denegado: solo puede pausar su propia cola",
      });
    }

    if (typeof paused !== "boolean") {
      return res.status(400).json({
        error: 'El campo "paused" debe ser un valor booleano (verdadero/falso)',
      });
    }

    const status = await service.toggleDoctorPause(doctorId, paused);

    return res.json({
      message: paused ? "Cola PAUSADA con éxito" : "Cola RETOMADA con éxito",
      doctorId: status.doctorId,
      isPaused: status.isPaused,
      pausedAt: (status as any).pausedAt,
      resumedAt: (status as any).resumedAt,
    });
  } catch (err: any) {
    console.error("[queue.togglePause] error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/queue/debug
 * Debug endpoint to see queue information (REMOVE IN PRODUCTION)
 */
export async function debugQueue(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    console.log("[DEBUG] Doctor ID:", user.id);

    const result = await service.join(user.id);

    return res.json({
      doctorId: user.id,
      queueResult: result,
      message: `Queue has ${result.queue.length} appointments`,
    });
  } catch (err: any) {
    console.error("[queue.debug] error", err);
    return res.status(500).json({ error: err.message || "Debug error" });
  }
}

/**
 * GET /api/queue/doctor/:doctorId/pause
 * Get the pause status for a doctor
 */
export async function getPauseStatus(req: Request, res: Response) {
  try {
    const { doctorId } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "No estas autenticado" });
    }

    if (!doctorId) {
      return res.status(400).json({ error: "El ID del Doctor es necesario" });
    }

    if (user.role !== "ADMINISTRADOR" && user.id !== doctorId) {
      return res.status(403).json({
        error: "Acceso denegado: solo puede ver su propio estado de pausa",
      });
    }

    const status = await service.getDoctorPauseStatus(doctorId);

    return res.json({
      doctorId: status.doctorId,
      isPaused: status.isPaused,
      pausedAt: (status as any).pausedAt,
      resumedAt: (status as any).resumedAt,
    });
  } catch (err: any) {
    console.error("[queue.getPauseStatus] error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/queue/doctor/:doctorId/confirmed
 * Get all confirmed appointments (waiting queue) for a doctor
 */
export async function getConfirmedAppointments(req: Request, res: Response) {
  try {
    const { doctorId } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "No estas autenticado" });
    }

    // Only the doctor or admin can view this
    if (user.role !== "ADMINISTRADOR" && user.id !== doctorId) {
      return res.status(403).json({
        error: "Acceso denegado: solo puede ver sus propias citas confirmadas",
      });
    }

    const result = await service.getConfirmedAppointments(doctorId);

    return res.json({
      doctorId,
      appointments: result.appointments,
      total: result.total,
    });
  } catch (err: any) {
    console.error("[queue.getConfirmedAppointments] error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/queue/doctor/:doctorId/history
 * Get appointment history (COMPLETED and NO_SHOW) for a doctor
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20)
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 */
export async function getDoctorHistory(req: Request, res: Response) {
  try {
    const { doctorId } = req.params;
    const user = req.user;
    const { page, limit, startDate, endDate } = req.query;

    if (!user) {
      return res.status(401).json({ error: "No estas autenticado" });
    }

    // Only the doctor or admin can view history
    if (user.role !== "ADMINISTRADOR" && user.id !== doctorId) {
      return res.status(403).json({
        error: "Acceso denegado: solo puede ver su propio historial",
      });
    }

    const filters: any = {};

    if (page) {
      filters.page = parseInt(page as string);
    }
    if (limit) {
      filters.limit = parseInt(limit as string);
    }
    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }
    if (endDate) {
      filters.endDate = new Date(endDate as string);
    }

    const result = await service.getDoctorHistory(doctorId, filters);

    return res.json({
      doctorId,
      appointments: result.appointments,
      pagination: result.pagination,
    });
  } catch (err: any) {
    console.error("[queue.getDoctorHistory] error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
