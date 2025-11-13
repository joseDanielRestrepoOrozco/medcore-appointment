// Queue wrapper: intenta usar Redis/BullMQ si REDIS_URL está presente,
// si no, proporciona una cola en memoria (no persistente) para desarrollo.

const REDIS_URL = process.env.REDIS_URL || '';

type CalendarJobPayload = {
  type: 'create' | 'update' | 'delete';
  appointmentId: string;
};

// `add` is the internal function used to enqueue a payload. When Redis is
// configured it will add to BullMQ; otherwise it pushes into an in-memory
// queue. The function signature is simplified to accept only the payload so
// callers don't need to pass a queue name.
let add: ((payload: CalendarJobPayload) => Promise<void>) | undefined;

if (REDIS_URL) {
  // lazy-require to avoid hard dependency crash if not installed
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Queue } = require('bullmq');
    const connection = { connection: { url: REDIS_URL } };
    const calendarQueue = new Queue('calendar-sync', connection);
    add = async (payload: CalendarJobPayload) => {
      await calendarQueue.add('calendar-sync', payload);
    };
    console.info('queue: using BullMQ with REDIS_URL');
  } catch (e) {
    console.warn(
      'queue: REDIS_URL provided but bullmq not installed, falling back to in-memory queue'
    );
  }
}

// Fallback in-memory queue (simple producer-only; worker must be in-process to consume)
const inMemoryQueue: CalendarJobPayload[] = [];
if (!add) {
  add = async (payload: CalendarJobPayload) => {
    inMemoryQueue.push(payload);
    // no-op: worker can import this module and poll `drainInMemoryQueue`
  };
}

export async function enqueueCalendarJob(payload: CalendarJobPayload) {
  if (!add) {
    throw new Error('Queue not initialized');
  }
  return add(payload);
}

// Helper for in-process worker to drain the in-memory queue
export function drainInMemoryQueue() {
  const copy = inMemoryQueue.splice(0, inMemoryQueue.length);
  return copy;
}

export type { CalendarJobPayload };

export default { enqueueCalendarJob, drainInMemoryQueue };
