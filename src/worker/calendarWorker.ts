import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { drainInMemoryQueue } from '../libs/queue.js';
import googleCalendar from '../libs/googleCalendar.js';

// Simple in-process worker. If BullMQ/Redis is configured, prefer running a dedicated
// worker process (this file can be started with `npm run worker`). If not, this
// will poll the in-memory queue exported by `libs/queue`.

async function processJob(job: any) {
  try {
    const { type, appointmentId } = job;
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appt) {
      console.warn('calendarWorker: appointment not found', appointmentId);
      return;
    }

    const apptAny = appt as any;
    if (type === 'create') {
      const evt = await googleCalendar.createEvent(apptAny);
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          calendarEventId: evt.id || evt.summary || null,
          calendarSyncStatus: 'SYNCED',
          lastCalendarSync: new Date(),
        } as any,
      });
      console.info('calendarWorker: created event', evt.id);
    } else if (type === 'update') {
      if (apptAny.calendarEventId) {
        await googleCalendar.updateEvent(apptAny.calendarEventId, apptAny);
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            calendarSyncStatus: 'SYNCED',
            lastCalendarSync: new Date(),
          } as any,
        });
        console.info('calendarWorker: updated event', apptAny.calendarEventId);
      } else {
        const evt = await googleCalendar.createEvent(apptAny);
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            calendarEventId: evt.id || null,
            calendarSyncStatus: 'SYNCED',
            lastCalendarSync: new Date(),
          } as any,
        });
        console.info('calendarWorker: created event (fallback)', evt.id);
      }
    } else if (type === 'delete') {
      if (apptAny.calendarEventId) {
        await googleCalendar.deleteEvent(apptAny.calendarEventId);
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            calendarEventId: null,
            calendarSyncStatus: 'SYNCED',
            lastCalendarSync: new Date(),
          } as any,
        });
        console.info('calendarWorker: deleted event', apptAny.calendarEventId);
      }
    }
  } catch (e) {
    console.error('calendarWorker: job failed', e);
    try {
      // Mark appointment as FAILED sync if possible
      if (job && job.appointmentId) {
        await prisma.appointment.update({
          where: { id: job.appointmentId },
          data: {
            calendarSyncStatus: 'FAILED',
            lastCalendarSync: new Date(),
          } as any,
        });
      }
    } catch (e2) {
      // swallow
    }
  }
}

async function run() {
  console.info('calendarWorker: starting');
  // If running with BullMQ+Redis, user should start a separate worker.
  // Here we poll the in-memory queue as a fallback.
  while (true) {
    const jobs = drainInMemoryQueue();
    for (const job of jobs) {
      // eslint-disable-next-line no-await-in-loop
      await processJob(job);
    }
    // sleep 1s
    // eslint-disable-next-line no-await-in-loop
    await new Promise(r => setTimeout(r, 1000));
  }
}

run().catch(e => {
  console.error('calendarWorker: fatal', e);
  process.exit(1);
});
