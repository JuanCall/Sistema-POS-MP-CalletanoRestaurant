/**
 * Tests para controllers/sistema.controller.js
 *
 * Incluye tests críticos de login con bcrypt (CRIT-01),
 * configuración, y endpoints auxiliares.
 */

// ─── Mocks ────────────────────────────────────────────────

const mockUsuariosDB = [];
let mockSALT_ROUNDS = 10;

const mockDb = {
    SALT_ROUNDS: mockSALT_ROUNDS,
    prepare: jest.fn((sql) => {
        if (sql.includes('SELECT * FROM usuarios WHERE username')) {
            return {
                get: jest.fn((username) => mockUsuariosDB.find(u => u.username === username) || null),
            };
        }
        if (sql.includes('UPDATE usuarios SET password')) {
            return { run: jest.fn() };
        }
        if (sql.includes('SELECT * FROM configuracion')) {
            return {
                all: jest.fn(() => [
                    { clave: 'ticketera_caja', valor: 'EPSON' },
                    { clave: 'ticketera_cocina', valor: 'XP-58' },
                ]),
            };
        }
        if (sql.includes('INSERT OR REPLACE INTO configuracion')) {
            return { run: jest.fn() };
        }
        return { run: jest.fn(), all: jest.fn(() => []), get: jest.fn(() => null) };
    }),
};

const mockCompareSync = jest.fn();
const mockHashSync = jest.fn();
jest.mock('bcryptjs', () => ({
    compareSync: (...args) => mockCompareSync(...args),
    hashSync: (...args) => mockHashSync(...args),
}));

const mockExec = jest.fn();
jest.mock('child_process', () => ({ exec: (...args) => mockExec(...args) }));

let mockExistsSync = false;
jest.mock('fs', () => ({
    existsSync: jest.fn(() => mockExistsSync),
    mkdirSync: jest.fn(),
}));

jest.mock('os', () => ({ homedir: () => 'C:\\Users\\test' }));

const mockState = {
    modoDomingoGlobal: false,
    estadoRestauranteGlobal: { apertura: 12, cierre: 22, cierreForzado: '' },
    rawMenuDiario: {},
    rawCartaCompleta: {},
};
jest.mock('../store/globalState', () => mockState);

jest.mock('../database', () => mockDb);

const ctrl = require('../controllers/sistema.controller');

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

describe('getStatus', () => {
    test('retorna { status: "online" }', () => {
        const req = {};
        const res = createMockRes();
        ctrl.getStatus(req, res);
        expect(res.json).toHaveBeenCalledWith({ status: 'online' });
    });
});

describe('getModoDomingo', () => {
    test('retorna modo domingo y estado restaurante', () => {
        const req = {};
        const res = createMockRes();
        ctrl.getModoDomingo(req, res);

        expect(res.json).toHaveBeenCalledWith({
            modoDomingo: mockState.modoDomingoGlobal,
            estadoRestaurante: mockState.estadoRestauranteGlobal,
        });
    });
});

describe('login', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUsuariosDB.length = 0;
        mockUsuariosDB.push({
            id: 1,
            username: 'calletano',
            password: '$2b$10$hashhasheado12345678901234567890',
            rol: 'admin',
        });
    });

    test('login exitoso con bcrypt', () => {
        mockCompareSync.mockReturnValueOnce(true);

        const req = { body: { username: 'calletano', password: '44910626' } };
        const res = createMockRes();

        ctrl.login(req, res);

        expect(mockCompareSync).toHaveBeenCalledWith('44910626', '$2b$10$hashhasheado12345678901234567890');
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            user: { username: 'calletano', rol: 'admin' },
        });
    });

    test('login fallido con bcrypt (contraseña incorrecta)', () => {
        mockCompareSync.mockReturnValueOnce(false);

        const req = { body: { username: 'calletano', password: 'wrong' } };
        const res = createMockRes();

        ctrl.login(req, res);

        expect(res.error).toHaveBeenCalledWith('Credenciales incorrectas', 401);
    });

    test('login con usuario inexistente', () => {
        const req = { body: { username: 'noexiste', password: 'x' } };
        const res = createMockRes();

        ctrl.login(req, res);

        expect(res.error).toHaveBeenCalledWith('Credenciales incorrectas', 401);
    });

    test('login exitoso con contraseña en texto plano (migración legacy)', () => {
        mockUsuariosDB.length = 0;
        mockUsuariosDB.push({
            id: 2,
            username: 'caja',
            password: 'caja123', // texto plano
            rol: 'cajero',
        });
        mockHashSync.mockReturnValueOnce('$2b$10$nuevohash12345678901234567890123456789012');

        const req = { body: { username: 'caja', password: 'caja123' } };
        const res = createMockRes();

        ctrl.login(req, res);

        // Debe migrar a bcrypt
        expect(mockHashSync).toHaveBeenCalledWith('caja123', mockSALT_ROUNDS);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            user: { username: 'caja', rol: 'cajero' },
        });
    });

    test('login fallido con contraseña texto plano (incorrecta)', () => {
        mockUsuariosDB.length = 0;
        mockUsuariosDB.push({
            id: 2,
            username: 'caja',
            password: 'caja123',
            rol: 'cajero',
        });

        const req = { body: { username: 'caja', password: 'wrong' } };
        const res = createMockRes();

        ctrl.login(req, res);

        expect(res.error).toHaveBeenCalledWith('Credenciales incorrectas', 401);
    });

    test('login con password que no comienza con $2b$ pero tampoco es bcrypt', () => {
        mockUsuariosDB.push({
            id: 3,
            username: 'test',
            password: 'otro_formato',
            rol: 'admin',
        });

        const req = { body: { username: 'test', password: 'otro_formato' } };
        const res = createMockRes();

        ctrl.login(req, res);

        // Debe tratarlo como texto plano
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            user: { username: 'test', rol: 'admin' },
        });
    });
});

describe('abrirComprobantes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockExistsSync = true;
    });

    test('abre carpeta de comprobantes', () => {
        const req = {};
        const res = createMockRes();

        ctrl.abrirComprobantes(req, res);

        expect(mockExec).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    test('crea carpeta si no existe', () => {
        mockExistsSync = false;
        const req = {};
        const res = createMockRes();

        ctrl.abrirComprobantes(req, res);

        expect(require('fs').mkdirSync).toHaveBeenCalled();
    });
});

describe('getImpresoras', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('retorna lista de impresoras desde PowerShell', () => {
        const req = {};
        const res = createMockRes();

        mockExec.mockImplementationOnce((cmd, cb) => {
            cb(null, '[{"Name":"EPSON TM-T20"},{"Name":"XP-58"}]');
        });

        ctrl.getImpresoras(req, res);

        expect(mockExec).toHaveBeenCalledWith(
            expect.stringContaining('powershell'),
            expect.any(Function)
        );
        // La respuesta se llama dentro del callback de exec
        expect(res.json).toHaveBeenCalledWith(['EPSON TM-T20', 'XP-58']);
    });

    test('retorna array vacío si powershell falla', () => {
        const req = {};
        const res = createMockRes();

        mockExec.mockImplementationOnce((cmd, cb) => {
            cb(new Error('error'), '');
        });

        ctrl.getImpresoras(req, res);

        expect(res.json).toHaveBeenCalledWith([]);
    });

    test('retorna array vacío si JSON es inválido', () => {
        const req = {};
        const res = createMockRes();

        mockExec.mockImplementationOnce((cmd, cb) => {
            cb(null, 'no-json');
        });

        ctrl.getImpresoras(req, res);

        expect(res.json).toHaveBeenCalledWith([]);
    });

    test('maneja impresora única (no array)', () => {
        const req = {};
        const res = createMockRes();

        mockExec.mockImplementationOnce((cmd, cb) => {
            cb(null, '{"Name":"EPSON TM-T20"}');
        });

        ctrl.getImpresoras(req, res);

        expect(res.json).toHaveBeenCalledWith(['EPSON TM-T20']);
    });
});

describe('getConfig', () => {
    test('retorna configuración como objeto clave-valor', () => {
        const req = {};
        const res = createMockRes();

        ctrl.getConfig(req, res);

        expect(res.json).toHaveBeenCalledWith({
            ticketera_caja: 'EPSON',
            ticketera_cocina: 'XP-58',
        });
    });

    test('maneja error de DB', () => {
        mockDb.prepare.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const req = {};
        const res = createMockRes();

        ctrl.getConfig(req, res);

        expect(res.error).toHaveBeenCalled();
    });
});

describe('setConfig', () => {
    test('guarda configuración correctamente', () => {
        const req = {
            body: { ticketera_caja: 'EPSON TM-T20', ticketera_cocina: 'XP-58 II' },
        };
        const res = createMockRes();

        ctrl.setConfig(req, res);

        expect(res.json).toHaveBeenCalledWith({ message: 'Configuración guardada' });
    });

    test('maneja error de DB', () => {
        mockDb.prepare.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const req = { body: { ticketera_caja: '', ticketera_cocina: '' } };
        const res = createMockRes();

        ctrl.setConfig(req, res);

        expect(res.error).toHaveBeenCalled();
    });
});
