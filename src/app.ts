import express from 'express';
import cors from 'cors';
import appointmentsRouter from './routes/appointments.routes';
import queueRouter from './routes/queue.routes';

const app = express();

app.use(cors());
app.use(express.json());

// Simple request logger to help diagnose incoming paths (development only)
app.use((req, _res, next) => {
  // eslint-disable-next-line no-console
  console.log(`[req] ${req.method} ${req.originalUrl}`);
  next();
});

// Mount appointments router at the canonical service prefix only.
// The API Gateway is responsible for prefix rewriting. Keeping a single prefix
// preserves a clean separation of concerns and a predictable routing surface.
app.use('/api/appointments', appointmentsRouter);
// Queue (waiting list) endpoints
app.use('/api/queue', queueRouter);

app.get('/', (_req, res) => {
  res.json({ service: 'medcore-appointment', status: 'ok' });
});

export default app;
