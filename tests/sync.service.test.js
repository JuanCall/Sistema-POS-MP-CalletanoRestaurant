/**
 * Tests para services/sync.service.js
 *
 * sincronizarHaciaArriba(): sube datos locales pendientes a Firebase
 * sincronizarHaciaAbajo(): descarga datos de Firebase a la DB local
 *
 * Se mockea firestore y database para aislar la lógica de sincronización.
 */

// ─── Mocks ────────────────────────────────────────────────

const mockVentasPendientes = [];
const mockGastosPendientes = [];
const mockInsumosPendientes = [];

const mockDb = {
    prepare: jest.fn((sql) => {
        if (sql.includes('SELECT * FROM ventas WHERE sincronizado = 0')) {
            return { all: jest.fn(() => [...mockVentasPendientes]) };
        }
        if (sql.includes('SELECT * FROM gastos WHERE sincronizado = 0')) {
            return { all: jest.fn(() => [...mockGastosPendientes]) };
        }
        if (sql.includes('SELECT * FROM insumos WHERE sincronizado = 0')) {
            return { all: jest.fn(() => [...mockInsumosPendientes]) };
        }
        if (sql.includes('UPDATE ventas SET')) {
            return { run: jest.fn() };
        }
        if (sql.includes('UPDATE gastos SET')) {
            return { run: jest.fn() };
        }
        if (sql.includes('UPDATE insumos SET')) {
            return { run: jest.fn() };
        }
        if (sql.includes('DELETE FROM movimientos_inventario')) {
            return { run: jest.fn() };
        }
        if (sql.includes('DELETE FROM insumos')) {
            return { run: jest.fn() };
        }
        if (sql.includes('DELETE FROM platos')) {
            return { run: jest.fn() };
        }
        if (sql.includes('DELETE FROM categorias')) {
            return { run: jest.fn() };
        }
        if (sql.includes('DELETE FROM')) {
            return { run: jest.fn() };
        }
        // INSERT específicos deben ir ANTES del genérico 'INSERT INTO'
        if (sql.includes('INSERT INTO insumos (id, nombre, unidad_medida, stock_actual, estado, sincronizado)')) {
            return { run: jest.fn() };
        }
        if (sql.includes('INSERT INTO categorias')) {
            return { run: mockInsertCatRun };
        }
        if (sql.includes('INSERT INTO platos')) {
            return { run: mockInsertPlatoRun };
        }
        if (sql.includes('INSERT INTO')) {
            return { run: jest.fn() };
        }
        if (sql.includes("DELETE FROM sqlite_sequence")) {
            return { run: jest.fn() };
        }
        return { run: jest.fn(), all: jest.fn(() => []), get: jest.fn(() => null) };
    }),
};

// Mock de Firebase: soporta collection().doc().set(), collection().doc().get() y collection().get()
const mockDocSet = jest.fn().mockResolvedValue();
const mockDocGet = jest.fn();
const mockCollectionGet = jest.fn();
const mockFirestoreDoc = jest.fn(() => ({ set: mockDocSet, get: mockDocGet }));
const mockFirestoreCollection = jest.fn(() => ({
    doc: mockFirestoreDoc,
    get: mockCollectionGet,
}));
const mockFirestoreTimestamp = { fromDate: jest.fn((d) => ({ toDate: () => d })) };

// Mock compartido para rastrear insertCat.run() y insertPlato.run()
const mockInsertCatRun = jest.fn();
const mockInsertPlatoRun = jest.fn();

jest.mock('../database', () => mockDb);
jest.mock('../config/firebase', () => ({
    firestore: { collection: mockFirestoreCollection },
    admin: { firestore: { Timestamp: mockFirestoreTimestamp, FieldValue: { serverTimestamp: () => new Date() } } },
}));

// Estado global mockeado (mutable entre tests)
let mockGlobalState = { rawMenuDiario: {}, rawCartaCompleta: {} };
jest.mock('../store/globalState', () => mockGlobalState);

// ─── Importamos el módulo bajo test ───────────────────────

const { sincronizarHaciaArriba, sincronizarHaciaAbajo } = require('../services/sync.service');

// ─── Tests: sincronizarHaciaArriba ────────────────────────

describe('sincronizarHaciaArriba()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockVentasPendientes.length = 0;
        mockGastosPendientes.length = 0;
        mockInsumosPendientes.length = 0;
    });

    test('no hace nada si no hay datos pendientes', async () => {
        await sincronizarHaciaArriba();
        expect(mockFirestoreCollection).not.toHaveBeenCalled();
    });

    test('sube una venta pendiente a Firebase y la marca como sincronizada', async () => {
        mockVentasPendientes.push({
            id: 1, firebase_id: null, fecha: '2026-06-15 12:00:00', mesa: '5',
            total_cobrado: 50, metodos_pago: JSON.stringify({ efectivo: 50 }),
            items: JSON.stringify([{ nombre: 'Arroz con Pollo', cantidad: 1 }]), sincronizado: 0,
        });

        await sincronizarHaciaArriba();

        expect(mockFirestoreCollection).toHaveBeenCalledWith('ventas_historicas');
        expect(mockDocSet).toHaveBeenCalled();
        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE ventas SET sincronizado = 1')
        );
    });

    test('genera firebase_id para venta sin firebase_id', async () => {
        mockVentasPendientes.push({
            id: 15, firebase_id: null, fecha: '2026-05-15 10:30:00', mesa: '3',
            total_cobrado: 30, metodos_pago: JSON.stringify({ yape: 30 }),
            items: JSON.stringify([{ nombre: 'Ceviche', cantidad: 1 }]), sincronizado: 0,
        });

        await sincronizarHaciaArriba();

        expect(mockDb.prepare).toHaveBeenCalledWith(
            'UPDATE ventas SET firebase_id = ? WHERE id = ?'
        );
    });

    test('usa firebase_id existente si ya tiene uno', async () => {
        mockVentasPendientes.push({
            id: 5, firebase_id: 'TKT-000005-20260615', fecha: '2026-06-15 12:00:00', mesa: '2',
            total_cobrado: 25, metodos_pago: JSON.stringify({ efectivo: 25 }),
            items: JSON.stringify([{ nombre: 'Menú', cantidad: 1 }]), sincronizado: 0,
        });

        await sincronizarHaciaArriba();

        expect(mockDb.prepare).not.toHaveBeenCalledWith(
            'UPDATE ventas SET firebase_id = ? WHERE id = ?'
        );
    });

    test('sube gastos pendientes a Firebase', async () => {
        mockGastosPendientes.push({
            id: 3, firebase_id: null, fecha: '2026-06-15 08:00:00', descripcion: 'Compra de verduras',
            monto: 120, categoria: 'Insumos', con_comprobante: 1, sincronizado: 0,
        });

        await sincronizarHaciaArriba();

        expect(mockFirestoreCollection).toHaveBeenCalledWith('gastos');
        expect(mockDocSet).toHaveBeenCalled();
    });

    test('sube insumos pendientes a Firebase', async () => {
        mockInsumosPendientes.push({
            id: 1, nombre: 'Arroz', unidad_medida: 'kg', stock_actual: 50, estado: 1, sincronizado: 0,
        });

        await sincronizarHaciaArriba();

        expect(mockFirestoreCollection).toHaveBeenCalledWith('insumos');
        expect(mockDocSet).toHaveBeenCalled();
    });

    test('procesa múltiples ventas pendientes', async () => {
        mockVentasPendientes.push(
            { id: 1, firebase_id: null, fecha: '2026-06-15 12:00:00', mesa: '1', total_cobrado: 50, metodos_pago: '{}', items: '[]', sincronizado: 0 },
            { id: 2, firebase_id: null, fecha: '2026-06-15 13:00:00', mesa: '2', total_cobrado: 30, metodos_pago: '{}', items: '[]', sincronizado: 0 }
        );

        await sincronizarHaciaArriba();

        const updateCalls = mockDb.prepare.mock.calls.filter(
            ([sql]) => sql.includes('UPDATE ventas SET sincronizado')
        );
        expect(updateCalls.length).toBe(2);
    });

    test('no falla si firestore lanza error (modo offline)', async () => {
        mockVentasPendientes.push({
            id: 99, firebase_id: null, fecha: '2026-06-15 12:00:00', mesa: 'DEL-001',
            total_cobrado: 45, metodos_pago: JSON.stringify({ plin: 45 }),
            items: JSON.stringify([]), sincronizado: 0,
        });
        mockDocSet.mockRejectedValueOnce(new Error('Firebase offline'));

        await expect(sincronizarHaciaArriba()).resolves.not.toThrow();
    });

    test('mesa como string se conserva en Firebase', async () => {
        mockVentasPendientes.push({
            id: 10, firebase_id: 'TKT-000010-20260615', fecha: '2026-06-15 12:00:00', mesa: 'DEL-001',
            total_cobrado: 40, metodos_pago: JSON.stringify({ efectivo: 40 }),
            items: JSON.stringify([]), sincronizado: 0,
        });

        await sincronizarHaciaArriba();

        expect(mockDocSet).toHaveBeenCalledWith(
            expect.objectContaining({ mesa: 'DEL-001' })
        );
    });
});

describe('sincronizarHaciaArriba - manejo de fechas', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockVentasPendientes.length = 0;
    });

    test('convierte fecha string a Timestamp de Firebase', async () => {
        mockVentasPendientes.push({
            id: 1, firebase_id: null, fecha: '2026-06-15 14:30:00', mesa: '1',
            total_cobrado: 60, metodos_pago: '{}', items: '[]', sincronizado: 0,
        });

        await sincronizarHaciaArriba();

        expect(mockFirestoreTimestamp.fromDate).toHaveBeenCalledWith(expect.any(Date));
        const dateArg = mockFirestoreTimestamp.fromDate.mock.calls[0][0];
        expect(dateArg.getFullYear()).toBe(2026);
        expect(dateArg.getMonth()).toBe(5);
        expect(dateArg.getDate()).toBe(15);
    });
});

// ─── Tests: sincronizarHaciaAbajo ─────────────────────────

describe('sincronizarHaciaAbajo', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGlobalState.rawMenuDiario = {};
        mockGlobalState.rawCartaCompleta = {};
        mockGlobalState.modoDomingoGlobal = false;
        mockGlobalState.estadoRestauranteGlobal = { apertura: 12, cierre: 22, cierreForzado: '' };
    });

    test('actualiza estado global con datos precargados (sin llamar Firebase)', async () => {
        const preCargados = {
            cartaCompleta: {
                categorias: [{ nombre: 'BEBIDAS', items: [{ nombre: 'INKA COLA 296ML', precio: 3 }] }],
            },
            menuDiario: {
                entradas: [{ nombre: 'CEVICHE', precio: 8, stock: 15 }],
                segundos: [],
                modoDomingo: false,
            },
            configuracion: { apertura: 10, cierre: 23 },
        };

        // Sin datos de insumos en Firebase → empty
        mockCollectionGet.mockResolvedValue({ empty: true, forEach: jest.fn() });

        await sincronizarHaciaAbajo(preCargados);

        // Debe actualizar el estado global (mutación directa del objeto mock)
        expect(mockGlobalState.rawCartaCompleta.categorias).toBeDefined();
        expect(mockGlobalState.rawCartaCompleta.categorias[0].nombre).toBe('BEBIDAS');
        expect(mockGlobalState.modoDomingoGlobal).toBe(false);
    });

    test('limpia y recarga insumos desde Firebase', async () => {
        const docs = [
            { id: 'INS-0001', data: () => ({ nombre: 'Arroz', unidad_medida: 'kg', stock_actual: 50, estado: 1 }) },
            { id: 'INS-0002', data: () => ({ nombre: 'Pollo', unidad_medida: 'kg', stock_actual: 20, estado: 1 }) },
        ];

        mockCollectionGet.mockResolvedValue({
            empty: false,
            forEach: jest.fn((cb) => docs.forEach(cb)),
        });
        // Snapshots de contenido no existen (no se llama porque pasamos vacío)
        mockDocGet.mockResolvedValue({ exists: false });

        await sincronizarHaciaAbajo({});

        // Debe limpiar insumos y luego insertar
        expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM insumos');
        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO insumos')
        );
    });

    test('no falla si insumosSnap está vacío', async () => {
        mockCollectionGet.mockResolvedValue({ empty: true, forEach: jest.fn() });
        mockDocGet.mockResolvedValue({ exists: false });

        // No debe lanzar excepción con snapshot vacío
        await expect(sincronizarHaciaAbajo({})).resolves.not.toThrow();
    });

    test('inserta categorías y platos desde cartaCompleta', async () => {
        mockDocGet
            .mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    categorias: [{
                        nombre: 'BEBIDAS',
                        items: [
                            { nombre: 'Inka Cola 296ml', precio: 3 },
                            { nombre: 'Inka Cola 500ml', precio: 5, precio2: 8 },
                        ],
                    }],
                }),
            })
            .mockResolvedValueOnce({ exists: false })  // menuDiario
            .mockResolvedValueOnce({ exists: false }); // configuracion
        mockCollectionGet.mockResolvedValue({ empty: true, forEach: jest.fn() }); // insumos

        // Llamar sin precargados para que use Firebase
        await sincronizarHaciaAbajo();

        // Debe insertar categoría y platos
        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO categorias')
        );
        expect(mockDb.prepare).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO platos')
        );
    });

    test('inserta entradas y segundos desde menuDiario', async () => {
        let callIndex = 0;
        mockDocGet.mockImplementation(() => {
            callIndex++;
            if (callIndex === 2) {
                return Promise.resolve({
                    exists: true,
                    data: () => ({
                        entradas: [
                            { nombre: 'Ceviche', precio: 8, stock: 20 },
                            { nombre: 'Papa Rellena', precio: 5, stock: null },
                        ],
                        segundos: [
                            { nombre: 'Arroz con Pollo', precio: 15, stock: 10 },
                        ],
                        modoDomingo: false,
                    }),
                });
            }
            return Promise.resolve({ exists: false });
        });
        mockCollectionGet.mockResolvedValue({ empty: true, forEach: jest.fn() }); // insumos

        await sincronizarHaciaAbajo();

        // Debe haber dos runs de categorías: 'entradas' y 'segundos'
        expect(mockInsertCatRun).toHaveBeenCalledTimes(2);

        // Verificar que se insertaron con nombres correctos
        expect(mockInsertCatRun).toHaveBeenCalledWith(expect.anything(), 'entradas');
        expect(mockInsertCatRun).toHaveBeenCalledWith(expect.anything(), 'segundos');
    });

    test('activa modo domingo cuando menuDiario lo indica', async () => {
        mockDocGet
            .mockResolvedValueOnce({ exists: false })  // cartaCompleta
            .mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    entradas: [],
                    segundos: [{ nombre: 'Arroz con Pollo', precio: 15 }],
                    modoDomingo: true,
                }),
            })
            .mockResolvedValueOnce({ exists: false }); // configuracion
        mockCollectionGet.mockResolvedValue({ empty: true, forEach: jest.fn() });

        await sincronizarHaciaAbajo();

        expect(mockGlobalState.modoDomingoGlobal).toBe(true);
    });

    test('actualiza estadoRestauranteGlobal desde configuracion', async () => {
        mockDocGet
            .mockResolvedValueOnce({ exists: false })  // cartaCompleta
            .mockResolvedValueOnce({ exists: false })  // menuDiario
            .mockResolvedValueOnce({
                exists: true,
                data: () => ({ apertura: 8, cierre: 23 }),
            }); // configuracion
        mockCollectionGet.mockResolvedValue({ empty: true, forEach: jest.fn() }); // insumos

        await sincronizarHaciaAbajo();

        expect(mockGlobalState.estadoRestauranteGlobal).toEqual({ apertura: 8, cierre: 23 });
    });
});
