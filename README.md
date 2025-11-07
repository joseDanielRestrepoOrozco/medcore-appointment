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

## Fase 0 — Preparación e integración con medcore-users, Redis y Google Calendar

Antes de avanzar con cola y sincronización con Google Calendar, configura lo siguiente en tu entorno:

- `USERS_SERVICE_URL` — URL del microservicio de users (por defecto `http://localhost:3002`).
- `REDIS_URL` — URL de Redis para la cola y locks, por ejemplo `redis://localhost:6379`.
- `GOOGLE_SERVICE_ACCOUNT_JSON` — ruta o contenido del JSON de la Service Account que el servicio usará para crear eventos.

## Calendar integration (MVP)

Se añadió un MVP de integración con Google Calendar:

- Variables de entorno nuevas (opcionales):

  - `GOOGLE_SERVICE_ACCOUNT_JSON` — contenido del JSON de la Service Account codificado en base64.
  - `GOOGLE_CALENDAR_ID` — ID del calendario donde crear/actualizar eventos.
  - `REDIS_URL` — si está presente, la cola usará BullMQ; si no, se usará un fallback en memoria (no persistente).

- Cómo arrancar el worker en desarrollo:

```bash
npm install
npm run worker
```

Notas:

- Si no se configuran `GOOGLE_SERVICE_ACCOUNT_JSON` y `GOOGLE_CALENDAR_ID`, la integración funcionará en modo mock y no realizará llamadas a Google.
- Si quieres que implemente un worker basado en BullMQ/Redis (persistente, con retries y métricas), dame permiso y lo implemento en la siguiente iteración.

- Redis: instalar y arrancar Redis local o usar un servicio gestionado. Redis será usado por la cola (BullMQ) y para locks (Redlock).

- Google Calendar: crear una Service Account en Google Cloud con permisos de Calendar; guardar el JSON y poner su ruta en `GOOGLE_SERVICE_ACCOUNT_JSON` o su contenido en base64 en la variable correspondiente.

Cómo validaremos usuarios (doctores/pacientes)

- El servicio de appointments consultará `USERS_SERVICE_URL` (endpoint `GET /api/users/:id`) para validar que un id corresponde a doctor o paciente. Asegúrate que `medcore-users` esté corriendo y exponga ese endpoint.

Archivos nuevos importantes

- `src/libs/config.ts` — centraliza las variables de entorno (USERS_SERVICE_URL, REDIS_URL, DEFAULT_TIMEZONE,...).
- `src/libs/usersClient.ts` — cliente HTTP ligero para validar existencia y rol de usuarios en `medcore-users`.

Siguiente paso

- Si confirmas, en la próxima iteración implemento las validaciones completas y los endpoints de appointments que interactúan con `usersClient` y con Redis para locking/cola.

## Probar con Postman (colección incluida)

En `postman/appointments.postman_collection.json` encontrarás una colección lista para importar. Recomendaciones:

- Crea un Environment en Postman con estas variables:

  - `gateway_url` = `http://localhost:3000`
  - `access_token` = (vacío; se guardará tras el login)
  - `internal_token` = (opcional, sólo para llamadas S2S)
  - `doctor_id`, `patient_id`, `appointment_id` = (rellenar según tus datos)

- Usa la request `Login Admin` para obtener el `access_token` y guardarlo automáticamente.
- Importante: la colección hace requests al API Gateway bajo el path `/api/v1/appointments`. El Gateway debe estar en ejecución y su `prefixRewrite` debe apuntar al servicio `medcore-appointment`.

Requests clave en la colección:

- `Get Availability` => GET `{{gateway_url}}/api/v1/appointments/disponibilidad?doctor_id={{doctor_id}}&fecha=YYYY-MM-DD`
- `Create Appointment` => POST `{{gateway_url}}/api/v1/appointments` (usa `Authorization: Bearer {{access_token}}`)

Si algo devuelve 503 del gateway, comprueba que `medcore-appointment` esté corriendo en `http://localhost:3003`.

Si quieres que exporte la colección actualizada como archivo `.json` listo para descargar desde aquí, dímelo y la adjunto.
