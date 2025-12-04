import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MedCore - Appointments API',
      version: '1.0.0',
      description: 'Sistema de gestión de citas médicas con workflow clínico',
      contact: {
        name: 'MedCore Team',
        email: 'support@medcore.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3003/api/v1',
        description: 'Servidor de desarrollo',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido del servicio de autenticación',
        },
      },
      schemas: {
        Appointment: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            patientId: { type: 'string', example: '507f1f77bcf86cd799439012' },
            doctorId: { type: 'string', example: '507f1f77bcf86cd799439013' },
            startAt: { type: 'string', format: 'date-time', example: '2025-12-02T10:00:00Z' },
            endAt: { type: 'string', format: 'date-time', example: '2025-12-02T10:30:00Z' },
            status: {
              type: 'string',
              enum: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
              example: 'CONFIRMED',
            },
            reason: { type: 'string', example: 'Consulta general' },
            notes: { type: 'string', example: 'Paciente presenta dolor de cabeza' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        QueueStatus: {
          type: 'object',
          properties: {
            doctorId: { type: 'string', example: '507f1f77bcf86cd799439013' },
            isPaused: { type: 'boolean', example: false },
            queueSize: { type: 'integer', example: 5 },
            currentPatient: {
              oneOf: [
                { $ref: '#/components/schemas/Appointment' },
                { type: 'null' },
              ],
            },
            waitingPatients: {
              type: 'array',
              items: { $ref: '#/components/schemas/Appointment' },
            },
          },
        },
        ConfirmedAppointmentsResponse: {
          type: 'object',
          properties: {
            doctorId: { type: 'string', example: '507f1f77bcf86cd799439013' },
            appointments: {
              type: 'array',
              items: { $ref: '#/components/schemas/Appointment' },
            },
            total: { type: 'integer', example: 5 },
          },
        },
        DoctorHistoryResponse: {
          type: 'object',
          properties: {
            doctorId: { type: 'string', example: '507f1f77bcf86cd799439013' },
            appointments: {
              type: 'array',
              items: { $ref: '#/components/schemas/Appointment' },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 20 },
                total: { type: 'integer', example: 45 },
                totalPages: { type: 'integer', example: 3 },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Mensaje de error' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MedCore Appointments API',
  }));

  app.get('/api/v1/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
