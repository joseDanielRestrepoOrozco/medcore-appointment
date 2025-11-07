import { Router } from 'express';
import * as controller from '../controllers/appointments.controller';

const router = Router();

// Crear cita
router.post('/', controller.createAppointment);

// Listar todas las citas (paginación/filtrado simple)
router.get('/', controller.listAppointments);

// Obtener disponibilidad para un doctor en una fecha (YYYY-MM-DD)
router.get('/disponibilidad', controller.getAvailability);

// Obtener cita por id
router.get('/:id', controller.getAppointmentById);

// Reprogramar usando PUT /:id (alias a reprogram)
router.put('/:id', controller.reprogramAppointment);

// Borrar / cancelar cita usando DELETE (alias a cancel)
router.delete('/:id', controller.deleteAppointment);

// Plantillas y excepciones
router.post('/templates', controller.createTemplate);
router.post('/exceptions', controller.createException);

// Cambiar estado de una cita
router.patch('/:id/state', controller.updateAppointmentState);

// Cancelar una cita (>=4h antes)
router.patch('/:id/cancel', controller.cancelAppointment);

// Reprogramar una cita (body: { newStartAt })
router.patch('/:id/reprogram', controller.reprogramAppointment);

// Acciones rápidas: confirmar, completar, marcar no-show
router.patch('/:id/confirm', controller.confirmAppointment);
router.patch('/:id/complete', controller.completeAppointment);
router.patch('/:id/no-show', controller.markNoShow);

// POST aliases (semántica solicitada)
router.post('/:id/confirm', controller.confirmAppointment);
router.post('/:id/complete', controller.completeAppointment);
router.post('/:id/mark-no-show', controller.markNoShow);

export default router;
