import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || '3003';
export const DATABASE_URL = process.env.DATABASE_URL || '';
export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'America/Bogota';

// URL del microservicio de users (para validar doctor/paciente). Ajustar según despliegue.
export const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || process.env.USERS_URL || 'http://localhost:3002';

// Token compartido para llamadas internas entre microservicios (para /internal endpoints)
export const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// Redis (opcional, para cola y locks)
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Google Calendar: path al JSON del service account o credenciales en base64
export const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

export const EMAIL_ENABLED = String(process.env.EMAIL_ENABLED || 'false') === 'true';

export default {
  PORT,
  DATABASE_URL,
  DEFAULT_TIMEZONE,
  USERS_SERVICE_URL,
  INTERNAL_SERVICE_TOKEN,
  REDIS_URL,
  GOOGLE_SERVICE_ACCOUNT_JSON,
  EMAIL_ENABLED,
};

