import { Request, Response } from 'express';
import * as service from '../services/appointments.service';

export async function createAppointment(req: Request, res: Response) {
  try {
    const payload = req.body;
    const result = await service.createAppointment(payload);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error creating appointment' });
  }
}

export async function getAppointmentById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const appt = await service.getAppointmentById(id);
    if (!appt) return res.status(404).json({ error: 'Not found' });
    res.json(appt);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAvailability(req: Request, res: Response) {
  try {
    const { doctor_id, fecha } = req.query as any;
    if (!doctor_id || !fecha) return res.status(400).json({ error: 'doctor_id and fecha are required' });
    const slots = await service.getAvailability(String(doctor_id), String(fecha));
    res.json({ date: fecha, slots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createTemplate(req: Request, res: Response) {
  try {
    const payload = req.body;
    const tpl = await service.createTemplate(payload);
    res.status(201).json(tpl);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function createException(req: Request, res: Response) {
  try {
    const payload = req.body;
    const exc = await service.createException(payload);
    res.status(201).json(exc);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateAppointmentState(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await service.updateAppointmentStatus(id, status);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
