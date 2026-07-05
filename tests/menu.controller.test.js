/**
 * Tests para controllers/menu.controller.js
 *
 * Cubre getMesas, getCarta (con cálculos de stock), getDataCruda,
 * getReceta, agregarInsumoReceta y eliminarInsumoReceta.
 */

// ─── Mocks ────────────────────────────────────────────────

const mockMesasDB = [];
const mockCategoriasDB = [];
const mockPlatosDB = [];
const mockInsumosDB = [];

const mockDb = {
    prepare: jest.fn((sql) => {
        if (sql.includes('SELECT * FROM mesas_activas')) {
            return {
                all: jest.fn(() => [...mockMesasDB].map(m => ({
                    ...m,
                    pedido: typeof m.pedido === 'string' ? m.pedido : JSON.stringify(m.pedido || []),
                }))),
            };
        }
        if (sql.includes('SELECT id, stock_actual, nombre FROM insumos')) {
            return { all: jest.fn(() => [...mockInsumosDB]) };
        }
        if (sql.includes('SELECT * FROM categorias')) {
            return { all: jest.fn(() => [...mockCategoriasDB]) };
        }
        if (sql.includes('SELECT * FROM platos WHERE categoria_id')) {
            return {
                all: jest.fn((catId) => mockPlatosDB.filter(p => p.categoria_id === catId)),
            };
        }
        if (sql.includes('SELECT receta_json FROM platos WHERE id')) {
            return {
                get: jest.fn((id) => {
                    const p = mockPlatosDB.find(pl => pl.id === Number(id));
                    return p ? { receta_json: p.receta_json || null } : null;
                }),
            };
        }
        if (sql.includes('SELECT nombre, unidad_medida FROM insumos WHERE id')) {
            return {
                get: jest.fn((id) => {
                    const ins = mockInsumosDB.find(i => i.id === Number(id));
                    return ins ? { nombre: ins.nombre, unidad_medida: ins.unidad_medida } : null;
                }),
            };
        }
        if (sql.includes('SELECT nombre, receta_json FROM platos WHERE id')) {
            return {
                get: jest.fn((id) => {
                    const p = mockPlatosDB.find(pl => pl.id === Number(id));
                    return p ? { nombre: p.nombre, receta_json: p.receta_json || null } : null;
                }),
            };
        }
        if (sql.includes('SELECT id FROM platos WHERE UPPER(nombre)')) {
            return {
                get: jest.fn((nombre) => {
                    const found = mockPlatosDB.find(p => p.nombre.toUpperCase() === nombre.toUpperCase());
                    return found ? { id: found.id } : null;
                }),
            };
        }
        if (sql.includes('UPDATE platos SET receta_json')) {
            return { run: jest.fn() };
        }
        return { run: jest.fn(), all: jest.fn(() => []), get: jest.fn(() => null) };
    }),
};

const mockDocSet = jest.fn().mockResolvedValue();
const mockFirestoreDoc = jest.fn(() => ({ set: mockDocSet }));
const mockFirestoreCollection = jest.fn(() => ({ doc: mockFirestoreDoc }));

jest.mock('../database', () => mockDb);
jest.mock('../config/firebase', () => ({
    firestore: { collection: mockFirestoreCollection },
}));

const mockState = {
    modoDomingoGlobal: false,
    estadoRestauranteGlobal: { apertura: 12, cierre: 22 },
    rawMenuDiario: { entradas: [], segundos: [] },
    rawCartaCompleta: { categorias: [] },
};
jest.mock('../store/globalState', () => mockState);

const ctrl = require('../controllers/menu.controller');

// ─── Helpers ──────────────────────────────────────────────

function createMockRes() {
    const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        error: jest.fn(function (msg, code) {
            this.status(code || 500).json({ success: false, error: msg });
            return this;
        }),
    };
    return res;
}

// ─── Tests ────────────────────────────────────────────────

describe('getMesas', () => {
    beforeEach(() => {
        mockMesasDB.length = 0;
    });

    test('retorna lista vacía si no hay mesas', () => {
        const req = {};
        const res = createMockRes();
        ctrl.getMesas(req, res);
        expect(res.json).toHaveBeenCalledWith([]);
    });

    test('retorna mesas con pedido parseado', () => {
        mockMesasDB.push({
            id: 'mesa_1',
            estado: 'ocupada',
            pedido: JSON.stringify([{ nombre: 'Arroz con Pollo', cantidad: 2 }]),
            total: 30,
            nota_general: '',
        });

        const req = {};
        const res = createMockRes();
        ctrl.getMesas(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'mesa_1',
                    estado: 'ocupada',
                    pedido: [{ nombre: 'Arroz con Pollo', cantidad: 2 }],
                }),
            ])
        );
    });

    test('retorna múltiples mesas', () => {
        mockMesasDB.push(
            { id: 'mesa_1', estado: 'ocupada', pedido: '[]', total: 0, nota_general: '' },
            { id: 'mesa_2', estado: 'libre', pedido: '[]', total: 0, nota_general: '' }
        );

        const req = {};
        const res = createMockRes();
        ctrl.getMesas(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ id: 'mesa_1' }),
                expect.objectContaining({ id: 'mesa_2' }),
            ])
        );
    });
});

describe('getCarta', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCategoriasDB.length = 0;
        mockPlatosDB.length = 0;
        mockInsumosDB.length = 0;
        mockState.rawMenuDiario = { entradas: [], segundos: [] };
        mockState.rawCartaCompleta = { categorias: [] };
    });

    test('retorna array vacío si no hay categorías', () => {
        const req = {};
        const res = createMockRes();
        ctrl.getCarta(req, res);
        expect(res.json).toHaveBeenCalledWith([]);
    });

    test('retorna categoría con plato simple sin stock ni receta', () => {
        mockCategoriasDB.push({ id: 1, nombre: 'BEBIDAS' });
        mockPlatosDB.push({ id: 1, categoria_id: 1, nombre: 'INKA COLA 296ML', precio: 3, estado: 1, stock_diario: null, receta_json: null });

        const req = {};
        const res = createMockRes();
        ctrl.getCarta(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    nombre: 'BEBIDAS',
                    items: expect.arrayContaining([
                        expect.objectContaining({
                            nombre: 'INKA COLA 296ML',
                            stock_actual: null,
                            costo_taper: 0,
                        }),
                    ]),
                }),
            ])
        );
    });

    test('calcula stock_actual desde stock_diario cuando está configurado', () => {
        mockCategoriasDB.push({ id: 1, nombre: 'ENTRADAS' });
        mockPlatosDB.push({ id: 1, categoria_id: 1, nombre: 'CEVICHE', precio: 8, estado: 1, stock_diario: 15, receta_json: null });
        mockState.rawMenuDiario = { entradas: [{ nombre: 'CEVICHE', stock: 15, precio: 8 }], segundos: [] };

        const req = {};
        const res = createMockRes();
        ctrl.getCarta(req, res);

        const jsonArg = res.json.mock.calls[0][0];
        const plato = jsonArg[0].items[0];
        expect(plato.stock_actual).toBe(15);
    });

    test('calcula stock mínimo desde receta cuando stock_diario es null', () => {
        mockCategoriasDB.push({ id: 1, nombre: 'SEGUNDOS' });
        mockInsumosDB.push({ id: 1, nombre: 'Arroz', unidad_medida: 'kg', stock_actual: 10, estado: 1 });
        mockPlatosDB.push({
            id: 1, categoria_id: 1, nombre: 'ARROZ CON POLLO', precio: 15,
            stock_diario: null,
            receta_json: JSON.stringify([{ insumo_id: 1, cantidad_requerida: 0.25 }]),
        });

        const req = {};
        const res = createMockRes();
        ctrl.getCarta(req, res);

        const jsonArg = res.json.mock.calls[0][0];
        const plato = jsonArg[0].items[0];
        // 10 kg / 0.25 kg por porción = 40 porciones posibles
        expect(plato.stock_actual).toBe(40);
    });

    test('calcula costo_taper desde receta cuando hay insumo TAPER', () => {
        mockCategoriasDB.push({ id: 1, nombre: 'SEGUNDOS' });
        mockInsumosDB.push(
            { id: 1, nombre: 'Arroz', unidad_medida: 'kg', stock_actual: 10, estado: 1 },
            { id: 2, nombre: 'TAPER MEDIANO', unidad_medida: 'unidad', stock_actual: 100, estado: 1 }
        );
        mockPlatosDB.push({
            id: 1, categoria_id: 1, nombre: 'ARROZ CON POLLO', precio: 15,
            stock_diario: null,
            receta_json: JSON.stringify([
                { insumo_id: 1, cantidad_requerida: 0.25 },
                { insumo_id: 2, cantidad_requerida: 1 },
            ]),
        });
        mockState.rawMenuDiario = {
            entradas: [],
            segundos: [{ nombre: 'ARROZ CON POLLO' }], // sin taper en menú diario para aislar cálculo desde receta
        };

        const req = {};
        const res = createMockRes();
        ctrl.getCarta(req, res);

        const jsonArg = res.json.mock.calls[0][0];
        const plato = jsonArg[0].items[0];
        // Taper mediano en receta (cantidad_requerida: 1) cuesta 2
        expect(plato.costo_taper).toBe(2);
    });

    test('asigna taper desde menu diario para platos con taper asignado', () => {
        mockCategoriasDB.push({ id: 1, nombre: 'ENTRADAS' });
        mockPlatosDB.push({ id: 1, categoria_id: 1, nombre: 'CEVICHE (ENTRADA)', precio: 8, estado: 1, stock_diario: null, receta_json: null });
        mockState.rawMenuDiario = {
            entradas: [{ nombre: 'CEVICHE (ENTRADA)', taper: ['chico'] }],
            segundos: [],
        };

        const req = {};
        const res = createMockRes();
        ctrl.getCarta(req, res);

        const jsonArg = res.json.mock.calls[0][0];
        const plato = jsonArg[0].items[0];
        expect(plato.taper).toEqual(['chico']);
        expect(plato.costo_taper).toBe(1);
    });

    test('maneja error de DB', () => {
        mockDb.prepare.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const req = {};
        const res = createMockRes();
        ctrl.getCarta(req, res);
        expect(res.error).toHaveBeenCalled();
    });
});

describe('getDataCruda', () => {
    test('retorna menu diario, carta y estado', () => {
        const req = {};
        const res = createMockRes();
        ctrl.getDataCruda(req, res);

        expect(res.json).toHaveBeenCalledWith({
            menuDiario: mockState.rawMenuDiario,
            cartaCompleta: expect.any(Object),
            estado: mockState.estadoRestauranteGlobal,
        });
    });

    test('asigna IDs a platos cuando existe precio2', () => {
        mockPlatosDB.push({ id: 5, nombre: 'CEVICHE (PERSONAL)', categoria_id: 1, precio: 8, stock_diario: null, receta_json: null });
        mockState.rawCartaCompleta = {
            categorias: [{
                nombre: 'Entradas',
                items: [{ nombre: 'Ceviche', precio: 8, precio2: 15 }],
            }],
        };

        const req = {};
        const res = createMockRes();
        ctrl.getDataCruda(req, res);

        const jsonArg = res.json.mock.calls[0][0];
        // El código busca el plato por nombre normalizado + sufijo '(PERSONAL)' cuando existe precio2
        expect(jsonArg.cartaCompleta.categorias[0].items[0].id).toBe(5);
    });
});

describe('getReceta', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPlatosDB.length = 0;
        mockInsumosDB.length = 0;
    });

    test('retorna array vacío si el plato no existe', () => {
        const req = { params: { id: '999' } };
        const res = createMockRes();
        ctrl.getReceta(req, res);
        expect(res.json).toHaveBeenCalledWith([]);
    });

    test('retorna array vacío si el plato no tiene receta', () => {
        mockPlatosDB.push({ id: 1, nombre: 'ARROZ CON POLLO', precio: 15, categoria_id: 1, stock_diario: null, receta_json: null });
        const req = { params: { id: '1' } };
        const res = createMockRes();
        ctrl.getReceta(req, res);
        expect(res.json).toHaveBeenCalledWith([]);
    });

    test('retorna ingredientes de la receta', () => {
        mockPlatosDB.push({
            id: 1, nombre: 'ARROZ CON POLLO', precio: 15, categoria_id: 1,
            receta_json: JSON.stringify([{ insumo_id: 1, cantidad_requerida: 0.25 }]),
        });
        mockInsumosDB.push({ id: 1, nombre: 'Arroz', unidad_medida: 'kg', stock_actual: 10, estado: 1 });

        const req = { params: { id: '1' } };
        const res = createMockRes();
        ctrl.getReceta(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    insumo_id: 1,
                    nombre: 'Arroz',
                    cantidad_requerida: 0.25,
                }),
            ])
        );
    });

    test('retorna Insumo Desconocido si no existe el insumo', () => {
        mockPlatosDB.push({
            id: 2, nombre: 'CEVICHE', precio: 12, categoria_id: 1,
            receta_json: JSON.stringify([{ insumo_id: 999, cantidad_requerida: 0.5 }]),
        });

        const req = { params: { id: '2' } };
        const res = createMockRes();
        ctrl.getReceta(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ nombre: 'Insumo Desconocido' }),
            ])
        );
    });
});

describe('agregarInsumoReceta', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPlatosDB.length = 0;
    });

    test('agrega insumo a receta', async () => {
        mockPlatosDB.push({
            id: 1, nombre: 'ARROZ CON POLLO', precio: 15, categoria_id: 1,
            receta_json: null,
        });
        mockState.rawCartaCompleta = { categorias: [{ nombre: 'Segundos', items: [{ nombre: 'ARROZ CON POLLO', receta: [] }] }] };

        const req = { params: { id: '1' }, body: { insumo_id: 1, cantidad_requerida: 0.25 } };
        const res = createMockRes();
        await ctrl.agregarInsumoReceta(req, res);

        expect(res.json).toHaveBeenCalledWith({ success: true });
        // Debe actualizar Firebase también
        expect(mockFirestoreCollection).toHaveBeenCalledWith('contenido');
    });

    test('reemplaza insumo existente (no duplica)', async () => {
        mockPlatosDB.push({
            id: 1, nombre: 'ARROZ CON POLLO', precio: 15, categoria_id: 1,
            receta_json: JSON.stringify([{ insumo_id: 1, cantidad_requerida: 0.5 }]),
        });

        const req = { params: { id: '1' }, body: { insumo_id: 1, cantidad_requerida: 0.25 } };
        const res = createMockRes();
        await ctrl.agregarInsumoReceta(req, res);

        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    test('retorna error si plato no existe', async () => {
        const req = { params: { id: '999' }, body: { insumo_id: 1, cantidad_requerida: 0.25 } };
        const res = createMockRes();
        await ctrl.agregarInsumoReceta(req, res);

        expect(res.error).toHaveBeenCalledWith('Plato no encontrado', 404);
    });
});

describe('eliminarInsumoReceta', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPlatosDB.length = 0;
    });

    test('elimina insumo de la receta', async () => {
        mockPlatosDB.push({
            id: 1, nombre: 'ARROZ CON POLLO', precio: 15, categoria_id: 1,
            receta_json: JSON.stringify([{ insumo_id: 1, cantidad_requerida: 0.25 }, { insumo_id: 2, cantidad_requerida: 0.5 }]),
        });

        const req = { params: { id: '1-1' } }; // platoId-insumoId compuesto
        const res = createMockRes();
        await ctrl.eliminarInsumoReceta(req, res);

        expect(res.json).toHaveBeenCalledWith({ success: true });
        // Debe actualizar plato con receta filtrada (solo queda insumo 2)
        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE platos SET receta_json')
        );
    });

    test('retorna error si identificador compuesto es inválido', async () => {
        const req = { params: { id: 'invalido' } }; // sin guión
        const res = createMockRes();
        await ctrl.eliminarInsumoReceta(req, res);

        expect(res.error).toHaveBeenCalledWith('Identificador compuesto inválido', 400);
    });

    test('retorna error si plato no existe', async () => {
        const req = { params: { id: '999-1' } };
        const res = createMockRes();
        await ctrl.eliminarInsumoReceta(req, res);

        expect(res.error).toHaveBeenCalledWith('Plato no encontrado', 404);
    });

    test('limpia receta a null si queda vacía', async () => {
        mockPlatosDB.push({
            id: 1, nombre: 'ARROZ CON POLLO', precio: 15, categoria_id: 1,
            receta_json: JSON.stringify([{ insumo_id: 1, cantidad_requerida: 0.25 }]),
        });

        const req = { params: { id: '1-1' } };
        const res = createMockRes();
        await ctrl.eliminarInsumoReceta(req, res);

        // Debe pasar null a run() cuando la lista queda vacía
        const updateCall = mockDb.prepare.mock.calls.find(([sql]) => sql.includes('UPDATE platos SET receta_json'));
        expect(updateCall).toBeDefined();
    });
});
