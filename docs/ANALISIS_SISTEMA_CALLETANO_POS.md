# 📋 SISTEMA CALLETANO POS — ANÁLISIS COMPLETO

> **Restaurante:** Calletano — Máncora, Talara, Piura — Perú
> **Propietario:** José Eliseo Calle Calle
> **Desarrollador:** Juan Calle Rosales
> **Versión:** 1.0.0
> **Fecha:** Junio 2026

---

## 1. ALCANCE DEL SISTEMA

Calletano POS es un **Sistema de Punto de Venta (POS) integral y modular** diseñado específicamente para las operaciones de un restaurante de tamaño pequeño a mediano en Perú. El sistema cubre **todo el ciclo operativo**: desde la toma de pedidos en el salón, el envío a cocina, el cobro con múltiples métodos de pago, la emisión de comprobantes electrónicos SUNAT, hasta el análisis financiero gerencial con inteligencia artificial.

### 1.1 Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                   ┌─────────────────┐                   │
│                   │  FIREBASE       │                   │
│                   │  FIRESTORE ☁️   │                   │
│                   │  + Auth         │                   │
│                   └────────┬────────┘                   │
│                            │                            │
│         ┌──────────────────┼──────────────────┐        │
│         ▼                  ▼                  ▼         │
│   ┌──────────┐     ┌──────────────┐     ┌───────────┐  │
│   │ MOZO-    │     │ SERVIDOR     │     │ CAJA APP  │  │
│   │ TABLET   │◄───►│ NODE.JS      │◄───►│ (Vite     │  │
│   │ (Expo)   │HTTP │ Express      │HTTP │  React)   │  │
│   │          │Socket│ Socket.IO    │     │           │  │
│   │          │     │ Puerto 3001  │     │ Pto 5173  │  │
│   └──────────┘     └──────┬───────┘     └───────────┘  │
│                            │                            │
│                            ▼                            │
│                   ┌─────────────────┐                   │
│                   │  SQLite         │                   │
│                   │  (Local DB)     │                   │
│                   │  + Electron     │                   │
│                   │  + Impresoras   │                   │
│                   │  + SUNAT API    │                   │
│                   └─────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Beneficios Clave

- **Elimina el papel y lápiz** para tomar pedidos
- **Automatiza el registro** de ventas y gastos (antes manual)
- **Controla el inventario** en tiempo real (antes sin control)
- **Emite boletas electrónicas** SUNAT (antes sin facturación)
- **Sincroniza con la nube** (Firebase) para respaldo y acceso remoto
- **Analítica con IA** (Gemini) para decisiones gerenciales

---

## 2. TECNOLOGÍAS UTILIZADAS

### 2.1 Backend (Servidor Local)

| Tecnología | Versión | Propósito |
|---|---|---|
| **Node.js** | v22.22.2 | Entorno de ejecución |
| **Express** | ^4.19.2 | Servidor HTTP REST |
| **Socket.IO** | ^4.7.5 | Comunicación en tiempo real (WebSockets) |
| **better-sqlite3** | ^11.1.2 | Base de datos local SQLite |
| **Firebase Admin SDK** | ^13.8.0 | Acceso Admin a Firestore desde el servidor |
| **Google Generative AI** | ^0.24.1 | API de Gemini 2.5 Flash para analítica IA |
| **Axios** | ^1.17.0 | Cliente HTTP para llamadas a APIs externas (SUNAT) |
| **bcrypt** | ^6.0.0 | Hashing de contraseñas |
| **Zod** | ^4.4.3 | Validación de esquemas de datos de entrada |
| **Winston** | ^3.19.0 | Logging estructurado con transporte a archivo |
| **dotenv** | ^16.6.1 | Variables de entorno |
| **cors** | ^2.8.5 | Middleware de CORS |
| **nodemon** | ^3.1.4 | Recarga automática del servidor en desarrollo |
| **sharp** | ^0.35.2 | Procesamiento de imágenes (assets, íconos) |

### 2.2 Frontend Caja (Desktop)

| Tecnología | Versión | Propósito |
|---|---|---|
| **React** | ^19.2.5 | UI Framework |
| **Vite** | ^8.0.10 | Bundler y dev server |
| **Bootstrap 5** | ^5.3.8 | Framework CSS |
| **Chart.js** | ^4.5.1 | Gráficos y dashboards |
| **react-chartjs-2** | ^5.3.1 | Wrapper React para Chart.js |
| **Lucide React** | ^1.14.0 | Iconos SVG |
| **Socket.IO Client** | ^4.8.3 | Tiempo real desde el frontend |
| **Axios** | ^1.15.2 | Cliente HTTP |
| **React Router DOM** | ^7.14.2 | Navegación (preparado para futuras vistas) |

### 2.3 Mobile (Mozo Tablet)

| Tecnología | Versión | Propósito |
|---|---|---|
| **React Native (Expo)** | ~54.0.35 | Framework mobile multiplataforma |
| **Expo Router** | ~6.0.24 | Navegación |
| **Firebase** (Client) | ^12.13.0 | Acceso directo a Firestore desde la tablet |
| **AsyncStorage** | 2.2.0 | Almacenamiento local (caché) |
| **Socket.IO Client** | ^4.8.3 | Tiempo real |
| **Axios** | ^1.15.2 | HTTP a servidor local |

### 2.4 Desktop App (Empaquetado)

| Tecnología | Versión | Propósito |
|---|---|---|
| **Electron** | ^31.2.0 | Empaquetado como app de escritorio |
| **electron-builder** | ^26.8.1 | Instalador NSIS para Windows |
| **concurrently** | ^8.2.2 | Ejecución paralela (Vite + Electron) |

### 2.5 Servicios Externos

| Servicio | Propósito |
|---|---|
| **Firebase Firestore** | Base de datos en la nube (sincronización y respaldo) |
| **Firebase Authentication** | Autenticación remota para modo admin desde la tablet |
| **Google Gemini 2.5 Flash** | Análisis táctico diario y estrategia financiera mensual |
| **ApisPeru (SUNAT)** | Facturación electrónica — emisión de boletas |
| **QR Server API** | Generación de códigos QR para boletas SUNAT |

---

## 3. BASE DE DATOS — MODELO RELACIONAL (SQLite)

### 3.1 Tablas

| Tabla | Propósito |
|---|---|
| **usuarios** | Credenciales del sistema (admin, cajero) |
| **categorias** | Categorías de platos (Ceviches, Sopas, etc.) |
| **platos** | Platos con precio, stock diario y receta JSON |
| **ventas** | Registro de transacciones (firebase_id, mesa, total, método pago, items) |
| **gastos** | Egresos operativos (descripción, monto, categoría, comprobante) |
| **mesas_activas** | Estado en vivo de mesas (pedido, total, nota) |
| **insumos** | Inventario de materias primas (nombre, unidad, stock, estado) |
| **movimientos_inventario** | Kardex: ingresos y salidas de insumos (FK a insumos) |
| **configuracion** | Par clave-valor (impresoras, última sync, etc.) |
| **sunat_correlativos** | Control de numeración correlativa de boletas |
| **sunat_pendientes** | Boletas pendientes de envío a SUNAT (modo offline) |

---

## 4. REQUISITOS FUNCIONALES (RQF)

### 4.1 RQF — MÓDULO DE AUTENTICACIÓN Y SEGURIDAD

| ID | Descripción | Actor |
|---|---|---|
| **RQF-01** | El sistema debe permitir el inicio de sesión con credenciales (usuario y contraseña) desde la caja POS | Caja |
| **RQF-02** | El sistema debe validar las credenciales contra la tabla `usuarios` en SQLite | Sistema |
| **RQF-03** | El sistema debe diferenciar dos roles: `admin` y `cajero` | Sistema |
| **RQF-04** | El sistema debe permitir al admin acceder al panel de control, arqueos, dashboard y configuración | Admin |
| **RQF-05** | El sistema debe restringir al cajero solo al módulo de Punto de Venta | Sistema |
| **RQF-06** | El sistema debe permitir al admin cerrar sesión explícitamente | Admin |
| **RQF-07** | La app móvil debe autenticar al admin contra el servidor local (vía HTTP) o contra Firebase Authentication en modo remoto | Mozo/Admin |

### 4.2 RQF — MÓDULO DE GESTIÓN DE SALÓN Y MESAS

| ID | Descripción | Actor |
|---|---|---|
| **RQF-08** | El sistema debe mostrar un mapa de mesas con estado (libre/ocupada) y total acumulado | Caja, Mozo |
| **RQF-09** | El sistema debe permitir seleccionar una mesa para ver y gestionar su pedido | Caja, Mozo |
| **RQF-10** | El sistema debe soportar mesas físicas (`mesa_1`..`mesa_N`), deliveries (`DEL-*`), cuentas abiertas (`CTA-*`), y recojos (`REC-*`) | Sistema |
| **RQF-11** | El sistema debe permitir mover una mesa a otra (física o cuenta abierta) | Caja |
| **RQF-12** | El sistema debe permitir fusionar pedidos al mover a una cuenta abierta existente | Caja |

### 4.3 RQF — MÓDULO DE CARTA Y MENÚ

| ID | Descripción | Actor |
|---|---|---|
| **RQF-13** | El sistema debe mostrar el catálogo completo de platos organizados por categorías | Caja, Mozo |
| **RQF-14** | El sistema debe calcular stock en tiempo real: stock diario para menú, stock por receta para carta | Sistema |
| **RQF-15** | El sistema debe marcar visualmente platos agotados (stock ≤ 0) y con poco stock (≤ 3) | Sistema |
| **RQF-16** | El sistema debe permitir al admin editar el Menú del Día (entradas, segundos, precio, stock, tapers) | Admin |
| **RQF-17** | El sistema debe permitir al admin editar la Carta completa (categorías, platos, precios, descripciones) | Admin |
| **RQF-18** | El sistema debe soportar el **Modo Domingo**: oculta entradas, precio fijo de S/30 en segundos, incluye bebida | Admin |
| **RQF-19** | El sistema debe permitir publicar menú y carta desde la caja POS y desde la app móvil | Admin |
| **RQF-20** | El sistema debe recargar la carta automáticamente cuando se publican cambios desde cualquier terminal | Sistema |

### 4.4 RQF — MÓDULO DE COMANDA Y PEDIDOS

| ID | Descripción | Actor |
|---|---|---|
| **RQF-21** | El sistema debe permitir agregar platos del catálogo a una mesa | Caja, Mozo |
| **RQF-22** | El sistema debe permitir agregar platos personalizados ("fuera de carta") con nombre y precio libre | Caja, Mozo |
| **RQF-23** | El sistema debe permitir agregar tapers y refrescos rápidos desde atajos | Caja |
| **RQF-24** | El sistema debe validar stock antes de agregar platos: si no hay insumos suficientes, bloquea la operación | Sistema |
| **RQF-25** | El sistema debe permitir modificar cantidades (+/-) de cada item en el pedido | Caja, Mozo |
| **RQF-26** | El sistema debe permitir cambiar la modalidad de cada item: `local`, `llevar`, `delivery`, `delivery_centro` | Caja, Mozo |
| **RQF-27** | El sistema debe calcular recargo por taper/envase según la modalidad y tipo de envase | Sistema |
| **RQF-28** | El sistema debe calcular recargo por zona de delivery (S/1 delivery normal, S/3 centro) | Sistema |
| **RQF-29** | El sistema debe permitir añadir notas individuales a cada plato para cocina | Caja, Mozo |
| **RQF-30** | El sistema debe fusionar items iguales automáticamente (mismo nombre, modalidad, nota) | Sistema |
| **RQF-31** | El sistema debe permitir separar cantidades al cambiar modalidad (split) | Caja, Mozo |
| **RQF-32** | El sistema debe calcular el combo "MENÚ COMPLETO" = entrada + segundo a S/15 + recargos | Sistema |
| **RQF-33** | El sistema debe permitir enviar pedido a cocina (marca items como `impreso = true`) | Caja, Mozo |
| **RQF-34** | El sistema debe descontar el inventario automáticamente al enviar a cocina | Sistema |
| **RQF-35** | El sistema debe restaurar inventario al eliminar items del pedido o anular ventas | Sistema |
| **RQF-36** | El sistema debe emitir alerta sonora y por Socket.IO cuando llega un nuevo pedido | Sistema |
| **RQF-37** | El sistema debe imprimir automáticamente en la impresora de cocina al enviar pedido | Sistema |
| **RQF-38** | El sistema debe separar impresión: platos local/llevar en un ticket, delivery en otro (con retardo) | Sistema |
| **RQF-39** | El sistema debe filtrar bebidas, tapers y envases de la impresión de cocina | Sistema |
| **RQF-40** | El sistema debe permitir crear mesas virtuales de Delivery con datos del cliente | Caja |
| **RQF-41** | El sistema debe permitir crear mesas virtuales de Recojo | Caja |
| **RQF-42** | El sistema debe eliminar mesas temporales (DEL-, REC-, CTA-) si quedan vacías | Sistema |
| **RQF-43** | En **Modo Domingo**, el sistema debe preguntar por la bebida al agregar un segundo | Caja |

### 4.5 RQF — MÓDULO DE COBRO Y FACTURACIÓN

| ID | Descripción | Actor |
|---|---|---|
| **RQF-44** | El sistema debe permitir cobrar una mesa con múltiples métodos de pago simultáneos: efectivo, Yape, Plin, tarjeta | Caja |
| **RQF-45** | El sistema debe calcular el vuelto automáticamente | Sistema |
| **RQF-46** | El sistema debe registrar la venta en SQLite con desglose de pagos | Sistema |
| **RQF-47** | El sistema debe generar **Nota de Venta** (interna, sin SUNAT) | Caja |
| **RQF-48** | El sistema debe generar **Boleta Electrónica** (con envío a SUNAT vía ApisPeru) | Caja |
| **RQF-49** | El sistema debe permitir ingresar datos de facturación del cliente (nombre, DNI/RUC, dirección) para la boleta | Caja |
| **RQF-50** | El sistema debe generar y almacenar PDF y XML de cada boleta emitida en `Documentos/Calletano_Comprobantes` | Sistema |
| **RQF-51** | El sistema debe encolar boletas pendientes en `sunat_pendientes` si falla el envío a SUNAT (modo offline) | Sistema |
| **RQF-52** | El sistema debe controlar la numeración correlativa de boletas (B001-00000001...) | Sistema |
| **RQF-53** | El sistema debe imprimir el ticket de cliente (con QR SUNAT si es boleta) al confirmar el cobro | Caja |
| **RQF-54** | El sistema debe solicitar confirmación antes de imprimir el comprobante | Sistema |
| **RQF-55** | El sistema debe imprimir Pre-Cuenta (resumen de pedido sin cobrar) bajo demanda | Caja |
| **RQF-56** | En cuentas abiertas (CTA), la pre-cuenta debe agrupar items por fecha de consumo | Sistema |

### 4.6 RQF — MÓDULO DE GASTOS

| ID | Descripción | Actor |
|---|---|---|
| **RQF-57** | El sistema debe permitir registrar gastos operativos (descripción, monto, categoría) | Admin |
| **RQF-58** | El sistema debe soportar categorías de gasto: Insumos, Personal, Servicios, Otros | Sistema |
| **RQF-59** | El sistema debe permitir marcar si el gasto tiene comprobante SUNAT (para radar tributario) | Admin |
| **RQF-60** | El sistema debe sincronizar gastos a Firebase automáticamente | Sistema |
| **RQF-61** | El sistema debe permitir anular/eliminar gastos con confirmación | Admin |
| **RQF-62** | El sistema debe mostrar gráfico de distribución de egresos por categoría | Admin |

### 4.7 RQF — MÓDULO DE INVENTARIO Y KARDEX

| ID | Descripción | Actor |
|---|---|---|
| **RQF-63** | El sistema debe gestionar insumos (nombre, unidad de medida: g, kg, und) | Admin |
| **RQF-64** | El sistema debe permitir dar de alta, editar, deshabilitar y reactivar insumos | Admin |
| **RQF-65** | El sistema debe registrar movimientos de inventario: INGRESO (+) y MERMA (-) | Admin |
| **RQF-66** | El sistema debe calcular stock actual automáticamente con cada movimiento | Sistema |
| **RQF-67** | El sistema debe impedir stock negativo (mínimo 0) | Sistema |
| **RQF-68** | El sistema debe permitir asociar una **receta** a cada plato (lista de insumos + cantidades) | Admin |
| **RQF-69** | El sistema debe calcular stock disponible de platos de carta en base a las recetas e inventario | Sistema |
| **RQF-70** | El sistema debe descontar insumos automáticamente al enviar pedido a cocina (según recetas) | Sistema |
| **RQF-71** | El sistema debe emitir alertas visuales de stock crítico: menú (≤1 ración), carta (≤1 plato), envases (≤1 unidad) | Sistema |

### 4.8 RQF — MÓDULO DE REPORTES Y ANALÍTICA

| ID | Descripción | Actor |
|---|---|---|
| **RQF-72** | El sistema debe generar **Arqueo de Caja** diario con desglose por método de pago, top 5 platos, total gastos | Admin |
| **RQF-73** | El sistema debe generar **Dashboard Mensual** con evolución diaria de ingresos/gastos (gráfico de líneas), rankings de platos (gráficos de dona), ventas por categoría, días operados | Admin |
| **RQF-74** | El sistema debe calcular indicadores SUNAT: ventas con comprobante, gastos con comprobante, radar tributario (límite S/5,000) | Sistema |
| **RQF-75** | El sistema debe generar **Libro de Ventas** (historial detallado por fecha) | Admin |
| **RQF-76** | El sistema debe permitir filtrar reportes por fecha (arqueo) y mes (dashboard) | Admin |
| **RQF-77** | El sistema debe permitir anular ventas desde el libro de ventas (elimina de SQLite y Firestore) | Admin |
| **RQF-78** | El sistema debe mostrar el **Radar Tributario** en la app móvil: barras de progreso de ventas y gastos SUNAT | Admin (Móvil) |

### 4.9 RQF — MÓDULO DE INTELIGENCIA ARTIFICIAL (Gemini)

| ID | Descripción | Actor |
|---|---|---|
| **RQF-79** | El sistema debe generar un **análisis táctico diario** vía Gemini 2.5 Flash con diagnóstico, acción y nivel de riesgo | Admin |
| **RQF-80** | El sistema debe generar una **estrategia financiera mensual** vía Gemini con diagnóstico, decisión y nivel financiero | Admin |
| **RQF-81** | El análisis diario debe considerar: ratio gastos/ingresos, tráfico, día de la semana, concentración de ventas en top platos | Sistema |
| **RQF-82** | El análisis mensual debe considerar: sales mix por categoría, plato estrella, días operados, margen | Sistema |
| **RQF-83** | El sistema debe usar responseSchema JSON para estructurar las respuestas de la IA | Sistema |

### 4.10 RQF — MÓDULO DE SINCRONIZACIÓN Y RESPALDO

| ID | Descripción | Actor |
|---|---|---|
| **RQF-84** | El sistema debe sincronizar datos local ↔ Firebase Firestore (bidireccional) | Sistema |
| **RQF-85** | La **sincronización hacia arriba** (local → nube) debe subir: ventas, gastos, insumos con `sincronizado = 0` | Sistema |
| **RQF-86** | La **sincronización hacia abajo** (nube → local) debe bajar: carta completa, menú diario, configuración, insumos | Sistema |
| **RQF-87** | La sincronización hacia abajo debe limpiar y recargar completamente categorías, platos e insumos | Sistema |
| **RQF-88** | El sistema debe sincronizar automáticamente al iniciar (`/api/init-sync`) | Sistema |
| **RQF-89** | El sistema debe tener listeners `onSnapshot` en Firebase para detectar cambios en tiempo real | Sistema |
| **RQF-90** | El sistema debe hacer respaldo automático cada 60 segundos (`sincronizarHaciaArriba`) | Sistema |
| **RQF-91** | El sistema debe tener un indicador visual de estado de conexión en todos los frontends | Sistema |

### 4.11 RQF — MÓDULO DE CONFIGURACIÓN DE HARDWARE

| ID | Descripción | Actor |
|---|---|---|
| **RQF-92** | El sistema debe detectar impresoras instaladas en Windows (vía PowerShell `Get-Printer`) | Sistema |
| **RQF-93** | El sistema debe permitir seleccionar impresora para tickets de caja y para comandas de cocina | Admin |
| **RQF-94** | El sistema debe imprimir tickets silenciosamente (sin diálogo de impresión) vía Electron IPC | Sistema |
| **RQF-95** | El sistema debe abrir la carpeta de comprobantes SUNAT (`Documentos/Calletano_Comprobantes`) | Admin |

### 4.12 RQF — MÓDULO DE ADMINISTRACIÓN REMOTA (MÓVIL)

| ID | Descripción | Actor |
|---|---|---|
| **RQF-96** | El sistema debe permitir al admin conectarse desde la tablet a la red local (vía IP) | Admin (Móvil) |
| **RQF-97** | El sistema debe permitir al admin conectarse en **modo remoto** vía Firebase Auth + Firestore directo (sin servidor local) | Admin (Móvil) |
| **RQF-98** | El sistema debe mostrar el estado del servidor (Conectado/Desconectado/Modo remoto) en la tablet | Sistema |
| **RQF-99** | El sistema debe permitir al admin editar y publicar el menú desde la tablet | Admin (Móvil) |
| **RQF-100** | El sistema debe permitir al admin registrar gastos desde la tablet (con correlativo cacheado) | Admin (Móvil) |
| **RQF-101** | El sistema debe mostrar el reporte diario y radar tributario en la tablet | Admin (Móvil) |
| **RQF-102** | El sistema debe permitir abrir/cerrar el restaurante desde la tablet | Admin (Móvil) |

### 4.13 RQF — MÓDULO DE COMANDERA MÓVIL (MOZO)

| ID | Descripción | Actor |
|---|---|---|
| **RQF-103** | El sistema debe permitir al mozo seleccionar una mesa del mapa de mesas | Mozo |
| **RQF-104** | El sistema debe mostrar la carta de platos con categorías, precios y stock en la tablet | Mozo |
| **RQF-105** | El sistema debe permitir al mozo agregar platos al carrito de la mesa | Mozo |
| **RQF-106** | El sistema debe permitir enviar la comanda a cocina vía HTTP al servidor local | Mozo |
| **RQF-107** | El sistema debe permitir agregar platos rápidos (tapers, refrescos, humitas) desde la tablet | Mozo |

---

## 5. REQUISITOS NO FUNCIONALES (RQNF)

| ID | Descripción | Categoría |
|---|---|---|
| **RQNF-01** | El sistema debe funcionar **completamente offline** en la red local (sin depender de internet para operaciones diarias) | Disponibilidad |
| **RQNF-02** | El sistema debe sincronizar con la nube cuando haya conexión | Disponibilidad |
| **RQNF-03** | La latencia de operaciones locales (agregar plato, enviar pedido) debe ser < 500ms | Rendimiento |
| **RQNF-04** | El sistema debe manejar al menos 12 mesas simultáneas (configuración actual del restaurante) y 100 transacciones por hora | Escalabilidad |
| **RQNF-05** | El sistema debe proteger los datos locales con SQLite (sin pérdida ante corte de energía) | Integridad |
| **RQNF-06** | El sistema debe usar Firebase como respaldo en la nube para evitar pérdida total de datos | Resiliencia |
| **RQNF-07** | La interfaz debe ser intuitiva para personal con mínima experiencia tecnológica (antes usaban lápiz y papel) | Usabilidad |
| **RQNF-08** | La caja POS debe ocupar toda la pantalla (kiosko) sin necesidad de mouse para operaciones frecuentes | UX |
| **RQNF-09** | El sistema debe funcionar en Windows (escritorio) y Android/iOS (tablet) | Portabilidad |
| **RQNF-10** | El sistema debe permitir empaquetado como aplicación de escritorio instalable (NSIS) | Distribución |
| **RQNF-11** | La seguridad de las credenciales locales debe ser manejada por hash en SQLite (implementado con bcrypt) | Seguridad |
| **RQNF-12** | La API de SUNAT debe tener manejo de errores y cola de reintentos (boletas pendientes) | Confiabilidad |
| **RQNF-13** | Los tickets de impresión deben tener formato térmico (80mm - 265px de ancho) | Compatibilidad |
| **RQNF-14** | El sistema debe usar la zona horaria de Perú (UTC-5) para todas las transacciones | Corrección |

---

## 6. FUNCIONALIDADES POR USUARIO

### 6.1 Rol: ADMIN (Dueño / Administrador)

**Acceso:** Caja POS (PC) + Tablet (App Móvil)

#### Desde la Caja POS:
- ✅ Iniciar sesión con credenciales de admin
- ✅ Gestionar el Punto de Venta (mesas, pedidos, cobros)
- ✅ **Panel de Control Gerencial** con 4 pestañas:
  - Editar y publicar **Menú del Día** (entradas, segundos, precios, stock, tapers, modo domingo)
  - Editar y publicar **Carta completa** (categorías, platos, descripciones, precios)
  - **Estado Operativo** (abrir/cerrar restaurante, horarios)
  - **Almacén** (CRUD insumos, movimientos kardex, recetas de platos)
- ✅ **Arqueo de Caja** diario con desglose por método de pago
- ✅ **Libro de Ventas** con filtro por fecha y opción de anular ventas
- ✅ **Control de Gastos** con gráfico de distribución
- ✅ **Analítica Integral** (Dashboard mensual con gráficos, rankings, IA)
- ✅ **Alertas de Stock Crítico** con notificaciones visuales
- ✅ Configuración de impresoras (caja y cocina)
- ✅ Forzar sincronización manual
- ✅ Ver comprobantes SUNAT (PDF/XML)
- ✅ **Consultar a Gemini AI** (análisis diario y estrategia mensual)

#### Desde la Tablet Móvil:
- ✅ Login local (vía IP) o remoto (vía Firebase Auth)
- ✅ **Radar Tributario** (barras de progreso SUNAT)
- ✅ Reporte diario en vivo (ingresos, gastos, balance)
- ✅ Editar y publicar **Menú del Día** con editor completo
- ✅ Registrar gastos (con correlativo cacheado en AsyncStorage)
- ✅ Abrir/Cerrar restaurante remotamente
- ✅ Marcar impuesto del mes como pagado

### 6.2 Rol: CAJA (Cajero)

**Acceso:** Caja POS (PC) únicamente

- ✅ Iniciar sesión con credenciales de cajero
- ✅ Ver mapa de mesas con estado (libre/ocupada)
- ✅ Ver pedido detallado de la mesa seleccionada
- ✅ Agregar platos del catálogo (con búsqueda)
- ✅ Agregar platos personalizados ("fuera de carta")
- ✅ Agregar tapers y refrescos rápidos
- ✅ Modificar cantidades (+/-) de cada item
- ✅ Cambiar modalidad (local/llevar/delivery/centro)
- ✅ Añadir notas a platos individuales
- ✅ Enviar pedido a cocina
- ✅ Eliminar items del pedido (con confirmación)
- ✅ Mover mesa a otro destino (mesa física o cuenta abierta)
- ✅ Cobrar mesa (Nota de Venta o Boleta Electrónica)
- ✅ Ingresar datos de facturación del cliente
- ✅ Imprimir ticket/pre-cuenta

### 6.3 Rol: MOZO (Mesero / Comander@)

**Acceso:** Tablet Móvil únicamente

- ✅ Conectar a la IP del servidor local
- ✅ Ver mapa de mesas con estado
- ✅ Seleccionar mesa y ver su estado actual
- ✅ Buscar platos en el catálogo
- ✅ Agregar platos al carrito de la mesa
- ✅ Agregar platos rápidos (tapers, refrescos, humitas)
- ✅ Cambiar modalidad (local/llevar/delivery)
- ✅ Añadir datos de delivery (cliente, dirección, teléfono)
- ✅ Enviar comanda a cocina (vía servidor local)
- ✅ Ver indicador de conexión al servidor

### 6.4 Funcionalidades Automáticas del Sistema

| ID | Función | Disparador |
|---|---|---|
| **SIS-01** | Sincronización hacia arriba (ventas, gastos, insumos → Firebase) | Cada 60 segundos |
| **SIS-02** | Sincronización hacia abajo (carta, menú, config, insumos ← Firebase) | Al iniciar + cambios en tiempo real |
| **SIS-03** | Detección de cambios en menuDiario vía `onSnapshot` | Tiempo real |
| **SIS-04** | Detección de cambios en configuración vía `onSnapshot` | Tiempo real |
| **SIS-05** | Cálculo de stock por receta (platos de carta) | Al cargar carta |
| **SIS-06** | Descuento de inventario al enviar pedido a cocina | Al crear pedido |
| **SIS-07** | Restauración de inventario al modificar/anular items | Al modificar pedido |
| **SIS-08** | Cálculo del combo "MENÚ COMPLETO" (entrada + segundo) | Al procesar pedido |
| **SIS-09** | Envío de boleta a SUNAT (vía ApisPeru) | Al generar boleta |
| **SIS-10** | Generación y almacenamiento de PDF/XML de boletas | Tras envío exitoso a SUNAT |
| **SIS-11** | Encolado de boletas pendientes si SUNAT está offline | Si falla envío a SUNAT |
| **SIS-12** | Control de correlativo de boletas (B001-n) | Al emitir boleta |
| **SIS-13** | Impresión automática en cocina al recibir pedido | Al crear pedido |
| **SIS-14** | Separación de impresión: local/llevar vs delivery | Al imprimir cocina |
| **SIS-15** | Actualización de stock de menú en Firebase al vender | Al procesar pedido/cobro |
| **SIS-16** | Eliminación automática de mesas temporales vacías | Al modificar pedido |
| **SIS-17** | Alerta sonora y visual de nuevo pedido | Socket.IO `alerta_sonora` |
| **SIS-18** | Alerta de stock crítico dividida (menú, carta, insumos) | Después de cada pedido |
| **SIS-19** | Migración estructural automática al iniciar (ALTER TABLE) | Al arrancar servidor |
| **SIS-20** | Cache de reportes (AsyncStorage) en la app móvil | Para reducir lecturas Firestore |

---

## 7. FLUJOS PRINCIPALES DEL SISTEMA

### 7.1 Flujo de Pedido (Caja POS)

```
1. Cajero selecciona mesa del mapa
2. Abre catálogo de platos (modal)
3. Agrega items → se consolidan en pedido
4. Puede modificar: cantidad, modalidad, notas
5. Envía a cocina → se descuenta inventario automáticamente
6. Cocina recibe impresión del ticket
7. Alerta sonora en caja
8. Se revisan alertas de stock
```

### 7.2 Flujo de Cobro

```
1. Cajero presiona "Nota de Venta" o "Generar Boleta"
2. Ingresa montos por método de pago (efectivo, Yape, Plin, tarjeta)
3. Si es boleta: ingresa datos del cliente
4. Sistema calcula vuelto
5. Confirma cobro:
   - Registra venta en SQLite
   - Envía a SUNAT (si es boleta)
   - Genera PDF/XML
   - Libera mesa
6. Pregunta si desea imprimir ticket para el cliente
```

### 7.3 Flujo de Sincronización

```
INICIO DEL SERVIDOR:
1. Crea/verifica tablas SQLite
2. Migraciones estructurales
3. Inicia listeners onSnapshot (Firebase → SQLite)
4. Servidor escucha en puerto 3001

CADA 60 SEGUNDOS:
1. Busca ventas con sincronizado=0
2. Busca gastos con sincronizado=0
3. Busca insumos con sincronizado=0
4. Sube cada uno a Firebase con ID formateado
5. Marca como sincronizado=1

AL DETECTAR CAMBIO EN FIREBASE (onSnapshot):
1. Lee nuevo menú/config desde Firestore
2. Limpia SQLite (movimientos → insumos → platos → categorías)
3. Reinserta todos los datos frescos desde Firebase
```

### 7.4 Flujo de Facturación SUNAT

```
1. Cajero emite Boleta Electrónica
2. Servidor construye payload JSON según schema SUNAT
3. Obtiene correlativo B001-n de SQLite
4. Envía POST a api.apisperu.com/v1/invoice/send
5. Si éxito: genera PDF y XML, guarda en Documentos
6. Si falla: guarda en sunat_pendientes para reintento
7. Responde con número de boleta
```

---

## 8. PROBLEMAS QUE RESUELVE

### 8.1 Contexto Original (Antes del Sistema)

El Restaurante Calletano operaba **completamente con lápiz y papel**:

| Aspecto | Cómo se hacía antes |
|---|---|
| **Toma de pedidos** | El mozo escribía en una libreta |
| **Envío a cocina** | Gritando el pedido o llevando el papel a la cocina |
| **Stock de platos** | Sin control — se avisaba "ya no hay" cuando se acababa |
| **Control de inventario** | No existía — no se sabía cuánto insumo se consumía |
| **Registro de ventas** | Se anotaba en un cuaderno al final del día |
| **Cálculo de totales** | Suma manual, propenso a errores |
| **Gastos** | En otro cuaderno, sin categorización |
| **Boleta SUNAT** | No se emitía (o se hacía en un sistema aparte) |
| **Reportes** | No existían — no se sabía la ganancia real |
| **Delivery** | Por teléfono, apuntando en papel |

### 8.2 Problemas Resueltos por el Sistema

| # | Problema | Solución |
|---|---|---|
| 1 | **Pedidos perdidos** por mala letra o papeles extraviados | Pedidos digitales con persistencia en SQLite |
| 2 | **Comunicación lenta con cocina** (gritos, papeles) | Impresión automática + alerta sonora por Socket.IO |
| 3 | **Errores en suma de cuentas** | Cálculo automático de totales con recargos |
| 4 | **Sin control de stock** → platos agotados inesperadamente | Stock en tiempo real por receta + alertas críticas |
| 5 | **Desperdicio de insumos** sin trazabilidad | Kardex digital: cada plato descuenta insumos exactos |
| 6 | **Pérdida de dinero** — no se sabía cuánto se vendió | Reporte diario automático con desglose |
| 7 | **No se sabía si el negocio era rentable** | Dashboard mensual con gráficos + análisis IA |
| 8 | **Sin facturación electrónica** → problemas con SUNAT | Emisión de boletas + PDF/XML + QR |
| 9 | **Gastos descontrolados** sin categorizar | Registro de gastos con categorías + comprobante |
| 10 | **No se podía ver el negocio a distancia** | App móvil con conexión remota vía Firebase |
| 11 | **Pérdida de datos** si se perdía el cuaderno | Sincronización automática a la nube |
| 12 | **Sin análisis de datos** para tomar decisiones | IA de Gemini analiza arqueo diario y mensual |
| 13 | **Lentitud en delivery** — datos del cliente en papel | Delivery digital con datos estructurados |
| 14 | **Cuentas fiadas no controladas** | Sistema de Cuentas Abiertas (CTA) con tracking |
| 15 | **Sin control de rayas/adicionales** | Modalidad llevar y delivery con recargos automáticos |

---

## 9. ESTRUCTURA DEL PROYECTO

```
calletano-pos-desktop/
├── server.js                 # Servidor Express + Socket.IO + Firebase listeners
├── main.js                   # Entry point de Electron
├── database.js               # Conexión SQLite + creación de tablas
├── package.json              # Dependencias del servidor y Electron
│
├── config/
│   ├── firebase.js           # Firebase Admin SDK (service account)
│   └── ai.js                 # Google Generative AI (Gemini)
│
├── routes/                   # Rutas Express (7 módulos)
│   ├── sync.routes.js        # Sincronización y admin remoto
│   ├── pos.routes.js         # Pedidos, mesas, cobros
│   ├── menu.routes.js        # Mesas, carta, recetas
│   ├── finanzas.routes.js    # Ventas, gastos
│   ├── inventario.routes.js  # Insumos, movimientos
│   ├── reportes.routes.js    # Reportes, dashboard, IA
│   └── sistema.routes.js     # Login, config, impresoras, status
│
├── controllers/              # Lógica de negocio
│   ├── sync.controller.js    # Init sync, admin menu/carta/estado
│   ├── pos.controller.js     # POS: pedidos, cobro, mover, inventario
│   ├── menu.controller.js    # Carta, mesas, recetas
│   ├── finanzas.controller.js# Ventas, gastos
│   ├── inventario.controller.js # CRUD insumos + movimientos
│   ├── reportes.controller.js   # Reportes + IA Gemini
│   └── sistema.controller.js    # Login, config, impresoras
│
├── services/
│   └── sync.service.js       # Sincronización bidireccional Firebase ↔ SQLite
│
├── store/
│   └── globalState.js        # Estado en memoria (menú, carta, modo domingo)
│
├── utils/
│   ├── helpers.js            # aFechaLocal, pad, normalizar, generarLeyenda
│   └── math.js               # calcularRecargoTaper, agruparItems, calcularTotalMesa
│
├── caja-app/                 # Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx           # Componente principal (orquestador)
│   │   ├── App.css           # Sistema de diseño ERP completo
│   │   ├── main.jsx          # Entry point React
│   │   ├── hooks/
│   │   │   ├── usePOS.js     # Lógica de punto de venta
│   │   │   ├── useAuth.js    # Autenticación local
│   │   │   └── useInventario.js # CRUD inventario desde frontend
│   │   ├── components/
│   │   │   ├── ModalAdmin.jsx    # Panel de control (4 tabs)
│   │   │   ├── ModalCobro.jsx    # Cobro con pagos y boleta SUNAT
│   │   │   ├── ModalArqueo.jsx   # Arqueo diario con IA
│   │   │   ├── ModalGastos.jsx   # Gastos con gráfico
│   │   │   ├── ModalHistorial.jsx# Libro de ventas
│   │   │   └── ModalDashboard.jsx# Dashboard mensual con gráficos
│   │   ├── utils/
│   │   │   ├── printer.js    # Generación de HTML para tickets térmicos
│   │   │   └── helpers.js    # Versión frontend de helpers
│   │   └── services/
│   │       └── api.js        # Cliente Axios centralizado
│   └── package.json
│
├── mozo-tablet/              # App móvil React Native (Expo)
│   ├── app/
│   │   ├── index.tsx         # UI completa (4 pantallas)
│   │   ├── _layout.tsx       # Layout Expo Router
│   │   └── _firebase-config.js # Firebase Client SDK
│   ├── src/
│   │   ├── hooks/
│   │   │   ├── useAppSystem.ts  # Red, sockets, login, estado restaurante
│   │   │   ├── useAdmin.ts      # Admin: reportes, gastos, menú, radar
│   │   │   └── useMozo.ts       # Mozo: carrito, modalidades, notas
│   │   ├── styles/
│   │   │   └── theme.ts     # Sistema de diseño mobile
│   │   └── utils/
│   │       └── helpers.ts   # Fecha, IDs, formatos
│   └── package.json
│

└── calletano_local.db        # Base de datos SQLite local
```

---

## 10. API REST — ENDPOINTS

### Sincronización y Admin
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/init-sync` | Inicializa sincronización completa |
| POST | `/api/admin/menu` | Publica menú del día |
| POST | `/api/admin/carta` | Publica carta completa |
| POST | `/api/admin/estado` | Actualiza estado operativo |

### POS (Punto de Venta)
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/pedidos` | Crear pedido (enviar a cocina) |
| PUT | `/api/mesas/:id/pedido` | Modificar pedido de mesa |
| POST | `/api/mesas/mover` | Mover mesa a destino |
| POST | `/api/cobrar` | Cobrar mesa |

### Menú y Mesas
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/mesas` | Obtener mesas activas |
| GET | `/api/carta` | Obtener carta con stock |
| GET | `/api/admin/data-cruda` | Datos crudos para admin |
| GET | `/api/platos/:id/receta` | Obtener receta de plato |
| POST | `/api/platos/:id/receta` | Agregar insumo a receta |
| DELETE | `/api/recetas/:id` | Eliminar insumo de receta |

### Finanzas
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/ventas?fecha=` | Obtener ventas por fecha |
| DELETE | `/api/ventas/:id` | Anular venta |
| GET | `/api/gastos?fecha=` | Obtener gastos por fecha |
| POST | `/api/gastos` | Crear gasto |
| DELETE | `/api/gastos/:id` | Eliminar gasto |

### Reportes e IA
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/reporte-diario?fecha=` | Arqueo diario |
| GET | `/api/dashboard?mes=` | Dashboard mensual |
| POST | `/api/ia/resumen` | Análisis IA diario |
| POST | `/api/ia/mensual` | Análisis IA mensual |

### Inventario
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/inventario` | Listar insumos |
| POST | `/api/inventario/insumo` | Crear insumo |
| PUT | `/api/inventario/insumo/:id` | Editar insumo |
| DELETE | `/api/inventario/insumo/:id` | Deshabilitar insumo |
| PUT | `/api/inventario/insumo/:id/habilitar` | Reactivar insumo |
| POST | `/api/inventario/movimiento` | Registrar movimiento kardex |

### Sistema
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/status` | Health check |
| GET | `/api/modo-domingo` | Estado modo domingo |
| POST | `/api/login` | Autenticación |
| GET | `/api/impresoras` | Listar impresoras |
| GET | `/api/config` | Obtener configuración |
| POST | `/api/config` | Guardar configuración |
| GET | `/api/abrir-comprobantes` | Abrir carpeta SUNAT |

---

## 11. CONSIDERACIONES DE MEJORA

### 11.1 Seguridad
- ~~**Contraseñas en texto plano** en SQLite → Implementar hashing (bcrypt)~~ ✅ **IMPLEMENTADO**: `database.js` usa `bcrypt.hashSync()` con 10 rounds de salt. Las contraseñas legacy se migran automáticamente al primer login.
- ~~**API Key de Gemini hardcodeada** → Mover a variables de entorno~~ ✅ **IMPLEMENTADO**: `config/ai.js` lee `process.env.GEMINI_API_KEY` desde `.env`. Ya no hay claves en el código fuente.
- **Sin autenticación en API REST** → Pendiente: agregar middleware JWT o token de sesión para proteger los endpoints

### 11.2 Técnicas
- ~~**Reintentos de SUNAT pendientes** → Job automático~~ ✅ **IMPLEMENTADO**: `server.js` tiene `reintentarBoletasPendientes()` con `setInterval` cada 5 minutos.
- ~~**Manejo de migraciones** → Sistema versionado~~ ✅ **IMPLEMENTADO**: `utils/migrations.js` con tabla `schema_version` y 4 migraciones versionadas.
- ~~**Logging centralizado** → Winston~~ ✅ **IMPLEMENTADO**: `utils/logger.js` con Winston, transporte a consola (color) y archivos (`error.log`, `combined.log`). Reemplaza `console.log/error/warn` globalmente.
- **TypeScript** → Pendiente: migrar progresivamente para mejorar mantenibilidad
- ~~**Validación de datos de entrada**~~ ✅ **IMPLEMENTADO**: `utils/validate.js` con middleware `validate(schema)` y 16+ schemas Zod. Usado en todas las rutas POST/PUT/PATCH.
- ~~**Middleware de errores consistente**~~ ✅ **IMPLEMENTADO**: `utils/response.js` con `responseHelpers` (agrega `res.success()/error()`) y `errorHandler` (middleware global).
- ~~**Pruebas unitarias**~~ ✅ **IMPLEMENTADO**: 295 tests en 15 suites con Jest, cubriendo todos los controladores, servicios y utilidades core.

### 11.3 Funcionales
- **Múltiples sucursales** → Arquitectura actual es mono-sucursal
- **Reporte de costos reales** vs precios de venta (margen bruto por plato)
- **Gestión de personal** (horarios, roles más granulares, comisiones)
- **Módulo de reservas** con integración al mapa de mesas

---

> **Documento generado el:** Junio 2026
> **Propósito:** Análisis completo del Sistema Calletano POS v1.0.0
