const db = require('../database');
const { firestore, admin } = require('../config/firebase');
const state = require('../store/globalState');
const { pad2, pad4, pad5, pad6, normalizar } = require('../utils/helpers');

async function sincronizarHaciaAbajo(datosPreCargados = {}) {
    // 🟢 OPTIMIZADO: Si ya tenemos los datos (e.g. onSnapshot), evitamos releerlos de Firebase
    const obtenerSnap = (ref, preCargado) => {
        if (preCargado !== undefined) return { exists: true, data: () => preCargado };
        return ref.get();
    };
    const [cartaSnap, menuSnap, configSnap, insumosSnap] = await Promise.all([
        obtenerSnap(firestore.collection('contenido').doc('cartaCompleta'), datosPreCargados.cartaCompleta),
        obtenerSnap(firestore.collection('contenido').doc('menuDiario'), datosPreCargados.menuDiario),
        obtenerSnap(firestore.collection('contenido').doc('configuracion'), datosPreCargados.configuracion),
        firestore.collection('insumos').get()
    ]);

    if (cartaSnap.exists) state.rawCartaCompleta = cartaSnap.data();
    if (menuSnap.exists) { state.rawMenuDiario = menuSnap.data(); state.modoDomingoGlobal = state.rawMenuDiario.modoDomingo === true; }
    if (configSnap.exists) {
        const nuevosDatosConfig = configSnap.data();
        // 🟢 Si pasamos datos precargados (posiblemente parciales por { merge: true }), hacemos merge con el estado existente
        state.estadoRestauranteGlobal = datosPreCargados.configuracion !== undefined
            ? { ...state.estadoRestauranteGlobal, ...nuevosDatosConfig }
            : nuevosDatosConfig;
    }

    db.prepare("DELETE FROM movimientos_inventario").run();
    try { db.prepare("DELETE FROM sqlite_sequence WHERE name='movimientos_inventario'").run(); } catch(e){}

    db.prepare("DELETE FROM insumos").run();
    try { db.prepare("DELETE FROM sqlite_sequence WHERE name='insumos'").run(); } catch(e){}
    
    const insertInsumo = db.prepare("INSERT INTO insumos (id, nombre, unidad_medida, stock_actual, estado, sincronizado) VALUES (?, ?, ?, ?, ?, 1)");
    
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

    if (state.rawCartaCompleta.categorias) {
        state.rawCartaCompleta.categorias.forEach(cat => {
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
    
    if (state.rawMenuDiario.entradas || state.rawMenuDiario.segundos) {
        if (state.rawMenuDiario.entradas && state.rawMenuDiario.entradas.length > 0) { 
            insertCat.run(idCat, 'entradas'); 
            state.rawMenuDiario.entradas.forEach(e => {
                const stockVal = (e.stock !== undefined && e.stock !== null && e.stock !== '') ? parseFloat(e.stock) : null;
                insertPlato.run(idCat, normalizar(e.nombre), parseFloat(e.precio || 0), stockVal, null);
            }); 
            idCat++; 
        }
        if (state.rawMenuDiario.segundos && state.rawMenuDiario.segundos.length > 0) { 
            insertCat.run(idCat, 'segundos'); 
            state.rawMenuDiario.segundos.forEach(s => {
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
            let firestoreId = venta.firebase_id;
            if (!firestoreId) {
                const fechaLimpia = venta.fecha.split(' ')[0].replace(/-/g, ''); 
                firestoreId = `TKT-${pad6(venta.id)}-${fechaLimpia}`;
                db.prepare('UPDATE ventas SET firebase_id = ? WHERE id = ?').run(firestoreId, venta.id);
            }
            await firestore.collection('ventas_historicas').doc(firestoreId).set({ 
                fecha: admin.firestore.Timestamp.fromDate(new Date(venta.fecha)), 
                mesa: isNaN(Number(venta.mesa)) ? venta.mesa : Number(venta.mesa),
                total_cobrado: venta.total_cobrado, metodos_pago: JSON.parse(venta.metodos_pago), items: JSON.parse(venta.items)
            });
            db.prepare('UPDATE ventas SET sincronizado = 1 WHERE id = ?').run(venta.id);
        }

        const gastosPendientes = db.prepare('SELECT * FROM gastos WHERE sincronizado = 0').all();
        for (let gasto of gastosPendientes) {
            let firestoreId = gasto.firebase_id;
            if (!firestoreId) {
                const fechaLimpia = gasto.fecha.split(' ')[0].replace(/-/g, '');
                firestoreId = `GAS-${pad5(gasto.id)}-${fechaLimpia}`;
                db.prepare('UPDATE gastos SET firebase_id = ? WHERE id = ?').run(firestoreId, gasto.id);
            }
            await firestore.collection('gastos').doc(firestoreId).set({ 
                categoria: gasto.categoria, concepto: gasto.descripcion, 
                fecha: admin.firestore.Timestamp.fromDate(new Date(gasto.fecha)), 
                monto: gasto.monto, con_comprobante: gasto.con_comprobante 
            });
            db.prepare('UPDATE gastos SET sincronizado = 1 WHERE id = ?').run(gasto.id);
        }

        const insumosPendientes = db.prepare('SELECT * FROM insumos WHERE sincronizado = 0').all();
        for (let insumo of insumosPendientes) {
            const firestoreId = `INS-${pad4(insumo.id)}`;
            await firestore.collection('insumos').doc(firestoreId).set({
                nombre: insumo.nombre, unidad_medida: insumo.unidad_medida, stock_actual: insumo.stock_actual, estado: insumo.estado
            }, { merge: true });
            db.prepare('UPDATE insumos SET sincronizado = 1 WHERE id = ?').run(insumo.id);
        }
    } catch (e) { console.log("Modo offline activado (Subida).", e.message); }
}

module.exports = { sincronizarHaciaAbajo, sincronizarHaciaArriba };