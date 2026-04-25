const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
require('dotenv').config();

// Importamos la conexión a la base de datos
const db = require('./config/database');

const app = express();
const puerto = process.env.PORT || 3000;

// Middlewares
app.use(cors()); 
app.use(express.json()); 

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// ==========================================
// FUNCIÓN MAESTRA DE IMPRESIÓN (WIFI Y USB)
// ==========================================
const imprimir = async (tipo, datos) => {
  const esCocina = tipo === 'COCINA';
  
  const config = {
    type: PrinterTypes.EPSON,
    interface: esCocina ? process.env.IMPRESORA_COCINA : process.env.IMPRESORA_CAJA,
    removeSpecialCharacters: false,
  };

  let printer = new ThermalPrinter(config);
  
  let isConnected = await printer.isPrinterConnected();
  if (!isConnected) {
    console.warn(`⚠️ Impresora de ${tipo} no detectada. Simulando impresión en consola...`);
  }

  // Diseño del Ticket
  printer.alignCenter();
  if (esCocina) {
    printer.println("--- COMANDA DE COCINA ---");
  } else {
    printer.println("CALLETANO RESTAURANT");
    printer.println("Máncora, Piura");
  }
  
  printer.println(`Mesa: ${datos.mesa} | Pedido: #${datos.id_pedido}`);
  printer.drawLine();

  datos.items.forEach(item => {
    // Normalizamos el nombre del plato ignorando espacios extra y forzando mayúsculas
    const nombreLimpio = item.nombre.trim().toUpperCase();
    
    printer.alignLeft();
    if (esCocina) {
      printer.println(`${item.cantidad || 1}x ${nombreLimpio}`);
      if (item.notas) printer.println(`   Nota: ${item.notas.toUpperCase()}`);
    } else {
      printer.leftRight(`${item.cantidad || 1}x ${nombreLimpio}`, `S/ ${item.precio.toFixed(2)}`);
      if (item.notas) printer.println(`   -> ${item.notas.toUpperCase()}`);
    }
  });

  if (!esCocina) {
    printer.drawLine();
    printer.alignRight();
    printer.println(`TOTAL: S/ ${datos.total.toFixed(2)}`);
    printer.println("");
    printer.alignCenter();
    printer.println("¡Gracias por su preferencia!");
  }

  printer.cut();
  printer.beep();

  try {
    if (isConnected) {
      await printer.execute();
      console.log(`🖨️ Ticket físico impreso en ${tipo}: Pedido #${datos.id_pedido}`);
    } else {
      // Si no hay impresora, mostramos que se simuló correctamente
      console.log(`🖨️ (Simulación) Impreso en ${tipo}: Pedido #${datos.id_pedido}`);
    }
  } catch (error) {
    console.error(`❌ Fallo en impresora de ${tipo}:`, error);
  }
};

// ==========================================
// RUTAS Y SOCKETS (LÓGICA DE NEGOCIO)
// ==========================================

app.get('/api/status', (req, res) => {
  res.json({ mensaje: '¡El Servidor del POS está corriendo perfectamente!' });
});

// Sockets: Recibir pedido del Mozo
io.on('connection', (socket) => {
  console.log('📱 Nueva tablet/caja conectada:', socket.id);

  socket.on('nuevo-pedido', async (data) => {
    console.log(`\n🛎️  ¡NUEVO PEDIDO RECIBIDO! Mesa: ${data.mesa}`);
    
    try {
      // 1. Guardar en BD
      const queryPedido = 'INSERT INTO pedidos (id_mesa, total) VALUES ($1, $2) RETURNING id_pedido';
      const resPedido = await db.query(queryPedido, [data.mesa, data.total]);
      const idPedidoNuevo = resPedido.rows[0].id_pedido;

      for (let item of data.items) {
        const queryDetalle = `
          INSERT INTO detalle_pedidos (id_pedido, id_producto, cantidad, precio_unitario, notas)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await db.query(queryDetalle, [idPedidoNuevo, item.id, 1, item.precio, item.notas || '']);
      }

      await db.query("UPDATE mesas SET estado = 'OCUPADA' WHERE numero = $1", [data.mesa]);
      console.log(`✅ Pedido #${idPedidoNuevo} guardado en PostgreSQL correctamente.`);

      const pedidoConId = { ...data, id_pedido: idPedidoNuevo };

      // 2. Imprimir automáticamente en la Cocina (WiFi)
      await imprimir('COCINA', pedidoConId);

      // 3. Avisar a la Caja para que actualice la pantalla
      io.emit('alerta-caja', pedidoConId);

    } catch (error) {
      console.error('❌ Error guardando el pedido en PostgreSQL:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Dispositivo desconectado:', socket.id);
  });
});

// API REST: Procesar pago (Cobro Mixto)
app.post('/api/pagar', async (req, res) => {
  const { id_pedido, mesa, efectivo, yape, plin, tarjeta } = req.body;

  try {
    // 1. Cambiamos el estado del pedido a 'PAGADO' y guardamos con qué pagaron
    await db.query(`
      UPDATE pedidos 
      SET estado = 'PAGADO', 
          pago_efectivo = $1, 
          pago_yape = $2, 
          pago_plin = $3, 
          pago_tarjeta = $4 
      WHERE id_pedido = $5
    `, [efectivo || 0, yape || 0, plin || 0, tarjeta || 0, id_pedido]);
    
    // 2. Liberamos la mesa
    await db.query("UPDATE mesas SET estado = 'LIBRE' WHERE numero = $1", [mesa]);

    console.log(`💰 Pago Mixto procesado: Pedido #${id_pedido} de la Mesa ${mesa}`);
    
    // 3. Imprimimos el ticket físico de la boleta (Opcional, si tienes la impresora)
    // await imprimir('CAJA', req.body); // Descomenta esta línea cuando la impresora USB esté lista

    res.json({ success: true, mensaje: 'Pago completado' });

  } catch (error) {
    console.error('❌ Error procesando el pago mixto:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// API REST: Registrar un Nuevo Gasto
app.post('/api/gastos', async (req, res) => {
  const { concepto, categoria, monto } = req.body;
  try {
    await db.query(
      "INSERT INTO gastos (concepto, categoria, monto) VALUES ($1, $2, $3)", 
      [concepto, categoria, monto]
    );
    console.log(`💸 Gasto registrado: ${concepto} (S/ ${monto})`);
    res.json({ success: true, mensaje: 'Gasto guardado' });
  } catch (error) {
    console.error('❌ Error guardando el gasto:', error);
    res.status(500).json({ error: 'Error al registrar el gasto' });
  }
});

// API REST: Imprimir Boleta (Botón de la Caja)
app.post('/api/imprimir-ticket', async (req, res) => {
  try {
    // Llamamos a la función maestra pasándole los datos que envía la interfaz de React
    await imprimir('CAJA', req.body);
    res.json({ success: true, mensaje: 'Ticket enviado a la impresora USB' });
  } catch (error) {
    console.error('❌ Error en la impresión de Caja:', error);
    res.status(500).json({ error: 'Error de hardware' });
  }
});

// API REST: Reporte Diario y Cierre de Caja
app.get('/api/reporte-diario', async (req, res) => {
  try {
    // 1. Calculamos el total de ingresos de hoy (solo pedidos PAGADOS)
    const ingresosRes = await db.query(`
      SELECT SUM(total) as total_dia 
      FROM pedidos 
      WHERE estado = 'PAGADO' AND DATE(fecha_apertura) = CURRENT_DATE
    `);
    const totalDia = ingresosRes.rows[0].total_dia || 0;

    // 2. Traemos todos los detalles vendidos hoy
    const queryPlatos = `
      SELECT p.nombre, dp.cantidad
      FROM detalle_pedidos dp
      JOIN pedidos ped ON dp.id_pedido = ped.id_pedido
      JOIN productos p ON dp.id_producto = p.id_producto
      WHERE ped.estado = 'PAGADO' AND DATE(ped.fecha_apertura) = CURRENT_DATE
    `;
    const platosRes = await db.query(queryPlatos);

    // 3. Consolidación de platos: Unificamos nombres ignorando mayúsculas y espacios extra
    const consolidadoPlatos = platosRes.rows.reduce((acumulador, item) => {
      // Limpieza estricta: quitamos espacios a los lados, reducimos espacios dobles a uno, y pasamos a mayúsculas
      const nombreLimpio = item.nombre.trim().replace(/\s+/g, ' ').toUpperCase();
      
      if (!acumulador[nombreLimpio]) {
        acumulador[nombreLimpio] = 0;
      }
      acumulador[nombreLimpio] += item.cantidad;
      return acumulador;
    }, {});

    res.json({ 
      success: true, 
      total: parseFloat(totalDia).toFixed(2), 
      platos: consolidadoPlatos 
    });

  } catch (error) {
    console.error('❌ Error generando el reporte:', error);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

// Encender el servidor
server.listen(puerto, () => {
  console.log(`\n🚀 Servidor Backend corriendo en el puerto ${puerto}`);
});