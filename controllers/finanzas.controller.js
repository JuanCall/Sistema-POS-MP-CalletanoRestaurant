const db = require('../database');
const { firestore, admin } = require('../config/firebase');
const { aFechaLocal, pad5, pad6 } = require('../utils/helpers');

const getVentas = (req, res) => {
    res.json(db.prepare("SELECT * FROM ventas WHERE date(fecha) = date(?) ORDER BY id DESC").all(req.query.fecha || new Date().toISOString().split('T')[0]));
};

const anularVenta = async (req, res) => {
  try {
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
    if (venta) {
        let firestoreId = venta.firebase_id;
        if (!firestoreId) {
            const fechaLimpia = venta.fecha.split(' ')[0].replace(/-/g, '');
            firestoreId = `TKT-${pad6(venta.id)}-${fechaLimpia}`;
        }
        await firestore.collection('ventas_historicas').doc(firestoreId).delete();
    }
    db.prepare(`DELETE FROM ventas WHERE id = ?`).run(req.params.id);
    res.json({ message: 'Venta anulada' });
  } catch (error) { res.error('Error al anular venta'); }
};

const getGastos = (req, res) => {
    res.json(db.prepare("SELECT * FROM gastos WHERE date(fecha) = date(?) ORDER BY id DESC").all(req.query.fecha || aFechaLocal(new Date()).split(' ')[0]));
};

const crearGasto = async (req, res) => {
  try {
    const fechaReal = req.body.fecha || aFechaLocal(new Date()); 
    const comprobanteFlag = req.body.con_comprobante ? 1 : 0; 
    
    const result = db.prepare(`INSERT INTO gastos (descripcion, monto, categoria, con_comprobante, fecha, sincronizado) VALUES (?, ?, ?, ?, ?, 1)`).run(req.body.descripcion, req.body.monto, req.body.categoria || 'Otros', comprobanteFlag, fechaReal);
    const idLocal = result.lastInsertRowid;
    
    const fechaLimpia = fechaReal.split(' ')[0].replace(/-/g, '');
    const idPersonalizado = `GAS-${pad5(idLocal)}-${fechaLimpia}`;
    
    db.prepare('UPDATE gastos SET firebase_id = ? WHERE id = ?').run(idPersonalizado, idLocal);
    
    await firestore.collection('gastos').doc(idPersonalizado).set({ 
        categoria: req.body.categoria || 'Otros', 
        concepto: req.body.descripcion, 
        fecha: admin.firestore.Timestamp.fromDate(new Date(fechaReal)), 
        monto: parseFloat(req.body.monto),
        con_comprobante: req.body.con_comprobante === true 
    });
    res.json({ id: idLocal, firestoreId: idPersonalizado });
  } catch (error) { 
      res.error(error.message || 'Error al guardar gasto'); 
  }
};

const anularGasto = async (req, res) => {
  try {
    const gasto = db.prepare('SELECT * FROM gastos WHERE id = ?').get(req.params.id);
    if (gasto) {
        let firestoreId = gasto.firebase_id;
        if (!firestoreId) {
            const fechaLimpia = gasto.fecha.split(' ')[0].replace(/-/g, '');
            firestoreId = `GAS-${pad5(gasto.id)}-${fechaLimpia}`;
        }
        await firestore.collection('gastos').doc(firestoreId).delete();
    }
    db.prepare('DELETE FROM gastos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) { res.error('Error al anular venta'); }
};

module.exports = {
    getVentas, anularVenta, getGastos, crearGasto, anularGasto
};