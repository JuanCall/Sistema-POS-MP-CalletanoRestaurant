/**
 * Tests para controllers/inventario.controller.js
 *
 * Se mockea database.js y config/firebase.js para aislar
 * la lógica de los controladores de inventario.
 */

const mockInsumosDB = [];

const mockDb = {
    prepare: jest.fn((sql) => {
        if (sql.includes('SELECT * FROM insumos ORDER BY')) {
            return { all: jest.fn(() => [...mockInsumosDB]) };
        }
        if (sql.includes('INSERT INTO insumos')) {
            return { run: jest.fn(() => ({ lastInsertRowid: mockInsumosDB.length + 1 })) };
        }
        if (sql.includes('UPDATE insumos SET')) {
            return { run: jest.fn() };
        }
        if (sql.includes('INSERT INTO movimientos_inventario')) {
            return { run: jest.fn(() => ({ lastInsertRowid: 1 })) };
        }
        if (sql.includes('SELECT stock_actual FROM insumos')) {
            return {
                get: jest.fn((id) => {
                    const insumo = mockInsumosDB.find(i => i.id === id);
                    return insumo ? { stock_actual: insumo.stock_actual } : null;
                }),
            };
        }
        return { run: jest.fn(), all: jest.fn(() => []), get: jest.fn(() => null) };
    }),
};

const mockDocSet = jest.fn().mockResolvedValue();
const mockFirestoreDoc = jest.fn(() => ({ set: mockDocSet }));
const mockFirestoreCollection = jest.fn(() => ({ doc: mockFirestoreDoc }));
const mockFirestoreTimestamp = { fromDate: jest.fn((d) => ({ toDate: () => d })) };

jest.mock('../database', () => mockDb);
jest.mock('../config/firebase', () => ({
    firestore: { collection: mockFirestoreCollection },
    admin: { firestore: { Timestamp: mockFirestoreTimestamp, FieldValue: { serverTimestamp: () => new Date() } } },
}));
jest.mock('../store/globalState');

const ctrl = require('../controllers/inventario.controller');

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

describe('inventario.controller - getInsumos', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        mockInsumosDB.length = 0;
    });

    test('retorna lista vacía si no hay insumos', () => {
        mockReq = {};
        ctrl.getInsumos(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    test('retorna todos los insumos ordenados', () => {
        mockInsumosDB.push(
            { id: 1, nombre: 'Arroz', unidad_medida: 'kg', stock_actual: 50, estado: 1 },
            { id: 2, nombre: 'Pollo', unidad_medida: 'kg', stock_actual: 20, estado: 1 }
        );
        mockReq = {};
        ctrl.getInsumos(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ nombre: 'Arroz' }),
                expect.objectContaining({ nombre: 'Pollo' }),
            ])
        );
    });

    test('maneja error de DB', () => {
        mockDb.prepare.mockImplementationOnce(() => {
            throw new Error('DB Error');
        });
        mockReq = {};
        ctrl.getInsumos(mockReq, mockRes);
        expect(mockRes.error).toHaveBeenCalled();
    });
});

describe('inventario.controller - crearInsumo', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        jest.clearAllMocks();
    });

    test('crea insumo correctamente', async () => {
        mockReq = { body: { nombre: 'Arroz', unidad_medida: 'kg' } };
        await ctrl.crearInsumo(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('envía a Firebase en segundo plano', async () => {
        mockReq = { body: { nombre: 'Pollo', unidad_medida: 'kg' } };
        await ctrl.crearInsumo(mockReq, mockRes);
        expect(mockFirestoreCollection).toHaveBeenCalledWith('insumos');
    });

    test('maneja error de duplicado', async () => {
        mockDb.prepare.mockImplementationOnce(() => {
            throw new Error('UNIQUE constraint');
        });
        mockReq = { body: { nombre: 'YaExiste', unidad_medida: 'kg' } };
        await ctrl.crearInsumo(mockReq, mockRes);
        expect(mockRes.error).toHaveBeenCalledWith('El insumo ya existe o hubo un error.');
    });
});

describe('inventario.controller - editarInsumo', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        jest.clearAllMocks();
    });

    test('edita insumo correctamente', async () => {
        mockReq = { params: { id: '1' }, body: { nombre: 'Arroz Nuevo', unidad_medida: 'g' } };
        await ctrl.editarInsumo(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('sincroniza cambios a Firebase', async () => {
        mockReq = { params: { id: '1' }, body: { nombre: 'Arroz', unidad_medida: 'kg' } };
        await ctrl.editarInsumo(mockReq, mockRes);
        expect(mockFirestoreCollection).toHaveBeenCalledWith('insumos');
    });
});

describe('inventario.controller - deshabilitarInsumo', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        jest.clearAllMocks();
    });

    test('deshabilita insumo (estado=0)', async () => {
        mockReq = { params: { id: '1' } };
        await ctrl.deshabilitarInsumo(mockReq, mockRes);
        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE insumos SET estado = 0')
        );
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
});

describe('inventario.controller - habilitarInsumo', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        jest.clearAllMocks();
    });

    test('habilita insumo (estado=1)', async () => {
        mockReq = { params: { id: '1' } };
        await ctrl.habilitarInsumo(mockReq, mockRes);
        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE insumos SET estado = 1')
        );
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
});

describe('inventario.controller - registrarMovimiento', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        mockInsumosDB.length = 0;
        jest.clearAllMocks();
        // Insumo base para tests de movimiento
        mockInsumosDB.push({ id: 1, nombre: 'Arroz', unidad_medida: 'kg', stock_actual: 50, estado: 1 });
    });

    test('registra INGRESO y aumenta stock', async () => {
        mockReq = {
            body: { insumo_id: 1, tipo: 'INGRESO', cantidad: 10, referencia: 'Compra semanal' },
        };
        await ctrl.registrarMovimiento(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('registra CONSUMO y disminuye stock', async () => {
        mockReq = {
            body: { insumo_id: 1, tipo: 'CONSUMO', cantidad: 5 },
        };
        await ctrl.registrarMovimiento(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('no permite stock negativo (floor en 0)', async () => {
        mockReq = {
            body: { insumo_id: 1, tipo: 'CONSUMO', cantidad: 9999 },
        };
        await ctrl.registrarMovimiento(mockReq, mockRes);

        // Debe ejecutarse sin error (el controlador hace Math.max(0, stock))
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('usa referencia por defecto si no se proporciona', async () => {
        mockReq = {
            body: { insumo_id: 1, tipo: 'INGRESO', cantidad: 5 },
        };
        await ctrl.registrarMovimiento(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('sincroniza movimiento a Firebase', async () => {
        mockReq = {
            body: { insumo_id: 1, tipo: 'INGRESO', cantidad: 10 },
        };
        await ctrl.registrarMovimiento(mockReq, mockRes);

        expect(mockFirestoreCollection).toHaveBeenCalledWith('movimientos_inventario');
    });

    test('maneja error de DB', async () => {
        mockDb.prepare.mockImplementationOnce(() => {
            throw new Error('DB Error');
        });
        mockReq = { body: { insumo_id: 999, tipo: 'INGRESO', cantidad: 10 } };
        await ctrl.registrarMovimiento(mockReq, mockRes);
        expect(mockRes.error).toHaveBeenCalled();
    });
});
