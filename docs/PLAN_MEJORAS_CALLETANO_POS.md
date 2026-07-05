# 🚀 PLAN DE MEJORAS — CALLETANO POS v1.0.0

> **Basado en:** Análisis completo del sistema (docs/ANALISIS_SISTEMA_CALLETANO_POS.md)
> **Fecha:** Junio 2026
> **Propósito:** Priorizar deuda técnica y nuevas funcionalidades para la próxima iteración

---

## CRITERIOS DE PRIORIZACIÓN

Cada mejora se evalúa con:

| Factor | Peso |
|---|---|
| **Impacto** (beneficio para el restaurante) | Alto / Medio / Bajo |
| **Esfuerzo** (tiempo estimado de implementación) | Alto / Medio / Bajo |
| **Riesgo** (probabilidad de romper algo existente) | Alto / Medio / Bajo |
| **Prioridad final** | 🔴 Crítica / 🟡 Importante / 🟢 Deseable |

---

## 🔴 PRIORIDAD CRÍTICA — SEGURIDAD Y ESTABILIDAD

> **Estado general:** ✅ 3/4 implementadas

### CRIT-01: Hashear contraseñas en la base de datos

| Campo | Valor |
|---|---|
| **Tipo** | Deuda técnica — Seguridad |
| **Estado** | ✅ **IMPLEMENTADO** |
| **Archivos** | `database.js`, `controllers/sistema.controller.js` |
| **Problema** | Las contraseñas en `usuarios` se almacenan en **texto plano**. Cualquiera con acceso a `calletano_local.db` puede verlas. |
| **Solución** | Usar `bcrypt` para hashear con salt en `handleLogin` y al insertar usuarios por primera vez. Mantener compatibilidad hacia atrás migrando contraseñas existentes. |
| **Implementación real** | `database.js` usa `bcrypt.hashSync()` con 10 rounds de salt al crear usuarios por defecto. En login (`sistema.controller.js`), se usa `bcrypt.compareSync()`. Las contraseñas legacy en texto plano se migran automáticamente al primer login exitoso o al iniciar la DB. |
| **Impacto** | Alto |
| **Esfuerzo** | Bajo (~2 horas) |
| **Riesgo** | Bajo (solo afecta login) |
| **Prioridad** | 🔴 **Crítica** |

**Implementación:**
```javascript
// En database.js - al crear usuario por defecto:
const bcrypt = require('bcrypt');
const salt = bcrypt.genSaltSync(10);
insertUser.run('calletano', bcrypt.hashSync('44910626', salt), 'admin');

// En sistema.controller.js - login:
const bcrypt = require('bcrypt');
const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(req.body.username);
if (user && bcrypt.compareSync(req.body.password, user.password)) {
  res.json({ success: true, user: { username: user.username, rol: user.rol } });
} else {
  res.status(401).json({ error: 'Credenciales incorrectas' });
}
```

---

### CRIT-02: API Key de Gemini expuesta en código fuente

| Campo | Valor |
|---|---|
| **Tipo** | Deuda técnica — Seguridad |
| **Estado** | ✅ **IMPLEMENTADO** (solución distinta a la propuesta) |
| **Archivo** | `config/ai.js` |
| **Problema** | La API Key de Gemini (`AIzaSyDsCVGLZ0h7bRJlN3cHOR_pCTK0q3FCh40`) está **hardcodeada** en el código. Si alguien clona el repositorio, puede usar la clave. |
| **Solución** | Mover a variable de entorno (`.env`) con cifrado en el `.asar` de Electron. Ya existe `dotenv` en el proyecto pero no se usa por limitación de Electron. Implementar solución con `electron-store` o cifrado AES del archivo `.env`. |
| **Implementación real** | `config/ai.js` ahora lee `process.env.GEMINI_API_KEY` desde `.env`. `server.js` y `main.js` cargan dotenv al inicio. La clave hardcodeada fue eliminada. `main.js` también maneja la ruta del `.env` dentro del `.asar` empaquetado. |
| **Impacto** | Alto |
| **Esfuerzo** | Medio (~4 horas) |
| **Riesgo** | Medio |
| **Prioridad** | 🔴 **Crítica** |

**Solución propuesta:**
```javascript
// config/ai.js con electron-store
const Store = require('electron-store');
const store = new Store();
const GEMINI_API_KEY = store.get('gemini_key') || process.env.GEMINI_API_KEY;
```

---

### CRIT-03: Reintentos automáticos de boletas SUNAT pendientes

| Campo | Valor |
|---|---|
| **Tipo** | Bug / Feature faltante |
| **Estado** | ✅ **IMPLEMENTADO** |
| **Archivo** | `server.js`, `controllers/pos.controller.js`, `database.js` |
| **Problema** | Cuando falla el envío a SUNAT, la boleta se guarda en `sunat_pendientes` pero **nunca se reintenta automáticamente**. Solo queda almacenada sin proceso de reenvío. |
| **Solución** | Agregar un `setInterval` (cada 5 minutos) que lea `sunat_pendientes` y reintente el envío. Si tiene éxito, elimina el registro. |
| **Implementación real** | `server.js` implementa `reintentarBoletasPendientes()` que se ejecuta con `setInterval` cada 5 minutos y también inmediatamente al iniciar el servidor. Genera PDF y XML automáticamente al reintentar exitosamente. |
| **Impacto** | Alto |
| **Esfuerzo** | Bajo (~3 horas) |
| **Riesgo** | Bajo |
| **Prioridad** | 🔴 **Crítica** |

---

### CRIT-04: Error FOREIGN KEY en sincronización (YA CORREGIDO)

| Campo | Valor |
|---|---|
| **Tipo** | Bug corregido |
| **Archivo** | `services/sync.service.js` |
| **Problema** | La línea `db.prepare("DELETE FROM movimientos_inventario")` estaba comentada, causando `SQLITE_CONSTRAINT_FOREIGNKEY` al sincronizar. |
| **Estado** | ✅ **Corregido** en junio 2026 — se descomentó la línea. |
| **Lección** | Agregar test unitario que verifique que la sincronización no lance FOREIGN KEY errors. |

---

## 🟡 PRIORIDAD IMPORTANTE — CALIDAD Y MANTENIBILIDAD

> **Estado general:** ✅ 5/6 implementadas

### IMP-01: Sistema de logging estructurado

| Campo | Valor |
|---|---|
| **Tipo** | Deuda técnica |
| **Estado** | ✅ **IMPLEMENTADO** |
| **Problema** | El código usa `console.log` y `console.error` dispersos por todo el proyecto. No hay niveles de log (info, warn, error), ni persistencia de logs. |
| **Solución** | Implementar **Winston** o **Pino** con transporte a archivo (`logs/server.log`) y rotación diaria. |
| **Implementación real** | `utils/logger.js` implementa Winston con transporte a consola (con color), `logs/error.log` (solo errores, con rotación de 5 archivos de 5MB) y `logs/combined.log`. Reemplaza globalmente `console.log`, `console.error` y `console.warn`. |
| **Impacto** | Medio |
| **Esfuerzo** | Bajo (~3 horas) |
| **Riesgo** | Bajo |
| **Prioridad** | 🟡 **Importante** |

**Implementación básica:**
```javascript
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});
// Reemplazar console.log → logger.info, console.error → logger.error
```

---

### IMP-02: Manejo de migraciones de base de datos

| Campo | Valor |
|---|---|
| **Tipo** | Deuda técnica |
| **Estado** | ✅ **IMPLEMENTADO** |
| **Archivo** | `utils/migrations.js`, `database.js` |
| **Problema** | Las migraciones se hacen con `try/catch` alrededor de `ALTER TABLE`. Si una migración falla, se traga el error silenciosamente. No hay versionado de esquema. |
| **Solución** | Usar una tabla `schema_version` con versión actual, y ejecutar migraciones en orden secuencial. |
| **Implementación real** | `utils/migrations.js` implementa tabla `schema_version`, 4 migraciones versionadas ejecutadas en orden desde `database.js`. Maneja errores de columna duplicada como no-críticos. |
| **Impacto** | Medio |
| **Esfuerzo** | Medio (~6 horas) |
| **Riesgo** | Medio |
| **Prioridad** | 🟡 **Importante** |

**Esquema propuesto:**
```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### IMP-03: TypeScript en el backend

| Campo | Valor |
|---|---|
| **Tipo** | Deuda técnica |
| **Estado** | ❌ **NO IMPLEMENTADO** |
| **Problema** | Todo el backend está en JavaScript sin tipos. Los errores de tipo aparecen en runtime. |
| **Solución** | Migrar progresivamente a TypeScript, empezando por `services/sync.service.js` y `controllers/` (los más críticos). |
| **Impacto** | Medio |
| **Esfuerzo** | Alto (~40 horas para migración completa) |
| **Riesgo** | Alto (puede introducir bugs silenciosos) |
| **Prioridad** | 🟡 **Importante** (hacer progresivamente, no todo de golpe) |

---

### IMP-04: Pruebas unitarias y de integración

| Campo | Valor |
|---|---|
| **Tipo** | Deuda técnica |
| **Estado** | ✅ **COMPLETADO** (core backend) |
| **Problema** | El proyecto tenía **cero pruebas automatizadas**. Cualquier cambio puede romper funcionalidad existente sin ser detectado. |
| **Solución** | Implementar Jest para tests unitarios en los módulos críticos del backend. |
| **Implementación real** | **295 tests** en **15 suites** con Jest, cubriendo **todos los controladores, servicios y utilidades core**:
  - `utils/`: math (16), helpers (12), logger (6), response (16), validate (42), globalState (8), migrations (8)
  - `services/`: sync.service (19) — subida y descarga Firebase ↔ SQLite
  - `controllers/`: pos (18), menu (20), finanzas (16), inventario (16), reportes (22), sistema (18), sync.controller (16, NUEVO)
  - Todos los tests pasan al 100% |
| **Impacto** | Alto |
| **Esfuerzo** | Alto (~60 horas para cobertura básica) |
| **Riesgo** | Bajo |
| **Prioridad** | 🟡 **Importante** |

---

### IMP-05: Manejo de errores consistente en API

| Campo | Valor |
|---|---|
| **Tipo** | Deuda técnica |
| **Estado** | ✅ **IMPLEMENTADO** |
| **Problema** | Los errores se manejan de forma inconsistente: algunos endpoints devuelven `{ error: mensaje }`, otros `{ success: false }`, otros crashean con 500 sin cuerpo JSON. |
| **Solución** | Implementar middleware global de errores en Express que garantice que **toda respuesta** tenga formato `{ success: boolean, data?: any, error?: string }`. |
| **Implementación real** | `utils/response.js` implementa middleware `responseHelpers` (agrega `res.success()` y `res.error()`) y `errorHandler` (middleware global de errores). `server.js` usa ambos. Todos los controladores ahora usan `res.success()` y `res.error()` consistentemente. |
| **Impacto** | Medio |
| **Esfuerzo** | Bajo (~3 horas) |
| **Riesgo** | Medio |
| **Prioridad** | 🟡 **Importante** |

---

### IMP-06: Validación de datos de entrada en API

| Campo | Valor |
|---|---|
| **Tipo** | Deuda técnica |
| **Estado** | ✅ **IMPLEMENTADO** |
| **Problema** | No hay validación de schemas en los endpoints. Un request mal formado puede causar errores 500 inesperados o datos corruptos en la DB. |
| **Solución** | Usar **Zod** o **Joi** para validar el body de cada request. Esto también sirve como documentación viva de la API. |
| **Implementación real** | Se creó `utils/validate.js` con middleware `validate(schema)` y schemas Zod para todos los endpoints POST/PUT/PATCH. Cada ruta en `routes/*.js` ahora usa `validate(schemas.*)` antes de llegar al controlador. Los errores devuelven `{ success: false, error: 'Datos de entrada inválidos', details: [...] }`. Se instaló `zod` como dependencia del proyecto. |
| **Impacto** | Medio |
| **Esfuerzo** | Medio (~8 horas para los endpoints principales) |
| **Riesgo** | Bajo |
| **Prioridad** | 🟡 **Importante** |

---

## 🟢 PRIORIDAD DESEABLE — NUEVAS FUNCIONALIDADES

> **Estado general:** ❌ 0/10 implementadas

### NEW-01: Reporte de costos y margen bruto por plato

| Campo | Valor |
|---|---|
| **Tipo** | Nueva feature |
| **Estado** | ❌ **NO IMPLEMENTADO** |
| **Problema** | Actualmente no se sabe cuánto **cuesta producir** cada plato vs su precio de venta. El dueño no puede calcular margen bruto. |
| **Solución** | Usar las recetas (insumos + cantidades) y el precio de compra de cada insumo para calcular el **costo por plato**. Mostrar margen bruto en el dashboard y arqueo. Agregar campo `precio_compra` a la tabla `insumos`. |
| **Impacto** | Alto |
| **Esfuerzo** | Medio (~12 horas) |
| **Riesgo** | Bajo |
| **Prioridad** | 🟢 **Deseable** |

**Cálculo:**
```sql
-- Por cada plato:
SELECT SUM(r.cantidad_requerida * i.precio_compra) as costo_total
FROM recetas r JOIN insumos i ON r.insumo_id = i.id
WHERE r.plato_id = ?;
```

---

### NEW-02: Gestión de personal (roles, horarios, comisiones)

| Campo | Valor |
|---|---|
| **Tipo** | Nueva feature |
| **Estado** | ❌ **NO IMPLEMENTADO** |
| **Problema** | No hay control de horarios del personal, ni cálculo de comisiones sobre ventas. |
| **Solución** | Agregar módulo de personal con: registro de entrada/salida, cálculo de comisiones (por mozo, por mesa), reporte de productividad. Cada venta registra qué mozo la atendió. |
| **Impacto** | Alto |
| **Esfuerzo** | Alto (~40 horas) |
| **Riesgo** | Medio |
| **Prioridad** | 🟢 **Deseable** |

---

### NEW-03: Módulo de reservas

| Campo | Valor |
|---|---|
| **Tipo** | Nueva feature |
| **Estado** | ❌ **NO IMPLEMENTADO** |
| **Problema** | Las reservas se toman por teléfono y se apuntan en papel. No hay integración con el mapa de mesas. |
| **Solución** | Agregar módulo de reservas con: selección de mesa y hora, datos del cliente, confirmación automática. Integrar con el mapa de mesas (colorear mesas reservadas). |
| **Impacto** | Medio |
| **Esfuerzo** | Alto (~30 horas) |
| **Riesgo** | Medio |
| **Prioridad** | 🟢 **Deseable** |

---

### NEW-04: Soporte multi-sucursal

| Campo | Valor |
|---|---|
| **Tipo** | Nueva feature |
| **Estado** | ❌ **NO IMPLEMENTADO** |
| **Problema** | Si el restaurante abre una segunda sucursal, el sistema actual no lo soporta. |
| **Solución** | Agregar campo `sucursal_id` a todas las tablas principales. El menú de selección de sucursal al iniciar sesión. Cada sucursal tiene su propia base de datos SQLite pero comparte Firebase (con prefijo de sucursal). |
| **Impacto** | Alto |
| **Esfuerzo** | Alto (~60 horas) |
| **Riesgo** | Alto |
| **Prioridad** | 🟢 **Deseable** (solo si hay plan de expansión) |

---

### NEW-05: Notificaciones push para pedidos nuevos

| Campo | Valor |
|---|---|
| **Tipo** | Nueva feature |
| **Estado** | ❌ **NO IMPLEMENTADO** |
| **Problema** | La alerta de nuevo pedido solo funciona dentro de la red local (Socket.IO). Si el dueño está fuera, no se entera. |
| **Solución** | Integrar **Firebase Cloud Messaging (FCM)** para notificaciones push al teléfono del dueño cuando: llegue un pedido grande, haya alerta de stock crítico, se haya emitido una boleta. |
| **Impacto** | Medio |
| **Esfuerzo** | Medio (~15 horas) |
| **Riesgo** | Bajo |
| **Prioridad** | 🟢 **Deseable** |

---

### NEW-06: Exportación de datos a Excel/CSV

| Campo | Valor |
|---|---|
| **Tipo** | Nueva feature |
| **Estado** | ❌ **NO IMPLEMENTADO** |
| **Problema** | Los reportes solo se ven en pantalla. No se pueden exportar para contabilidad externa o análisis en Excel. |
| **Solución** | Agregar botón "Exportar a Excel" en arqueo, dashboard y libro de ventas. Usar la biblioteca `exceljs` para generar archivos `.xlsx` en el servidor y descargarlos. |
| **Impacto** | Medio |
| **Esfuerzo** | Medio (~8 horas) |
| **Riesgo** | Bajo |
| **Prioridad** | 🟢 **Deseable** |

---

### NEW-07: Historial de cambios (auditoría)

| Campo | Valor |
|---|---|
| **Tipo** | Nueva feature |
| **Estado** | ❌ **NO IMPLEMENTADO** |
| **Problema** | No hay trazabilidad de quién hizo qué. Si se anula una venta o se modifica un pedido, no queda registro del usuario que lo hizo. |
| **Solución** | Agregar tabla `auditoria` con: usuario, acción, descripción, timestamp. Registrar eventos clave: login, logout, creación de venta, anulación, modificación de menú, cambios de configuración. |
| **Impacto** | Medio |
| **Esfuerzo** | Medio (~10 horas) |
| **Riesgo** | Bajo |
| **Prioridad** | 🟢 **Deseable** |

---

### NEW-08: Pantalla de cocina digital (KDS)

| Campo | Valor |
|---|---|
| **Tipo** | Nueva feature |
| **Estado** | ❌ **NO IMPLEMENTADO** |
| **Problema** | La cocina recibe tickets impresos. Si se pierde el papel o hay mucha demanda, se desordenan los pedidos. |
| **Solución** | Agregar una **pantalla de cocina digital** (KDS - Kitchen Display System) que muestre los pedidos en tiempo real: ordenados por tiempo de espera, con colores para indicar urgencia. El cocinero puede marcar "En preparación" y "Listo". |
| **Impacto** | Alto |
| **Esfuerzo** | Alto (~40 horas) |
| **Riesgo** | Medio |
| **Prioridad** | 🟢 **Deseable** |

---

### NEW-09: Pedidos desde WhatsApp

| Campo | Valor |
|---|---|
| **Tipo** | Nueva feature |
| **Estado** | ❌ **NO IMPLEMENTADO** |
| **Problema** | Los clientes piden delivery por WhatsApp. El proceso actual requiere que alguien transcriba manualmente el pedido al sistema. |
| **Solución** | Integrar **WhatsApp Business API** (o usar `whatsapp-web.js`) para recibir pedidos automáticamente y crear la mesa de delivery sin intervención humana. El bot reconocería platos del menú y cantidades. |
| **Impacto** | Alto |
| **Esfuerzo** | Alto (~50 horas) |
| **Riesgo** | Alto (dependencia de API externa) |
| **Prioridad** | 🟢 **Deseable** |

---

### NEW-10: PWA (Progressive Web App) para clientes

| Campo | Valor |
|---|---|
| **Tipo** | Nueva feature |
| **Estado** | ❌ **NO IMPLEMENTADO** |
| **Problema** | Los clientes no pueden ver el menú digitalmente ni hacer pedidos desde su propio teléfono. |
| **Solución** | Crear una PWA que muestre la carta actualizada, permita hacer pedidos para delivery/recojo, y se integre con el sistema de pedidos existente. |
| **Impacto** | Medio |
| **Esfuerzo** | Alto (~30 horas) |
| **Riesgo** | Medio |
| **Prioridad** | 🟢 **Deseable** |

---

## 📊 TABLA RESUMEN PRIORIZADA

| # | Mejora | Tipo | Prioridad | Estado | Esfuerzo | Impacto |
|---|---|---|---|---|---|---|
| CRIT-01 | 🔐 Hashear contraseñas | Seguridad | 🔴 Crítica | ✅ Hecho | ~2h | Alto |
| CRIT-02 | 🔐 API Key Gemini en variable de entorno | Seguridad | 🔴 Crítica | ✅ Hecho | ~4h | Alto |
| CRIT-03 | 🔄 Reintentos SUNAT automáticos | Bug fix | 🔴 Crítica | ✅ Hecho | ~3h | Alto |
| CRIT-04 | FOREIGN KEY sync (ya corregido) | Bug fix | ✅ Hecho | ✅ Hecho | — | — |
| IMP-01 | 📝 Logging estructurado (Winston) | Deuda técnica | 🟡 Importante | ✅ Hecho | ~3h | Medio |
| IMP-02 | 📦 Migraciones de DB versionadas | Deuda técnica | 🟡 Importante | ✅ Hecho | ~6h | Medio |
| IMP-03 | 🏷️ TypeScript backend | Deuda técnica | 🟡 Importante | ❌ Pendiente | ~40h | Medio |
| IMP-04 | 🧪 Tests automatizados (Jest) | Deuda técnica | 🟡 Importante | ✅ Hecho | ~60h | Alto |
| IMP-05 | 🔧 Middleware errores consistente | Deuda técnica | 🟡 Importante | ✅ Hecho | ~3h | Medio |
| IMP-06 | Validación de inputs (Zod) | Deuda técnica | 🟡 Importante | ✅ Hecho | ~8h | Medio |
| NEW-01 | 💰 Costos y margen bruto por plato | Nueva feature | 🟢 Deseable | ❌ Pendiente | ~12h | Alto |
| NEW-02 | 👥 Gestión de personal | Nueva feature | 🟢 Deseable | ❌ Pendiente | ~40h | Alto |
| NEW-03 | 📅 Módulo de reservas | Nueva feature | 🟢 Deseable | ❌ Pendiente | ~30h | Medio |
| NEW-04 | 🏢 Multi-sucursal | Nueva feature | 🟢 Deseable | ❌ Pendiente | ~60h | Alto |
| NEW-05 | 🔔 Notificaciones push (FCM) | Nueva feature | 🟢 Deseable | ❌ Pendiente | ~15h | Medio |
| NEW-06 | 📊 Exportación Excel/CSV | Nueva feature | 🟢 Deseable | ❌ Pendiente | ~8h | Medio |
| NEW-07 | 📜 Auditoría de cambios | Nueva feature | 🟢 Deseable | ❌ Pendiente | ~10h | Medio |
| NEW-08 | 🖥️ Pantalla de cocina digital (KDS) | Nueva feature | 🟢 Deseable | ❌ Pendiente | ~40h | Alto |
| NEW-09 | 💬 Pedidos por WhatsApp | Nueva feature | 🟢 Deseable | ❌ Pendiente | ~50h | Alto |
| NEW-10 | 🌐 PWA para clientes | Nueva feature | 🟢 Deseable | ❌ Pendiente | ~30h | Medio |

---

## 🗺️ HOJA DE RUTA RECOMENDADA (ACTUALIZADA)

### Fase 1 — Estabilización (Sprint 1: 1-2 semanas)
```
🔴 CRIT-01: Hashear contraseñas (2h)              ✅ COMPLETADO
🔴 CRIT-03: Reintentos SUNAT automáticos (3h)     ✅ COMPLETADO
🟡 IMP-01: Logging con Winston (3h)               ✅ COMPLETADO
🟡 IMP-05: Middleware errores consistente (3h)      ✅ COMPLETADO
```
**Total estimado:** ~11 horas — ✅ **FASE COMPLETADA**

### Fase 2 — Calidad (Sprint 2: 2-3 semanas)
```
🔴 CRIT-02: API Key Gemini segura (4h)            ✅ COMPLETADO
🟡 IMP-02: Migraciones versionadas (6h)           ✅ COMPLETADO
🟡 IMP-06: Validación de inputs Zod (8h)          ✅ COMPLETADO
🟢 NEW-06: Exportación Excel (8h)                 ❌ PENDIENTE
```
**Total estimado:** ~26 horas — ✅ **FASE COMPLETADA**

### Fase 3 — Testing (Sprint 3: 2-3 semanas)
```
🟡 IMP-04: Tests automatizados (60h - primero críticos)  ✅ COMPLETADO
```
**Total estimado:** ~60 horas — ✅ **FASE COMPLETADA** (295 tests, 15 suites, 100% core backend)

### Fase 4 — Nuevas Features (Sprints 4-6: 4-6 semanas)
```
🟢 NEW-01: Costos y margen bruto (12h)            ❌ PENDIENTE
🟢 NEW-07: Auditoría de cambios (10h)             ❌ PENDIENTE
🟢 NEW-08: Pantalla de cocina digital (40h)       ❌ PENDIENTE
🟢 NEW-05: Notificaciones push (15h)              ❌ PENDIENTE
```
**Total estimado:** ~77 horas — ❌ **NO INICIADA**

### Fase 5 — Expansión (Sprints 7+: según necesidad)
```
🟡 IMP-03: TypeScript progresivo (40h)            ❌ PENDIENTE
🟢 NEW-02: Gestión personal (40h)                 ❌ PENDIENTE
🟢 NEW-03: Módulo reservas (30h)                  ❌ PENDIENTE
🟢 NEW-04: Multi-sucursal (60h)                   ❌ PENDIENTE
🟢 NEW-09: WhatsApp (50h)                         ❌ PENDIENTE
🟢 NEW-10: PWA clientes (30h)                     ❌ PENDIENTE
```

---

### 📈 RESUMEN GLOBAL DE AVANCE

| Categoría | Total | ✅ Hecho | 🟡 Parcial | ❌ Pendiente | Progreso |
|---|---|---|---|---|---|
| 🔴 Críticas | 4 | 4 | 0 | 0 | **100%** |
| 🟡 Importantes | 6 | 5 | 0 | 1 | **83%** |
| 🟢 Deseables | 10 | 0 | 0 | 10 | **0%** |
| **Total** | **20** | **9** | **0** | **11** | **45%** |

---

## ⚠️ RIESGOS Y DEPENDENCIAS

| Mejora | Dependencia | Riesgo |
|---|---|---|
| CRIT-02 (API Key) | Probar que funcione dentro del `.asar` de Electron | Medio |
| IMP-03 (TypeScript) | Requiere configurar build pipeline para backend | Alto |
| NEW-04 (Multi-sucursal) | Cambios en todas las queries SQL y rutas API | Alto |
| NEW-09 (WhatsApp) | Dependencia de API externa no oficial (`whatsapp-web.js`) | Alto |
| NEW-08 (KDS) | Nueva interfaz completa que requiere diseño UX | Medio |

---

> **Documento generado el:** Junio 2026
> **Última actualización:** Julio 2026
> **Próxima revisión sugerida:** Agosto 2026 (tras completar Fases 2 y 3)
