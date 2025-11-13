import { Router } from 'express';
import * as controller from '../controllers/appointments.controller.js';
import { requireRoles, authenticateUser } from '../middlewares/auth.js';

const router = Router();

// Crear cita
router.post('/', controller.createAppointment);

// Listar todas las citas (paginación/filtrado simple)
router.get('/', controller.listAppointments);

// Obtener disponibilidad para un doctor en una fecha (YYYY-MM-DD)
router.get('/disponibilidad', controller.getAvailability);

// Obtener cita por id (requiere autenticación)
router.get('/:id', authenticateUser(), controller.getAppointmentById);

// Reprogramar usando PUT /:id (alias a reprogram) (requiere autenticación)
router.put('/:id', authenticateUser(), controller.reprogramAppointment);

// Borrar / cancelar cita usando DELETE (alias a cancel) (requiere autenticación)
router.delete('/:id', authenticateUser(), controller.deleteAppointment);

// Plantillas y excepciones
router.post('/templates', controller.createTemplate);
router.post('/exceptions', controller.createException);

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
