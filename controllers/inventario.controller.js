const db = require('../database');
const { firestore, admin } = require('../config/firebase');
const { pad2, pad4, pad6 } = require('../utils/helpers');

const getInsumos = (req, res) => {
    try { res.json(db.prepare('SELECT * FROM insumos ORDER BY estado DESC, nombre ASC').all()); } 
    catch (e) { res.error(e.message); }
};

const crearInsumo = async (req, res) => {
    try {
        const info = db.prepare('INSERT INTO insumos (nombre, unidad_medida, sincronizado) VALUES (?, ?, 0)').run(req.body.nombre, req.body.unidad_medida);
        const firestoreId = `INS-${pad4(info.lastInsertRowid)}`;
        
        // 🟢 NUBE EN SEGUNDO PLANO: Guarda en Firebase sin bloquear la aplicación local
        firestore.collection('insumos').doc(firestoreId).set({ nombre: req.body.nombre, unidad_medida: req.body.unidad_medida, stock_actual: 0, estado: 1 }).catch(()=>{});
        
        res.json({ success: true });
    } catch (e) { res.error('El insumo ya existe o hubo un error.'); }
};

const editarInsumo = async (req, res) => {
    try {
        db.prepare('UPDATE insumos SET nombre = ?, unidad_medida = ?, sincronizado = 0 WHERE id = ?').run(req.body.nombre, req.body.unidad_medida, req.params.id);
        const firestoreId = `INS-${pad4(req.params.id)}`;
        
        // 🟢 NUBE EN SEGUNDO PLANO
        firestore.collection('insumos').doc(firestoreId).set({ nombre: req.body.nombre, unidad_medida: req.body.unidad_medida }, { merge: true }).catch(()=>{});
        
        res.json({ success: true });
    } catch (e) { res.error(e.message); }
};

const deshabilitarInsumo = async (req, res) => {
    try {
        db.prepare('UPDATE insumos SET estado = 0, sincronizado = 0 WHERE id = ?').run(req.params.id); 
        const firestoreId = `INS-${pad4(req.params.id)}`;
        
        firestore.collection('insumos').doc(firestoreId).set({ estado: 0 }, { merge: true }).catch(()=>{});
        
        res.json({ success: true });
    } catch (e) { res.error(e.message); }
};

const habilitarInsumo = async (req, res) => {
    try {
        db.prepare('UPDATE insumos SET estado = 1, sincronizado = 0 WHERE id = ?').run(req.params.id); 
        const firestoreId = `INS-${pad4(req.params.id)}`;
        
        firestore.collection('insumos').doc(firestoreId).set({ estado: 1 }, { merge: true }).catch(()=>{});
        
        res.json({ success: true });
    } catch (e) { res.error(e.message); }
};

const registrarMovimiento = async (req, res) => {
    try {
        const { insumo_id, tipo, cantidad, referencia } = req.body;
        const cantFloat = parseFloat(cantidad);
        const cantidadReal = tipo === 'INGRESO' ? cantFloat : -cantFloat;
        
        // 1. Guardado LOCAL GARANTIZADO (🟢 FIX: No permitir stock negativo)
        const rowActual = db.prepare('SELECT stock_actual FROM insumos WHERE id = ?').get(insumo_id);
        const nuevoStock = Math.max(0, (rowActual?.stock_actual || 0) + cantidadReal);
        db.prepare('UPDATE insumos SET stock_actual = ?, sincronizado = 0 WHERE id = ?').run(nuevoStock, insumo_id);
        const info = db.prepare('INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, referencia) VALUES (?, ?, ?, ?)').run(insumo_id, tipo, cantidadReal, referencia || 'Ajuste manual');
        
        const row = db.prepare('SELECT stock_actual FROM insumos WHERE id = ?').get(insumo_id);
        if (row) {
            const firestoreInsumoId = `INS-${pad4(insumo_id)}`;
            const d = new Date();
            const yyyymmdd = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
            const firestoreMovId = `MOV-${pad6(info.lastInsertRowid)}-${yyyymmdd}-${firestoreInsumoId}`;

            // 🟢 NUBE EN SEGUNDO PLANO: Firebase no bloquea si no hay internet
            firestore.collection('insumos').doc(firestoreInsumoId).set({ stock_actual: row.stock_actual }, { merge: true }).catch(()=>{});
            firestore.collection('movimientos_inventario').doc(firestoreMovId).set({ insumo_id: firestoreInsumoId, tipo, cantidad: cantidadReal, referencia: referencia || 'Ajuste manual', fecha: admin.firestore.FieldValue.serverTimestamp() }).catch(()=>{});
        }
        res.json({ success: true });
    } catch (e) { res.error(e.message); }
};

module.exports = {
    getInsumos, crearInsumo, editarInsumo, deshabilitarInsumo, habilitarInsumo, registrarMovimiento
};