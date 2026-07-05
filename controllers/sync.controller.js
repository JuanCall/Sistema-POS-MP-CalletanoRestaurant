const db = require('../database');
const { firestore, admin } = require('../config/firebase');
const state = require('../store/globalState');
const { aFechaLocal, normalizar } = require('../utils/helpers');
const { sincronizarHaciaAbajo, sincronizarHaciaArriba } = require('../services/sync.service');

const initSync = async (req, res) => {
    const io = req.app.get('io'); // Extraemos el socket
    try {
        await sincronizarHaciaArriba(); 
        const pendingV = db.prepare('SELECT COUNT(*) as c FROM ventas WHERE sincronizado = 0').get().c;
        const pendingG = db.prepare('SELECT COUNT(*) as c FROM gastos WHERE sincronizado = 0').get().c;
        if (pendingV > 0 || pendingG > 0) return res.error('No se pudo respaldar la info local');

        const countVentasLocal = db.prepare('SELECT COUNT(*) as c FROM ventas').get().c;
        const countGastosLocal = db.prepare('SELECT COUNT(*) as c FROM gastos').get().c;

        await sincronizarHaciaAbajo();

        // 🟢 OPTIMIZADO: Solo leer mesas de Firebase si no hay datos locales o si pasó suficiente tiempo
        const countMesasLocal = db.prepare('SELECT COUNT(*) as c FROM mesas_activas').get().c;
        const ultimaSyncRow = db.prepare("SELECT valor FROM configuracion WHERE clave = 'ultima_sync_at'").get();
        const ultimaSyncAt = ultimaSyncRow ? ultimaSyncRow.valor : null;
        const ahora = new Date();
        const haceCuanto = ultimaSyncAt ? (ahora - new Date(ultimaSyncAt)) / 1000 : Infinity;
        
        if (countMesasLocal === 0 || haceCuanto > 30 || !ultimaSyncAt) {
            const mesasSnap = await firestore.collection('mesas_pos').get();
            const insertMesa = db.prepare("INSERT OR IGNORE INTO mesas_activas (id, estado, pedido, total, nota_general) VALUES (?, ?, ?, ?, ?)");
            mesasSnap.forEach(doc => { const d = doc.data(); insertMesa.run(doc.id, d.estado || 'libre', JSON.stringify(d.pedido_actual || []), d.total_consumo || 0, d.nota_general || ''); });
        }

        // 🟢 Leer última sincronización para evitar leer todo cada vez (ya declarado arriba para mesas)
        
        let ventasQuery;
        if (ultimaSyncAt) {
            // 🟢 OPTIMIZADO: Solo traer documentos NUEVOS desde la última sincronización
            const fechaDesde = admin.firestore.Timestamp.fromDate(new Date(ultimaSyncAt));
            ventasQuery = firestore.collection('ventas_historicas').where('fecha', '>=', fechaDesde).orderBy('fecha', 'asc');
        } else {
            // 🟢 Primera sincronización: usa la lógica anterior (últimos 500 o todos)
            ventasQuery = firestore.collection('ventas_historicas').orderBy('fecha', 'asc');
            if (countVentasLocal > 0) ventasQuery = firestore.collection('ventas_historicas').orderBy('fecha', 'desc').limit(500);
        }
        const ventasSnap = await ventasQuery.get();
        const insertVenta = db.prepare("INSERT INTO ventas (firebase_id, mesa, total_cobrado, metodos_pago, items, fecha, sincronizado) VALUES (?, ?, ?, ?, ?, ?, 1)");
        
        ventasSnap.forEach(doc => { 
            try { 
                const d = doc.data(); 
                let fechaLocal = new Date().toISOString().replace('T', ' '); 
                if (d.fecha && typeof d.fecha.toDate === 'function') fechaLocal = aFechaLocal(d.fecha.toDate()); 
                const existeVenta = db.prepare("SELECT id FROM ventas WHERE firebase_id = ?").get(doc.id);
                if (!existeVenta) insertVenta.run(doc.id, d.mesa || 'Desconocida', parseFloat(d.total_cobrado) || 0, JSON.stringify(d.metodos_pago || { efectivo: parseFloat(d.total_cobrado) || 0 }), JSON.stringify(d.items || []), fechaLocal); 
            } catch(err) {}
        });

        let gastosQuery;
        if (ultimaSyncAt) {
            // 🟢 FIX: Agregar buffer de 5 segundos para evitar perder gastos por diferencias de milisegundos
            const fechaDesdeDate = new Date(ultimaSyncAt);
            fechaDesdeDate.setSeconds(fechaDesdeDate.getSeconds() - 5);
            const fechaDesde = admin.firestore.Timestamp.fromDate(fechaDesdeDate);
            gastosQuery = firestore.collection('gastos').where('fecha', '>=', fechaDesde).orderBy('fecha', 'asc');
        } else {
            gastosQuery = firestore.collection('gastos').orderBy('fecha', 'asc');
            if (countGastosLocal > 0) gastosQuery = firestore.collection('gastos').orderBy('fecha', 'desc').limit(500);
        }
        const gastosSnap = await gastosQuery.get();
        const insertGasto = db.prepare("INSERT INTO gastos (firebase_id, descripcion, monto, categoria, con_comprobante, fecha, sincronizado) VALUES (?, ?, ?, ?, ?, ?, 1)");

        gastosSnap.forEach(doc => { 
            try { 
                const d = doc.data(); 
                let fechaLocal = new Date().toISOString().replace('T', ' '); 
                if (d.fecha && typeof d.fecha.toDate === 'function') {
                    try { fechaLocal = aFechaLocal(d.fecha.toDate()); } catch(innerErr) { /* mantener fecha actual */ }
                }
                const existeGasto = db.prepare("SELECT id FROM gastos WHERE firebase_id = ?").get(doc.id);
                if (!existeGasto) insertGasto.run(doc.id, d.concepto || 'Gasto', d.monto || 0, d.categoria || 'Otros', d.con_comprobante ? 1 : 0, fechaLocal);
            } catch(err) { console.error("Error insertando gasto sync:", err.message); }
        });

        // 🟢 Guardar timestamp de esta sincronización para la próxima vez
        db.prepare("INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('ultima_sync_at', ?)").run(new Date().toISOString());

        if(io) io.emit('actualizar_mesas');
        res.json({ success: true, message: 'Sync OK', modoDomingo: state.modoDomingoGlobal, estadoRestaurante: state.estadoRestauranteGlobal });
    } catch (e) { 
        console.error("Error en Mega-Sync:", e); res.error('Error en Mega-Sync'); 
    }
};        const setAdminMenu = async (req, res) => { 
    const io = req.app.get('io');
    try { 
        await firestore.collection('contenido').doc('menuDiario').set(req.body); 
        // 🟢 OPTIMIZADO: Pasamos los datos que acabamos de subir para no releerlos de Firebase
        try { await sincronizarHaciaAbajo({ menuDiario: req.body }); } catch (err) { console.error("Aviso Sync:", err); }
        if(io) io.emit('actualizar_mesas'); 
        res.json({ success: true }); 
    } catch (e) { res.error(e.message); } 
};

const setAdminCarta = async (req, res) => { 
    const io = req.app.get('io');
    try { 
        const nuevaCarta = req.body;
        if (state.rawCartaCompleta && state.rawCartaCompleta.categorias) {
            nuevaCarta.categorias.forEach(newCat => {
                const oldCat = state.rawCartaCompleta.categorias.find(c => c.nombre === newCat.nombre);
                if (oldCat && oldCat.items) {
                    newCat.items.forEach(newItem => {
                        const oldItem = oldCat.items.find(i => normalizar(i.nombre) === normalizar(newItem.nombre));
                        if (oldItem && oldItem.receta) newItem.receta = oldItem.receta;
                    });
                }
            });
        }
        await firestore.collection('contenido').doc('cartaCompleta').set(nuevaCarta); 
        // 🟢 OPTIMIZADO: Pasamos los datos que acabamos de subir para no releerlos de Firebase
        await sincronizarHaciaAbajo({ cartaCompleta: nuevaCarta });
        if(io) io.emit('actualizar_mesas'); 
        res.json({ success: true }); 
    } catch (e) { res.error(e.message); } 
};

const setAdminEstado = async (req, res) => { 
    const io = req.app.get('io');
    try { 
        await firestore.collection('contenido').doc('configuracion').set(req.body, { merge: true }); 
        // 🟢 OPTIMIZADO: Pasamos los datos que acabamos de subir para no releerlos de Firebase
        await sincronizarHaciaAbajo({ configuracion: req.body });
        if(io) io.emit('cambio_estado_restaurante', state.estadoRestauranteGlobal); 
        res.json({ success: true }); 
    } catch (e) { res.error(e.message); } 
};

module.exports = { initSync, setAdminMenu, setAdminCarta, setAdminEstado };