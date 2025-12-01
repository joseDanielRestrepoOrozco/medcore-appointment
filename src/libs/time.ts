import { DateTime } from 'luxon';
import { DEFAULT_TIMEZONE } from './config.js';

const ZONE = DEFAULT_TIMEZONE || 'America/Bogota';

export function toZoneISO(val: any) {
  if (!val) return val;
  if (val instanceof Date) return DateTime.fromJSDate(val).setZone(ZONE).toISO();
  const dt = DateTime.fromISO(String(val));
  if (!dt.isValid) return val;
  return dt.setZone(ZONE).toISO();
}

export function convertAppointmentToLocal(appt: any) {
  if (!appt) return appt;
  return {
    ...appt,
    startAt: toZoneISO((appt as any).startAt),
    endAt: toZoneISO((appt as any).endAt),
    createdAt: toZoneISO((appt as any).createdAt),
    updatedAt: toZoneISO((appt as any).updatedAt),
    startAtLocal: (appt as any).startAtLocal || toZoneISO((appt as any).startAt),
    endAtLocal: (appt as any).endAtLocal || toZoneISO((appt as any).endAt),
  } as any;
}
