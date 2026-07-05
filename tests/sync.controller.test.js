/**
 * Tests para controllers/sync.controller.js
 *
 * Cubre las 4 funciones del controlador de sincronización:
 * - initSync: sincronización completa (subir + bajar)
 * - setAdminMenu: actualizar menú diario
 * - setAdminCarta: actualizar carta completa
 * - setAdminEstado: actualizar configuración del restaurante
 *
 * Se mockean database.js, config/firebase.js, services/sync.service.js y store/globalState.js
 */

// ─── Mocks compartidos ──────────────────────────────────

const mockSyncService = {
    sincronizarHaciaArriba: jest.fn().mockResolvedValue(),
    sincronizarHaciaAbajo: jest.fn().mockResolvedValue(),
};

const mockDocSet = jest.fn().mockResolvedValue();
const mockFirebaseGet = jest.fn();

jest.mock('../services/sync.service', () => mockSyncService);

// Mock de Firebase que soporta todos los patrones de llamada:
//   collection().get()
//   collection().doc(id).set(data)
//   collection().doc(id).get()
//   collection().where(...).orderBy(...).get()
//   collection().orderBy(...).limit(...).get()
jest.mock('../config/firebase', () => ({
    firestore: {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                set: mockDocSet,
                get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
            })),
            get: mockFirebaseGet,
            where: jest.fn(() => ({
                orderBy: jest.fn(() => ({
                    get: mockFirebaseGet,
                })),
                get: mockFirebaseGet,
            })),
            orderBy: jest.fn(() => ({
                limit: jest.fn(() => ({ get: mockFirebaseGet })),
                get: mockFirebaseGet,
            })),
            limit: jest.fn(() => ({ get: mockFirebaseGet })),
        })),
    },
    admin: {
        firestore: {
            Timestamp: { fromDate: jest.fn((d) => ({ toDate: () => d })) },
            FieldValue: { serverTimestamp: () => new Date() },
        },
    },
}));

const mockState = {
    modoDomingoGlobal: false,
    estadoRestauranteGlobal: { apertura: 12, cierre: 22, cierreForzado: '' },
    rawMenuDiario: { entradas: [], segundos: [] },
    rawCartaCompleta: {
        categorias: [{
            nombre: 'Entradas',
            items: [{ nombre: 'Ceviche', receta: [{ insumo_id: 1, cantidad_requerida: 0.5 }] }],
        }],
    },
};
jest.mock('../store/globalState', () => mockState);

// ─── Variables de estado de la DB mock ──────────────────

let mockDbCountResults = {};

const mockDb = {
    prepare: jest.fn((sql) => {
        if (sql.includes('SELECT COUNT(*) as c FROM ventas WHERE sincronizado')) {
            return { get: jest.fn(() => ({ c: mockDbCountResults.ventasPendientes || 0 })) };
        }
        if (sql.includes('SELECT COUNT(*) as c FROM ventas')) {
            return { get: jest.fn(() => ({ c: mockDbCountResults.totalVentas || 0 })) };
        }
        if (sql.includes('SELECT COUNT(*) as c FROM gastos WHERE sincronizado')) {
            return { get: jest.fn(() => ({ c: mockDbCountResults.gastosPendientes || 0 })) };
        }
        if (sql.includes('SELECT COUNT(*) as c FROM gastos')) {
            return { get: jest.fn(() => ({ c: mockDbCountResults.totalGastos || 0 })) };
        }
        if (sql.includes('SELECT COUNT(*) as c FROM mesas_activas')) {
            return { get: jest.fn(() => ({ c: mockDbCountResults.totalMesas || 0 })) };
        }
        if (sql.includes("SELECT valor FROM configuracion WHERE clave = 'ultima_sync_at'")) {
            return { get: jest.fn(() => mockDbCountResults.ultimaSync ? { valor: mockDbCountResults.ultimaSync } : null) };
        }
        if (sql.includes('SELECT id FROM ventas WHERE firebase_id = ?')) {
            return { get: jest.fn(() => null) };
        }
        if (sql.includes('SELECT id FROM gastos WHERE firebase_id = ?')) {
            return { get: jest.fn(() => null) };
        }
        if (sql.includes('INSERT INTO ventas')) {
            return { run: jest.fn() };
        }
        if (sql.includes('INSERT INTO gastos')) {
            return { run: jest.fn() };
        }
        if (sql.includes('INSERT OR IGNORE INTO mesas_activas')) {
            return { run: jest.fn() };
        }
        if (sql.includes('INSERT OR REPLACE INTO configuracion')) {
            return { run: jest.fn() };
        }
        return { run: jest.fn(), all: jest.fn(() => []), get: jest.fn(() => null) };
    }),
};

jest.mock('../database', () => mockDb);

const ctrl = require('../controllers/sync.controller');

// ─── Helpers ─────────────────────────────────────────────

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

function createMockReq(body = {}, ioMock = null) {
    return {
        body,
        app: {
            get: jest.fn(() => ioMock || { emit: jest.fn() }),
        },
    };
}

// ─── Tests ───────────────────────────────────────────────

describe('initSync', () => {
    let mockReq, mockRes;
    let mockIo;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDbCountResults = {
            ventasPendientes: 0,
            gastosPendientes: 0,
            totalVentas: 0,
            totalGastos: 0,
            totalMesas: 0,
            ultimaSync: null,
        };
        mockIo = { emit: jest.fn() };
        mockRes = createMockRes();
        mockSyncService.sincronizarHaciaArriba.mockResolvedValue();
        mockSyncService.sincronizarHaciaAbajo.mockResolvedValue();
        mockFirebaseGet.mockResolvedValue({ forEach: jest.fn(), empty: true });
    });

    test('ejecuta sync completo exitosamente', async () => {
        mockReq = createMockReq({}, mockIo);

        await ctrl.initSync(mockReq, mockRes);

        expect(mockSyncService.sincronizarHaciaArriba).toHaveBeenCalled();
        expect(mockSyncService.sincronizarHaciaAbajo).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, message: 'Sync OK' })
        );
    });

    test('emite evento actualizar_mesas via socket', async () => {
        mockReq = createMockReq({}, mockIo);

        await ctrl.initSync(mockReq, mockRes);

        expect(mockIo.emit).toHaveBeenCalledWith('actualizar_mesas');
    });

    test('maneja error cuando hay ventas pendientes por subir', async () => {
        mockDbCountResults.ventasPendientes = 3;
        mockReq = createMockReq({}, mockIo);

        await ctrl.initSync(mockReq, mockRes);

        expect(mockRes.error).toHaveBeenCalledWith('No se pudo respaldar la info local');
    });

    test('maneja error cuando hay gastos pendientes por subir', async () => {
        mockDbCountResults.gastosPendientes = 2;
        mockReq = createMockReq({}, mockIo);

        await ctrl.initSync(mockReq, mockRes);

        expect(mockRes.error).toHaveBeenCalledWith('No se pudo respaldar la info local');
    });

    test('guarda timestamp de sincronización', async () => {
        mockReq = createMockReq({}, mockIo);

        await ctrl.initSync(mockReq, mockRes);

        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('INSERT OR REPLACE INTO configuracion')
        );
    });

    test('incluye modoDomingo y estadoRestaurante en respuesta', async () => {
        mockReq = createMockReq({}, mockIo);

        await ctrl.initSync(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                modoDomingo: false,
                estadoRestaurante: expect.objectContaining({ apertura: 12 }),
            })
        );
    });

    test('retorna error si falla el proceso', async () => {
        mockSyncService.sincronizarHaciaArriba.mockRejectedValue(new Error('Firebase error'));
        mockReq = createMockReq({}, mockIo);

        await ctrl.initSync(mockReq, mockRes);

        expect(mockRes.error).toHaveBeenCalledWith('Error en Mega-Sync');
    });

    test('carga mesas desde Firebase si no hay mesas locales', async () => {
        // Simular que hay mesas en Firebase
        mockFirebaseGet.mockResolvedValue({
            forEach: jest.fn((cb) => {
                cb({ id: 'mesa_1', data: () => ({ estado: 'libre', pedido_actual: [], total_consumo: 0, nota_general: '' }) });
                cb({ id: 'mesa_2', data: () => ({ estado: 'ocupada', pedido_actual: [{ nombre: 'Arroz', cantidad: 1 }], total_consumo: 15, nota_general: 'Nota' }) });
            }),
            empty: false,
        });

        mockReq = createMockReq({}, mockIo);
        await ctrl.initSync(mockReq, mockRes);

        expect(mockFirebaseGet).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
    });
});

describe('setAdminMenu', () => {
    let mockReq, mockRes;
    let mockIo;

    beforeEach(() => {
        jest.clearAllMocks();
        mockIo = { emit: jest.fn() };
        mockRes = createMockRes();
        mockSyncService.sincronizarHaciaAbajo.mockResolvedValue();
        mockDocSet.mockResolvedValue();
    });

    test('guarda menú en Firebase y sincroniza', async () => {
        mockReq = createMockReq({
            entradas: [{ nombre: 'Ceviche', precio: 8 }],
            segundos: [],
        }, mockIo);

        await ctrl.setAdminMenu(mockReq, mockRes);

        expect(mockDocSet).toHaveBeenCalledWith(mockReq.body);
        expect(mockSyncService.sincronizarHaciaAbajo).toHaveBeenCalledWith(
            expect.objectContaining({ menuDiario: mockReq.body })
        );
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('emite evento actualizar_mesas', async () => {
        mockReq = createMockReq({}, mockIo);

        await ctrl.setAdminMenu(mockReq, mockRes);

        expect(mockIo.emit).toHaveBeenCalledWith('actualizar_mesas');
    });

    test('maneja error de Firebase', async () => {
        mockDocSet.mockRejectedValueOnce(new Error('Error de conexión'));
        mockReq = createMockReq({}, mockIo);

        await ctrl.setAdminMenu(mockReq, mockRes);

        expect(mockRes.error).toHaveBeenCalledWith('Error de conexión');
    });
});

describe('setAdminCarta', () => {
    let mockReq, mockRes;
    let mockIo;

    beforeEach(() => {
        jest.clearAllMocks();
        mockIo = { emit: jest.fn() };
        mockRes = createMockRes();
        mockSyncService.sincronizarHaciaAbajo.mockResolvedValue();
        mockDocSet.mockResolvedValue();
        mockState.rawCartaCompleta = {
            categorias: [{
                nombre: 'Entradas',
                items: [{ nombre: 'Ceviche', receta: [{ insumo_id: 1, cantidad_requerida: 0.5 }] }],
            }],
        };
    });

    test('guarda carta en Firebase y preserva recetas existentes', async () => {
        const newCarta = {
            categorias: [{
                nombre: 'Entradas',
                items: [{ nombre: 'Ceviche', precio: 8 }],
            }],
        };

        mockReq = createMockReq(newCarta, mockIo);

        await ctrl.setAdminCarta(mockReq, mockRes);

        // Debe preservar la receta existente del Ceviche
        const calledData = mockDocSet.mock.calls[0][0];
        expect(calledData.categorias[0].items[0].receta).toBeDefined();
        expect(calledData.categorias[0].items[0].receta[0].insumo_id).toBe(1);
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('guarda carta sin recetas previas', async () => {
        mockState.rawCartaCompleta = { categorias: [] };
        const newCarta = {
            categorias: [{
                nombre: 'BEBIDAS',
                items: [{ nombre: 'Inka Cola', precio: 3 }],
            }],
        };

        mockReq = createMockReq(newCarta, mockIo);

        await ctrl.setAdminCarta(mockReq, mockRes);

        expect(mockDocSet).toHaveBeenCalledWith(newCarta);
        expect(mockSyncService.sincronizarHaciaAbajo).toHaveBeenCalledWith(
            expect.objectContaining({ cartaCompleta: newCarta })
        );
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('emite actualizar_mesas', async () => {
        mockReq = createMockReq({ categorias: [] }, mockIo);

        await ctrl.setAdminCarta(mockReq, mockRes);

        expect(mockIo.emit).toHaveBeenCalledWith('actualizar_mesas');
    });

    test('maneja error de Firebase', async () => {
        mockDocSet.mockRejectedValueOnce(new Error('Error Firebase'));
        mockReq = createMockReq({ categorias: [] }, mockIo);

        await ctrl.setAdminCarta(mockReq, mockRes);

        expect(mockRes.error).toHaveBeenCalledWith('Error Firebase');
    });
});

describe('setAdminEstado', () => {
    let mockReq, mockRes;
    let mockIo;

    beforeEach(() => {
        jest.clearAllMocks();
        mockIo = { emit: jest.fn() };
        mockRes = createMockRes();
        mockSyncService.sincronizarHaciaAbajo.mockResolvedValue();
        mockDocSet.mockResolvedValue();
        mockState.estadoRestauranteGlobal = { apertura: 12, cierre: 22, cierreForzado: '' };
    });

    test('guarda configuración en Firebase con merge', async () => {
        const configData = { apertura: 10, cierre: 23 };
        mockReq = createMockReq(configData, mockIo);

        await ctrl.setAdminEstado(mockReq, mockRes);

        expect(mockDocSet).toHaveBeenCalledWith(configData, { merge: true });
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('sincroniza hacia abajo después de guardar', async () => {
        mockReq = createMockReq({ apertura: 8 }, mockIo);

        await ctrl.setAdminEstado(mockReq, mockRes);

        expect(mockSyncService.sincronizarHaciaAbajo).toHaveBeenCalledWith(
            expect.objectContaining({ configuracion: { apertura: 8 } })
        );
    });

    test('emite cambio_estado_restaurante', async () => {
        mockReq = createMockReq({ apertura: 9 }, mockIo);

        await ctrl.setAdminEstado(mockReq, mockRes);

        expect(mockIo.emit).toHaveBeenCalledWith(
            'cambio_estado_restaurante',
            mockState.estadoRestauranteGlobal
        );
    });

    test('maneja error de Firebase', async () => {
        mockDocSet.mockRejectedValueOnce(new Error('Firebase error'));
        mockReq = createMockReq({}, mockIo);

        await ctrl.setAdminEstado(mockReq, mockRes);

        expect(mockRes.error).toHaveBeenCalledWith('Firebase error');
    });

    test('no emite socket si io no está disponible', async () => {
        mockReq = createMockReq({ apertura: 10 }, null); // sin io

        await ctrl.setAdminEstado(mockReq, mockRes);

        // No debe lanzar excepción por io ser null
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
});
