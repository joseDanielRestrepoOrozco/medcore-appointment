import { Router } from 'express';
import * as controller from '../controllers/appointments.controller';

const router = Router();

// Crear cita
router.post('/', controller.createAppointment);

// Obtener disponibilidad para un doctor en una fecha (YYYY-MM-DD)
router.get('/disponibilidad', controller.getAvailability);

// Obtener cita por id
router.get('/:id', controller.getAppointmentById);

// Plantillas y excepciones
router.post('/templates', controller.createTemplate);
router.post('/exceptions', controller.createException);

// Cambiar estado de una cita
router.patch('/:id/state', controller.updateAppointmentState);

export default router;
