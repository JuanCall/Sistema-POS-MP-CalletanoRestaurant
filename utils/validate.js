/**
 * Sistema de validación de datos de entrada con Zod.
 * Provee middleware reutilizable y schemas para todos los endpoints del API.
 *
 * Uso en rutas:
 *   router.post('/login', validate(schemas.login), ctrl.login);
 */
const { z } = require('zod');

// ─── Helpers ───────────────────────────────────────────────

/**
 * Middleware factory: valida req.body contra un schema Zod.
 * Si falla, responde con 400 y los errores formateados.
 * Si pasa, reemplaza req.body con los datos transformados/limpios.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: errors,
      });
    }
    req.body = result.data;
    next();
  };
}

// ─── Schemas ───────────────────────────────────────────────

const schemas = {
  // ── Sistema ─────────────────────────────────────────

  login: z.object({
    username: z.string({ required_error: 'username es requerido' }).min(1, 'username no puede estar vacío'),
    password: z.string({ required_error: 'password es requerido' }).min(1, 'password no puede estar vacío'),
  }),

  setConfig: z.object({
    ticketera_caja: z.string().optional().default(''),
    ticketera_cocina: z.string().optional().default(''),
  }).strict(),

  // ── POS ─────────────────────────────────────────────

  itemPedido: z.object({
    nombre: z.string().min(1),
    precio: z.union([z.number(), z.string()]).optional(),
    cantidad: z.number().positive().optional(),
    categoria: z.string().optional(),
    modalidad: z.enum(['local', 'delivery', 'delivery_centro', 'llevar']).optional(),
    nota: z.string().optional(),
    taper: z.union([z.string(), z.array(z.string())]).optional(),
    costo_taper: z.number().optional(),
    impreso: z.boolean().optional(),
    cliente: z.string().nullable().optional(),
    fecha_agregado: z.string().optional(),
    isMenuDrink: z.boolean().optional(),
    isDomingo: z.boolean().optional(),
    es_modo_domingo: z.boolean().optional(),
  }).passthrough(),

  crearPedido: z.object({
    mesa: z.string({ required_error: 'mesa es requerida' }).min(1),
    items: z.array(z.record(z.any())).min(1, 'Debe haber al menos un item'),
    nota_general: z.string().optional(),
  }),

  modificarPedido: z.object({
    pedido: z.array(z.record(z.any())),
  }),

  moverMesa: z.object({
    origen: z.string({ required_error: 'origen es requerido' }).min(1),
    destino: z.string({ required_error: 'destino es requerido' }).min(1),
  }),

  cobrarMesa: z.object({
    mesaId: z.string({ required_error: 'mesaId es requerido' }).min(1),
    mesaNum: z.string({ required_error: 'mesaNum es requerido' }).min(1),
    metodosPago: z.record(z.any(), { required_error: 'metodosPago es requerido' }),
    totalCobrado: z.union([z.number(), z.string()], { required_error: 'totalCobrado es requerido' }),
    items: z.array(z.record(z.any())).min(1, 'Debe haber al menos un item'),
    clienteFacturacion: z.object({
      documento: z.string().optional().default(''),
      nombre: z.string().optional().default(''),
      direccion: z.string().optional().default(''),
    }).optional(),
  }),

  // ── Menú ────────────────────────────────────────────

  agregarInsumoReceta: z.object({
    insumo_id: z.union([z.number(), z.string()], { required_error: 'insumo_id es requerido' }),
    cantidad_requerida: z.union([z.number(), z.string()], { required_error: 'cantidad_requerida es requerida' }),
  }),

  // ── Inventario ──────────────────────────────────────

  crearInsumo: z.object({
    nombre: z.string({ required_error: 'nombre es requerido' }).min(1, 'nombre no puede estar vacío'),
    unidad_medida: z.string({ required_error: 'unidad_medida es requerida' }).min(1, 'unidad_medida no puede estar vacía'),
  }),

  editarInsumo: z.object({
    nombre: z.string({ required_error: 'nombre es requerido' }).min(1, 'nombre no puede estar vacío'),
    unidad_medida: z.string({ required_error: 'unidad_medida es requerida' }).min(1, 'unidad_medida no puede estar vacía'),
  }),

  registrarMovimiento: z.object({
    insumo_id: z.union([z.number(), z.string()], { required_error: 'insumo_id es requerido' }),
    tipo: z.enum(['INGRESO', 'CONSUMO'], { required_error: 'tipo debe ser INGRESO o CONSUMO' }),
    cantidad: z.union([z.number(), z.string()], { required_error: 'cantidad es requerida' }),
    referencia: z.string().optional(),
  }),

  // ── Finanzas ────────────────────────────────────────

  crearGasto: z.object({
    descripcion: z.string({ required_error: 'descripcion es requerida' }).min(1, 'descripcion no puede estar vacía'),
    monto: z.union([z.number(), z.string()], { required_error: 'monto es requerido' }),
    categoria: z.string().optional(),
    con_comprobante: z.boolean().optional(),
    fecha: z.string().optional(),
  }),

  // ── Reportes / IA ───────────────────────────────────

  resumenDiarioIA: z.object({
    ingresos: z.union([z.number(), z.string()]),
    gastos: z.union([z.number(), z.string()]),
    topPlatos: z.array(z.record(z.any())),
    diaSemana: z.string().optional(),
    cantidadTotalPlatos: z.union([z.number(), z.string()]).optional(),
    gastoMayor: z.string().optional(),
  }),

  resumenMensualIA: z.object({
    ingresos: z.union([z.number(), z.string()]),
    gastos: z.union([z.number(), z.string()]),
    platoCorona: z.string().nullable().optional(),
    mes: z.string().optional(),
    ventasPorCategoria: z.array(z.record(z.any())).optional(),
    diasOperados: z.number().optional(),
  }),

  // ── Sync (Admin) ────────────────────────────────────

  adminMenu: z.object({}).passthrough(),
  adminCarta: z.object({}).passthrough(),
  adminEstado: z.object({}).passthrough(),
};

module.exports = { validate, schemas };
