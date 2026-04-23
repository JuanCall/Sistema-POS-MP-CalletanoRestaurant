const pool = require('../config/database');

const createOrder = async (req, res) => {
  const { id_mesa, id_usuario, estado, detalles } = req.body;

  if (!id_mesa || !id_usuario || !Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({
      message: 'Datos del pedido incompletos',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const mesaResult = await client.query(
      'SELECT id_mesa, estado FROM mesas WHERE id_mesa = $1',
      [id_mesa]
    );

    if (mesaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        message: 'La mesa no existe',
      });
    }

    if (mesaResult.rows[0].estado === 'OCUPADA') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'La mesa ya se encuentra ocupada',
      });
    }

    const usuarioResult = await client.query(
      'SELECT id_usuario FROM usuarios WHERE id_usuario = $1',
      [id_usuario]
    );

    if (usuarioResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        message: 'El usuario no existe',
      });
    }

    const pedidoResult = await client.query(
      `INSERT INTO pedidos (id_mesa, id_usuario, estado)
       VALUES ($1, $2, $3)
       RETURNING id_pedido`,
      [id_mesa, id_usuario, estado || 'EN_ATENCION']
    );

    const idPedido = pedidoResult.rows[0].id_pedido;

    for (const item of detalles) {
      const {
        tipo_item,
        id_producto,
        id_plato_menu,
        cantidad,
        precio_unitario,
        notas,
        estado_impresion,
      } = item;

      if (!tipo_item || !cantidad || !precio_unitario) {
        throw new Error('Detalle de pedido incompleto');
      }

      if (tipo_item === 'CARTA' && !id_producto) {
        throw new Error('Falta id_producto para item de carta');
      }

      if (tipo_item === 'MENU' && !id_plato_menu) {
        throw new Error('Falta id_plato_menu para item de menu');
      }

      await client.query(
        `INSERT INTO detalle_pedidos
        (id_pedido, tipo_item, id_producto, id_plato_menu, cantidad, precio_unitario, notas, estado_impresion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          idPedido,
          tipo_item,
          id_producto || null,
          id_plato_menu || null,
          cantidad,
          precio_unitario,
          notas || null,
          estado_impresion || 'PENDIENTE',
        ]
      );
    }

    await client.query(
      'UPDATE mesas SET estado = $1 WHERE id_mesa = $2',
      ['OCUPADA', id_mesa]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Pedido creado correctamente',
      id_pedido: idPedido,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear pedido:', error.message);

    return res.status(500).json({
      message: 'Error al crear el pedido',
    });
  } finally {
    client.release();
  }
};

const getMesas = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_mesa, numero, estado FROM mesas ORDER BY numero ASC'
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener mesas:', error.message);

    return res.status(500).json({
      message: 'Error al obtener las mesas',
    });
  }
};

const getMesaById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT id_mesa, numero, estado FROM mesas WHERE id_mesa = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Mesa no encontrada',
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener la mesa:', error.message);

    return res.status(500).json({
      message: 'Error al obtener la mesa',
    });
  }
};

module.exports = {
  createOrder,
  getMesas,
  getMesaById,
};
