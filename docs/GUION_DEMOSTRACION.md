# 🎬 DEMOSTRACIÓN CALLETANO POS — 5 MINUTOS

> **Propósito:** Mostrar el flujo completo del sistema desde que el cliente llega hasta que paga.
> **Audiencia:** Dueño del restaurante, inversores, personal operativo.
> **Formato:** Presentación en vivo desde la Caja POS (PC).

---

## ⏱️ GUION PASO A PASO

### [0:00 – 0:30] 🚀 APERTURA Y LOGIN

**En pantalla:** Pantalla de login.

**Locutor:**
> "Este es Calletano POS. Un sistema que reemplaza el lápiz, papel y calculadora por una plataforma digital completa. Iniciamos sesión como administrador."

**Acción:** Escribir usuario `calletano`, contraseña `******`, presionar "Acceder".

**Resultado esperado:** Entra al POS, se ve el mapa de mesas del salón a la izquierda y la comandera (detalle de pedido) a la derecha.

---

### [0:30 – 1:00] 🪑 MAPA DE MESAS

**En pantalla:** Vista del salón con cuadrícula de mesas.

**Locutor:**
> "Aquí vemos el mapa del salón en tiempo real. Las mesas en verde están libres, en rojo están ocupadas con su total acumulado. Arriba también tenemos botones para crear delivery o recojo."

**Acción:** Señalar con el mouse: mesas libres (verde), mesas ocupadas (rojo con monto), botones "Nuevo Recojo" y "Nuevo Delivery".

**Punto clave:** Mostrar que el sistema soporta **mesas físicas, deliveries (DEL-), cuentas abiertas (CTA-) y recojos (REC-)**.

---

### [1:00 – 2:00] 📝 TOMA DE PEDIDO

**En pantalla:** Una mesa seleccionada, catálogo de platos abierto.

**Locutor:**
> "Seleccionamos una mesa libre y agregamos platos desde el catálogo. El sistema organiza los platos por categorías: entradas del menú, segundos, y toda la carta — con precios y stock en tiempo real."

**Acción:** 
1. Click en mesa libre → se selecciona (borde azul).
2. Click "Agregar Plato" → se abre el modal del catálogo.
3. Click en una entrada (ej: "Ceviche Mixto") → se agrega al pedido.
4. Click en un segundo (ej: "Arroz con Mariscos") → se agrega al pedido.
5. Click "Agregar Plato" de nuevo → click en un plato de la carta (ej: "Lomo Saltado").
6. Cerrar modal del catálogo.

**Locutor:**
> "Cada plato muestra su precio. Si un plato está agotado, aparece tachado y no permite agregarlo. Los que están por agotarse muestran una alerta naranja."

**Punto clave:** Mostrar el stock en tiempo real y la diferenciación entre **Menú del Día** (precios fijos) y **Carta** (precios variables).

---

### [2:00 – 2:30] ⚙️ MODALIDADES Y RECARGOS

**En pantalla:** Pedido visible en la comandera lateral.

**Locutor:**
> "Podemos cambiar la modalidad de cada plato con un click: local, llevar, delivery o delivery al centro. El sistema calcula automáticamente el recargo por taper o por zona de delivery."

**Acción:**
1. Click en la modalidad `[LOCAL]` de un plato → cambia a `[LLEVAR]`.
2. Señalar que el total se actualiza automáticamente (recargo de envase).

**Punto clave:** Mostrar que **no hay cálculos manuales** — el sistema suma todo automáticamente.

---

### [2:30 – 3:00] 🔥 ENVÍO A COCINA

**En pantalla:** Botón "¡ENVIAR A COCINA!" flotante.

**Locutor:**
> "Cuando el pedido está listo, presionamos 'Enviar a Cocina'. El sistema descuenta automáticamente el inventario según las recetas de cada plato, imprime la comanda en la impresora de cocina y emite una alerta sonora."

**Acción:**
1. Click en "¡ENVIAR A COCINA!".
2. Señalar la alerta de stock que aparece (si aplica).

**Punto clave:** Mencionar que las **bebidas, tapers y envases se filtran de la impresión de cocina** — solo va lo que se cocina. Y los deliveries se imprimen con un retardo para dar tiempo al delivery man.

---

### [3:00 – 4:00] 💳 COBRO CON MÚLTIPLES MÉTODOS

**En pantalla:** Modal de cobro.

**Locutor:**
> "Para cobrar, tenemos dos opciones: Nota de Venta (interna) o Boleta Electrónica SUNAT. El sistema acepta múltiples métodos de pago simultáneos."

**Acción:**
1. Click "GENERAR BOLETA" → se abre modal de cobro.
2. Rellenar datos de facturación: nombre "Cliente Demo", DNI "00000000".
3. Ingresar montos: efectivo S/ 20, Yape S/ 15.
4. Señalar que el sistema calcula el **vuelto automáticamente**.
5. Click en "Procesar Cobro".

**Locutor:**
> "Al confirmar, el sistema registra la venta en SQLite, libera la mesa, genera el PDF y XML de la boleta, y lo envía a SUNAT a través de ApisPeru. Luego pregunta si deseamos imprimir el ticket para el cliente."

**Punto clave:** Mostrar que soporta **4 métodos de pago simultáneos** (efectivo, Yape, Plin, tarjeta).

---

### [4:00 – 4:45] 📊 PANEL DE CONTROL (VISTAZO RÁPIDO)

**En pantalla:** Panel de Control con pestañas.

**Locutor:**
> "Como administrador, desde el panel de control podemos gestionar todo el restaurante en tiempo real."

**Acción (solo mostrar, no profundizar):**
1. Abrir sidebar → click "Panel de Control".
2. Navegar rápidamente por las 4 pestañas:
   - **Menú:** Editar platos del día, stock, modo domingo.
   - **Carta:** Editar categorías, precios, descripciones.
   - **Estado:** Abrir/cerrar restaurante.
   - **Almacén:** Inventario de insumos, kardex, recetas.

**Locutor:**
> "Editar el menú del día, la carta completa, gestionar el inventario con kardex, y asignar recetas a cada plato para que el descuento de inventario sea automático y preciso."

**Punto clave:** Mencionar el **Modo Domingo** (precio fijo S/30, oculta entradas, incluye bebida).

---

### [4:45 – 5:00] 🧠 INTELIGENCIA ARTIFICIAL (CIERRE)

**En pantalla:** Arqueo de Caja con botón de IA, Dashboard mensual.

**Locutor:**
> "Finalmente, el sistema genera un arqueo diario automático con desglose por método de pago, top 5 platos y gastos. Con un solo click obtenemos un análisis táctico con Gemini IA que nos dice cómo vamos y qué hacer."

**Acción:**
1. Abrir "Arqueo de Caja" desde el sidebar.
2. Click "Consultar a Gemini IA".
3. Mostrar el resultado: diagnóstico, acción recomendada, nivel de riesgo.

**Locutor:**
> "Y el dashboard mensual muestra la evolución día a día, rankings de platos, ventas por categoría, y una estrategia financiera mensual generada por IA. Todo lo que antes se hacía a mano, ahora es automático."

---

## 📋 CHECKLIST DE PREPARACIÓN

- [ ] Tener el servidor corriendo: `node server.js`
- [ ] Tener la app de caja corriendo: `cd caja-app && npm run dev`
- [ ] Tener datos de prueba: al menos 2 mesas con pedidos, 1 delivery, 1 cuenta abierta
- [ ] Desactivar el audio de la PC si es molesto
- [ ] Tener el menú del día con 2 entradas y 3 segundos
- [ ] Tener la carta con al menos 3 categorías con items
- [ ] Verificar que el API Key de Gemini esté configurada (para demo de IA)
- [ ] Pantalla completa (F11) para simular modo kiosko
- [ ] Probar el flujo completo 1 vez ANTES de la demo

## 💡 TIPS PARA EL PRESENTADOR

- **Habla pausado** — el sistema hace las cosas rápido, tú ve explicando.
- **Si algo falla**, di "esto es un prototipo en evolución" y sigue al siguiente paso.
- **No profundices** en detalles técnicos (bases de datos, sockets) a menos que pregunten.
- **Enfatiza el antes vs después**: "Antes se anotaba en papel, ahora es automático".
- **El ticket de venta** (pre-cuenta, boleta) es muy visual — muéstralo siempre.

---

> **Duración estimada:** 5 minutos exactos.
> **Documento generado:** Julio 2026 — v1.0
