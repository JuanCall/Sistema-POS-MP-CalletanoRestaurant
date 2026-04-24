const pool = require('../config/database');
const { logError } = require('../utils/logger');

const closeTable = async (req, res) => {
  const { id_pedido, cajero_id, metodo_pago } = req.body;

  if (!id_pedido || !cajero_id || !metodo_pago) {
    return res.status(400).json({
      message: 'id_pedido, cajero_id y metodo_pago son obligatorios',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const pedidoResult = await client.query(
      `SELECT id_pedido, id_mesa, estado
       FROM pedidos
       WHERE id_pedido = $1`,
      [id_pedido]
    );

    if (pedidoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        message: 'Pedido no encontrado',
      });
    }

    const pedido = pedidoResult.rows[0];

    if (pedido.estado === 'PAGADO') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'El pedido ya fue pagado',
      });
    }

    if (pedido.estado === 'ANULADO') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'No se puede facturar un pedido anulado',
      });
    }

    const detalleResult = await client.query(
      `SELECT cantidad, precio_unitario
       FROM detalle_pedidos
       WHERE id_pedido = $1`,
      [id_pedido]
    );

    if (detalleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'El pedido no tiene detalles registrados',
      });
    }

    const subtotal = Number(
      detalleResult.rows
        .reduce((acc, item) => acc + Number(item.cantidad) * Number(item.precio_unitario), 0)
        .toFixed(2)
    );

    const igv = Number((subtotal * 0.18).toFixed(2));
    const total = Number((subtotal + igv).toFixed(2));

    const ventaResult = await client.query(
      `INSERT INTO ventas
       (id_pedido, cajero_id, subtotal, igv, total, metodo_pago)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_venta, fecha_emision`,
      [id_pedido, cajero_id, subtotal, igv, total, metodo_pago]
    );

    await client.query(
      `UPDATE pedidos
       SET estado = 'PAGADO'
       WHERE id_pedido = $1`,
      [id_pedido]
    );

    await client.query(
      `UPDATE mesas
       SET estado = 'LIBRE'
       WHERE id_mesa = $1`,
      [pedido.id_mesa]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Mesa cerrada correctamente',
      venta: {
        id_venta: ventaResult.rows[0].id_venta,
        id_pedido,
        id_mesa: pedido.id_mesa,
        subtotal,
        igv,
        total,
        metodo_pago,
        fecha_emision: ventaResult.rows[0].fecha_emision,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cerrar mesa:', error.message);

    logError({
      message: 'Error al cerrar mesa',
      error,
      context: 'billingController.closeTable',
    });

    return res.status(500).json({
      message: 'Error al cerrar la mesa',
    });
  } finally {
    client.release();
  }
};

module.exports = {
  closeTable,
};
