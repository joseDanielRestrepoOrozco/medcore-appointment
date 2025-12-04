import { Router } from "express";
import * as controller from "../controllers/queue.controller.js";
import { requireRoles } from "../middlewares/auth.js";

const router = Router();

// Patient joins queue
router.get("/join", requireRoles(["MEDICO"]), controller.join);

// Debug endpoint
router.get("/debug", requireRoles(["MEDICO"]), controller.debugQueue);

// Doctor views current ticket
/**
 * @openapi
 * /queue/doctor/{doctorId}/current:
 *   get:
 *     tags: [Clinical Workflow]
 *     summary: Obtener paciente actual siendo atendido
 *     description: Retorna el estado completo de la cola del doctor incluyendo el paciente actual (IN_PROGRESS) y pacientes en espera
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del doctor
 *     responses:
 *       200:
 *         description: Estado de la cola del doctor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueueStatus'
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/current", requireRoles(["MEDICO"]), controller.getCurrent);

// Doctor calls next
router.post("/call-next", requireRoles(["MEDICO"]), controller.callNext);

// Doctor completes ticket
router.put(
  "/ticket/:ticketId/complete",
  requireRoles(["MEDICO"]),
  controller.completeTicket
);

// Get position (both roles but authorization enforced in controller)
router.get(
  "/ticket/:ticketId/position",
  requireRoles(["PACIENTE", "MEDICO"]),
  controller.getPosition
);

// Helper: list tickets for authenticated user
router.get(
  "/me",
  requireRoles(["PACIENTE", "MEDICO"]),
  controller.listMyTickets
);

// Mark appointment as NO_SHOW
router.patch(
  "/ticket/:ticketId/no-show",
  requireRoles(["MEDICO"]),
  controller.markNoShow
);

router.put(
  "/doctor/:doctorId/pause",
  requireRoles(["MEDICO", "ADMINISTRADOR"]),
  controller.togglePause
);

router.get(
  "/doctor/:doctorId/pause",
  requireRoles(["MEDICO", "ADMINISTRADOR"]),
  controller.getPauseStatus
);

// Get confirmed appointments (waiting queue) for a doctor
/**
 * @openapi
 * /queue/doctor/{doctorId}/confirmed:
 *   get:
 *     tags: [Clinical Workflow]
 *     summary: Listar citas confirmadas del doctor (Cola de espera)
 *     description: Obtiene todas las citas CONFIRMADAS de un doctor ordenadas por hora de inicio
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del doctor
 *     responses:
 *       200:
 *         description: Lista de citas confirmadas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConfirmedAppointmentsResponse'
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/doctor/:doctorId/confirmed",
  requireRoles(["MEDICO", "ADMINISTRADOR"]),
  controller.getConfirmedAppointments
);

// Get appointment history for a doctor
/**
 * @openapi
 * /queue/doctor/{doctorId}/history:
 *   get:
 *     tags: [Clinical Workflow]
 *     summary: Historial de pacientes atendidos por el doctor
 *     description: Obtiene el historial de citas COMPLETADAS y NO_SHOW con paginación y filtros de fecha
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del doctor
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Cantidad de resultados por página
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha de inicio para filtrar (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha de fin para filtrar (ISO 8601)
 *     responses:
 *       200:
 *         description: Historial de citas con paginación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DoctorHistoryResponse'
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/doctor/:doctorId/history",
  requireRoles(["MEDICO", "ADMINISTRADOR"]),
  controller.getDoctorHistory
);

// Get doctor's appointments by date
router.get(
  "/my-appointments",
  requireRoles(["MEDICO"]),
  controller.getMyAppointmentsByDate
);

export default router;
