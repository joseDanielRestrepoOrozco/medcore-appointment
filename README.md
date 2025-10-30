# medcore-appointment

Microservicio para agendar citas (MedCore).

Run quickstart (desde la carpeta del servicio):

1. Instalar dependencias

```bash
npm install
```

2. Generar Prisma Client (ya generado si ejecutaste `npx prisma generate`)

```bash
npx prisma generate
```

3. Levantar en modo desarrollo

```bash
npm run dev
```

Endpoints principales:

- GET / -> health
- POST /api/appointments -> crear cita
- GET /api/appointments/disponibilidad?doctor_id=...&fecha=YYYY-MM-DD -> slots
- GET /api/appointments/:id -> obtener cita

Notes:

- Timezone: America/Bogota
- Slot length por defecto: 30 minutos
- No autenticación implementada (según requerimiento)
