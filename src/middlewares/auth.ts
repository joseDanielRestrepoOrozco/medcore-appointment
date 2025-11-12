import { type NextFunction, type Request, type Response } from 'express';
import { AUTH_SERVICE_URL } from '../libs/config';

/**
 * Middleware para validar roles permitidos (consulta al servicio AUTH)
 */
export const requireRoles = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const response = await fetch(
        `${AUTH_SERVICE_URL}/api/v1/auth/verify-token?allowedRoles=${allowedRoles.join(',')}`,
        {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'auth error' }));
        res.status(response.status).json(errorData);
        return;
      }

      const data = await response.json();
      // attach user to request for downstream handlers
      (req as any).user = data.user;
      next();
    } catch (error) {
      console.error('[requireRoles] Error al conectar con el servicio de autenticación:', error);
      res.status(503).json({ error: 'Servicio no disponible' });
    }
  };
};

export const authenticateUser = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No token provided' });
      const response = await fetch(`${AUTH_SERVICE_URL}/api/v1/auth/authenticate`, {
        method: 'GET',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'auth error' }));
        return res.status(response.status).json(err);
      }
      const data = await response.json();
      (req as any).user = data.user;
      next();
    } catch (error) {
      console.error('[authenticateUser] auth service error', error);
      res.status(503).json({ error: 'Servicio no disponible' });
    }
  };
};
