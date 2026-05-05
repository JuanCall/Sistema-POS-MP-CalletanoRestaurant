const { exec } = require('child_process');
const express = require('express');
const http = require('http'); 
const { Server } = require('socket.io'); 
const cors = require('cors');
const db = require('./database');
const admin = require('firebase-admin');
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const firestore = admin.firestore();

const app = express();
const server = http.createServer(app); 
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] } });

app.use(cors());
app.use(express.json());

const aFechaLocal = (jsDate) => {
    const tzOffset = jsDate.getTimezoneOffset() * 60000;
    return new Date(jsDate.getTime() - tzOffset).toISOString().slice(0, 19).replace('T', ' ');
};

// =================================================================
// 1. CEREBRO MATEMÁTICO (Normalización y Tapers)
// =================================================================
const normalizar = (txt) => txt ? txt.toUpperCase().replace(/\s+/g, ' ').trim() : '';

function calcularRecargoTaper(modalidad, categoria, nombre) {
    if (modalidad === 'delivery_centro') return 5;
    if (modalidad === 'delivery') return 3; 
    if (modalidad !== 'llevar') return 0;   
    const cat = normalizar(categoria); const nom = normalizar(nombre);
    const cats1Sol = ['GUARNICIONES', 'JUGOS NATURALES', 'BEBIDAS HELADAS', 'BEBIDAS CALIENTES', 'CERVEZA', 'ENTRADAS', 'ENTRADA'];
    if (cats1Sol.includes(cat) || nom.includes('(ENTRADA)') || nom.includes('HUMITA')) return 1; 
    return 2; 
}

function calcularTotalMesa(pedido, modoDomingo = false) {
    let total = 0; let expE = []; let expS = []; let otros = [];
    pedido.forEach(item => {
        const catExacta = item.categoria ? item.categoria.trim() : ''; 
        if (!modoDomingo && (catExacta === 'entradas' || catExacta === 'entrada')) { for(let i=0; i<item.cantidad; i++) expE.push({...item, cantidad: 1}); } 
        else if (!modoDomingo && (catExacta === 'segundos' || catExacta === 'segundo')) { for(let i=0; i<item.cantidad; i++) expS.push({...item, cantidad: 1}); } 
        else { for(let i=0; i<item.cantidad; i++) otros.push({...item, cantidad: 1}); }
    });

    while (expE.length > 0 && expS.length > 0) {
        let E = expE.shift(); let S = expS.shift(); let recargo = 0;
        if (E.modalidad === 'delivery_centro' || S.modalidad === 'delivery_centro') recargo = 5;
        else if (E.modalidad === 'delivery' || S.modalidad === 'delivery') recargo = 3;
        else if (E.modalidad === 'llevar' && S.modalidad === 'llevar') recargo = 3; 
        else if (S.modalidad === 'llevar') recargo = 2;
        else if (E.modalidad === 'llevar') recargo = 1;
        total += (15 + recargo);
    }

    [...expE, ...expS, ...otros].forEach(item => {
        let recargo = calcularRecargoTaper(item.modalidad || 'local', item.categoria, item.nombre);
        total += ((parseFloat(item.precio) || 0) + recargo);
    });
    return total;
}

function fusionarPedidos(pedidoActual, itemsNuevos) {
    let fusionado = [...pedidoActual];
    itemsNuevos.forEach(nuevo => {
        const nomNormalizado = normalizar(nuevo.nombre);
        // Respeta si el item ya fue impreso para no mezclarlo con uno nuevo
        let idx = fusionado.findIndex(i => normalizar(i.nombre) === nomNormalizado && (i.modalidad || 'local') === (nuevo.modalidad || 'local') && normalizar(i.nota) === normalizar(nuevo.nota) && i.impreso === nuevo.impreso);
        
        if (idx > -1) fusionado[idx].cantidad += nuevo.cantidad;
        else fusionado.push({ nombre: nomNormalizado, precio: parseFloat(nuevo.precio) || 0, cantidad: nuevo.cantidad, modalidad: nuevo.modalidad || 'local', categoria: nuevo.categoria || 'GENERAL', nota: normalizar(nuevo.nota || ''), impreso: nuevo.impreso || false, cliente: nuevo.cliente || null });
    });
    fusionado.forEach(item => { item.subtotal = item.cantidad * ((item.precio || 0) + calcularRecargoTaper(item.modalidad || 'local', item.categoria, item.nombre)); });
    return fusionado;
}

// =================================================================
// 2. MOTOR DE SINCRONIZACIÓN AUTOMÁTICA (MEGA SYNC)
// =================================================================
async function sincronizarHaciaArriba() {
    try {
        const ventasPendientes = db.prepare('SELECT * FROM ventas WHERE sincronizado = 0').all();
        for (let venta of ventasPendientes) {
            // FORMATO: TKT-000000-YYYYMMDD
            const fechaLimpia = venta.fecha.split(' ')[0].replace(/-/g, ''); 
            const numeroTicket = String(venta.id).padStart(6, '0'); 
            const idPersonalizado = `TKT-${numeroTicket}-${fechaLimpia}`;

            await firestore.collection('ventas_historicas').doc(idPersonalizado).set({ 
                fecha: admin.firestore.Timestamp.fromDate(new Date(venta.fecha)), mesa: venta.mesa, total_cobrado: venta.total_cobrado, metodos_pago: JSON.parse(venta.metodos_pago), items: JSON.parse(venta.items), origen: 'Desktop' 
            });
            db.prepare('UPDATE ventas SET sincronizado = 1 WHERE id = ?').run(venta.id);
        }

        const gastosPendientes = db.prepare('SELECT * FROM gastos WHERE sincronizado = 0').all();
        for (let gasto of gastosPendientes) {
            // FORMATO: GAS-0000
            const numeroGasto = String(gasto.id).padStart(4, '0');
            const idPersonalizado = `GAS-${numeroGasto}`;

            await firestore.collection('gastos').doc(idPersonalizado).set({ 
                categoria: gasto.categoria, concepto: gasto.descripcion, fecha: admin.firestore.Timestamp.fromDate(new Date(gasto.fecha)), monto: gasto.monto, origen: 'Desktop' 
            });
            db.prepare('UPDATE gastos SET sincronizado = 1 WHERE id = ?').run(gasto.id);
        }
    } catch (e) { console.log("Modo offline activado (Subida)."); }
}

app.get('/api/init-sync', async (req, res) => {
    try {
        console.log("☁️ Iniciando Mega-Sincronización automática...");
        await sincronizarHaciaArriba(); 

        // SEGURIDAD: Antes de borrar lo local, comprobamos que no haya quedado nada pendiente de subir
        const pendingV = db.prepare('SELECT COUNT(*) as c FROM ventas WHERE sincronizado = 0').get().c;
        const pendingG = db.prepare('SELECT COUNT(*) as c FROM gastos WHERE sincronizado = 0').get().c;
        if (pendingV > 0 || pendingG > 0) {
            return res.status(500).json({ error: 'No se pudo respaldar la info local antes de sincronizar por problemas de internet.' });
        }

        // Descargamos de Firebase en orden ASCENDENTE (Del más antiguo al más nuevo)
        const [cartaSnap, menuSnap, mesasSnap, ventasSnap, gastosSnap] = await Promise.all([
            firestore.collection('contenido').doc('cartaCompleta').get(),
            firestore.collection('contenido').doc('menuDiario').get(),
            firestore.collection('mesas_pos').get(),
            firestore.collection('ventas_historicas').orderBy('fecha', 'asc').get(), 
            firestore.collection('gastos').orderBy('fecha', 'asc').get()
        ]);

        db.prepare("DELETE FROM platos").run(); db.prepare("DELETE FROM categorias").run();
        let idCat = 1;
        const insertCat = db.prepare("INSERT INTO categorias (id, nombre) VALUES (?, ?)");
        const insertPlato = db.prepare("INSERT INTO platos (categoria_id, nombre, precio) VALUES (?, ?, ?)");

        if (cartaSnap.exists) {
            (cartaSnap.data().categorias || []).forEach(cat => {
                if (cat.nombre) { 
                    insertCat.run(idCat, cat.nombre); 
                    
                    // Verificamos si la categoría es de bebidas/jugos
                    const esJugo = cat.nombre.toLowerCase().includes('jugo') || cat.nombre.toLowerCase().includes('bebida');
                    
                    (cat.items || []).forEach(it => { 
                        if(it.nombre && it.precio) {
                            const p1 = parseFloat(it.precio);
                            const p2 = parseFloat(it.precio2) || 0;
                            const nombrePlato = normalizar(it.nombre);
                            
                            if (p2 > 0) {
                                // Si tiene un segundo precio válido, creamos DOS botones en el POS
                                const sufijo1 = esJugo ? ' (Vaso)' : ' (Personal)';
                                const sufijo2 = esJugo ? ' (Jarra)' : ' (Fuente)';
                                
                                insertPlato.run(idCat, nombrePlato + sufijo1, p1);
                                insertPlato.run(idCat, nombrePlato + sufijo2, p2);
                            } else {
                                // Si solo tiene un precio (precio2 es 0 o no existe), pasa normal
                                insertPlato.run(idCat, nombrePlato, p1); 
                            }
                        } 
                    }); 
                    idCat++; 
                }
            });
        }
        if (menuSnap.exists) {
            const m = menuSnap.data();
            if (m.entradas && m.entradas.length > 0) { insertCat.run(idCat, 'entradas'); m.entradas.forEach(e => insertPlato.run(idCat, normalizar(e.nombre), parseFloat(e.precio || 0))); idCat++; }
            if (m.segundos && m.segundos.length > 0) { insertCat.run(idCat, 'segundos'); m.segundos.forEach(s => insertPlato.run(idCat, normalizar(s.nombre), parseFloat(s.precio || 0))); idCat++; }        }

        // SINCRONIZACIÓN INTELIGENTE DE MESAS:
        // Crea las mesas base de Firebase si la app es nueva, pero RESPETA y no borra las mesas que ya tienen pedidos activos locales.
        const insertMesa = db.prepare("INSERT OR IGNORE INTO mesas_activas (id, estado, pedido, total, nota_general) VALUES (?, ?, ?, ?, ?)");
        mesasSnap.forEach(doc => { 
            const d = doc.data(); 
            insertMesa.run(doc.id, d.estado || 'libre', JSON.stringify(d.pedido_actual || []), d.total_consumo || 0, d.nota_general || ''); 
        });
        
        // RESET DE IDs: Borramos las tablas y reseteamos el autoincrementador a cero
        db.prepare("DELETE FROM ventas").run(); 
        try { db.prepare("DELETE FROM sqlite_sequence WHERE name='ventas'").run(); } catch(e){} // Resetea el ID a 1
        
        const insertVenta = db.prepare("INSERT INTO ventas (mesa, total_cobrado, metodos_pago, items, fecha, sincronizado) VALUES (?, ?, ?, ?, ?, 1)");
        ventasSnap.forEach(doc => { 
            try {
                const d = doc.data(); 
                let fechaLocal = new Date().toISOString().replace('T', ' ');
                if (d.fecha && typeof d.fecha.toDate === 'function') {
                    fechaLocal = aFechaLocal(d.fecha.toDate());
                } else if (d.fecha && d.fecha.seconds) { 
                    fechaLocal = aFechaLocal(new Date(d.fecha.seconds * 1000));
                } else if (d.fecha) {
                    fechaLocal = aFechaLocal(new Date(d.fecha));
                }
                
                insertVenta.run(
                    d.mesa || 'Desconocida', parseFloat(d.total_cobrado) || 0, 
                    JSON.stringify(d.metodos_pago || { efectivo: parseFloat(d.total_cobrado) || 0 }), 
                    JSON.stringify(d.items || []), fechaLocal
                );
            } catch(err) {}
        });

        // RESET DE IDs: Borramos Gastos y reseteamos el autoincrementador
        db.prepare("DELETE FROM gastos").run();
        try { db.prepare("DELETE FROM sqlite_sequence WHERE name='gastos'").run(); } catch(e){}
        
        const insertGasto = db.prepare("INSERT INTO gastos (descripcion, monto, categoria, fecha, sincronizado) VALUES (?, ?, ?, ?, 1)");
        gastosSnap.forEach(doc => { 
            try {
                const d = doc.data(); 
                let fechaLocal = new Date().toISOString().replace('T', ' ');
                if (d.fecha && typeof d.fecha.toDate === 'function') fechaLocal = aFechaLocal(d.fecha.toDate());
                insertGasto.run(d.concepto || 'Gasto', d.monto || 0, d.categoria || 'Otros', fechaLocal); 
            } catch(err) {}
        });

        io.emit('actualizar_mesas');
        res.json({ success: true, message: 'Mega-Sincronización completada' });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Error en Mega-Sync' }); }
});

setInterval(sincronizarHaciaArriba, 60000);

// =================================================================
// 3. RUTAS API
// =================================================================
io.on('connection', (socket) => { console.log(`🟢 Socket conectado: ${socket.id}`); });
app.get('/api/status', (req, res) => res.json({ status: 'online' }));

app.post('/api/login', (req, res) => {
    const user = db.prepare('SELECT * FROM usuarios WHERE username = ? AND password = ?').get(req.body.username, req.body.password);
    if (user) res.json({ success: true, user: { username: user.username, rol: user.rol } });
    else res.status(401).json({ error: 'Credenciales incorrectas' });
});

app.get('/api/mesas', (req, res) => res.json(db.prepare('SELECT * FROM mesas_activas').all().map(m => ({ ...m, pedido: JSON.parse(m.pedido) }))));
app.get('/api/carta', (req, res) => res.json(db.prepare('SELECT * FROM categorias').all().map(cat => ({ nombre: cat.nombre, items: db.prepare('SELECT * FROM platos WHERE categoria_id = ?').all(cat.id) }))));

app.post('/api/pedidos', (req, res) => {
    const { mesa, items, nota_general } = req.body;
    
    // Los pedidos que envía el Mozo se imprimen de inmediato, por ende nacen como "impresos"
    items.forEach(i => i.impreso = true);
    
    let row = db.prepare('SELECT pedido FROM mesas_activas WHERE id = ?').get(mesa);
    if (!row) {
        db.prepare(`INSERT INTO mesas_activas (id, estado, pedido, total, nota_general) VALUES (?, 'ocupada', '[]', 0, ?)`).run(mesa, nota_general || '');
        row = { pedido: '[]' };
    }
    
    let nuevoPedido = fusionarPedidos(JSON.parse(row.pedido), items);
    let nuevoTotal = calcularTotalMesa(nuevoPedido, new Date().getDay() === 0);
    
    db.prepare(`UPDATE mesas_activas SET estado = 'ocupada', pedido = ?, total = ?, nota_general = COALESCE(NULLIF(nota_general, ''), ?) WHERE id = ?`).run(JSON.stringify(nuevoPedido), nuevoTotal, nota_general || '', mesa);
    
    io.emit('alerta_sonora'); io.emit('actualizar_mesas'); 
    io.emit('imprimir_cocina', { mesa: mesa, items: items }); 
    res.json({ success: true });
});

app.put('/api/mesas/:id/pedido', (req, res) => {
    try {
        const { pedido } = req.body;
        pedido.forEach(item => { item.subtotal = item.cantidad * ((parseFloat(item.precio) || 0) + calcularRecargoTaper(item.modalidad || 'local', item.categoria, item.nombre)); });
        let nuevoTotal = calcularTotalMesa(pedido, new Date().getDay() === 0);
        let nuevoEstado = pedido.length === 0 ? 'libre' : 'ocupada';

        db.prepare(`UPDATE mesas_activas SET estado = ?, pedido = ?, total = ? WHERE id = ?`).run(nuevoEstado, JSON.stringify(pedido), nuevoTotal, req.params.id);
        io.emit('actualizar_mesas'); res.json({ success: true, totalCalculado: nuevoTotal });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Error al actualizar pedido' }); }
});

app.post('/api/cobrar', (req, res) => {
    const { mesaId, metodosPago, totalCobrado, items } = req.body;
    db.prepare(`INSERT INTO ventas (mesa, total_cobrado, metodos_pago, items, fecha, sincronizado) VALUES (?, ?, ?, ?, datetime('now', 'localtime'), 0)`).run(mesaId, totalCobrado, JSON.stringify(metodosPago), JSON.stringify(items));
    
    // Si es una mesa física, se libera. Si es un Delivery Virtual, se DESTRUYE de la pantalla.
    if (String(mesaId).startsWith('DEL-')) {
        db.prepare(`DELETE FROM mesas_activas WHERE id = ?`).run(mesaId);
    } else {
        db.prepare(`UPDATE mesas_activas SET estado = 'libre', pedido = '[]', total = 0, nota_general = '' WHERE id = ?`).run(mesaId);
    }
    
    io.emit('actualizar_mesas'); sincronizarHaciaArriba();
    res.json({ success: true });
});

// =================================================================
// RUTAS DE CONFIGURACIÓN E IMPRESORAS
// =================================================================
app.get('/api/impresoras', (req, res) => {
  exec('powershell -Command "Get-Printer | Select-Object Name | ConvertTo-Json"', (error, stdout, stderr) => {
    if (error) return res.json([]);
    try {
      const printers = JSON.parse(stdout);
      const printerList = Array.isArray(printers) ? printers.map(p => p.Name) : [printers.Name];
      res.json(printerList);
    } catch (e) { res.json([]); }
  });
});

app.get('/api/config', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM configuracion`).all();
    const config = {};
    rows.forEach(row => { config[row.clave] = row.valor; });
    res.json(config);
  } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/api/config', (req, res) => {
  try {
    const { ticketera_caja, ticketera_cocina } = req.body;
    const stmt = db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)`);
    stmt.run('ticketera_caja', ticketera_caja);
    stmt.run('ticketera_cocina', ticketera_cocina);
    res.json({ message: 'Configuración guardada' });
  } catch (err) { res.status(500).json({error: err.message}); }
});

// =================================================================
// RUTAS DE VENTAS (Con borrado en Firestore)
// =================================================================
app.get('/api/ventas', (req, res) => {
    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];
    res.json(db.prepare("SELECT * FROM ventas WHERE date(fecha) = date(?) ORDER BY id DESC").all(fecha));
});

app.delete('/api/ventas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Obtener la venta local para calcular su ID de Firestore
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
    if (venta) {
        const fechaLimpia = venta.fecha.split(' ')[0].replace(/-/g, ''); 
        const numeroTicket = String(venta.id).padStart(6, '0'); 
        const idFirestore = `TKT-${numeroTicket}-${fechaLimpia}`;
        // 2. Borrar de Firestore
        await firestore.collection('ventas_historicas').doc(idFirestore).delete();
    }
    // 3. Borrar localmente
    db.prepare(`DELETE FROM ventas WHERE id = ?`).run(id);
    res.json({ message: 'Venta anulada en local y nube' });
  } catch (error) {
    res.status(500).json({ error: 'Error al anular', detalle: error.message });
  }
});

// =================================================================
// RUTAS DE GASTOS 
// =================================================================
app.get('/api/gastos', (req, res) => {
    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];
    res.json(db.prepare("SELECT * FROM gastos WHERE date(fecha) = date(?) ORDER BY id DESC").all(fecha));
});

app.post('/api/gastos', async (req, res) => {
  const { descripcion, monto, categoria, fecha } = req.body;
  if (!descripcion || monto === undefined) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const fechaReal = fecha || new Date().toISOString().replace('T', ' ');
    // 1. Insertar localmente
    const result = db.prepare(`INSERT INTO gastos (descripcion, monto, categoria, fecha, sincronizado) VALUES (?, ?, ?, ?, 1)`).run(descripcion, monto, categoria || 'Otros', fechaReal);
    
    // 2. Armar ID Firestore
    const idGasto = result.lastInsertRowid;
    const numeroGasto = String(idGasto).padStart(4, '0');
    const idFirestore = `GAS-${numeroGasto}`;

    // 3. Subir a Firestore
    await firestore.collection('gastos').doc(idFirestore).set({ 
        categoria: categoria || 'Otros', 
        concepto: descripcion, 
        fecha: admin.firestore.Timestamp.fromDate(new Date(fechaReal)), 
        monto: parseFloat(monto), 
        origen: 'Desktop' 
    });

    res.json({ id: idGasto, descripcion, monto, categoria, fecha: fechaReal });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar el gasto' });
  }
});

app.delete('/api/gastos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Calcular el ID de Firestore (ej. GAS-0005)
    const numeroGasto = String(id).padStart(4, '0');
    const idFirestore = `GAS-${numeroGasto}`;

    // 2. Borrar de la nube (Firestore)
    await firestore.collection('gastos').doc(idFirestore).delete();

    // 3. Borrar de la base de datos local (SQLite)
    db.prepare('DELETE FROM gastos WHERE id = ?').run(id);
    
    res.json({ success: true, message: 'Gasto eliminado de local y nube' });
  } catch (error) {
    res.status(500).json({ error: 'Error al anular gasto', detalle: error.message });
  }
});

// =================================================================
// RUTAS DE VENTAS (Con borrado en Firestore)
// =================================================================
app.get('/api/ventas', (req, res) => {
    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];
    res.json(db.prepare("SELECT * FROM ventas WHERE date(fecha) = date(?) ORDER BY id DESC").all(fecha));
});

app.delete('/api/ventas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Obtener la venta local para calcular su ID de Firestore
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
    if (venta) {
        const fechaLimpia = venta.fecha.split(' ')[0].replace(/-/g, ''); 
        const numeroTicket = String(venta.id).padStart(6, '0'); 
        const idFirestore = `TKT-${numeroTicket}-${fechaLimpia}`;
        // 2. Borrar de Firestore
        await firestore.collection('ventas_historicas').doc(idFirestore).delete();
    }
    // 3. Borrar localmente
    db.prepare(`DELETE FROM ventas WHERE id = ?`).run(id);
    res.json({ message: 'Venta anulada en local y nube' });
  } catch (error) {
    res.status(500).json({ error: 'Error al anular', detalle: error.message });
  }
});

app.get('/api/reporte-diario', (req, res) => {
    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];
    const ventas = db.prepare("SELECT total_cobrado, metodos_pago, items FROM ventas WHERE date(fecha) = date(?)").all(fecha);
    const gastos = db.prepare("SELECT monto FROM gastos WHERE date(fecha) = date(?)").all(fecha);

    let totales = { efectivo: 0, yape: 0, plin: 0, tarjeta: 0, totalVentas: 0, totalGastos: 0, balance: 0 };
    let contadorPlatos = {};

    ventas.forEach(v => {
        const pagos = JSON.parse(v.metodos_pago || '{}');
        totales.efectivo += parseFloat(pagos.efectivo || 0); totales.yape += parseFloat(pagos.yape || 0);
        totales.plin += parseFloat(pagos.plin || 0); totales.tarjeta += parseFloat(pagos.tarjeta || 0);
        totales.totalVentas += v.total_cobrado;
        
        JSON.parse(v.items || '[]').forEach(it => {
            let nombre = normalizar(it.nombre);
            let cat = normalizar(it.categoria || '');
            
            const catProhibidas = ['BEBIDAS HELADAS', 'GUARNICIONES', 'JUGOS NATURALES', 'BEBIDAS CALIENTES', 'CERVEZA'];
            const esLogistica = nombre.includes('TAPER') || nombre.includes('REFRESCO');
            const excluirGrafico = nombre.includes('(EXTRA)') || nombre.includes('(SEGUNDO)') || nombre.includes('(ENTRADA)') || nombre === 'HUMITA';

            if(!catProhibidas.includes(cat) && !esLogistica && !excluirGrafico) {
                // AGRUPADOR: Fusiona todas las variantes de menú completo en una sola
                if (nombre.startsWith('MENÚ COMPLETO')) nombre = 'MENÚ COMPLETO';
                
                contadorPlatos[nombre] = (contadorPlatos[nombre] || 0) + it.cantidad;
            }
        });
    });

    gastos.forEach(g => totales.totalGastos += g.monto);
    totales.balance = totales.totalVentas - totales.totalGastos;
    let topPlatos = Object.keys(contadorPlatos).map(k => ({ nombre: k, cant: contadorPlatos[k] })).sort((a,b) => b.cant - a.cant).slice(0, 5);
    res.json({ totales, topPlatos });
});

app.get('/api/dashboard', (req, res) => {
    try {
        const mesParam = req.query.mes || new Date().toISOString().slice(0, 7); 
        const [yearParam, monthParam] = mesParam.split('-');

        const ventas = db.prepare("SELECT fecha, total_cobrado, items FROM ventas").all();
        const gastos = db.prepare("SELECT fecha, monto FROM gastos").all();

        let diasStr = []; let ingXDia = []; let gasXDia = [];
        for(let i=1; i<=31; i++) { diasStr.push(i.toString()); ingXDia.push(0); gasXDia.push(0); }

        let contadorPlatos = {}; let totalIng = 0; let totalGas = 0;

        ventas.forEach(v => {
            if (v.fecha.startsWith(`${yearParam}-${monthParam}`)) {
                let dia = parseInt(v.fecha.split(' ')[0].split('-')[2]); 
                if(!isNaN(dia)) ingXDia[dia-1] += v.total_cobrado;
                totalIng += v.total_cobrado;
                
                JSON.parse(v.items || '[]').forEach(it => {
                    let nombre = normalizar(it.nombre);
                    let cat = normalizar(it.categoria || '');
                    
                    const catProhibidas = ['BEBIDAS HELADAS', 'GUARNICIONES', 'JUGOS NATURALES', 'BEBIDAS CALIENTES', 'CERVEZA'];
                    const esLogistica = nombre.includes('TAPER') || nombre.includes('REFRESCO');
                    const excluirGrafico = nombre.includes('(EXTRA)') || nombre.includes('(SEGUNDO)') || nombre.includes('(ENTRADA)') || nombre === 'HUMITA';

                    if(!catProhibidas.includes(cat) && !esLogistica && !excluirGrafico) {
                        // AGRUPADOR: Fusiona todas las variantes de menú completo
                        if (nombre.startsWith('MENÚ COMPLETO')) nombre = 'MENÚ COMPLETO';
                        
                        contadorPlatos[nombre] = (contadorPlatos[nombre] || 0) + it.cantidad;
                    }
                });
            }
        });

        gastos.forEach(g => {
            if (g.fecha.startsWith(`${yearParam}-${monthParam}`)) {
                let dia = parseInt(g.fecha.split(' ')[0].split('-')[2]);
                if(!isNaN(dia)) gasXDia[dia-1] += g.monto;
                totalGas += g.monto;
            }
        });

        let rankingAll = Object.keys(contadorPlatos).map(k => ({ nombre: k, cantidad: contadorPlatos[k] })).sort((a,b) => b.cantidad - a.cantidad);
        let platoCorona = rankingAll.length > 0 ? rankingAll[0] : null;
        let restoRanking = rankingAll.slice(1);

        // FILTRO ESTRICTO: Solo reconoce Menú Completo y Almuerzos reales
        const esMenu = (n) => {
            const norm = n.toUpperCase();
            return norm === 'MENÚ COMPLETO' || norm.startsWith('ALMUERZO:');
        };

        let rankingMenu = restoRanking.filter(p => esMenu(p.nombre)).slice(0, 10);
        let rankingCarta = restoRanking.filter(p => !esMenu(p.nombre)).slice(0, 10);

        res.json({ totales: { ingresos: totalIng, gastos: totalGas, neto: totalIng - totalGas }, evolucion: { labels: diasStr, ingresos: ingXDia, gastos: gasXDia }, platoCorona, rankingMenu, rankingCarta });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Error dashboard' }); }
});

// =================================================================
// RUTAS DE CONFIGURACIÓN E IMPRESORAS
// =================================================================
app.get('/api/impresoras', (req, res) => {
  exec('powershell -Command "Get-Printer | Select-Object Name | ConvertTo-Json"', (error, stdout, stderr) => {
    if (error) return res.json([]);
    try {
      const printers = JSON.parse(stdout);
      const printerList = Array.isArray(printers) ? printers.map(p => p.Name) : [printers.Name];
      res.json(printerList);
    } catch (e) { res.json([]); }
  });
});

app.get('/api/config', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM configuracion`).all();
    const config = {};
    rows.forEach(row => { config[row.clave] = row.valor; });
    res.json(config);
  } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/api/config', (req, res) => {
  try {
    const { ticketera_caja, ticketera_cocina } = req.body;
    const stmt = db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)`);
    stmt.run('ticketera_caja', ticketera_caja);
    stmt.run('ticketera_cocina', ticketera_cocina);
    res.json({ message: 'Configuración guardada' });
  } catch (err) { res.status(500).json({error: err.message}); }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 SERVIDOR LISTO EN PUERTO ${PORT}`));