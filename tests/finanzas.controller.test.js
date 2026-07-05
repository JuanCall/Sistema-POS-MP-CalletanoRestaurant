/**
 * Tests para controllers/finanzas.controller.js
 *
 * Se mockea database.js y config/firebase.js para aislar
 * la lógica de los controladores de Express.
 */

const mockVentasDB = [];
const mockGastosDB = [];

const mockDb = {
    prepare: jest.fn((sql) => {
        if (sql.includes('SELECT * FROM ventas WHERE date')) {
            return {
                all: jest.fn(() => [...mockVentasDB]),
            };
        }
        if (sql.includes('SELECT * FROM gastos WHERE date')) {
            return {
                all: jest.fn(() => [...mockGastosDB]),
            };
        }
        if (sql.includes('SELECT * FROM ventas WHERE id')) {
            return {
                get: jest.fn((id) => mockVentasDB.find(v => v.id === Number(id)) || null),
            };
        }
        if (sql.includes('SELECT * FROM gastos WHERE id')) {
            return {
                get: jest.fn((id) => mockGastosDB.find(g => g.id === Number(id)) || null),
            };
        }
        if (sql.includes('DELETE FROM ventas')) {
            return { run: jest.fn() };
        }
        if (sql.includes('DELETE FROM gastos')) {
            return { run: jest.fn() };
        }
        if (sql.includes('INSERT INTO gastos')) {
            return { run: jest.fn(() => ({ lastInsertRowid: 1 })) };
        }
        if (sql.includes('UPDATE gastos SET firebase_id')) {
            return { run: jest.fn() };
        }
        return { run: jest.fn(), all: jest.fn(() => []), get: jest.fn(() => null) };
    }),
};

const mockDocDelete = jest.fn().mockResolvedValue();
const mockDocSet = jest.fn().mockResolvedValue();
const mockFirestoreDoc = jest.fn(() => ({
    delete: mockDocDelete,
    set: mockDocSet,
}));
const mockFirestoreCollection = jest.fn(() => ({ doc: mockFirestoreDoc }));
const mockFirestoreTimestamp = { fromDate: jest.fn((d) => ({ toDate: () => d })) };

jest.mock('../database', () => mockDb);
jest.mock('../config/firebase', () => ({
    firestore: { collection: mockFirestoreCollection },
    admin: { firestore: { Timestamp: mockFirestoreTimestamp, FieldValue: { serverTimestamp: () => new Date() } } },
}));
jest.mock('../store/globalState');

const ctrl = require('../controllers/finanzas.controller');

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

describe('finanzas.controller - getVentas', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        mockVentasDB.length = 0;
    });

    test('retorna ventas de la fecha actual si no se especifica fecha', () => {
        mockReq = { query: {} };
        ctrl.getVentas(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalled();
        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('SELECT * FROM ventas')
        );
    });

    test('retorna ventas de una fecha específica', () => {
        mockReq = { query: { fecha: '2026-06-15' } };
        ctrl.getVentas(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalled();
    });

    test('retorna array vacío si no hay ventas ese día', () => {
        mockReq = { query: { fecha: '2026-01-01' } };
        ctrl.getVentas(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    test('retorna ventas existentes', () => {
        mockVentasDB.push({ id: 1, mesa: '5', total_cobrado: 50, fecha: '2026-06-15 12:00:00', metodos_pago: '{}', items: '[]', sincronizado: 1 });
        mockReq = { query: { fecha: '2026-06-15' } };
        ctrl.getVentas(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ id: 1, total_cobrado: 50 })])
        );
    });
});

describe('finanzas.controller - anularVenta', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        mockVentasDB.length = 0;
        jest.clearAllMocks();
    });

    test('anula venta existente y la elimina de Firebase', async () => {
        mockVentasDB.push({ id: 1, firebase_id: 'TKT-000001-20260615', fecha: '2026-06-15', mesa: '5', total_cobrado: 50, metodos_pago: '{}', items: '[]' });
        mockReq = { params: { id: '1' } };

        await ctrl.anularVenta(mockReq, mockRes);

        expect(mockDocDelete).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Venta anulada' });
    });

    test('anula venta sin firebase_id (genera ID interno)', async () => {
        mockVentasDB.push({ id: 15, firebase_id: null, fecha: '2026-05-15 10:00:00', mesa: '3', total_cobrado: 30, metodos_pago: '{}', items: '[]' });
        mockReq = { params: { id: '15' } };

        await ctrl.anularVenta(mockReq, mockRes);

        // Debe generar el firebase_id y luego borrar de Firebase
        expect(mockFirestoreCollection).toHaveBeenCalledWith('ventas_historicas');
        expect(mockDocDelete).toHaveBeenCalled();
    });

    test('maneja error cuando falla la anulación', async () => {
        mockReq = { params: { id: '999' } };
        mockDb.prepare.mockImplementationOnce(() => {
            throw new Error('DB error');
        });

        await ctrl.anularVenta(mockReq, mockRes);

        expect(mockRes.error).toHaveBeenCalledWith('Error al anular venta');
    });
});

describe('finanzas.controller - getGastos', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        mockGastosDB.length = 0;
    });

    test('retorna gastos del día actual', () => {
        mockReq = { query: {} };
        ctrl.getGastos(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalled();
    });

    test('retorna gastos de una fecha específica', () => {
        mockReq = { query: { fecha: '2026-06-15' } };
        ctrl.getGastos(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalled();
    });
});

describe('finanzas.controller - crearGasto', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        jest.clearAllMocks();
    });

    test('crea gasto con datos mínimos', async () => {
        mockReq = { body: { descripcion: 'Pan', monto: 15 } };

        await ctrl.crearGasto(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({ id: 1 })
        );
    });

    test('crea gasto con todos los campos', async () => {
        mockReq = {
            body: {
                descripcion: 'Compra de verduras',
                monto: 120,
                categoria: 'Insumos',
                con_comprobante: true,
                fecha: '2026-06-15 10:00:00',
            },
        };

        await ctrl.crearGasto(mockReq, mockRes);

        expect(mockFirestoreCollection).toHaveBeenCalledWith('gastos');
        expect(mockDocSet).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalled();
    });

    test('crea gasto sin fecha (usa fecha actual)', async () => {
        mockReq = { body: { descripcion: 'Pan', monto: 15 } };

        await ctrl.crearGasto(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalled();
    });

    test('maneja error en creación de gasto', async () => {
        mockReq = { body: { descripcion: 'Pan', monto: 'invalido' } };
        mockDb.prepare.mockImplementationOnce(() => {
            throw new Error('Error en DB');
        });

        await ctrl.crearGasto(mockReq, mockRes);

        expect(mockRes.error).toHaveBeenCalled();
    });
});

describe('finanzas.controller - anularGasto', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        mockGastosDB.length = 0;
        jest.clearAllMocks();
    });

    test('anula gasto existente y lo elimina de Firebase', async () => {
        mockGastosDB.push({ id: 1, firebase_id: 'GAS-00001-20260615', fecha: '2026-06-15', descripcion: 'Pan', monto: 15, categoria: 'Insumos', con_comprobante: 0 });
        mockReq = { params: { id: '1' } };

        await ctrl.anularGasto(mockReq, mockRes);

        expect(mockDocDelete).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('anula gasto sin firebase_id', async () => {
        mockGastosDB.push({ id: 3, firebase_id: null, fecha: '2026-06-15 08:00:00', descripcion: 'Pan', monto: 15 });
        mockReq = { params: { id: '3' } };

        await ctrl.anularGasto(mockReq, mockRes);

        expect(mockFirestoreCollection).toHaveBeenCalledWith('gastos');
        expect(mockDocDelete).toHaveBeenCalled();
    });
});
