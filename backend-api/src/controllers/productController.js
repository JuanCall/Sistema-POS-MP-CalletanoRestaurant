const pool = require('../config/database');

const getCategorias = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_categoria, nombre, etiqueta_col1, etiqueta_col2 FROM categorias ORDER BY id_categoria ASC'
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener categorias:', error.message);

    return res.status(500).json({
      message: 'Error al obtener las categorias',
    });
  }
};

const getProductos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id_producto,
        p.nombre,
        p.precio_unico,
        p.precio_col1,
        p.precio_col2,
        p.disponible,
        p.id_categoria,
        c.nombre AS categoria
      FROM productos p
      INNER JOIN categorias c ON p.id_categoria = c.id_categoria
      ORDER BY p.id_producto ASC
    `);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos:', error.message);

    return res.status(500).json({
      message: 'Error al obtener los productos',
    });
  }
};

module.exports = {
  getCategorias,
  getProductos,
};
