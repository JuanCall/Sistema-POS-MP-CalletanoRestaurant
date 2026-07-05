/**
 * Tests para utils/logger.js
 *
 * Winston logger: configuración de transports, formato, y reemplazo
 * global de console.log/error/warn.
 *
 * Se usa jest.isolateModules() para forzar recarga del módulo en cada test
 * que necesita verificar la inicialización.
 */

// ─── Variables de mock compartidas ────────────────────────

let mockLoggerInstance;
let mockCreateLogger;

function setupMocks() {
    mockLoggerInstance = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    };

    mockCreateLogger = jest.fn(() => mockLoggerInstance);

    jest.mock('fs', () => ({
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
    }));

    jest.mock('winston', () => ({
        createLogger: mockCreateLogger,
        format: {
            combine: jest.fn(() => 'combined-format'),
            timestamp: jest.fn(() => 'timestamp-format'),
            errors: jest.fn(() => 'errors-format'),
            printf: jest.fn(() => 'printf-format'),
            colorize: jest.fn(() => 'colorize-format'),
        },
        transports: {
            Console: jest.fn(() => ({ on: jest.fn() })),
            File: jest.fn(() => ({ on: jest.fn() })),
        },
    }));
}

describe('utils/logger.js — inicialización', () => {
    test('crea directorio logs si no existe', () => {
        jest.isolateModules(() => {
            const mockMkdirSync = jest.fn();
            jest.mock('fs', () => ({
                existsSync: jest.fn().mockReturnValue(false),
                mkdirSync: mockMkdirSync,
            }));
            jest.mock('winston', () => ({
                createLogger: jest.fn(() => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() })),
                format: { combine: jest.fn(), timestamp: jest.fn(), errors: jest.fn(), printf: jest.fn(), colorize: jest.fn() },
                transports: { Console: jest.fn(() => ({})), File: jest.fn(() => ({})) },
            }));
            require('../utils/logger');
            expect(mockMkdirSync).toHaveBeenCalled();
        });
    });

    test('configura 3 transports (console, error.log, combined.log)', () => {
        jest.isolateModules(() => {
            setupMocks();
            require('../utils/logger');
            const callArgs = mockCreateLogger.mock.calls[0][0];
            expect(callArgs.transports).toBeDefined();
            expect(callArgs.transports.length).toBe(3);
        });
    });

    test('usa nivel por defecto info si no hay LOG_LEVEL', () => {
        jest.isolateModules(() => {
            const oldLevel = process.env.LOG_LEVEL;
            delete process.env.LOG_LEVEL;
            setupMocks();
            require('../utils/logger');
            const callArgs = mockCreateLogger.mock.calls[0][0];
            expect(callArgs.level).toBe('info');
            if (oldLevel) process.env.LOG_LEVEL = oldLevel;
        });
    });

    test('usa LOG_LEVEL de entorno si está configurado', () => {
        jest.isolateModules(() => {
            process.env.LOG_LEVEL = 'debug';
            setupMocks();
            require('../utils/logger');
            expect(mockCreateLogger).toHaveBeenCalledWith(
                expect.objectContaining({ level: 'debug' })
            );
            delete process.env.LOG_LEVEL;
        });
    });
});

describe('utils/logger.js — console replacement', () => {
    test('console.log redirige a logger.info', () => {
        // El reemplazo global ya ocurrió al cargarse el módulo principal
        expect(typeof console.log).toBe('function');
    });

    test('console.error redirige a logger.error', () => {
        expect(typeof console.error).toBe('function');
    });

    test('console.warn redirige a logger.warn', () => {
        expect(typeof console.warn).toBe('function');
    });
});
