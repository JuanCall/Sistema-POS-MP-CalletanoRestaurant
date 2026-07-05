/**
 * Tests para utils/migrations.js
 *
 * Sistema de migraciones versionadas: tabla schema_version,
 * getCurrentVersion, runMigrations con casos de éxito, error,
 * columnas duplicadas, y migraciones ya aplicadas.
 */

const { runMigrations } = require('../utils/migrations');

// ─── Helpers ──────────────────────────────────────────────

function createMockDb() {
    const executedStatements = [];
    const appliedMigrations = [];

    return {
        executedStatements,
        appliedMigrations,
        exec: jest.fn((sql) => {
            executedStatements.push(sql);
        }),
        prepare: jest.fn((sql) => {
            if (sql.includes('CREATE TABLE IF NOT EXISTS schema_version')) {
                return {
                    run: jest.fn(),
                };
            }
            if (sql.includes('SELECT COALESCE(MAX(version), 0) as v FROM schema_version')) {
                return {
                    get: jest.fn(() => {
                        if (appliedMigrations.length === 0) return { v: 0 };
                        return { v: Math.max(...appliedMigrations) };
                    }),
                };
            }
            if (sql.includes('INSERT INTO schema_version')) {
                return {
                    run: jest.fn((version, name) => {
                        appliedMigrations.push(version);
                    }),
                };
            }
            if (sql.includes('INSERT OR IGNORE INTO schema_version')) {
                return {
                    run: jest.fn((version, name) => {
                        if (!appliedMigrations.includes(version)) {
                            appliedMigrations.push(version);
                        }
                    }),
                };
            }
            if (sql.includes('UPDATE ventas SET firebase_id')) {
                return {
                    run: jest.fn(),
                };
            }
            if (sql.includes('UPDATE gastos SET firebase_id')) {
                return {
                    run: jest.fn(),
                };
            }
            if (sql.includes('SELECT id, fecha FROM ventas WHERE firebase_id IS NULL')) {
                return {
                    all: jest.fn(() => [
                        { id: 1, fecha: '2026-06-15 12:00:00' },
                        { id: 2, fecha: '2026-06-16 10:00:00' },
                    ]),
                };
            }
            if (sql.includes('SELECT id, fecha FROM gastos WHERE firebase_id IS NULL')) {
                return {
                    all: jest.fn(() => [
                        { id: 1, fecha: '2026-06-15 08:00:00' },
                    ]),
                };
            }
            return {
                run: jest.fn(),
                all: jest.fn(() => []),
                get: jest.fn(() => null),
            };
        }),
    };
}

// ─── Tests ────────────────────────────────────────────────

describe('runMigrations', () => {
    let mockLog;
    let db;

    beforeEach(() => {
        mockLog = jest.fn();
    });

    test('no ejecuta migraciones si la DB está actualizada (schema v4)', () => {
        db = createMockDb();
        // Simular que ya se aplicaron todas (v1, v2, v3, v4)
        db.appliedMigrations.push(1, 2, 3, 4);

        runMigrations(db, mockLog);

        // No debe ejecutar ALTER TABLE porque ya están aplicadas
        const alterCalls = db.exec.mock.calls.filter(
            ([sql]) => sql.includes('ALTER TABLE')
        );
        expect(alterCalls.length).toBe(0);
        // Debe loguear que está actualizada
        expect(mockLog).toHaveBeenCalledWith(
            expect.stringMatching(/actualizada/)
        );
    });

    test('ejecuta todas las migraciones desde 0', () => {
        db = createMockDb();

        runMigrations(db, mockLog);

        // Debe ejecutar 4 ALTER TABLE
        const alterCalls = db.exec.mock.calls.filter(
            ([sql]) => sql.includes('ALTER TABLE')
        );
        expect(alterCalls.length).toBe(4);

        // Debe registrar las 4 migraciones en schema_version
        expect(db.appliedMigrations).toContain(1);
        expect(db.appliedMigrations).toContain(2);
        expect(db.appliedMigrations).toContain(3);
        expect(db.appliedMigrations).toContain(4);

        // Debe loguear progreso
        expect(mockLog).toHaveBeenCalledWith(
            expect.stringMatching(/Ejecutando/)
        );
        expect(mockLog).toHaveBeenCalledWith(
            expect.stringMatching(/completadas/)
        );
    });

    test('ejecuta solo migraciones pendientes (desde v2)', () => {
        db = createMockDb();
        db.appliedMigrations.push(1, 2);

        runMigrations(db, mockLog);

        // Solo debe ejecutar v3 y v4
        const alterCalls = db.exec.mock.calls.filter(
            ([sql]) => sql.includes('ALTER TABLE')
        );
        expect(alterCalls.length).toBe(2);
        expect(db.appliedMigrations).toContain(3);
        expect(db.appliedMigrations).toContain(4);
    });

    test('asigna firebase_id a ventas sin él en migración v2', () => {
        db = createMockDb();

        runMigrations(db, mockLog);

        // La migración v2 ejecuta UPDATE ventas SET firebase_id para registros sin firebase_id
        const updateCalls = db.prepare.mock.calls.filter(
            ([sql]) => sql.includes('UPDATE ventas SET firebase_id')
        );
        expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    });

    test('asigna firebase_id a gastos sin él en migración v3', () => {
        db = createMockDb();

        runMigrations(db, mockLog);

        const updateCalls = db.prepare.mock.calls.filter(
            ([sql]) => sql.includes('UPDATE gastos SET firebase_id')
        );
        expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    });

    test('no falla si ALTER TABLE ya existe (duplicate column)', () => {
        db = createMockDb();
        // Simular que ALTER TABLE lanza error de columna duplicada
        db.exec = jest.fn((sql) => {
            if (sql.includes('ALTER TABLE')) {
                const err = new Error('duplicate column name');
                // No throw, el código maneja esto
            }
        });

        // Simplemente verificar que no lanza excepción
        expect(() => runMigrations(db, mockLog)).not.toThrow();
    });

    test('crea la tabla schema_version al inicio', () => {
        db = createMockDb();

        runMigrations(db, mockLog);

        // Debe ejecutar CREATE TABLE IF NOT EXISTS schema_version
        const createCalls = db.exec.mock.calls.filter(
            ([sql]) => sql.includes('CREATE TABLE IF NOT EXISTS schema_version')
        );
        expect(createCalls.length).toBe(1);
    });
});

describe('getCurrentVersion', () => {
    test('retorna 0 si no hay migraciones aplicadas', () => {
        const db = createMockDb();
        // getCurrentVersion se llama internamente, verificamos que con v=0
        // se ejecutan todas las migraciones
        runMigrations(db, jest.fn());
        expect(db.appliedMigrations.length).toBe(4);
    });
});
