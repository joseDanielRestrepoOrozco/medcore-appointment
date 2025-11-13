import { Router } from 'express';
import * as controller from '../controllers/appointments.controller.js';
import { requireRoles, authenticateUser } from '../middlewares/auth.js';

const router = Router();

// Crear cita
router.post('/', controller.createAppointment);

// Listar todas las citas (paginación/filtrado simple)
router.get('/', requireRoles(['ADMINISTRADOR']), controller.listAppointments);

// Obtener disponibilidad para un doctor en una fecha (YYYY-MM-DD)
router.get('/disponibilidad', controller.getAvailability);

router.get('/me', authenticateUser(), controller.getMyAppointments);

// ============= SCHEDULE TEMPLATES (Doctor's availability) =============
// IMPORTANT: These routes must come BEFORE /:id to avoid matching "templates" as an ID

// Get doctor's own templates (requires authentication as MEDICO)
router.get('/templates', requireRoles(['MEDICO']), controller.getMyTemplates);

// Create a new template (requires authentication as MEDICO)
router.post('/templates', requireRoles(['MEDICO']), controller.createTemplate);

// Update a template (requires authentication as MEDICO)
router.put(
  '/templates/:id',
  requireRoles(['MEDICO']),
  controller.updateTemplate
);

// Delete a template (requires authentication as MEDICO)
router.delete(
  '/templates/:id',
  requireRoles(['MEDICO']),
  controller.deleteTemplate
);

// ============= SCHEDULE EXCEPTIONS =============

// Create exception (block/special hours for a specific date)
router.post('/exceptions', controller.createException);

// ============= APPOINTMENT CRUD BY ID =============
// IMPORTANT: These routes with /:id must come AFTER specific routes like /templates

// Obtener cita por id (requiere autenticación)
router.get('/:id', authenticateUser(), controller.getAppointmentById);

// Reprogramar usando PUT /:id (alias a reprogram) (requiere autenticación)
router.put('/:id', authenticateUser(), controller.reprogramAppointment);

// Borrar / cancelar cita usando DELETE (alias a cancel) (requiere autenticación)
router.delete('/:id', authenticateUser(), controller.deleteAppointment);

// Cambiar estado de una cita (requiere autenticación)
// Cancelar una cita (>=4h antes) (requiere autenticación)
router.patch('/:id/cancel', authenticateUser(), controller.cancelAppointment);

// Reprogramar una cita (body: { newStartAt }) (requiere autenticación)
router.patch(
  '/:id/reprogram',
  authenticateUser(),
  controller.reprogramAppointment
);

// Acciones rápidas: confirmar, completar, marcar no-show
router.patch(
  '/:id/confirm',
  requireRoles(['PACIENTE']),
  controller.confirmAppointment
);

// POST aliases (semántica solicitada)
router.post('/:id/confirm', controller.confirmAppointment);

export default router;
