# Validaciones de Seguridad - Medcore Appointments

## Descripción

Este documento describe las validaciones de seguridad implementadas para garantizar que los usuarios solo puedan acceder y modificar las citas que les corresponden.

## Reglas de Acceso

### 1. **Consulta de Citas**

Para consultar una cita específica (`GET /api/v1/appointments/:id`), el usuario debe cumplir una de las siguientes condiciones:

- **Es el paciente** de la cita (su ID coincide con `appointment.patientId`)
- **Es el médico** de la cita (su ID coincide con `appointment.doctorId`)
- **Es un administrador** (tiene rol `ADMIN`)

### 2. **Modificación de Citas**

Las siguientes operaciones también requieren las mismas validaciones de acceso:

- **Cancelar cita** (`PATCH /api/v1/appointments/:id/cancel` o `DELETE /api/v1/appointments/:id`)
- **Reprogramar cita** (`PATCH /api/v1/appointments/:id/reprogram` o `PUT /api/v1/appointments/:id`)
- **Cambiar estado** (`PATCH /api/v1/appointments/:id/state`)
- **Completar cita** (`PATCH /api/v1/appointments/:id/complete` o `POST /api/v1/appointments/:id/complete`)
- **Marcar como no asistió** (`PATCH /api/v1/appointments/:id/no-show` o `POST /api/v1/appointments/:id/mark-no-show`)
- **Confirmar cita** (`PATCH /api/v1/appointments/:id/confirm` o `POST /api/v1/appointments/:id/confirm`)

## Implementación Técnica

### Función Helper: `checkAppointmentAccess`

```typescript
async function checkAppointmentAccess(
  appointmentId: string,
  user?: UserPayload
): Promise<void>;
```

Esta función centraliza la lógica de validación de acceso:

1. **Verifica autenticación**: Si no hay usuario autenticado, lanza error `Authentication required`
2. **Permite acceso total a ADMIN**: Si el usuario tiene rol `ADMIN`, se permite el acceso
3. **Valida existencia**: Verifica que la cita existe
4. **Verifica propiedad**: Comprueba que el usuario sea el paciente O el médico de la cita
5. **Deniega acceso**: Si no cumple ninguna condición, lanza error `Access denied`

### Middleware de Autenticación

Se utiliza el middleware `authenticateUser()` en las rutas que requieren validación de acceso:

```typescript
router.get('/:id', authenticateUser(), controller.getAppointmentById);
router.put('/:id', authenticateUser(), controller.reprogramAppointment);
router.delete('/:id', authenticateUser(), controller.deleteAppointment);
// ... etc
```

### Manejo de Errores

Los controladores manejan los errores de seguridad con códigos HTTP apropiados:

- **403 Forbidden**: Cuando el usuario no tiene acceso a la cita
- **401 Unauthorized**: Cuando no hay autenticación
- **404 Not Found**: Cuando la cita no existe
- **400 Bad Request**: Para otros errores de validación

## Ejemplo de Flujo

### Escenario 1: Paciente consulta su propia cita ✅

```
Usuario: paciente123 (rol: PACIENTE)
Cita: { id: "cita1", patientId: "paciente123", doctorId: "doctor456" }
Resultado: ACCESO PERMITIDO
```

### Escenario 2: Médico consulta cita de su paciente ✅

```
Usuario: doctor456 (rol: MEDICO)
Cita: { id: "cita1", patientId: "paciente123", doctorId: "doctor456" }
Resultado: ACCESO PERMITIDO
```

### Escenario 3: Administrador consulta cualquier cita ✅

```
Usuario: admin789 (rol: ADMIN)
Cita: { id: "cita1", patientId: "paciente123", doctorId: "doctor456" }
Resultado: ACCESO PERMITIDO
```

### Escenario 4: Usuario intenta consultar cita de otro ❌

```
Usuario: paciente999 (rol: PACIENTE)
Cita: { id: "cita1", patientId: "paciente123", doctorId: "doctor456" }
Resultado: ERROR 403 - "Access denied: you do not have permission to access this appointment"
```

## Endpoints sin Validación Específica

Los siguientes endpoints NO requieren validación de acceso individual:

- **Crear cita** (`POST /api/v1/appointments`)
- **Listar citas** (`GET /api/v1/appointments`)
- **Obtener disponibilidad** (`GET /api/v1/appointments/disponibilidad`)
- **Crear plantilla** (`POST /api/v1/appointments/templates`)
- **Crear excepción** (`POST /api/v1/appointments/exceptions`)

> **Nota**: Estos endpoints pueden requerir autenticación pero no validan el acceso a citas específicas.

## Pruebas Recomendadas

Para validar la implementación, se recomienda probar:

1. ✅ Paciente accede a su propia cita
2. ✅ Médico accede a cita de su paciente
3. ✅ Admin accede a cualquier cita
4. ❌ Paciente intenta acceder a cita de otro paciente
5. ❌ Médico intenta acceder a cita de otro médico
6. ❌ Usuario sin autenticación intenta acceder a una cita
7. ✅ Paciente cancela/reprograma su propia cita
8. ✅ Médico completa/marca no-show en cita de su paciente

## Consideraciones de Seguridad

- **Autenticación requerida**: Todas las operaciones sobre citas específicas requieren token JWT válido
- **Validación a nivel de servicio**: La validación se hace en la capa de servicio, no solo en controladores
- **Mensajes de error seguros**: No se revelan detalles sobre la existencia de citas a usuarios no autorizados
- **Roles centralizados**: La validación de roles se hace a través del servicio AUTH
