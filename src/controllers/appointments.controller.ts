import { type Request, type Response } from 'express';
import * as service from '../services/appointments.service.js';

export async function createAppointment(req: Request, res: Response) {
  try {
    const payload = req.body;

    const authHeader = String(req.get('authorization') || '');
    const result = await service.createAppointment(
      payload,
      authHeader || undefined
    );
    res.status(201).json(result);
  } catch (err: any) {
    res
      .status(400)
      .json({ error: err.message || 'Error creating appointment' });
  }
}

export async function listAppointments(_req: Request, res: Response) {
  try {
    // simple listing; could support pagination/filters via query params
    const items = await service.listAppointments();
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAppointmentById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const appt = await service.getAppointmentById(id, req.user);
    if (!appt) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(appt);
  } catch (err: any) {
    const statusCode =
      err.message === 'Authentication required' ||
      err.message.includes('Access denied')
        ? 403
        : 500;
    res.status(statusCode).json({ error: err.message });
  }
}

export async function deleteAppointment(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const updated = await service.cancelAppointment(id, req.user);
    res.json(updated);
  } catch (err: any) {
    const statusCode =
      err.message === 'Authentication required' ||
      err.message.includes('Access denied')
        ? 403
        : 400;
    res.status(statusCode).json({ error: err.message });
  }
}

export async function getAvailability(req: Request, res: Response) {
  try {
    const { doctor_id, fecha } = req.query as any;
    if (!doctor_id || !fecha) {
      res.status(400).json({ error: 'doctor_id and fecha are required' });
      return;
    }
    const slots = await service.getAvailability(
      String(doctor_id),
      String(fecha)
    );
    res.json({ date: fecha, slots });
    return;
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

export async function cancelAppointment(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const updated = await service.cancelAppointment(id, req.user);
    res.json(updated);
  } catch (err: any) {
    const statusCode =
      err.message === 'Authentication required' ||
      err.message.includes('Access denied')
        ? 403
        : 400;
    res.status(statusCode).json({ error: err.message });
  }
}

export async function reprogramAppointment(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const { newStartAt } = req.body;
    const updated = await service.reprogramAppointment(
      id,
      newStartAt,
      req.user
    );
    res.json(updated);
  } catch (err: any) {
    const statusCode =
      err.message === 'Authentication required' ||
      err.message.includes('Access denied')
        ? 403
        : 400;
    res.status(statusCode).json({ error: err.message });
  }
}

// PUT /:id -> alias to reprogramAppointment (keeps same validation)
export async function reprogramAppointmentByPut(req: Request, res: Response) {
  return reprogramAppointment(req, res);
}

export async function confirmAppointment(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const updated = await service.confirmAppointment(
      id,
      req.user?.id || '',
      req.user
    );
    res.json(updated);
  } catch (err: any) {
    const statusCode =
      err.message === 'Authentication required' ||
      err.message.includes('Access denied')
        ? 403
        : 400;
    res.status(statusCode).json({ error: err.message });
  }
}
