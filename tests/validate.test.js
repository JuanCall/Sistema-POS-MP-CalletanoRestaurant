const { validate, schemas } = require('../utils/validate');

// ─── Helpers ──────────────────────────────────────────────

function createMockRes() {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    return res;
}

// ─── Tests del Middleware validate() ──────────────────────

describe('validate() middleware', () => {
    let mockRes;
    let mockNext;

    beforeEach(() => {
        mockRes = createMockRes();
        mockNext = jest.fn();
    });

    test('llama a next() si el body es válido', () => {
        const middleware = validate(schemas.login);
        const req = { body: { username: 'admin', password: '123456' } };
        middleware(req, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('reemplaza req.body con datos transformados (defaults)', () => {
        const middleware = validate(schemas.setConfig);
        const req = { body: { ticketera_caja: 'EPSON' } };
        middleware(req, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        // ticketera_cocina debe tener el default ''
        expect(req.body.ticketera_cocina).toBe('');
        expect(req.body.ticketera_caja).toBe('EPSON');
    });

    test('responde 400 si el body es inválido (campo faltante)', () => {
        const middleware = validate(schemas.login);
        const req = { body: { username: 'admin' } }; // falta password
        middleware(req, mockRes, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'Datos de entrada inválidos',
                details: expect.arrayContaining([
                    expect.objectContaining({ path: 'password' }),
                ]),
            })
        );
    });

    test('responde 400 si el body está vacío', () => {
        const middleware = validate(schemas.login);
        const req = { body: {} };
        middleware(req, mockRes, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'Datos de entrada inválidos',
            })
        );
    });

    test('responde 400 si el body es null', () => {
        const middleware = validate(schemas.crearInsumo);
        const req = { body: null };
        middleware(req, mockRes, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('responde 400 con multiple errores si hay varios campos inválidos', () => {
        const middleware = validate(schemas.crearInsumo);
        const req = { body: {} }; // falta nombre y unidad_medida
        middleware(req, mockRes, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(400);
        const jsonCall = mockRes.json.mock.calls[0][0];
        expect(jsonCall.details.length).toBeGreaterThanOrEqual(2);
    });

    test('rechaza campos extra si el schema usa .strict()', () => {
        const middleware = validate(schemas.setConfig);
        const req = { body: { ticketera_caja: 'X', campo_extra: 'no' } };
        middleware(req, mockRes, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('acepta campos extra si el schema usa .passthrough()', () => {
        const middleware = validate(schemas.adminMenu);
        const req = { body: { algunaPropiedad: 'valor', otra: 123 } };
        middleware(req, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(req.body).toEqual({ algunaPropiedad: 'valor', otra: 123 });
    });
});

// ─── Tests de Schemas Individuales ────────────────────────

describe('schemas.login', () => {
    test('acepta username y password válidos', () => {
        const result = schemas.login.safeParse({ username: 'admin', password: '44910626' });
        expect(result.success).toBe(true);
    });

    test('rechaza username vacío', () => {
        const result = schemas.login.safeParse({ username: '', password: 'x' });
        expect(result.success).toBe(false);
    });

    test('rechaza password vacío', () => {
        const result = schemas.login.safeParse({ username: 'admin', password: '' });
        expect(result.success).toBe(false);
    });
});

describe('schemas.setConfig', () => {
    test('acepta objeto con defaults', () => {
        const result = schemas.setConfig.safeParse({ ticketera_caja: 'EPSON TM-T20' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.ticketera_cocina).toBe('');
        }
    });

    test('rechaza propiedades desconocidas (strict)', () => {
        const result = schemas.setConfig.safeParse({ invalido: 'x' });
        expect(result.success).toBe(false);
    });

    test('acepta objeto vacío (todo opcional con defaults)', () => {
        const result = schemas.setConfig.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.ticketera_caja).toBe('');
            expect(result.data.ticketera_cocina).toBe('');
        }
    });
});

describe('schemas.itemPedido', () => {
    test('acepta item con solo nombre', () => {
        const result = schemas.itemPedido.safeParse({ nombre: 'Arroz con Pollo' });
        expect(result.success).toBe(true);
    });

    test('acepta item con todos los campos opcionales', () => {
        const result = schemas.itemPedido.safeParse({
            nombre: 'Ceviche',
            precio: 15,
            cantidad: 2,
            categoria: 'Entradas',
            modalidad: 'local',
            nota: 'Sin cebolla',
            taper: ['mediano'],
            costo_taper: 2,
            impreso: true,
            cliente: null,
            fecha_agregado: '2026-06-15',
            isMenuDrink: false,
            isDomingo: false,
            es_modo_domingo: false,
        });
        expect(result.success).toBe(true);
    });

    test('acepta taper como string', () => {
        const result = schemas.itemPedido.safeParse({ nombre: 'Arroz', taper: 'chico' });
        expect(result.success).toBe(true);
    });

    test('acepta modalidad delivery_centro y llevar', () => {
        expect(schemas.itemPedido.safeParse({ nombre: 'X', modalidad: 'delivery_centro' }).success).toBe(true);
        expect(schemas.itemPedido.safeParse({ nombre: 'X', modalidad: 'llevar' }).success).toBe(true);
    });

    test('rechaza modalidad inválida', () => {
        const result = schemas.itemPedido.safeParse({ nombre: 'X', modalidad: 'express' });
        expect(result.success).toBe(false);
    });

    test('rechaza nombre vacío', () => {
        const result = schemas.itemPedido.safeParse({ nombre: '' });
        expect(result.success).toBe(false);
    });

    test('acepta campos extra via passthrough', () => {
        const result = schemas.itemPedido.safeParse({ nombre: 'X', campo_extra: 'debe pasar' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.campo_extra).toBe('debe pasar');
        }
    });
});

describe('schemas.crearPedido', () => {
    test('acepta pedido con mesa e items', () => {
        const result = schemas.crearPedido.safeParse({
            mesa: 'mesa_1',
            items: [{ nombre: 'Arroz con Pollo', cantidad: 2 }],
        });
        expect(result.success).toBe(true);
    });

    test('acepta nota_general opcional', () => {
        const result = schemas.crearPedido.safeParse({
            mesa: 'DEL-001',
            items: [{ nombre: 'Ceviche' }],
            nota_general: 'Sin cebolla',
        });
        expect(result.success).toBe(true);
    });

    test('rechaza items vacío', () => {
        const result = schemas.crearPedido.safeParse({ mesa: 'x', items: [] });
        expect(result.success).toBe(false);
    });

    test('rechaza sin mesa', () => {
        const result = schemas.crearPedido.safeParse({ items: [{ nombre: 'x' }] });
        expect(result.success).toBe(false);
    });
});

describe('schemas.modificarPedido', () => {
    test('acepta pedido como array', () => {
        const result = schemas.modificarPedido.safeParse({ pedido: [] });
        expect(result.success).toBe(true);
    });

    test('acepta pedido con items', () => {
        const result = schemas.modificarPedido.safeParse({
            pedido: [{ nombre: 'Arroz con Pollo', cantidad: 1, impreso: true }],
        });
        expect(result.success).toBe(true);
    });

    test('rechaza si pedido no es array', () => {
        const result = schemas.modificarPedido.safeParse({ pedido: 'no-array' });
        expect(result.success).toBe(false);
    });

    test('rechaza si pedido es null', () => {
        const result = schemas.modificarPedido.safeParse({ pedido: null });
        expect(result.success).toBe(false);
    });

    test('rechaza si pedido es objeto', () => {
        const result = schemas.modificarPedido.safeParse({ pedido: { nombre: 'x' } });
        expect(result.success).toBe(false);
    });
});

describe('schemas.moverMesa', () => {
    test('acepta origen y destino', () => {
        const result = schemas.moverMesa.safeParse({ origen: 'mesa_1', destino: 'mesa_2' });
        expect(result.success).toBe(true);
    });

    test('rechaza si falta origen', () => {
        const result = schemas.moverMesa.safeParse({ destino: 'mesa_2' });
        expect(result.success).toBe(false);
    });
});

describe('schemas.cobrarMesa', () => {
    const validCobro = {
        mesaId: 'mesa_1',
        mesaNum: '1',
        metodosPago: { efectivo: 50, yape: 0 },
        totalCobrado: 50,
        items: [{ nombre: 'Arroz con Pollo', precio: 15, cantidad: 1 }],
    };

    test('acepta cobro válido', () => {
        const result = schemas.cobrarMesa.safeParse(validCobro);
        expect(result.success).toBe(true);
    });

    test('acepta totalCobrado como string', () => {
        const result = schemas.cobrarMesa.safeParse({ ...validCobro, totalCobrado: '50.00' });
        expect(result.success).toBe(true);
    });

    test('acepta clienteFacturacion opcional', () => {
        const result = schemas.cobrarMesa.safeParse({
            ...validCobro,
            clienteFacturacion: { documento: '12345678', nombre: 'Juan Perez', direccion: 'Av. Lima 123' },
        });
        expect(result.success).toBe(true);
    });

    test('rechaza sin items', () => {
        const result = schemas.cobrarMesa.safeParse({ ...validCobro, items: [] });
        expect(result.success).toBe(false);
    });

    test('rechaza sin mesaId', () => {
        const { mesaId, ...rest } = validCobro;
        const result = schemas.cobrarMesa.safeParse(rest);
        expect(result.success).toBe(false);
    });
});

describe('schemas.crearInsumo', () => {
    test('acepta nombre y unidad_medida', () => {
        const result = schemas.crearInsumo.safeParse({ nombre: 'Arroz', unidad_medida: 'kg' });
        expect(result.success).toBe(true);
    });

    test('rechaza nombre vacío', () => {
        const result = schemas.crearInsumo.safeParse({ nombre: '', unidad_medida: 'kg' });
        expect(result.success).toBe(false);
    });
});

describe('schemas.editarInsumo', () => {
    test('acepta nombre y unidad_medida', () => {
        const result = schemas.editarInsumo.safeParse({ nombre: 'Arroz Nuevo', unidad_medida: 'g' });
        expect(result.success).toBe(true);
    });
});

describe('schemas.registrarMovimiento', () => {
    test('acepta movimiento INGRESO', () => {
        const result = schemas.registrarMovimiento.safeParse({
            insumo_id: 1, tipo: 'INGRESO', cantidad: 10,
        });
        expect(result.success).toBe(true);
    });

    test('acepta movimiento CONSUMO', () => {
        const result = schemas.registrarMovimiento.safeParse({
            insumo_id: '1', tipo: 'CONSUMO', cantidad: '5',
        });
        expect(result.success).toBe(true);
    });

    test('acepta referencia opcional', () => {
        const result = schemas.registrarMovimiento.safeParse({
            insumo_id: 1, tipo: 'INGRESO', cantidad: 10, referencia: 'Compra semanal',
        });
        expect(result.success).toBe(true);
    });

    test('rechaza tipo inválido', () => {
        const result = schemas.registrarMovimiento.safeParse({
            insumo_id: 1, tipo: 'TRANSFERENCIA', cantidad: 10,
        });
        expect(result.success).toBe(false);
    });
});

describe('schemas.agregarInsumoReceta', () => {
    test('acepta insumo_id y cantidad_requerida', () => {
        const result = schemas.agregarInsumoReceta.safeParse({
            insumo_id: 1, cantidad_requerida: 0.5,
        });
        expect(result.success).toBe(true);
    });

    test('acepta valores como string', () => {
        const result = schemas.agregarInsumoReceta.safeParse({
            insumo_id: '1', cantidad_requerida: '0.5',
        });
        expect(result.success).toBe(true);
    });
});

describe('schemas.crearGasto', () => {
    test('acepta gasto mínimo', () => {
        const result = schemas.crearGasto.safeParse({ descripcion: 'Pan', monto: 15 });
        expect(result.success).toBe(true);
    });

    test('acepta monto como string', () => {
        const result = schemas.crearGasto.safeParse({ descripcion: 'Pan', monto: '15.50' });
        expect(result.success).toBe(true);
    });

    test('acepta con todos los campos', () => {
        const result = schemas.crearGasto.safeParse({
            descripcion: 'Compra de verduras',
            monto: 120,
            categoria: 'Insumos',
            con_comprobante: true,
            fecha: '2026-06-15',
        });
        expect(result.success).toBe(true);
    });

    test('rechaza sin descripcion', () => {
        const result = schemas.crearGasto.safeParse({ monto: 10 });
        expect(result.success).toBe(false);
    });

    test('acepta monto 0', () => {
        const result = schemas.crearGasto.safeParse({ descripcion: 'Gratis', monto: 0 });
        expect(result.success).toBe(true);
    });

    test('rechaza monto como booleano', () => {
        const result = schemas.crearGasto.safeParse({ descripcion: 'Test', monto: true });
        expect(result.success).toBe(false);
    });
});

describe('schemas.resumenDiarioIA', () => {
    test('acepta datos mínimos', () => {
        const result = schemas.resumenDiarioIA.safeParse({
            ingresos: 1500, gastos: 400, topPlatos: [{ nombre: 'Arroz', cantidad: 20 }],
        });
        expect(result.success).toBe(true);
    });

    test('acepta campos opcionales', () => {
        const result = schemas.resumenDiarioIA.safeParse({
            ingresos: '1500', gastos: '400',
            topPlatos: [],
            diaSemana: 'Lunes',
            cantidadTotalPlatos: 50,
            gastoMayor: 'Compra de pollo',
        });
        expect(result.success).toBe(true);
    });
});

describe('schemas.resumenMensualIA', () => {
    test('acepta datos mínimos', () => {
        const result = schemas.resumenMensualIA.safeParse({
            ingresos: 45000, gastos: 18000,
        });
        expect(result.success).toBe(true);
    });

    test('acepta platoCorona null', () => {
        const result = schemas.resumenMensualIA.safeParse({
            ingresos: 45000, gastos: 18000, platoCorona: null,
        });
        expect(result.success).toBe(true);
    });
});

describe('schemas.adminMenu / adminCarta / adminEstado', () => {
    test('adminMenu acepta cualquier objeto', () => {
        const result = schemas.adminMenu.safeParse({ entradas: [], segundos: [], modoDomingo: false });
        expect(result.success).toBe(true);
    });

    test('adminCarta acepta cualquier objeto', () => {
        const result = schemas.adminCarta.safeParse({ categorias: [{ nombre: 'Entradas', items: [] }] });
        expect(result.success).toBe(true);
    });

    test('adminEstado acepta cualquier objeto', () => {
        const result = schemas.adminEstado.safeParse({ abierto: true, horario: '10:00-22:00' });
        expect(result.success).toBe(true);
    });
});
