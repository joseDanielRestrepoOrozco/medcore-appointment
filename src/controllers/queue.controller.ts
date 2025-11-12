import { Request, Response } from 'express';
import * as service from '../services/queue.service';
import usersClient from '../libs/usersClient';

export async function join(req: Request, res: Response) {
  try {
    const { doctorId, patientId, metadata } = req.body;
    const user = (req as any).user;
    // Only patients may create/join
    if (!user || String(user.role).toUpperCase() !== 'PACIENTE') {
      return res.status(403).json({ error: 'Only patients can join the queue' });
    }
    // Ensure the authenticated user is the same patient (ownership)
    if (user.id !== patientId) return res.status(403).json({ error: 'Cannot create ticket for another patient' });

    // validate doctor exists
    const ok = await usersClient.checkDoctorExists(doctorId, { Authorization: String(req.get('authorization') || '') }).catch(() => false);
    if (!ok) return res.status(404).json({ error: 'Doctor not found' });

    const result = await service.joinTicket(doctorId, patientId, metadata);
    res.status(201).json({ ticketId: result.ticket.id, position: result.position });
  } catch (err: any) {
    console.error('[queue.join] error', err);
    res.status(400).json({ error: err.message || 'could not join' });
  }
}

export async function getCurrent(req: Request, res: Response) {
  try {
    const { doctorId } = req.params;
    const user = (req as any).user;
    if (!user || String(user.role).toUpperCase() !== 'MEDICO') return res.status(403).json({ error: 'Only doctors allowed' });
    if (user.id !== doctorId) return res.status(403).json({ error: 'Not your queue' });

    const current = await service.getCurrentForDoctor(doctorId);
    res.json({ ticket: current });
  } catch (err: any) {
    console.error('[queue.getCurrent] error', err);
    res.status(500).json({ error: 'internal' });
  }
}

export async function callNext(req: Request, res: Response) {
  try {
    const { doctorId } = req.body;
    const user = (req as any).user;
    if (!user || String(user.role).toUpperCase() !== 'MEDICO') return res.status(403).json({ error: 'Only doctors allowed' });
    if (user.id !== doctorId) return res.status(403).json({ error: 'Not your queue' });

    const result = await service.callNext(doctorId);
    if (!result) return res.status(404).json({ error: 'No waiting tickets' });
    res.json(result);
  } catch (err: any) {
    console.error('[queue.callNext] error', err);
    res.status(500).json({ error: 'internal' });
  }
}

export async function completeTicket(req: Request, res: Response) {
  try {
    const { ticketId } = req.params;
    const user = (req as any).user;
    // Only doctor may complete
    if (!user || String(user.role).toUpperCase() !== 'MEDICO') return res.status(403).json({ error: 'Only doctors allowed' });

    const ok = await service.completeTicket(ticketId);
    if (!ok) return res.status(400).json({ error: 'Ticket not in CALLED state or not found' });
    res.json({ ticketId, status: 'COMPLETED' });
  } catch (err: any) {
    console.error('[queue.completeTicket] error', err);
    res.status(500).json({ error: 'internal' });
  }
}

export async function getPosition(req: Request, res: Response) {
  try {
    const { ticketId } = req.params;
    const user = (req as any).user;
    const pos = await service.getTicketPosition(ticketId);
    if (!pos) return res.status(404).json({ error: 'Ticket not found' });
    // Authorization: patient can only see own ticket; doctor can see tickets for their patients
    if (String(user.role).toUpperCase() === 'PACIENTE' && user.id !== pos.ticket.patientId) return res.status(403).json({ error: 'Forbidden' });
    if (String(user.role).toUpperCase() === 'MEDICO' && user.id !== pos.ticket.doctorId) return res.status(403).json({ error: 'Forbidden' });

    res.json({ ticketId: pos.ticket.id, position: pos.position });
  } catch (err: any) {
    console.error('[queue.getPosition] error', err);
    res.status(500).json({ error: 'internal' });
  }
}

export async function listMyTickets(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const tickets = await service.getTicketsForUser(user.id, user.role);
    res.json({ tickets });
  } catch (err: any) {
    console.error('[queue.listMyTickets] error', err);
    res.status(500).json({ error: 'internal' });
  }
}
