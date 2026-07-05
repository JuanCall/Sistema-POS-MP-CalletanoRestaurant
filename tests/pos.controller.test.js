/**
 * Tests para controllers/pos.controller.js
 *
 * Funciones core del sistema POS:
 * - crearPedido (con verificación de stock)
 * - modificarPedido (con diferencial de inventario)
 * - moverMesa (con/sin fusión)
 * - cobrarMesa (con/sin SUNAT)
 *
 * Funciones internas:
 * - calcularUsoInventario
 * - procesarRecetasVenta
 * - auditarStockYAlertar
 * - actualizarStockMenuFirebase
 * - registrarMovimientoInventario
 */

// ─── Variables de estado compartidas ─────────────────────

const mockInsumosDB = [];
const mockMesasDB = [];
let mockRecetaDB = {}; // { 'PLATO_NORM|CAT_NORM': [{ insumo_id, cantidad_requerida }, ...] }

// ─── Mock de database ────────────────────────────────────

const mockDb = {
    prepare: jest.fn((sql) => {
        if (sql.includes('SELECT pedido FROM mesas_activas WHERE id')) {
            return {
                get: jest.fn((id) => {
                    const m = mockMesasDB.find(mesa => mesa.id === id);
                    return m ? { pedido: m.pedido } : null;
                }),
            };
        }
        if (sql.includes('SELECT * FROM mesas_activas WHERE id')) {
            return {
                get: jest.fn((id) => {
                    const m = mockMesasDB.find(mesa => mesa.id === id);
                    return m || null;
                }),
            };
        }
        if (sql.includes('SELECT * FROM mesas_activas')) {
            return { all: jest.fn(() => [...mockMesasDB]) };
        }
        if (sql.includes('INSERT OR IGNORE INTO mesas_activas')) {
            return { run: jest.fn() };
        }
        if (sql.includes('UPDATE mesas_activas SET')) {
            return { run: jest.fn() };
        }
        if (sql.includes('DELETE FROM mesas_activas')) {
            return { run: jest.fn() };
        }
        // Insumos
        if (sql.includes('SELECT stock_actual FROM insumos WHERE UPPER(nombre)')) {
            return {
                get: jest.fn((nom) => {
                    const ins = mockInsumosDB.find(i => i._nombreNorm === nom);
                    return ins ? { stock_actual: ins.stock_actual } : null;
                }),
            };
        }
        if (sql.includes('SELECT id, stock_actual, nombre FROM insumos WHERE UPPER(nombre)')) {
            return {
                get: jest.fn((nom) => {
                    const ins = mockInsumosDB.find(i => i._nombreNorm === nom);
                    return ins ? { id: ins.id, stock_actual: ins.stock_actual, nombre: ins.nombre } : null;
                }),
            };
        }
        if (sql.includes('SELECT id, stock_actual, nombre FROM insumos')) {
            return { all: jest.fn(() => [...mockInsumosDB]) };
        }
        if (sql.includes('UPDATE insumos SET stock_actual')) {
            return { run: jest.fn() };
        }
        if (sql.includes('INSERT INTO movimientos_inventario')) {
            return { run: jest.fn(() => ({ lastInsertRowid: 1 })) };
        }
        // Platos con receta 
        if (sql.includes('SELECT p.receta_json FROM platos p JOIN categorias c')) {
            return {
                get: jest.fn((nombreBase, cat) => {
                    const key = `${nombreBase}|${cat}`;
                    if (mockRecetaDB[key]) {
                        return { receta_json: JSON.stringify(mockRecetaDB[key]) };
                    }
                    return null;
                }),
            };
        }
        if (sql.includes('SELECT p.id, p.stock_diario FROM platos p JOIN categorias c')) {
            return {
                get: jest.fn(() => null),
            };
        }
        if (sql.includes('UPDATE platos SET stock_diario')) {
            return { run: jest.fn() };
        }
        // SUNAT
        if (sql.includes('SELECT numero FROM sunat_correlativos')) {
            return { get: jest.fn(() => ({ numero: 0 })) };
        }
        if (sql.includes("UPDATE sunat_correlativos SET numero")) {
            return { run: jest.fn() };
        }
        if (sql.includes('INSERT INTO sunat_pendientes')) {
            return { run: jest.fn() };
        }
        if (sql.includes('UPDATE ventas SET firebase_id')) {
            return { run: jest.fn() };
        }
        if (sql.includes('INSERT INTO ventas')) {
            return { run: jest.fn(() => ({ lastInsertRowid: 1 })) };
        }
        if (sql.includes('SELECT nombre FROM insumos WHERE id')) {
            return {
                get: jest.fn((id) => {
                    const ins = mockInsumosDB.find(i => i.id === id);
                    return ins ? { nombre: ins.nombre } : null;
                }),
            };
        }
        return { run: jest.fn(), all: jest.fn(() => []), get: jest.fn(() => null) };
    }),
};

// Firebase mocks
const mockDocSet = jest.fn().mockResolvedValue();
const mockDocDelete = jest.fn().mockResolvedValue();
const mockFirestoreDoc = jest.fn(() => ({ set: mockDocSet, delete: mockDocDelete }));
const mockFirestoreCollection = jest.fn(() => ({ doc: mockFirestoreDoc }));
const mockFieldValue = { serverTimestamp: () => new Date() };

jest.mock('../database', () => mockDb);
jest.mock('../config/firebase', () => ({
    firestore: { collection: mockFirestoreCollection },
    admin: { firestore: { FieldValue: mockFieldValue } },
}));
jest.mock('../services/sync.service', () => ({
    sincronizarHaciaArriba: jest.fn().mockResolvedValue(),
}));

const mockState = {
    modoDomingoGlobal: false,
    rawMenuDiario: { entradas: [], segundos: [] },
    rawCartaCompleta: { categorias: [] },
};
jest.mock('../store/globalState', () => mockState);

jest.mock('axios', () => ({
    post: jest.fn().mockResolvedValue({ data: 'ok' }),
}));
jest.mock('fs');
jest.mock('path');
jest.mock('os', () => ({ homedir: () => 'C:\\Users\\test' }));

const ctrl = require('../controllers/pos.controller');

// ─── Helpers ──────────────────────────────────────────────

function createMockReq(body = {}, params = {}) {
    return {
        body,
        params,
        app: {
            get: jest.fn(() => ({
                emit: jest.fn(),
            })),
        },
    };
}

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

// Helper para crear insumos mock
function addMockInsumo(id, nombre, stock) {
    const ins = { id, nombre, _nombreNorm: nombre.toUpperCase().replace(/\s+/g, ' ').trim(), stock_actual: stock, unidad_medida: 'unidad', estado: 1 };
    mockInsumosDB.push(ins);
    return ins;
}

function addMockMesa(id, estado = 'libre', pedido = '[]', total = 0, nota = '') {
    const mesa = { id, estado, pedido, total, nota_general: nota };
    mockMesasDB.push(mesa);
    return mesa;
}

// ─── Tests ────────────────────────────────────────────────

describe('crearPedido', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockInsumosDB.length = 0;
        mockMesasDB.length = 0;
        mockRecetaDB = {};
        mockState.modoDomingoGlobal = false;
        mockState.rawMenuDiario = { entradas: [], segundos: [] };
    });

    test('crea pedido exitosamente en mesa nueva', async () => {
        addMockInsumo(1, 'ARROZ', 50);

        const req = createMockReq({
            mesa: 'mesa_5',
            items: [{ nombre: 'Arroz con Pollo', precio: 15, cantidad: 2, categoria: 'Segundos', modalidad: 'local' }],
        });
        const res = createMockRes();

        await ctrl.crearPedido(req, res);

        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    test('rechaza pedido si no hay stock suficiente', async () => {
        addMockInsumo(1, 'ARROZ', 1); // solo 1 unidad
        // Configurar receta para el plato
        mockRecetaDB['ARROZ CON POLLO|SEGUNDOS'] = [{ insumo_id: 1, cantidad_requerida: 1 }];

        const req = createMockReq({
            mesa: 'mesa_1',
            items: [{ nombre: 'Arroz con Pollo', precio: 15, cantidad: 10, categoria: 'Segundos', modalidad: 'local' }],
        });
        const res = createMockRes();

        await ctrl.crearPedido(req, res);

        // Necesita 10 unidades de ARROZ pero solo hay 1
        expect(res.error).toHaveBeenCalledWith(
            expect.stringContaining('Stock agotado'),
            400
        );
    });

    test('fusión de items iguales en la misma mesa', async () => {
        addMockInsumo(1, 'ARROZ', 50);
        mockRecetaDB['ARROZ CON POLLO|SEGUNDOS'] = [{ insumo_id: 1, cantidad_requerida: 1 }];
        addMockMesa('mesa_1', 'ocupada', JSON.stringify([
            { nombre: 'ARROZ CON POLLO', precio: 15, cantidad: 1, modalidad: 'local', categoria: 'SEGUNDOS', impreso: true, taper: [] },
        ]));

        const req = createMockReq({
            mesa: 'mesa_1',
            items: [{ nombre: 'Arroz con Pollo', precio: 15, cantidad: 2, categoria: 'Segundos', modalidad: 'local' }],
        });
        const res = createMockRes();

        await ctrl.crearPedido(req, res);

        expect(res.json).toHaveBeenCalledWith({ success: true });
    });
});

describe('modificarPedido', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockInsumosDB.length = 0;
        mockMesasDB.length = 0;
        mockRecetaDB = {};
    });

    test('modifica pedido existente correctamente', async () => {
        addMockInsumo(1, 'ARROZ', 50);
        mockRecetaDB['ARROZ CON POLLO|SEGUNDOS'] = [{ insumo_id: 1, cantidad_requerida: 1 }];
        addMockMesa('mesa_1', 'ocupada', JSON.stringify([
            { nombre: 'ARROZ CON POLLO', precio: 15, cantidad: 2, modalidad: 'local', categoria: 'SEGUNDOS', impreso: true, taper: [] },
        ]), 30);

        const req = createMockReq(
            { pedido: [{ nombre: 'ARROZ CON POLLO', precio: 15, cantidad: 1, modalidad: 'local', categoria: 'SEGUNDOS', impreso: true, taper: [] }] },
            { id: 'mesa_1' }
        );
        const res = createMockRes();

        await ctrl.modificarPedido(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
    });

    test('rechaza modificación si falta stock', async () => {
        addMockInsumo(1, 'ARROZ', 2);
        mockRecetaDB['ARROZ CON POLLO|SEGUNDOS'] = [{ insumo_id: 1, cantidad_requerida: 1 }];
        addMockMesa('mesa_1', 'ocupada', JSON.stringify([
            { nombre: 'ARROZ CON POLLO', precio: 15, cantidad: 1, modalidad: 'local', categoria: 'SEGUNDOS', impreso: true, taper: [] },
        ]));

        // El pedido actual consume 1 unidad de ARROZ. El nuevo consume 10.
        // Diferencia = 9. Stock actual = 2. Faltan 9-2 = 7.
        const req = createMockReq(
            { pedido: [{ nombre: 'ARROZ CON POLLO', precio: 15, cantidad: 10, modalidad: 'local', categoria: 'SEGUNDOS', impreso: true, taper: [] }] },
            { id: 'mesa_1' }
        );
        const res = createMockRes();

        await ctrl.modificarPedido(req, res);

        expect(res.error).toHaveBeenCalledWith(
            expect.stringContaining('Stock agotado'),
            400
        );
    });

    test('elimina mesa temporal si pedido queda vacío', async () => {
        addMockMesa('DEL-001', 'ocupada', JSON.stringify([
            { nombre: 'ARROZ CON POLLO', precio: 15, cantidad: 1, modalidad: 'local', categoria: 'SEGUNDOS', impreso: true, taper: [] },
        ]));

        const req = createMockReq(
            { pedido: [] },
            { id: 'DEL-001' }
        );
        const res = createMockRes();

        await ctrl.modificarPedido(req, res);

        // Debe eliminar la mesa temporal (DEL-001 → DELETE FROM mesas_activas)
        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM mesas_activas')
        );
    });

    test('maneja error interno', async () => {
        const req = createMockReq({}, { id: 'mesa_1' });
        const res = createMockRes();

        await ctrl.modificarPedido(req, res);

        expect(res.error).toHaveBeenCalled();
    });
});

describe('moverMesa', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMesasDB.length = 0;
    });

    test('mueve pedido de una mesa a otra libre', async () => {
        addMockMesa('mesa_1', 'ocupada', JSON.stringify([
            { nombre: 'ARROZ CON POLLO', cantidad: 2, modalidad: 'local' },
        ]), 30, 'Nota test');

        const req = createMockReq({ origen: 'mesa_1', destino: 'mesa_2' });
        const res = createMockRes();

        await ctrl.moverMesa(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
    });

    test('retorna error si origen no existe', async () => {
        const req = createMockReq({ origen: 'mesa_999', destino: 'mesa_2' });
        const res = createMockRes();

        await ctrl.moverMesa(req, res);

        expect(res.error).toHaveBeenCalledWith('Origen no existe', 404);
    });

    test('fusión con cuenta abierta (CTA-)', async () => {
        addMockMesa('mesa_1', 'ocupada', JSON.stringify([
            { nombre: 'ARROZ CON POLLO', cantidad: 1, modalidad: 'local' },
        ]), 15, 'Nota 1');
        addMockMesa('CTA-001', 'ocupada', JSON.stringify([
            { nombre: 'CEVICHE', cantidad: 1, modalidad: 'local' },
        ]), 8, 'Nota 2');

        const req = createMockReq({ origen: 'mesa_1', destino: 'CTA-001' });
        const res = createMockRes();

        await ctrl.moverMesa(req, res);

        // Debe fusionar los pedidos y eliminar el origen (mesa física se limpia)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
    });

    test('rechaza mover a mesa física ocupada', async () => {
        addMockMesa('mesa_1', 'ocupada', JSON.stringify([{ nombre: 'A', cantidad: 1 }]), 10);
        addMockMesa('mesa_2', 'ocupada', JSON.stringify([{ nombre: 'B', cantidad: 1 }]), 10);

        const req = createMockReq({ origen: 'mesa_1', destino: 'mesa_2' });
        const res = createMockRes();

        await ctrl.moverMesa(req, res);

        expect(res.error).toHaveBeenCalledWith(
            'La mesa de destino física ya está ocupada',
            400
        );
    });

    test('elimina origen DEL- después de mover', async () => {
        addMockMesa('DEL-001', 'ocupada', JSON.stringify([{ nombre: 'A', cantidad: 1 }]), 10);

        const req = createMockReq({ origen: 'DEL-001', destino: 'mesa_2' });
        const res = createMockRes();

        await ctrl.moverMesa(req, res);

        // Origen DEL- debe eliminarse con DELETE
        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM mesas_activas')
        );
    });
});

describe('cobrarMesa', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockInsumosDB.length = 0;
        mockMesasDB.length = 0;
        delete process.env.APISPERU_TOKEN;
    });

    test('cobra mesa exitosamente sin SUNAT', async () => {
        addMockMesa('mesa_1', 'ocupada', JSON.stringify([
            { nombre: 'ARROZ CON POLLO', precio: 15, cantidad: 1, modalidad: 'local', categoria: 'SEGUNDOS' },
        ]));

        const req = createMockReq({
            mesaId: 'mesa_1',
            mesaNum: '1',
            metodosPago: { efectivo: 15, enviado_sunat: false },
            totalCobrado: 15,
            items: [{ nombre: 'Arroz con Pollo', precio: 15, cantidad: 1, categoria: 'Segundos', modalidad: 'local' }],
        });
        const res = createMockRes();

        await ctrl.cobrarMesa(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
    });

    test('genera boleta SUNAT si enviado_sunat es true', async () => {
        process.env.APISPERU_TOKEN = 'test-token';
        addMockMesa('mesa_2', 'ocupada', JSON.stringify([]));

        const req = createMockReq({
            mesaId: 'mesa_2',
            mesaNum: '2',
            metodosPago: { efectivo: 50, enviado_sunat: true },
            totalCobrado: 50,
            items: [{ nombre: 'Arroz con Pollo', precio: 15, cantidad: 1, categoria: 'Segundos', modalidad: 'local', impreso: true }],
            clienteFacturacion: { documento: '12345678', nombre: 'Juan Perez', direccion: 'Av. Lima 123' },
        });
        const res = createMockRes();

        await ctrl.cobrarMesa(req, res);

        // Debe devolver numBoleta
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                numBoleta: expect.stringMatching(/^B001-/),
            })
        );
    });

    test('guarda como pendiente SUNAT si no hay token', async () => {
        addMockMesa('mesa_1', 'ocupada', JSON.stringify([]));

        const req = createMockReq({
            mesaId: 'mesa_1',
            mesaNum: '1',
            metodosPago: { efectivo: 30, enviado_sunat: true },
            totalCobrado: 30,
            items: [{ nombre: 'Ceviche', precio: 8, cantidad: 1, categoria: 'Entradas', modalidad: 'local' }],
        });
        const res = createMockRes();

        await ctrl.cobrarMesa(req, res);

        // Sin token, debe guardar en sunat_pendientes
        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO sunat_pendientes')
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
    });

    test('elimina mesa DEL- después de cobrar', async () => {
        addMockMesa('DEL-001', 'ocupada', JSON.stringify([]));

        const req = createMockReq({
            mesaId: 'DEL-001',
            mesaNum: 'DEL-001',
            metodosPago: { efectivo: 25, enviado_sunat: false },
            totalCobrado: 25,
            items: [{ nombre: 'Arroz con Pollo', precio: 15, cantidad: 1, categoria: 'Segundos', modalidad: 'local' }],
        });
        const res = createMockRes();

        await ctrl.cobrarMesa(req, res);

        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM mesas_activas')
        );
    });

    test('maneja error en cobro', async () => {
        const req = createMockReq({}); // body vacío
        const res = createMockRes();

        await ctrl.cobrarMesa(req, res);

        expect(res.error).toHaveBeenCalled();
    });
});

describe('Funciones internas del POS', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockInsumosDB.length = 0;
    });

    describe('calcularUsoInventario (lógica importada vía procesarRecetasVenta)', () => {
        test('reconoce INKA COLA 296ML como consumo directo', async () => {
            addMockInsumo(1, 'INKA COLA 296ML', 50);
            addMockMesa('mesa_1');

            const req = createMockReq({
                mesa: 'mesa_1',
                items: [
                    { nombre: 'Inka Cola 296ml', precio: 3, cantidad: 2, categoria: 'Bebidas', modalidad: 'local' },
                ],
            });
            const res = createMockRes();

            await ctrl.crearPedido(req, res);

            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        test('detecta falta de stock antes de crear pedido', async () => {
            addMockInsumo(1, 'ARROZ', 0); // Sin stock
            mockRecetaDB['ARROZ CON POLLO|SEGUNDOS'] = [{ insumo_id: 1, cantidad_requerida: 1 }];

            const req = createMockReq({
                mesa: 'mesa_1',
                items: [
                    { nombre: 'Arroz con Pollo', precio: 15, cantidad: 1, categoria: 'Segundos', modalidad: 'local' },
                ],
            });
            const res = createMockRes();

            await ctrl.crearPedido(req, res);

            expect(res.error).toHaveBeenCalledWith(
                expect.stringContaining('Stock agotado'),
                400
            );
        });
    });
});
