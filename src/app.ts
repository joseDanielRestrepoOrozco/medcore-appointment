import express from 'express';
import cors from 'cors';
import appointmentsRouter from './routes/appointments.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/appointments', appointmentsRouter);

app.get('/', (_req, res) => {
  res.json({ service: 'medcore-appointment', status: 'ok' });
});

export default app;
