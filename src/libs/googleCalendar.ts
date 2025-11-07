// Cliente de Google Calendar con fallback.
import { google } from 'googleapis';
import fs from 'fs';

// Soporta dos formas de credenciales:
// - GOOGLE_SERVICE_ACCOUNT_JSON (base64 con contenido del JSON)
// - GOOGLE_SERVICE_ACCOUNT_FILE (ruta al JSON en disco)
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const SERVICE_ACCOUNT_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '';
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || '';

let authClient: any = null;
let calendarApi: any = null;

function loadKeyFromFile(path: string) {
  try {
    const content = fs.readFileSync(path, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('googleCalendar: failed to read service account file', e);
    return null;
  }
}

function initIfNeeded() {
  if (authClient && calendarApi) return;
  if ((!SERVICE_ACCOUNT_JSON && !SERVICE_ACCOUNT_FILE) || !CALENDAR_ID) {
    console.warn('googleCalendar: no service account or calendar id configured; running in noop mode');
    return;
  }
  try {
    let key: any = null;
    if (SERVICE_ACCOUNT_JSON) {
      key = JSON.parse(Buffer.from(SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'));
    } else if (SERVICE_ACCOUNT_FILE) {
      key = loadKeyFromFile(SERVICE_ACCOUNT_FILE);
    }
    if (!key) {
      console.warn('googleCalendar: no valid service account key available');
      return;
    }
    authClient = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    } as any);
    calendarApi = google.calendar({ version: 'v3', auth: authClient });
  } catch (e) {
    console.error('googleCalendar: failed to init client', e);
  }
}

export async function createEvent(appointment: any) {
  initIfNeeded();
  if (!calendarApi) return { id: `mock-${appointment.id}` };
  const event = {
    summary: `Cita: ${appointment.reason || appointment.id}`,
    description: `Paciente: ${appointment.patientId} - Doctor: ${appointment.doctorId}`,
    start: { dateTime: appointment.startAt.toISOString() },
    end: { dateTime: appointment.endAt.toISOString() },
  } as any;
  const res = await calendarApi.events.insert({ calendarId: CALENDAR_ID, requestBody: event });
  return res.data;
}

export async function updateEvent(eventId: string, appointment: any) {
  initIfNeeded();
  if (!calendarApi) return { id: eventId };
  const event = {
    summary: `Cita: ${appointment.reason || appointment.id}`,
    description: `Paciente: ${appointment.patientId} - Doctor: ${appointment.doctorId}`,
    start: { dateTime: appointment.startAt.toISOString() },
    end: { dateTime: appointment.endAt.toISOString() },
  } as any;
  const res = await calendarApi.events.update({ calendarId: CALENDAR_ID, eventId, requestBody: event });
  return res.data;
}

export async function deleteEvent(eventId: string) {
  initIfNeeded();
  if (!calendarApi) return { id: eventId };
  await calendarApi.events.delete({ calendarId: CALENDAR_ID, eventId });
  return { id: eventId };
}

export default { createEvent, updateEvent, deleteEvent };
