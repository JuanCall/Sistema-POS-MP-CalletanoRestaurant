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

let modoDomingoGlobal = false;
let estadoRestauranteGlobal = { apertura: 12, cierre: 22, cierreForzado: '' };
let rawMenuDiario = {};
let rawCartaCompleta = {};

const aFechaLocal = (jsDate) => {
    const tzOffset = jsDate.getTimezoneOffset() * 60000;
    return new Date(jsDate.getTime() - tzOffset).toISOString().slice(0, 19).replace('T', ' ');
};

// 🟢 Funciones de formato de IDs
const pad2 = (num) => String(num).padStart(2, '0'); 
const pad4 = (num) => String(num).padStart(4, '0'); 
const pad5 = (num) => String(num).padStart(5, '0'); 
const pad6 = (num) => String(num).padStart(6, '0'); 

const normalizar = (txt) => txt ? txt.toUpperCase().replace(/\s+/g, ' ').trim() : '';

// 🟢 CEREBRO MATEMÁTICO: Recargos Automáticos por Taper y Delivery
function calcularRecargoTaper(item) {
    if (item.modalidad === 'local') return 0; 
    
    const cat = normalizar(item.categoria); 
    const categoriasBebidas = ['JUGOS NATURALES', 'BEBIDAS HELADAS', 'BEBIDAS CALIENTES', 'CERVEZA', 'BEBIDAS'];
    if (categoriasBebidas.includes(cat)) return 1; 

    let recargoEnvase = item.costo_taper || 0;
    
    if (!item.costo_taper && item.taper) {
        const tArr = Array.isArray(item.taper) ? item.taper : [item.taper];
        tArr.forEach(t => {
            if (t === 'chico' || t === 'sopa') recargoEnvase += 1;
            if (t === 'mediano' || t === 'grande') recargoEnvase += 2;
        });
    } else if (!item.costo_taper && (!item.taper || item.taper.length === 0)) {
        const nom = normalizar(item.nombre);
        if (nom.includes('(ENTRADA)') || nom.includes('HUMITA') || nom.includes('ARROZ') || nom.includes('CAMOTE') || nom.includes('YUCA')) recargoEnvase += 1;
    }
    
    let recargoZona = 0;
    if (item.modalidad === 'delivery') recargoZona = 1;
    if (item.modalidad === 'delivery_centro') recargoZona = 3;
    
    return recargoEnvase + recargoZona; 
}

function agruparItemsParaVenta(pedido, modoDomingo = false) {
    let finalItems = []; let entries = []; let mains = []; let others = [];
    pedido.forEach(item => {
        const cat = item.categoria ? item.categoria.toLowerCase().trim() : '';
        const subtotalUnitario = item.subtotal / item.cantidad;
        const itemClon = { ...item, cantidad: 1, subtotal: subtotalUnitario };
        if (!modoDomingo && cat === 'entradas') { for(let i=0; i<item.cantidad; i++) entries.push({...itemClon}); }
        else if (!modoDomingo && cat === 'segundos') { for(let i=0; i<item.cantidad; i++) mains.push({...itemClon}); }
        else { 
            if (modoDomingo && cat === 'segundos' && !item.nombre.toUpperCase().startsWith('ALMUERZO:')) item.nombre = `Almuerzo: ${item.nombre}`;
            others.push(item); 
        }
    });

    const getModTag = (mod) => {
        if (mod === 'delivery_centro') return 'Centro';
        if (mod === 'delivery') return 'Delivery';
        if (mod === 'llevar') return 'Llevar';
        return null; 
    };

    while (entries.length > 0 && mains.length > 0) {
        let e = entries.shift(); let s = mains.shift(); let label = "MENÚ COMPLETO"; let recargo = 0;
        const tagE = getModTag(e.modalidad); const tagS = getModTag(s.modalidad);
        if (tagE && tagS) label += (e.modalidad === s.modalidad) ? ` (${tagE})` : ` (E/${tagE} S/${tagS})`;
        else if (tagE) label += ` (E/${tagE})`; 
        else if (tagS) label += ` (S/${tagS})`; 
        
        // 🟢 FUSIÓN DE TAPERS Y CÁLCULO DINÁMICO DE PRECIO PARA MENÚ COMPLETO
        let tapersAgrupados = [];
        let costoTapers = 0;

        if (e.taper) tapersAgrupados.push(...(Array.isArray(e.taper) ? e.taper : [e.taper]));
        if (s.taper) tapersAgrupados.push(...(Array.isArray(s.taper) ? s.taper : [s.taper]));

        if (e.modalidad !== 'local' || s.modalidad !== 'local') {
            tapersAgrupados.forEach(t => {
                if (t === 'chico' || t === 'sopa') costoTapers += 1;
                if (t === 'mediano' || t === 'grande') costoTapers += 2;
            });
        }

        let recargoZona = 0;
        if (e.modalidad === 'delivery_centro' || s.modalidad === 'delivery_centro') recargoZona = 3;
        else if (e.modalidad === 'delivery' || s.modalidad === 'delivery') recargoZona = 1;

        recargo = costoTapers + recargoZona;

        finalItems.push({ nombre: label, precio: 15 + recargo, cantidad: 1, subtotal: 15 + recargo, modalidad: e.modalidad || s.modalidad, taper: tapersAgrupados });
    }

    [...entries, ...mains, ...others].forEach(it => {
        let idx = finalItems.findIndex(f => f.nombre === it.nombre && f.modalidad === it.modalidad && (f.nota || '') === (it.nota || '') && JSON.stringify(f.taper) === JSON.stringify(it.taper));
        if (idx > -1) { finalItems[idx].cantidad += it.cantidad; finalItems[idx].subtotal += it.subtotal; } 
        else { finalItems.push(it); }
    });
    return finalItems;
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
        
        // 🟢 CÁLCULO DINÁMICO DE PRECIO PARA MENÚ COMPLETO
        let costoTapers = 0;
        if (E.modalidad !== 'local' || S.modalidad !== 'local') {
            const tArrE = Array.isArray(E.taper) ? E.taper : [E.taper];
            const tArrS = Array.isArray(S.taper) ? S.taper : [S.taper];
            [...tArrE, ...tArrS].forEach(t => {
                if (t === 'chico' || t === 'sopa') costoTapers += 1;
                if (t === 'mediano' || t === 'grande') costoTapers += 2;
            });
        }

        let recargoZona = 0;
        if (E.modalidad === 'delivery_centro' || S.modalidad === 'delivery_centro') recargoZona = 3;
        else if (E.modalidad === 'delivery' || S.modalidad === 'delivery') recargoZona = 1;
        
        recargo = costoTapers + recargoZona;
        total += (15 + recargo);
    }

    [...expE, ...expS, ...otros].forEach(item => { total += ((parseFloat(item.precio) || 0) + calcularRecargoTaper(item)); });
    return total;
}

function fusionarPedidos(pedidoActual, itemsNuevos) {
    let fusionado = [...pedidoActual];
    itemsNuevos.forEach(nuevo => {
        const nomNormalizado = normalizar(nuevo.nombre);
        let idx = fusionado.findIndex(i => normalizar(i.nombre) === nomNormalizado && (i.modalidad || 'local') === (nuevo.modalidad || 'local') && normalizar(i.nota) === normalizar(nuevo.nota) && i.impreso === nuevo.impreso && JSON.stringify(i.taper) === JSON.stringify(nuevo.taper));
        if (idx > -1) fusionado[idx].cantidad += nuevo.cantidad;
        else fusionado.push({ nombre: nomNormalizado, precio: parseFloat(nuevo.precio) || 0, cantidad: nuevo.cantidad, modalidad: nuevo.modalidad || 'local', categoria: nuevo.categoria || 'GENERAL', nota: normalizar(nuevo.nota || ''), impreso: nuevo.impreso || false, cliente: nuevo.cliente || null, taper: nuevo.taper || [] });
    });
    fusionado.forEach(item => { item.subtotal = item.cantidad * ((item.precio || 0) + calcularRecargoTaper(item)); });
    return fusionado;
}

function actualizarStockMenuFirebase(nombrePlatoDB, cantidadCambio) {
    let modificado = false;
    const nomNormalizado = normalizar(nombrePlatoDB);

    if (rawMenuDiario.entradas) {
        rawMenuDiario.entradas.forEach(e => {
            if (normalizar(e.nombre) === nomNormalizado && e.stock !== null && e.stock !== undefined && e.stock !== '') {
                e.stock = Math.max(0, (parseFloat(e.stock) || 0) + cantidadCambio);
                modificado = true;
            }
        });
    }
    if (rawMenuDiario.segundos) {
        rawMenuDiario.segundos.forEach(s => {
            if (normalizar(s.nombre) === nomNormalizado && s.stock !== null && s.stock !== undefined && s.stock !== '') {
                s.stock = Math.max(0, (parseFloat(s.stock) || 0) + cantidadCambio);
                modificado = true;
            }
        });
    }
    if (modificado) firestore.collection('contenido').doc('menuDiario').set(rawMenuDiario).catch(()=>{});
}

function registrarMovimientoInventario(insumoNombre, cantidad, tipo, referencia) {
    try {
        const nomNorm = normalizar(insumoNombre);
        // 🟢 CORRECCIÓN: Usamos UPPER(nombre) para que "Taper chico" coincida con "TAPER CHICO"
        const insumo = db.prepare('SELECT id, stock_actual, nombre FROM insumos WHERE UPPER(nombre) = ?').get(nomNorm);
        if (insumo) {
            db.prepare('UPDATE insumos SET stock_actual = stock_actual + ? WHERE id = ?').run(cantidad, insumo.id);
            const info = db.prepare(`INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, referencia) VALUES (?, ?, ?, ?)`).run(insumo.id, tipo, cantidad, referencia);
            
            const firestoreInsumoId = `INS-${pad4(insumo.id)}`;
            const d = new Date();
            const yyyymmdd = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
            const firestoreMovId = `MOV-${pad6(info.lastInsertRowid)}-${yyyymmdd}-${firestoreInsumoId}`;

            const newStock = insumo.stock_actual + cantidad;
            firestore.collection('insumos').doc(firestoreInsumoId).set({ stock_actual: newStock }, { merge: true }).catch(()=>{});
            firestore.collection('movimientos_inventario').doc(firestoreMovId).set({
                insumo_id: firestoreInsumoId, tipo, cantidad, referencia, fecha: admin.firestore.FieldValue.serverTimestamp()
            }).catch(()=>{});
        }
    } catch(e) { console.error("Error en inventario:", e.message); }
}

function procesarRecetasVenta(items, refTicket, esRestauracion = false) {
    const factorMates = esRestauracion ? 1 : -1;
    
    items.forEach(item => {
        const nom = normalizar(item.nombre);
        const qty = item.cantidad;

        // 1. DESCUENTO BOTONES RÁPIDOS
        if (nom.startsWith('TAPER ')) {
            registrarMovimientoInventario(nom, qty * factorMates, esRestauracion ? 'RESTAURACION' : 'VENTA DIRECTA', refTicket);
            return;
        }

        // 2. DESCUENTO TAPERS DEL MENÚ DIARIO (Desde el Array)
        if (item.taper && item.modalidad !== 'local') {
            const tapers = Array.isArray(item.taper) ? item.taper : [item.taper];
            tapers.forEach(t => {
                if (t && String(t).trim() !== '') {
                    const nombreTaper = `TAPER ${normalizar(t)}`;
                    registrarMovimientoInventario(nombreTaper, qty * factorMates, esRestauracion ? 'RESTAURACION' : 'CONSUMO', refTicket);
                }
            });
        }

        // 3. DESCUENTO RECETAS DE LA CARTA
        const esFuente = nom.includes('(FUENTE)') || nom.includes('(JARRA)');
        let nombreBase = nom;
        if (nom.includes(' (FUENTE)')) nombreBase = nom.replace(' (FUENTE)', ' (PERSONAL)');
        if (nom.includes(' (JARRA)')) nombreBase = nom.replace(' (JARRA)', ' (VASO)');

        const plato = db.prepare('SELECT id, stock_diario, receta_json, nombre FROM platos WHERE UPPER(nombre) = ?').get(nombreBase);
        if (plato) {
            if (plato.receta_json) {
                const ingredientes = JSON.parse(plato.receta_json);
                ingredientes.forEach(ing => {
                    const insumoRow = db.prepare('SELECT id, nombre FROM insumos WHERE id = ?').get(ing.insumo_id);
                    if (insumoRow) {
                        const nombreInsumo = normalizar(insumoRow.nombre);
                        const esTaper = nombreInsumo.includes('TAPER') || nombreInsumo.includes('ENVASE');
                        
                        // Si comen local, no descontamos envases de la receta
                        if (esTaper && item.modalidad === 'local') return;

                        const multiplicador = esFuente ? 2 : 1;
                        const totalDeducir = ing.cantidad_requerida * qty * multiplicador;
                        registrarMovimientoInventario(insumoRow.nombre, totalDeducir * factorMates, esRestauracion ? 'RESTAURACION' : 'CONSUMO', refTicket);
                    }
                });
            }
            if (plato.stock_diario !== null) {
                db.prepare('UPDATE platos SET stock_diario = stock_diario + ? WHERE id = ?').run(qty * factorMates, plato.id);
                actualizarStockMenuFirebase(plato.nombre, qty * factorMates);
            }
        }
    });
}

function auditarStockYAlertar() {
    const alertasMenu = [];
    const alertasCarta = [];
    const platosMenu = db.prepare('SELECT nombre, stock_diario FROM platos WHERE stock_diario IS NOT NULL').all();
    platosMenu.forEach(p => {
        if (p.stock_diario <= 3 && p.stock_diario >= 0) alertasMenu.push({ nombre: p.nombre, restante: p.stock_diario });
    });

    const insumosDisponibles = {};
    db.prepare('SELECT id, stock_actual FROM insumos').all().forEach(i => insumosDisponibles[i.id] = i.stock_actual);
    
    const platosCarta = db.prepare('SELECT id, nombre, receta_json FROM platos WHERE stock_diario IS NULL').all();
    platosCarta.forEach(plato => {
        if (plato.receta_json) {
            const receta = JSON.parse(plato.receta_json);
            if (receta.length > 0) {
                let maxPortions = Infinity;
                receta.forEach(r => {
                    const stockInsumo = insumosDisponibles[r.insumo_id] || 0;
                    const porcionesPosibles = Math.floor(stockInsumo / r.cantidad_requerida);
                    if (porcionesPosibles < maxPortions) maxPortions = porcionesPosibles;
                });
                if (maxPortions <= 3 && maxPortions >= 0) alertasCarta.push({ nombre: plato.nombre, restante: maxPortions });
            }
        }
    });

    if (alertasMenu.length > 0 || alertasCarta.length > 0) {
        io.emit('alerta_stock_dividida', { menu: alertasMenu, carta: alertasCarta });
    }
}

async function sincronizarHaciaAbajo() {
    const [cartaSnap, menuSnap, configSnap, insumosSnap] = await Promise.all([
        firestore.collection('contenido').doc('cartaCompleta').get(),
        firestore.collection('contenido').doc('menuDiario').get(),
        firestore.collection('contenido').doc('configuracion').get(),
        firestore.collection('insumos').get()
    ]);

    if (cartaSnap.exists) rawCartaCompleta = cartaSnap.data();
    if (menuSnap.exists) { rawMenuDiario = menuSnap.data(); modoDomingoGlobal = rawMenuDiario.modoDomingo === true; }
    if (configSnap.exists) estadoRestauranteGlobal = configSnap.data();

    // 🟢 NUEVO: Limpiamos los movimientos locales primero para evitar el bloqueo de Llave Foránea
    db.prepare("DELETE FROM movimientos_inventario").run();
    try { db.prepare("DELETE FROM sqlite_sequence WHERE name='movimientos_inventario'").run(); } catch(e){}

    // Ahora sí limpiamos los insumos sin que SQLite marque error
    db.prepare("DELETE FROM insumos").run();
    try { db.prepare("DELETE FROM sqlite_sequence WHERE name='insumos'").run(); } catch(e){}
    
    const insertInsumo = db.prepare("INSERT INTO insumos (id, nombre, unidad_medida, stock_actual, estado) VALUES (?, ?, ?, ?, ?)");
    
    if (insumosSnap && !insumosSnap.empty) {
        insumosSnap.forEach(doc => {
            const data = doc.data();
            const idNum = parseInt(doc.id.replace('INS-', ''), 10);
            if (!isNaN(idNum)) {
                insertInsumo.run(idNum, data.nombre, data.unidad_medida, data.stock_actual, data.estado);
            }
        });
    }

    db.prepare("DELETE FROM platos").run(); db.prepare("DELETE FROM categorias").run();
    try { db.prepare("DELETE FROM sqlite_sequence WHERE name='platos'").run(); db.prepare("DELETE FROM sqlite_sequence WHERE name='categorias'").run(); } catch(e){}

    let idCat = 1;
    const insertCat = db.prepare("INSERT INTO categorias (id, nombre) VALUES (?, ?)");
    const insertPlato = db.prepare("INSERT INTO platos (categoria_id, nombre, precio, stock_diario, receta_json) VALUES (?, ?, ?, ?, ?)");

    if (rawCartaCompleta.categorias) {
        rawCartaCompleta.categorias.forEach(cat => {
            if (cat.nombre) { 
                insertCat.run(idCat, cat.nombre); 
                const esJugo = cat.nombre.toLowerCase().includes('jugo') || cat.nombre.toLowerCase().includes('bebida');
                (cat.items || []).forEach(it => { 
                    if(it.nombre && it.precio) {
                        const p1 = parseFloat(it.precio); const p2 = parseFloat(it.precio2) || 0; 
                        const nombrePlato = normalizar(it.nombre);
                        const recetaString = it.receta ? JSON.stringify(it.receta) : null;
                        
                        if (p2 > 0) {
                            insertPlato.run(idCat, nombrePlato + (esJugo ? ' (VASO)' : ' (PERSONAL)'), p1, null, recetaString);
                            insertPlato.run(idCat, nombrePlato + (esJugo ? ' (JARRA)' : ' (FUENTE)'), p2, null, recetaString);
                        } else { 
                            insertPlato.run(idCat, nombrePlato, p1, null, recetaString); 
                        }
                    } 
                }); 
                idCat++; 
            }
        });
    }
    
    if (rawMenuDiario.entradas || rawMenuDiario.segundos) {
        if (rawMenuDiario.entradas && rawMenuDiario.entradas.length > 0) { 
            insertCat.run(idCat, 'entradas'); 
            rawMenuDiario.entradas.forEach(e => {
                const stockVal = (e.stock !== undefined && e.stock !== null && e.stock !== '') ? parseFloat(e.stock) : null;
                insertPlato.run(idCat, normalizar(e.nombre), parseFloat(e.precio || 0), stockVal, null);
            }); 
            idCat++; 
        }
        if (rawMenuDiario.segundos && rawMenuDiario.segundos.length > 0) { 
            insertCat.run(idCat, 'segundos'); 
            rawMenuDiario.segundos.forEach(s => {
                const stockVal = (s.stock !== undefined && s.stock !== null && s.stock !== '') ? parseFloat(s.stock) : null;
                insertPlato.run(idCat, normalizar(s.nombre), parseFloat(s.precio || 0), stockVal, null);
            }); 
            idCat++; 
        }
    }
}

async function sincronizarHaciaArriba() {
    try {
        const ventasPendientes = db.prepare('SELECT * FROM ventas WHERE sincronizado = 0').all();
        for (let venta of ventasPendientes) {
            const fechaLimpia = venta.fecha.split(' ')[0].replace(/-/g, ''); 
            const idPersonalizado = `TKT-${pad6(venta.id)}-${fechaLimpia}`;
            await firestore.collection('ventas_historicas').doc(idPersonalizado).set({ 
                fecha: admin.firestore.Timestamp.fromDate(new Date(venta.fecha)), 
                mesa: isNaN(Number(venta.mesa)) ? venta.mesa : Number(venta.mesa),
                total_cobrado: venta.total_cobrado, metodos_pago: JSON.parse(venta.metodos_pago), items: JSON.parse(venta.items)
            });
            db.prepare('UPDATE ventas SET sincronizado = 1 WHERE id = ?').run(venta.id);
        }

        const gastosPendientes = db.prepare('SELECT * FROM gastos WHERE sincronizado = 0').all();
        for (let gasto of gastosPendientes) {
            const fechaLimpia = gasto.fecha.split(' ')[0].replace(/-/g, '');
            const idPersonalizado = `GAS-${pad5(gasto.id)}-${fechaLimpia}`;
            await firestore.collection('gastos').doc(idPersonalizado).set({ categoria: gasto.categoria, concepto: gasto.descripcion, fecha: admin.firestore.Timestamp.fromDate(new Date(gasto.fecha)), monto: gasto.monto });
            db.prepare('UPDATE gastos SET sincronizado = 1 WHERE id = ?').run(gasto.id);
        }

        const insumosLocales = db.prepare('SELECT * FROM insumos').all();
        for (let insumo of insumosLocales) {
            const firestoreId = `INS-${pad4(insumo.id)}`;
            await firestore.collection('insumos').doc(firestoreId).set({
                nombre: insumo.nombre, unidad_medida: insumo.unidad_medida, stock_actual: insumo.stock_actual, estado: insumo.estado
            }, { merge: true });
        }
    } catch (e) { console.log("Modo offline activado (Subida).", e.message); }
}

app.get('/api/init-sync', async (req, res) => {
    try {
        await sincronizarHaciaArriba(); 
        const pendingV = db.prepare('SELECT COUNT(*) as c FROM ventas WHERE sincronizado = 0').get().c;
        const pendingG = db.prepare('SELECT COUNT(*) as c FROM gastos WHERE sincronizado = 0').get().c;
        if (pendingV > 0 || pendingG > 0) return res.status(500).json({ error: 'No se pudo respaldar la info local' });

        await sincronizarHaciaAbajo();
        const [mesasSnap, ventasSnap, gastosSnap] = await Promise.all([ firestore.collection('mesas_pos').get(), firestore.collection('ventas_historicas').orderBy('fecha', 'asc').get(), firestore.collection('gastos').orderBy('fecha', 'asc').get() ]);

        const insertMesa = db.prepare("INSERT OR IGNORE INTO mesas_activas (id, estado, pedido, total, nota_general) VALUES (?, ?, ?, ?, ?)");
        mesasSnap.forEach(doc => { const d = doc.data(); insertMesa.run(doc.id, d.estado || 'libre', JSON.stringify(d.pedido_actual || []), d.total_consumo || 0, d.nota_general || ''); });
        
        db.prepare("DELETE FROM ventas").run(); try { db.prepare("DELETE FROM sqlite_sequence WHERE name='ventas'").run(); } catch(e){} 
        const insertVenta = db.prepare("INSERT INTO ventas (mesa, total_cobrado, metodos_pago, items, fecha, sincronizado) VALUES (?, ?, ?, ?, ?, 1)");
        ventasSnap.forEach(doc => { 
            try { const d = doc.data(); let fechaLocal = new Date().toISOString().replace('T', ' '); if (d.fecha && typeof d.fecha.toDate === 'function') fechaLocal = aFechaLocal(d.fecha.toDate()); insertVenta.run(d.mesa || 'Desconocida', parseFloat(d.total_cobrado) || 0, JSON.stringify(d.metodos_pago || { efectivo: parseFloat(d.total_cobrado) || 0 }), JSON.stringify(d.items || []), fechaLocal); } catch(err) {}
        });

        db.prepare("DELETE FROM gastos").run(); try { db.prepare("DELETE FROM sqlite_sequence WHERE name='gastos'").run(); } catch(e){}
        const insertGasto = db.prepare("INSERT INTO gastos (descripcion, monto, categoria, fecha, sincronizado) VALUES (?, ?, ?, ?, 1)");
        gastosSnap.forEach(doc => { 
            try { const d = doc.data(); let fechaLocal = new Date().toISOString().replace('T', ' '); if (d.fecha && typeof d.fecha.toDate === 'function') fechaLocal = aFechaLocal(d.fecha.toDate()); insertGasto.run(d.concepto || 'Gasto', d.monto || 0, d.categoria || 'Otros', fechaLocal); } catch(err) {}
        });

        io.emit('actualizar_mesas');
        res.json({ success: true, message: 'Mega-Sincronización completada', modoDomingo: modoDomingoGlobal, estadoRestaurante: estadoRestauranteGlobal });
    } catch (e) { res.status(500).json({ error: 'Error en Mega-Sync' }); }
});

setInterval(sincronizarHaciaArriba, 60000);

app.get('/api/admin/data-cruda', (req, res) => {
    try {
        let cartaConIds = JSON.parse(JSON.stringify(rawCartaCompleta));
        if (cartaConIds.categorias) {
            cartaConIds.categorias.forEach(cat => {
                const esJugo = cat.nombre.toLowerCase().includes('jugo') || cat.nombre.toLowerCase().includes('bebida');
                if (cat.items) {
                    cat.items.forEach(it => {
                        const nomNormalizado = normalizar(it.nombre);
                        let sufijo = '';
                        if (parseFloat(it.precio2) > 0) sufijo = esJugo ? ' (VASO)' : ' (PERSONAL)';
                        const row = db.prepare('SELECT id FROM platos WHERE UPPER(nombre) = ?').get(nomNormalizado + sufijo);
                        if (row) it.id = row.id;
                    });
                }
            });
        }
        res.json({ menuDiario: rawMenuDiario, cartaCompleta: cartaConIds, estado: estadoRestauranteGlobal });
    } catch (e) { res.json({ menuDiario: rawMenuDiario, cartaCompleta: rawCartaCompleta, estado: estadoRestauranteGlobal }); }
});

app.post('/api/admin/menu', async (req, res) => { 
    try { 
        await firestore.collection('contenido').doc('menuDiario').set(req.body); 
        try {
            await sincronizarHaciaAbajo(); 
        } catch (syncErr) {
            console.error("Advertencia: El menú subió a Firebase, pero hubo un error menor en la réplica local:", syncErr);
        }
        io.emit('actualizar_mesas'); 
        res.json({ success: true }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.post('/api/admin/carta', async (req, res) => { 
    try { 
        const nuevaCarta = req.body;
        if (rawCartaCompleta && rawCartaCompleta.categorias) {
            nuevaCarta.categorias.forEach(newCat => {
                const oldCat = rawCartaCompleta.categorias.find(c => c.nombre === newCat.nombre);
                if (oldCat && oldCat.items) {
                    newCat.items.forEach(newItem => {
                        const oldItem = oldCat.items.find(i => normalizar(i.nombre) === normalizar(newItem.nombre));
                        if (oldItem && oldItem.receta) newItem.receta = oldItem.receta;
                    });
                }
            });
        }
        await firestore.collection('contenido').doc('cartaCompleta').set(nuevaCarta); 
        await sincronizarHaciaAbajo(); 
        io.emit('actualizar_mesas'); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.post('/api/admin/estado', async (req, res) => { try { await firestore.collection('contenido').doc('configuracion').set(req.body, { merge: true }); await sincronizarHaciaAbajo(); io.emit('cambio_estado_restaurante', estadoRestauranteGlobal); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get('/api/inventario', (req, res) => {
    try { res.json(db.prepare('SELECT * FROM insumos WHERE estado = 1 ORDER BY nombre').all()); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventario/insumo', async (req, res) => {
    try {
        const info = db.prepare('INSERT INTO insumos (nombre, unidad_medida) VALUES (?, ?)').run(req.body.nombre, req.body.unidad_medida);
        const firestoreId = `INS-${pad4(info.lastInsertRowid)}`;
        await firestore.collection('insumos').doc(firestoreId).set({ nombre: req.body.nombre, unidad_medida: req.body.unidad_medida, stock_actual: 0, estado: 1 });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'El insumo ya existe o hubo un error.' }); }
});

app.put('/api/inventario/insumo/:id', async (req, res) => {
    try {
        db.prepare('UPDATE insumos SET nombre = ?, unidad_medida = ? WHERE id = ?').run(req.body.nombre, req.body.unidad_medida, req.params.id);
        const firestoreId = `INS-${pad4(req.params.id)}`;
        await firestore.collection('insumos').doc(firestoreId).set({ nombre: req.body.nombre, unidad_medida: req.body.unidad_medida }, { merge: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/inventario/insumo/:id', async (req, res) => {
    try {
        db.prepare('UPDATE insumos SET estado = 0 WHERE id = ?').run(req.params.id); 
        const firestoreId = `INS-${pad4(req.params.id)}`;
        await firestore.collection('insumos').doc(firestoreId).set({ estado: 0 }, { merge: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventario/movimiento', async (req, res) => {
    try {
        const { insumo_id, tipo, cantidad, referencia } = req.body;
        const cantFloat = parseFloat(cantidad);
        const cantidadReal = tipo === 'INGRESO' ? cantFloat : -cantFloat;
        
        db.prepare('UPDATE insumos SET stock_actual = stock_actual + ? WHERE id = ?').run(cantidadReal, insumo_id);
        const info = db.prepare('INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, referencia) VALUES (?, ?, ?, ?)').run(insumo_id, tipo, cantidadReal, referencia || 'Ajuste manual');
        
        const row = db.prepare('SELECT stock_actual FROM insumos WHERE id = ?').get(insumo_id);
        if (row) {
            const firestoreInsumoId = `INS-${pad4(insumo_id)}`;
            const d = new Date();
            const yyyymmdd = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()); // 🟢 CORRECCIÓN APLICADA
            const firestoreMovId = `MOV-${pad6(info.lastInsertRowid)}-${yyyymmdd}-${firestoreInsumoId}`;

            await firestore.collection('insumos').doc(firestoreInsumoId).set({ stock_actual: row.stock_actual }, { merge: true });
            await firestore.collection('movimientos_inventario').doc(firestoreMovId).set({ insumo_id: firestoreInsumoId, tipo, cantidad: cantidadReal, referencia: referencia || 'Ajuste manual', fecha: admin.firestore.FieldValue.serverTimestamp() });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

function actualizarRecetaEnCartaFirebase(nombrePlatoDB, listaReceta) {
    if (rawCartaCompleta && rawCartaCompleta.categorias) {
        const nombreLimpio = normalizar(nombrePlatoDB).replace(' (PERSONAL)', '').replace(' (VASO)', '');
        rawCartaCompleta.categorias.forEach(cat => {
            if (cat.items) {
                cat.items.forEach(it => {
                    if (normalizar(it.nombre) === nombreLimpio) {
                        it.receta = listaReceta;
                    }
                });
            }
        });
        firestore.collection('contenido').doc('cartaCompleta').set(rawCartaCompleta).catch(err => console.error("Error subiendo carta:", err));
    }
}

app.get('/api/platos/:id/receta', (req, res) => {
    try {
        const plato = db.prepare('SELECT receta_json FROM platos WHERE id = ?').get(req.params.id);
        if (!plato || !plato.receta_json) return res.json([]);
        const lista = JSON.parse(plato.receta_json);
        const resultado = lista.map(item => {
            const insumo = db.prepare('SELECT nombre, unidad_medida FROM insumos WHERE id = ?').get(item.insumo_id);
            return {
                id: `${req.params.id}-${item.insumo_id}`,
                insumo_id: item.insumo_id, nombre: insumo ? insumo.nombre : 'Insumo Desconocido',
                cantidad_requerida: item.cantidad_requerida, text_unidad: insumo ? insumo.unidad_medida : 'g', unidad_medida: insumo ? insumo.unidad_medida : 'g'
            };
        });
        res.json(resultado);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/platos/:id/receta', async (req, res) => {
    try {
        const platoId = req.params.id;
        const { insumo_id, cantidad_requerida } = req.body;
        const plato = db.prepare('SELECT nombre, receta_json FROM platos WHERE id = ?').get(platoId);
        if (!plato) return res.status(404).json({ error: 'Plato no encontrado' });

        let lista = plato.receta_json ? JSON.parse(plato.receta_json) : [];
        lista = lista.filter(r => r.insumo_id !== Number(insumo_id));
        lista.push({ insumo_id: Number(insumo_id), cantidad_requerida: parseFloat(cantidad_requerida) });

        db.prepare('UPDATE platos SET receta_json = ? WHERE id = ?').run(JSON.stringify(lista), platoId);
        actualizarRecetaEnCartaFirebase(plato.nombre, lista);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/recetas/:id', async (req, res) => {
    try {
        const [platoId, insumoId] = req.params.id.split('-');
        if (!platoId || !insumoId) return res.status(400).json({ error: 'Identificador compuesto inválido' });
        const plato = db.prepare('SELECT nombre, receta_json FROM platos WHERE id = ?').get(platoId);
        if (!plato) return res.status(404).json({ error: 'Plato no encontrado' });

        let lista = plato.receta_json ? JSON.parse(plato.receta_json) : [];
        lista = lista.filter(r => r.insumo_id !== Number(insumoId));
        db.prepare('UPDATE platos SET receta_json = ? WHERE id = ?').run(lista.length > 0 ? JSON.stringify(lista) : null, platoId);

        actualizarRecetaEnCartaFirebase(plato.nombre, lista);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

io.on('connection', (socket) => { console.log(`🟢 Socket conectado: ${socket.id}`); });
app.get('/api/status', (req, res) => res.json({ status: 'online' }));
app.get('/api/modo-domingo', (req, res) => res.json({ modoDomingo: modoDomingoGlobal, estadoRestaurante: estadoRestauranteGlobal }));

app.post('/api/login', (req, res) => {
    const user = db.prepare('SELECT * FROM usuarios WHERE username = ? AND password = ?').get(req.body.username, req.body.password);
    if (user) res.json({ success: true, user: { username: user.username, rol: user.rol } });
    else res.status(401).json({ error: 'Credenciales incorrectas' });
});

app.get('/api/mesas', (req, res) => res.json(db.prepare('SELECT * FROM mesas_activas').all().map(m => ({ ...m, pedido: JSON.parse(m.pedido) }))));

app.get('/api/carta', (req, res) => {
    try {
        const insumosDisponibles = {};
        const insumosNombres = {};
        db.prepare('SELECT id, stock_actual, nombre FROM insumos').all().forEach(i => {
            insumosDisponibles[i.id] = i.stock_actual;
            insumosNombres[i.id] = i.nombre;
        });

        const cartaDirecta = db.prepare('SELECT * FROM categorias').all().map(cat => ({ 
            nombre: cat.nombre, 
            items: db.prepare('SELECT * FROM platos WHERE categoria_id = ?').all(cat.id).map(plato => {
                let costo_taper = 0;
                let tapersAsignados = [];
                
                // 🟢 RESCATE DEL TAPER DESDE EL MENÚ DIARIO PARA ENTRADAS Y SEGUNDOS
                const catNom = normalizar(cat.nombre);
                if ((catNom === 'ENTRADAS' || catNom === 'ENTRADA') && rawMenuDiario.entradas) {
                    const found = rawMenuDiario.entradas.find(e => normalizar(e.nombre) === normalizar(plato.nombre));
                    if (found && found.taper) tapersAsignados = Array.isArray(found.taper) ? found.taper : [found.taper];
                } else if ((catNom === 'SEGUNDOS' || catNom === 'SEGUNDO') && rawMenuDiario.segundos) {
                    const found = rawMenuDiario.segundos.find(s => normalizar(s.nombre) === normalizar(plato.nombre));
                    if (found && found.taper) tapersAsignados = Array.isArray(found.taper) ? found.taper : [found.taper];
                }

                if (plato.stock_diario !== null) {
                    plato.stock_actual = plato.stock_diario;
                    plato.taper = tapersAsignados; // Devolver los tapers al Frontend
                    
                    tapersAsignados.forEach(t => {
                        if (t === 'chico' || t === 'sopa') costo_taper += 1;
                        if (t === 'mediano' || t === 'grande') costo_taper += 2;
                    });
                    
                } else if (plato.receta_json) {
                    const receta = JSON.parse(plato.receta_json);
                    if (receta.length > 0) {
                        let maxPortions = Infinity;
                        receta.forEach(r => {
                            const stock = insumosDisponibles[r.insumo_id] || 0;
                            const nomInsumo = normalizar(insumosNombres[r.insumo_id] || '');
                            
                            if (nomInsumo.includes('TAPER') || nomInsumo.includes('ENVASE')) {
                                if (nomInsumo.includes('CHICO') || nomInsumo.includes('SOPA')) costo_taper += (1 * r.cantidad_requerida);
                                if (nomInsumo.includes('MEDIANO') || nomInsumo.includes('GRANDE')) costo_taper += (2 * r.cantidad_requerida);
                            } else {
                                const posibles = Math.floor(stock / r.cantidad_requerida);
                                if (posibles < maxPortions) maxPortions = posibles;
                            }
                        });
                        plato.stock_actual = maxPortions === Infinity ? 0 : maxPortions;
                    } else { plato.stock_actual = null; }
                } else { plato.stock_actual = null; }
                
                plato.costo_taper = costo_taper;
                return plato;
            })
        }));
        res.json(cartaDirecta);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pedidos', (req, res) => {
    try {
        const { mesa, items, nota_general } = req.body;
        const refComanda = `COM-${String(mesa).replace('mesa_', '')}-${Date.now().toString().slice(-4)}`;
        
        procesarRecetasVenta(items, refComanda, false);
        items.forEach(i => i.impreso = true);
        
        let row = db.prepare('SELECT pedido FROM mesas_activas WHERE id = ?').get(mesa);
        let pedidoViejo = row && row.pedido ? JSON.parse(row.pedido) : [];
        let pedidoSoloImpresos = pedidoViejo.filter(i => i.impreso);
        
        // 🟢 FUSIÓN CORREGIDA: Ya no suma platos si el mozo presiona "A Cocina" dos veces
        let nuevoPedido = fusionarPedidos(pedidoSoloImpresos, items);
        let nuevoTotal = calcularTotalMesa(nuevoPedido, modoDomingoGlobal);
        
        db.prepare(`UPDATE mesas_activas SET estado = 'ocupada', pedido = ?, total = ?, nota_general = COALESCE(NULLIF(nota_general, ''), ?) WHERE id = ?`).run(JSON.stringify(nuevoPedido), nuevoTotal, nota_general || '', mesa);
        
        io.emit('alerta_sonora'); io.emit('actualizar_mesas'); io.emit('imprimir_cocina', { mesa: mesa, items: items }); 
        auditarStockYAlertar(); 
        res.json({ success: true });
    } catch (e) {
        console.error("Error en /pedidos:", e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/mesas/:id/pedido', (req, res) => {
    try {
        const mesaId = req.params.id;
        const pedidoNuevo = req.body.pedido;
        const row = db.prepare('SELECT pedido FROM mesas_activas WHERE id = ?').get(mesaId);
        const pedidoViejo = row ? JSON.parse(row.pedido) : [];

        const diffRestaurar = [];
        pedidoViejo.filter(i => i.impreso).forEach(oldItem => {
            const newItem = pedidoNuevo.find(i => i.nombre === oldItem.nombre && i.modalidad === oldItem.modalidad && (i.nota||'') === (oldItem.nota||'') && i.impreso);
            const newQty = newItem ? newItem.cantidad : 0;
            if (oldItem.cantidad > newQty) {
                diffRestaurar.push({ ...oldItem, cantidad: oldItem.cantidad - newQty });
            }
        });

        if (diffRestaurar.length > 0) {
            const refRestore = `DEV-${String(mesaId).replace('mesa_', '')}-${Date.now().toString().slice(-4)}`;
            procesarRecetasVenta(diffRestaurar, refRestore, true); 
            auditarStockYAlertar(); 
        }

        pedidoNuevo.forEach(item => { item.subtotal = item.cantidad * ((parseFloat(item.precio) || 0) + calcularRecargoTaper(item)); });
        let nuevoTotal = calcularTotalMesa(pedidoNuevo, modoDomingoGlobal);
        let nuevoEstado = pedidoNuevo.length === 0 ? 'libre' : 'ocupada';
        db.prepare(`UPDATE mesas_activas SET estado = ?, pedido = ?, total = ? WHERE id = ?`).run(nuevoEstado, JSON.stringify(pedidoNuevo), nuevoTotal, mesaId);
        
        io.emit('actualizar_mesas'); 
        res.json({ success: true, totalCalculado: nuevoTotal });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Error al actualizar' }); }
});

app.post('/api/cobrar', (req, res) => {
    try {
        const { mesaId, mesaNum, metodosPago, totalCobrado, items } = req.body;
        const itemsAgrupados = agruparItemsParaVenta(items, modoDomingoGlobal);
        
        const result = db.prepare(`INSERT INTO ventas (mesa, total_cobrado, metodos_pago, items, fecha, sincronizado) VALUES (?, ?, ?, ?, datetime('now', 'localtime'), 0)`).run(mesaNum, totalCobrado, JSON.stringify(metodosPago), JSON.stringify(itemsAgrupados));
        const ventaId = result.lastInsertRowid;
        const fechaLimpia = new Date().toISOString().split('T')[0].replace(/-/g, ''); 
        const ticketRef = `TKT-${pad6(ventaId)}-${fechaLimpia}`;
        
        const itemsVentaDirecta = items.filter(i => !i.impreso);
        if (itemsVentaDirecta.length > 0) {
            const agrupadosDirectos = agruparItemsParaVenta(itemsVentaDirecta, modoDomingoGlobal);
            procesarRecetasVenta(agrupadosDirectos, ticketRef, false);
        }

        if (String(mesaId).startsWith('DEL-')) db.prepare(`DELETE FROM mesas_activas WHERE id = ?`).run(mesaId);
        else db.prepare(`UPDATE mesas_activas SET estado = 'libre', pedido = '[]', total = 0, nota_general = '' WHERE id = ?`).run(mesaId);
        
        io.emit('actualizar_mesas'); 
        auditarStockYAlertar(); 
        sincronizarHaciaArriba();
        res.json({ success: true });
    } catch (e) {
        console.error("Error en /cobrar:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/impresoras', (req, res) => {
  exec('powershell -Command "Get-Printer | Select-Object Name | ConvertTo-Json"', (error, stdout, stderr) => {
    if (error) return res.json([]);
    try { const printers = JSON.parse(stdout); res.json(Array.isArray(printers) ? printers.map(p => p.Name) : [printers.Name]); } catch (e) { res.json([]); }
  });
});

app.get('/api/config', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM configuracion`).all();
    const config = {}; rows.forEach(row => { config[row.clave] = row.valor; });
    res.json(config);
  } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/api/config', (req, res) => {
  try {
    const stmt = db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)`);
    stmt.run('ticketera_caja', req.body.ticketera_caja); stmt.run('ticketera_cocina', req.body.ticketera_cocina);
    res.json({ message: 'Configuración guardada' });
  } catch (err) { res.status(500).json({error: err.message}); }
});

app.get('/api/ventas', (req, res) => { res.json(db.prepare("SELECT * FROM ventas WHERE date(fecha) = date(?) ORDER BY id DESC").all(req.query.fecha || new Date().toISOString().split('T')[0])); });
app.delete('/api/ventas/:id', async (req, res) => {
  try {
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
    if (venta) {
        const fechaLimpia = venta.fecha.split(' ')[0].replace(/-/g, '');
        await firestore.collection('ventas_historicas').doc(`TKT-${pad6(venta.id)}-${fechaLimpia}`).delete();
    }
    db.prepare(`DELETE FROM ventas WHERE id = ?`).run(req.params.id);
    res.json({ message: 'Venta anulada' });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/gastos', (req, res) => res.json(db.prepare("SELECT * FROM gastos WHERE date(fecha) = date(?) ORDER BY id DESC").all(req.query.fecha || aFechaLocal(new Date()).split(' ')[0])));
app.post('/api/gastos', async (req, res) => {
  try {
    const fechaReal = req.body.fecha || aFechaLocal(new Date()); 
    const result = db.prepare(`INSERT INTO gastos (descripcion, monto, categoria, fecha, sincronizado) VALUES (?, ?, ?, ?, 1)`).run(req.body.descripcion, req.body.monto, req.body.categoria || 'Otros', fechaReal);
    const fechaLimpia = fechaReal.split(' ')[0].replace(/-/g, '');
    const idPersonalizado = `GAS-${pad5(result.lastInsertRowid)}-${fechaLimpia}`;
    
    await firestore.collection('gastos').doc(idPersonalizado).set({ categoria: req.body.categoria || 'Otros', concepto: req.body.descripcion, fecha: admin.firestore.Timestamp.fromDate(new Date(fechaReal)), monto: parseFloat(req.body.monto) });
    res.json({ id: result.lastInsertRowid });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});
app.delete('/api/gastos/:id', async (req, res) => {
  try {
    const gasto = db.prepare('SELECT * FROM gastos WHERE id = ?').get(req.params.id);
    if (gasto) {
        const fechaLimpia = gasto.fecha.split(' ')[0].replace(/-/g, '');
        await firestore.collection('gastos').doc(`GAS-${pad5(gasto.id)}-${fechaLimpia}`).delete();
    }
    db.prepare('DELETE FROM gastos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/reporte-diario', (req, res) => {
    const ventas = db.prepare("SELECT total_cobrado, metodos_pago, items FROM ventas WHERE date(fecha) = date(?)").all(req.query.fecha || new Date().toISOString().split('T')[0]);
    const gastos = db.prepare("SELECT monto FROM gastos WHERE date(fecha) = date(?)").all(req.query.fecha || new Date().toISOString().split('T')[0]);
    let totales = { efectivo: 0, yape: 0, plin: 0, tarjeta: 0, totalVentas: 0, totalGastos: 0, balance: 0 }; let contadorPlatos = {};
    ventas.forEach(v => {
        const pagos = JSON.parse(v.metodos_pago || '{}');
        totales.efectivo += parseFloat(pagos.efectivo || 0); totales.yape += parseFloat(pagos.yape || 0); totales.plin += parseFloat(pagos.plin || 0); totales.tarjeta += parseFloat(pagos.tarjeta || 0);
        totales.totalVentas += v.total_cobrado;
        JSON.parse(v.items || '[]').forEach(it => {
            let n = normalizar(it.nombre); let c = normalizar(it.categoria || '');
            if(!['BEBIDAS HELADAS', 'GUARNICIONES', 'JUGOS NATURALES', 'BEBIDAS CALIENTES', 'CERVEZA'].includes(c) && !n.includes('TAPER') && !n.includes('REFRESCO') && !n.includes('(EXTRA)') && !n.includes('(SEGUNDO)') && !n.includes('(ENTRADA)') && n !== 'HUMITA') {
                if (n.startsWith('MENÚ COMPLETO')) n = 'MENÚ COMPLETO';
                contadorPlatos[n] = (contadorPlatos[n] || 0) + it.cantidad;
            }
        });
    });
    gastos.forEach(g => totales.totalGastos += g.monto); totales.balance = totales.totalVentas - totales.totalGastos;
    res.json({ totales, topPlatos: Object.keys(contadorPlatos).map(k => ({ nombre: k, cant: contadorPlatos[k] })).sort((a,b) => b.cant - a.cant).slice(0, 5) });
});

app.get('/api/dashboard', (req, res) => {
    try {
        const [yearParam, monthParam] = (req.query.mes || new Date().toISOString().slice(0, 7)).split('-');
        const ventas = db.prepare("SELECT fecha, total_cobrado, items FROM ventas").all(); const gastos = db.prepare("SELECT fecha, monto FROM gastos").all();
        let diasStr = []; let ingXDia = []; let gasXDia = []; for(let i=1; i<=31; i++) { diasStr.push(i.toString()); ingXDia.push(0); gasXDia.push(0); }
        let contadorPlatos = {}; let totalIng = 0; let totalGas = 0;
        ventas.forEach(v => {
            if (v.fecha.startsWith(`${yearParam}-${monthParam}`)) {
                let dia = parseInt(v.fecha.split(' ')[0].split('-')[2]); if(!isNaN(dia)) ingXDia[dia-1] += v.total_cobrado; totalIng += v.total_cobrado;
                JSON.parse(v.items || '[]').forEach(it => {
                    let n = normalizar(it.nombre); let c = normalizar(it.categoria || '');
                    if(!['BEBIDAS HELADAS', 'GUARNICIONES', 'JUGOS NATURALES', 'BEBIDAS CALIENTES', 'CERVEZA'].includes(c) && !n.includes('TAPER') && !n.includes('REFRESCO') && !n.includes('(EXTRA)') && !n.includes('(SEGUNDO)') && !n.includes('(ENTRADA)') && n !== 'HUMITA') {
                        if (n.startsWith('MENÚ COMPLETO')) n = 'MENÚ COMPLETO'; contadorPlatos[n] = (contadorPlatos[n] || 0) + it.cantidad;
                    }
                });
            }
        });
        gastos.forEach(g => { if (g.fecha.startsWith(`${yearParam}-${monthParam}`)) { let dia = parseInt(g.fecha.split(' ')[0].split('-')[2]); if(!isNaN(dia)) gasXDia[dia-1] += g.monto; totalGas += g.monto; } });
        let rankingAll = Object.keys(contadorPlatos).map(k => ({ nombre: k, cantidad: contadorPlatos[k] })).sort((a,b) => b.cantidad - a.cantidad);
        let restoRanking = rankingAll.slice(1);
        res.json({ totales: { ingresos: totalIng, gastos: totalGas, neto: totalIng - totalGas }, evolucion: { labels: diasStr, ingresos: ingXDia, gastos: gasXDia }, platoCorona: rankingAll.length > 0 ? rankingAll[0] : null, rankingMenu: restoRanking.filter(p => p.nombre === 'MENÚ COMPLETO' || p.nombre.startsWith('ALMUERZO:')).slice(0, 10), rankingCarta: restoRanking.filter(p => !(p.nombre === 'MENÚ COMPLETO' || p.nombre.startsWith('ALMUERZO:'))).slice(0, 10) });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

firestore.collection('contenido').doc('configuracion').onSnapshot((docSnap) => {
    if (docSnap.exists) {
        const nuevaConfig = docSnap.data();
        if (JSON.stringify(estadoRestauranteGlobal) !== JSON.stringify(nuevaConfig)) {
            estadoRestauranteGlobal = nuevaConfig; io.emit('cambio_estado_restaurante', estadoRestauranteGlobal); 
        }
    }
});

firestore.collection('contenido').doc('menuDiario').onSnapshot(async (docSnap) => {
    if (docSnap.exists) {
        const nuevoMenu = docSnap.data();
        if (JSON.stringify(rawMenuDiario) !== JSON.stringify(nuevoMenu)) {
            await sincronizarHaciaAbajo(); io.emit('actualizar_mesas'); 
        }
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 SERVIDOR LISTO EN PUERTO ${PORT} PARA RED LOCAL`));