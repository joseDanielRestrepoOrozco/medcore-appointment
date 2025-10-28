import express from 'express';
import cors from 'cors';

// segun la documentacion de prisma ahora se debe importar asi
// NO importart directamente desde '@prisma/client'
import { PrismaClient } from './generated/prisma/client.js';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cors());

const ejemploAppointment = {
  patientId: 'patient-123',
  doctorId: 'doctor-456',
  appointmentAt: new Date().toISOString(),
  reason: 'Regular check-up',
};

app.post('/appointments', async (_req, res) => {
  try {
    const newAppointment = await prisma.appointment.create({
      data: ejemploAppointment,
    });
    res.status(201).json(newAppointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    if (error instanceof Error) {
      res.status(500).json({
        error: 'Error creating appointment',
        details: error.message,
      });
    }
  }
});

app.get('/', async (_req, res) => {
  const appointments = await prisma.appointment.findMany();
  res.send(appointments);
});

export default app;
