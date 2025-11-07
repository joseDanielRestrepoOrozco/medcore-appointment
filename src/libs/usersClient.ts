import { USERS_SERVICE_URL, INTERNAL_SERVICE_TOKEN } from './config';

type UserResponse = {
  id: string;
  role?: string;
  email?: string;
};

async function fetchFromUsers(path: string, extraHeaders?: Record<string, string>) {
  const url = `${USERS_SERVICE_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {};
  // Prefer internal token for S2S calls, but allow forwarding of Authorization
  if (INTERNAL_SERVICE_TOKEN) headers['x-internal-token'] = INTERNAL_SERVICE_TOKEN;
  if (extraHeaders) Object.assign(headers, extraHeaders);
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`users service ${res.status} ${res.statusText} ${text}`);
    // attach status for callers
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
}

export async function getUserById(id: string, extraHeaders?: Record<string, string>): Promise<UserResponse> {
  // Use the internal endpoint exposed by medcore-users which accepts an internal token
  return fetchFromUsers(`/internal/users/${id}`, extraHeaders) as Promise<UserResponse>;
}

export async function checkDoctorExists(id: string, extraHeaders?: Record<string, string>): Promise<boolean> {
  try {
    const user = await getUserById(id, extraHeaders);
    return user && (user.role === 'MEDICO' || String(user.role).toUpperCase() === 'MEDICO');
  } catch (err: any) {
    if (err.status === 404) return false;
    throw err;
  }
}

export async function checkPatientExists(id: string, extraHeaders?: Record<string, string>): Promise<boolean> {
  try {
    const user = await getUserById(id, extraHeaders);
    return user && (user.role === 'PACIENTE' || String(user.role).toUpperCase() === 'PACIENTE');
  } catch (err: any) {
    if (err.status === 404) return false;
    throw err;
  }
}

export default { getUserById, checkDoctorExists, checkPatientExists };
