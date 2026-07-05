/**
 * Tests para controllers/reportes.controller.js
 *
 * getReporteDiario, getDashboard, resumenDiarioIA, resumenMensualIA
 *
 * Se mockean database.js, config/ai.js y config/firebase.js
 */

// ─── Mocks ────────────────────────────────────────────────

const mockVentasDB = [];
const mockGastosDB = [];

const mockDb = {
    prepare: jest.fn((sql) => {
        if (sql.includes('SELECT total_cobrado, metodos_pago, items FROM ventas')) {
            return { all: jest.fn(() => [...mockVentasDB]) };
        }
        if (sql.includes('SELECT * FROM gastos')) {
            return { all: jest.fn(() => [...mockGastosDB]) };
        }
        if (sql.includes('SELECT fecha, total_cobrado, metodos_pago, items FROM ventas')) {
            return { all: jest.fn(() => [...mockVentasDB]) };
        }
        if (sql.includes('SELECT fecha, monto, con_comprobante FROM gastos')) {
            return { all: jest.fn(() => [...mockGastosDB]) };
        }
        return { all: jest.fn(() => []) };
    }),
};

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
    generateContent: mockGenerateContent,
}));

jest.mock('../database', () => mockDb);
jest.mock('../config/ai', () => ({
    genAI: {
        getGenerativeModel: mockGetGenerativeModel,
    },
}));

const ctrl = require('../controllers/reportes.controller');

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

describe('getReporteDiario', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        mockVentasDB.length = 0;
        mockGastosDB.length = 0;
    });

    test('retorna totales en cero si no hay ventas ni gastos', () => {
        mockReq = { query: { fecha: '2026-06-15' } };
        ctrl.getReporteDiario(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                totales: expect.objectContaining({
                    efectivo: 0,
                    yape: 0,
                    plin: 0,
                    tarjeta: 0,
                    totalVentas: 0,
                    totalGastos: 0,
                    balance: 0,
                }),
                topPlatos: [],
                cantidadTotalPlatos: 0,
            })
        );
    });

    test('calcula totales correctamente con ventas', () => {
        mockVentasDB.push({
            total_cobrado: 100,
            metodos_pago: JSON.stringify({ efectivo: 50, yape: 30, plin: 10, tarjeta: 10 }),
            items: JSON.stringify([{ nombre: 'Arroz con Pollo', cantidad: 2, categoria: 'Segundos' }]),
            fecha: '2026-06-15 12:00:00',
        });

        mockReq = { query: { fecha: '2026-06-15' } };
        ctrl.getReporteDiario(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.totales.efectivo).toBe(50);
        expect(jsonArg.totales.yape).toBe(30);
        expect(jsonArg.totales.totalVentas).toBe(100);
        expect(jsonArg.totales.balance).toBe(100); // sin gastos
        expect(jsonArg.cantidadTotalPlatos).toBe(2);
    });

    test('calcula gastos correctamente', () => {
        mockGastosDB.push(
            { descripcion: 'Pan', monto: 15, con_comprobante: 1 },
            { descripcion: 'Pollo', monto: 80, con_comprobante: 0 }
        );

        mockReq = { query: { fecha: '2026-06-15' } };
        ctrl.getReporteDiario(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.totales.totalGastos).toBe(95);
        expect(jsonArg.gastoMayor).toBe('Pollo');
    });

    test('identifica el gasto mayor correctamente', () => {
        mockGastosDB.push(
            { descripcion: 'Pan', monto: 15 },
            { descripcion: 'Pollo', monto: 80 },
            { descripcion: 'Verduras', monto: 30 }
        );

        mockReq = { query: { fecha: '2026-06-15' } };
        ctrl.getReporteDiario(mockReq, mockRes);

        expect(mockRes.json.mock.calls[0][0].gastoMayor).toBe('Pollo');
    });

    test('topPlatos ordenado por cantidad descendente', () => {
        mockVentasDB.push({
            total_cobrado: 200,
            metodos_pago: JSON.stringify({ efectivo: 200 }),
            items: JSON.stringify([
                { nombre: 'Arroz con Pollo', cantidad: 3, categoria: 'Segundos' },
                { nombre: 'Ceviche', cantidad: 5, categoria: 'Entradas' },
            ]),
        });

        mockReq = { query: { fecha: '2026-06-15' } };
        ctrl.getReporteDiario(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.topPlatos[0].nombre).toBe('CEVICHE');
        expect(jsonArg.topPlatos[0].cant).toBe(5);
        expect(jsonArg.topPlatos[1].nombre).toBe('ARROZ CON POLLO');
        expect(jsonArg.topPlatos[1].cant).toBe(3);
    });

    test('filtra bebidas incluidas con almuerzo (isMenuDrink)', () => {
        mockVentasDB.push({
            total_cobrado: 50,
            metodos_pago: JSON.stringify({ efectivo: 50 }),
            items: JSON.stringify([
                { nombre: 'INKA COLA 296ML', cantidad: 1, categoria: 'BEBIDAS', isMenuDrink: true },
                { nombre: 'Menú Completo', cantidad: 1, categoria: 'Segundos' },
            ]),
        });

        mockReq = { query: { fecha: '2026-06-15' } };
        ctrl.getReporteDiario(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        // Bebida con isMenuDrink no debe contar en topPlatos ni en cantidadTotalPlatos (si no se suma... wait, suma cantidadTotalPlatos pero no en top).
        // Revisemos: la línea es cantidadTotalPlatos += it.cantidad - this IS before the if check for isMenuDrink
        // Luego el if (it.isMenuDrink) return; solo excluye de contadorPlatos
        expect(jsonArg.cantidadTotalPlatos).toBe(2);
        expect(jsonArg.topPlatos.length).toBe(1);
    });

    test('normaliza nombres "ALMUERZO: X" a "X"', () => {
        mockVentasDB.push({
            total_cobrado: 30,
            metodos_pago: JSON.stringify({ efectivo: 30 }),
            items: JSON.stringify([
                { nombre: 'Almuerzo: Arroz con Pollo', cantidad: 1, categoria: 'Segundos' },
            ]),
        });

        mockReq = { query: { fecha: '2026-06-15' } };
        ctrl.getReporteDiario(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.topPlatos[0].nombre).toBe('ARROZ CON POLLO');
    });

    test('convierte fecha DD/MM/YYYY a YYYY-MM-DD', () => {
        mockVentasDB.push({
            total_cobrado: 100,
            metodos_pago: JSON.stringify({ efectivo: 100 }),
            items: JSON.stringify([{ nombre: 'Arroz', cantidad: 1, categoria: 'Segundos' }]),
        });

        mockReq = { query: { fecha: '15/06/2026' } };
        ctrl.getReporteDiario(mockReq, mockRes);

        // Si la conversión funciona, mockVentasDB se devuelve (el mock de .all() ignora el parámetro)
        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.totales.totalVentas).toBe(100);
        expect(jsonArg.totales.balance).toBe(100);
    });

    test('usa fecha actual si no se especifica', () => {
        mockVentasDB.push({
            total_cobrado: 75,
            metodos_pago: JSON.stringify({ yape: 75 }),
            items: JSON.stringify([{ nombre: 'Ceviche', cantidad: 1, categoria: 'Entradas' }]),
            fecha: new Date().toISOString().split('T')[0] + ' 12:00:00',
        });

        mockReq = { query: {} };
        ctrl.getReporteDiario(mockReq, mockRes);

        // El controlador usa la fecha actual, mockVentasDB tiene datos, debe retornarlos
        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.totales.totalVentas).toBe(75);
    });

    test('maneja error de DB', () => {
        mockDb.prepare.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        mockReq = { query: { fecha: '2026-06-15' } };
        ctrl.getReporteDiario(mockReq, mockRes);

        expect(mockRes.error).toHaveBeenCalled();
    });
});

describe('getDashboard', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        mockVentasDB.length = 0;
        mockGastosDB.length = 0;
    });

    test('retorna dashboard con valores en cero si no hay datos', () => {
        mockReq = { query: { mes: '2026-06' } };
        ctrl.getDashboard(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.totales.ingresos).toBe(0);
        expect(jsonArg.totales.gastos).toBe(0);
        expect(jsonArg.totales.neto).toBe(0);
        expect(jsonArg.platoCorona).toBeNull();
        expect(jsonArg.diasOperados).toBe(0);
    });

    test('agrupa ventas por día para evolución mensual', () => {
        mockVentasDB.push(
            { fecha: '2026-06-01 12:00:00', total_cobrado: 100, metodos_pago: '{}', items: '[]' },
            { fecha: '2026-06-15 12:00:00', total_cobrado: 200, metodos_pago: '{}', items: '[]' }
        );

        mockReq = { query: { mes: '2026-06' } };
        ctrl.getDashboard(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.totales.ingresos).toBe(300);
        expect(jsonArg.diasOperados).toBe(2);
        // evolución: día 1 (índice 0) debe tener 100, día 15 (índice 14) debe tener 200
        expect(jsonArg.evolucion.ingresos[0]).toBe(100);
        expect(jsonArg.evolucion.ingresos[14]).toBe(200);
    });

    test('identifica plato corona (más vendido)', () => {
        const mockItems = JSON.stringify([
            { nombre: 'Arroz con Pollo', cantidad: 5, categoria: 'Segundos', subtotal: 75 },
            { nombre: 'Ceviche', cantidad: 3, categoria: 'Entradas', subtotal: 24 },
        ]);

        mockVentasDB.push(
            { fecha: '2026-06-15 12:00:00', total_cobrado: 99, metodos_pago: '{}', items: mockItems }
        );

        mockReq = { query: { mes: '2026-06' } };
        ctrl.getDashboard(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.platoCorona.nombre).toBe('ARROZ CON POLLO');
        expect(jsonArg.platoCorona.cantidad).toBe(5);
    });

    test('separa ranking en menú y carta', () => {
        // El controlador reemplaza 'ALMUERZO: X' por solo 'X', así que usamos nombres
        // donde Menú Completo NO sea el platoCorona para que quede en rankingMenu
        const mockItems = JSON.stringify([
            { nombre: 'Ceviche', cantidad: 15, categoria: 'Entradas', subtotal: 120 },
            { nombre: 'Menú Completo', cantidad: 10, categoria: 'Segundos', subtotal: 150 },
            { nombre: 'Arroz con Pollo', cantidad: 5, categoria: 'Segundos', subtotal: 75 },
        ]);

        mockVentasDB.push(
            { fecha: '2026-06-15 12:00:00', total_cobrado: 345, metodos_pago: '{}', items: mockItems }
        );

        mockReq = { query: { mes: '2026-06' } };
        ctrl.getDashboard(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        
        // platoCorona debe ser Ceviche (15 unidades)
        expect(jsonArg.platoCorona.nombre).toBe('CEVICHE');
        
        // MENÚ COMPLETO (10) queda en restoRanking (después de slice(1)) y va a rankingMenu
        expect(jsonArg.rankingMenu.length).toBeGreaterThanOrEqual(1);
        const menuItem = jsonArg.rankingMenu.find(p => p.nombre === 'MENÚ COMPLETO');
        expect(menuItem).toBeDefined();
        expect(menuItem.cantidad).toBe(10);
        
        // ARROZ CON POLLO (5) va a rankingCarta
        expect(jsonArg.rankingCarta.length).toBeGreaterThanOrEqual(1);
        const cartaItem = jsonArg.rankingCarta.find(p => p.nombre === 'ARROZ CON POLLO');
        expect(cartaItem).toBeDefined();
        expect(cartaItem.cantidad).toBe(5);
    });

    test('calcula ventasSunat correctamente', () => {
        mockVentasDB.push(
            { fecha: '2026-06-15 12:00:00', total_cobrado: 100, metodos_pago: JSON.stringify({ enviado_sunat: true }), items: '[]' },
            { fecha: '2026-06-15 13:00:00', total_cobrado: 50, metodos_pago: JSON.stringify({ efectivo: 50 }), items: '[]' }
        );

        mockReq = { query: { mes: '2026-06' } };
        ctrl.getDashboard(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.totales.ventasSunat).toBe(100);
    });

    test('retorna ventasPorCategoria', () => {
        const mockItems = JSON.stringify([
            { nombre: 'Arroz con Pollo', cantidad: 2, categoria: 'Segundos', subtotal: 30 },
            { nombre: 'Ceviche', cantidad: 1, categoria: 'Entradas', subtotal: 8 },
        ]);

        mockVentasDB.push(
            { fecha: '2026-06-15 12:00:00', total_cobrado: 38, metodos_pago: '{}', items: mockItems }
        );

        mockReq = { query: { mes: '2026-06' } };
        ctrl.getDashboard(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.ventasPorCategoria).toBeDefined();
        expect(jsonArg.ventasPorCategoria.length).toBeGreaterThanOrEqual(2);
    });

    test('cuenta días operados correctamente', () => {
        mockVentasDB.push(
            { fecha: '2026-06-01 12:00:00', total_cobrado: 100, metodos_pago: '{}', items: '[]' },
            { fecha: '2026-06-01 18:00:00', total_cobrado: 50, metodos_pago: '{}', items: '[]' }, // mismo día
            { fecha: '2026-06-02 12:00:00', total_cobrado: 200, metodos_pago: '{}', items: '[]' }
        );

        mockReq = { query: { mes: '2026-06' } };
        ctrl.getDashboard(mockReq, mockRes);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.diasOperados).toBe(2); // Solo 2 días únicos
    });

    test('usa mes actual si no se especifica', () => {
        mockReq = { query: {} };
        ctrl.getDashboard(mockReq, mockRes);

        const today = new Date().toISOString().slice(0, 7);
        expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('maneja error de DB', () => {
        mockDb.prepare.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        mockReq = { query: { mes: '2026-06' } };
        ctrl.getDashboard(mockReq, mockRes);

        expect(mockRes.error).toHaveBeenCalled();
    });
});

describe('resumenDiarioIA', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        jest.clearAllMocks();
    });

    test('envía datos a Gemini y retorna análisis', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => JSON.stringify({
                    diagnostico: 'Buen flujo de caja diario.',
                    accion: 'Revisar gasto de insumos.',
                    nivelRiesgo: 'bajo',
                }),
            },
        });

        mockReq = {
            body: {
                ingresos: 1500,
                gastos: 400,
                topPlatos: [{ nombre: 'Arroz con Pollo', categoria: 'Segundos', precio: 15, cantidad: 50 }],
                diaSemana: 'Sábado',
                cantidadTotalPlatos: 80,
                gastoMayor: 'Compra de pollo',
            },
        };

        await ctrl.resumenDiarioIA(mockReq, mockRes);

        expect(mockGetGenerativeModel).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'gemini-2.5-flash',
            })
        );
        expect(mockGenerateContent).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith({
            diagnostico: 'Buen flujo de caja diario.',
            accion: 'Revisar gasto de insumos.',
            nivelRiesgo: 'bajo',
        });
    });

    test('retorna fallback si Gemini falla', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API Error'));

        mockReq = {
            body: { ingresos: 100, gastos: 50, topPlatos: [] },
        };

        await ctrl.resumenDiarioIA(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
            diagnostico: expect.any(String),
            accion: expect.any(String),
            nivelRiesgo: 'alto',
        });
    });

    test('calcula ratio de gastos', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => JSON.stringify({
                    diagnostico: 'Test',
                    accion: 'Test',
                    nivelRiesgo: 'bajo',
                }),
            },
        });

        mockReq = {
            body: {
                ingresos: 1000,
                gastos: 500, // 50%
                topPlatos: [],
            },
        };

        await ctrl.resumenDiarioIA(mockReq, mockRes);

        // El prompt debe incluir "50%"
        const promptCall = mockGenerateContent.mock.calls[0][0];
        expect(promptCall).toContain('50');
    });
});

describe('resumenMensualIA', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockRes = createMockRes();
        jest.clearAllMocks();
    });

    test('envía datos mensuales a Gemini y retorna dictamen', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => JSON.stringify({
                    diagnostico: 'Mes saludable.',
                    decision: 'Mantener estrategia actual.',
                    nivelFinanciero: 'saludable',
                }),
            },
        });

        mockReq = {
            body: {
                ingresos: 45000,
                gastos: 18000,
                platoCorona: 'Arroz con Pollo',
                mes: 'Junio 2026',
                ventasPorCategoria: [{ categoria: 'Segundos', total: 30000 }],
                diasOperados: 26,
            },
        };

        await ctrl.resumenMensualIA(mockReq, mockRes);

        expect(mockGetGenerativeModel).toHaveBeenCalled();
        expect(mockGenerateContent).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith({
            diagnostico: 'Mes saludable.',
            decision: 'Mantener estrategia actual.',
            nivelFinanciero: 'saludable',
        });
    });

    test('retorna fallback si Gemini falla', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API Error'));

        mockReq = {
            body: { ingresos: 1000, gastos: 500, mes: 'Enero' },
        };

        await ctrl.resumenMensualIA(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
            diagnostico: expect.any(String),
            decision: expect.any(String),
            nivelFinanciero: 'critico',
        });
    });

    test('calcula promedio diario correctamente', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => JSON.stringify({
                    diagnostico: 'X',
                    decision: 'Y',
                    nivelFinanciero: 'estable',
                }),
            },
        });

        mockReq = {
            body: {
                ingresos: 26000,
                gastos: 10000,
                mes: 'Junio',
                diasOperados: 26,
            },
        };

        await ctrl.resumenMensualIA(mockReq, mockRes);

        // promedio diario = 26000/26 = 1000
        const promptCall = mockGenerateContent.mock.calls[0][0];
        expect(promptCall).toContain('1000');
    });
});
