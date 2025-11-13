import { type NextFunction, type Request, type Response } from 'express';
import { AUTH_SERVICE_URL } from '../libs/config.js';

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

      // Llamar al servicio AUTH para verificar el token
      const response = await fetch(
        `${AUTH_SERVICE_URL}/api/v1/auth/verify-token?allowedRoles=${allowedRoles.join(
          ','
        )}`,
        {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000), // Timeout de 5 segundos
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        res.status(response.status).json(errorData);
        return;
      }

      const data = await response.json();

      req.user = data.user;

      next();
    } catch (error) {
      console.error(
        '[requireRoles] Error al conectar con el servicio de autenticación:',
        error
      );
      res.status(503).json({
        error: 'Servicio no disponible',
        message:
          'El servicio de autenticación no está disponible en este momento. Por favor, intenta más tarde.',
      });
    }
  };
};

export const authenticateUser = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }
      const response = await fetch(
        `${AUTH_SERVICE_URL}/api/v1/auth/authenticate`,
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
        const err = await response
          .json()
          .catch(() => ({ error: 'auth error' }));
        res.status(response.status).json(err);
        return;
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
