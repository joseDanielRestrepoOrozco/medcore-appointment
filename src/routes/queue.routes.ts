import { Router } from 'express';
import * as controller from '../controllers/queue.controller';
import { requireRoles, authenticateUser } from '../middlewares/auth';

const router = Router();

// Patient joins queue
router.post('/join', requireRoles(['PACIENTE']), controller.join);

// Doctor views current ticket
router.get('/doctor/:doctorId/current', requireRoles(['MEDICO']), controller.getCurrent);

// Doctor calls next
router.post('/call-next', requireRoles(['MEDICO']), controller.callNext);

// Doctor completes ticket
router.put('/ticket/:ticketId/complete', requireRoles(['MEDICO']), controller.completeTicket);

// Get position (both roles but authorization enforced in controller)
router.get('/ticket/:ticketId/position', requireRoles(['PACIENTE','MEDICO']), controller.getPosition);

// Helper: list tickets for authenticated user
router.get('/me', requireRoles(['PACIENTE','MEDICO']), controller.listMyTickets);

export default router;
