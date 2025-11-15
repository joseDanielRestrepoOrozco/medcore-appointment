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
    const user = req.user;
    const payload = req.body;

    // If user is authenticated as a doctor, use their ID
    if (user && user.role === 'MEDICO') {
      payload.doctorId = user.id;
    }

    // Validate doctorId is present
    if (!payload.doctorId) {
      return res.status(400).json({ error: 'doctorId is required' });
    }

    // If user is a doctor, ensure they can only create for themselves
    if (user && user.role === 'MEDICO' && payload.doctorId !== user.id) {
      return res.status(403).json({
        error: 'Access denied: You can only create templates for yourself',
      });
    }

    const tpl = await service.createTemplate(payload);
    return res.status(201).json(tpl);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

/**
 * GET /templates
 * Get all templates for the authenticated doctor
 */
export async function getMyTemplates(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (user.role !== 'MEDICO') {
      return res
        .status(403)
        .json({ error: 'Only doctors can access templates' });
    }

    const templates = await service.getTemplatesByDoctor(user.id);
    return res.json({ templates, count: templates.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /templates/:id
 * Update a template for the authenticated doctor
 */
export async function updateTemplate(req: Request, res: Response) {
  try {
    const user = req.user;
    const { id } = req.params;
    const payload = req.body;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (user.role !== 'MEDICO') {
      return res
        .status(403)
        .json({ error: 'Only doctors can update templates' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    const updated = await service.updateTemplate(id, user.id, payload);
    return res.json(updated);
  } catch (err: any) {
    const statusCode = err.message.includes('Access denied')
      ? 403
      : err.message.includes('not found')
      ? 404
      : 400;
    return res.status(statusCode).json({ error: err.message });
  }
}

/**
 * DELETE /templates/:id
 * Delete a template for the authenticated doctor
 */
export async function deleteTemplate(req: Request, res: Response) {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (user.role !== 'MEDICO') {
      return res
        .status(403)
        .json({ error: 'Only doctors can delete templates' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    await service.deleteTemplate(id, user.id);
    return res.json({ message: 'Template deleted successfully', id });
  } catch (err: any) {
    const statusCode = err.message.includes('Access denied')
      ? 403
      : err.message.includes('not found')
      ? 404
      : 400;
    return res.status(statusCode).json({ error: err.message });
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

// PUT /:id -> alias to reprogramAppointment (keeps same validation)
export const reprogramAppointment = async (req: Request, res: Response) => {
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
    return;
  } catch (err: any) {
    const statusCode =
      err.message === 'Authentication required' ||
      err.message.includes('Access denied')
        ? 403
        : 400;
    res.status(statusCode).json({ error: err.message });
    return;
  }
};

export const getMyAppointments = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const appointments = await service.getAppointmentsByUserId(
      user?.id ?? ''
    );
    res.json(appointments);
  } catch (err: unknown) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Unknown error' });
  }
};

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
