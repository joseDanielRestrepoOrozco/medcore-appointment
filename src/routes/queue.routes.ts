import { Router } from 'express';
import * as controller from '../controllers/queue.controller.js';
import { requireRoles } from '../middlewares/auth.js';

const router = Router();

// Patient joins queue
router.get('/join', requireRoles(['MEDICO']), controller.join);

// Doctor views current ticket
router.get('/current', requireRoles(['MEDICO']), controller.getCurrent);

// Doctor calls next
router.post('/call-next', requireRoles(['MEDICO']), controller.callNext);

// Doctor completes ticket
router.put(
  '/ticket/:ticketId/complete',
  requireRoles(['MEDICO']),
  controller.completeTicket
);

// Get position (both roles but authorization enforced in controller)
router.get(
  '/ticket/:ticketId/position',
  requireRoles(['PACIENTE', 'MEDICO']),
  controller.getPosition
);

// Helper: list tickets for authenticated user
router.get(
  '/me',
  requireRoles(['PACIENTE', 'MEDICO']),
  controller.listMyTickets
);

// Mark appointment as NO_SHOW
router.patch(
  '/ticket/:ticketId/no-show',
  requireRoles(['MEDICO']),
  controller.markNoShow
);

// Get doctor's appointments by date
router.get(
  '/my-appointments',
  requireRoles(['MEDICO']),
  controller.getMyAppointmentsByDate
);

export default router;
