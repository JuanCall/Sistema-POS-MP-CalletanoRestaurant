const { success, error, responseHelpers, errorHandler } = require('../utils/response');

describe('success()', () => {
    let mockRes;
    beforeEach(() => {
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    test('retorna { success: true } con data null', () => {
        success(mockRes, null);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: null });
    });

    test('retorna { success: true } con data primitiva', () => {
        success(mockRes, 'hola');
        expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: 'hola' });
    });

    test('retorna { success: true, ...data } cuando data es objeto', () => {
        success(mockRes, { id: 1, nombre: 'test' });
        expect(mockRes.json).toHaveBeenCalledWith({ success: true, id: 1, nombre: 'test' });
    });

    test('retorna array como data', () => {
        success(mockRes, [1, 2, 3]);
        expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [1, 2, 3] });
    });

    test('usa status code personalizado', () => {
        success(mockRes, null, 201);
        expect(mockRes.status).toHaveBeenCalledWith(201);
    });
});

describe('error()', () => {
    let mockRes;
    beforeEach(() => {
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    test('retorna { success: false, error } con status 500', () => {
        error(mockRes, 'Error interno');
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ success: false, error: 'Error interno' });
    });

    test('usa mensaje por defecto', () => {
        error(mockRes);
        expect(mockRes.json).toHaveBeenCalledWith({ success: false, error: 'Error interno del servidor' });
    });

    test('usa status code personalizado', () => {
        error(mockRes, 'No encontrado', 404);
        expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    test('usa status code 401', () => {
        error(mockRes, 'No autorizado', 401);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ success: false, error: 'No autorizado' });
    });
});

describe('responseHelpers middleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = {};
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
    });

    test('agrega res.success() al objeto response', () => {
        responseHelpers(mockReq, mockRes, mockNext);
        expect(typeof mockRes.success).toBe('function');
    });

    test('agrega res.error() al objeto response', () => {
        responseHelpers(mockReq, mockRes, mockNext);
        expect(typeof mockRes.error).toBe('function');
    });

    test('llama a next()', () => {
        responseHelpers(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    test('res.success() responde correctamente', () => {
        responseHelpers(mockReq, mockRes, mockNext);
        mockRes.success({ data: 'test' });
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: 'test' });
    });

    test('res.success() usa status code personalizado', () => {
        responseHelpers(mockReq, mockRes, mockNext);
        mockRes.success(null, 201);
        expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('res.error() responde correctamente', () => {
        responseHelpers(mockReq, mockRes, mockNext);
        mockRes.error('Error personalizado');
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ success: false, error: 'Error personalizado' });
    });

    test('res.error() usa status code personalizado', () => {
        responseHelpers(mockReq, mockRes, mockNext);
        mockRes.error('No encontrado', 404);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ success: false, error: 'No encontrado' });
    });
});

describe('errorHandler middleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = {};
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('responde 500 con mensaje genérico por defecto', () => {
        const err = new Error('Algo salió mal');
        errorHandler(err, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            error: 'Error interno del servidor',
        });
    });

    test('usa status code y mensaje expuesto del error', () => {
        const err = new Error('No autorizado');
        err.statusCode = 401;
        err.expose = true;
        errorHandler(err, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            error: 'No autorizado',
        });
    });

    test('usa err.status si no hay err.statusCode', () => {
        const err = new Error('No encontrado');
        err.status = 404;
        err.expose = true;
        errorHandler(err, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            error: 'No encontrado',
        });
    });

    test('oculta mensaje interno si no está expuesto', () => {
        const err = new Error('Error interno de DB');
        err.statusCode = 500;
        // err.expose no está definido → false
        errorHandler(err, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            error: 'Error interno del servidor',
        });
    });

    test('loguea el error real en consola', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const err = new Error('Error crítico');
        err.expose = true;

        errorHandler(err, mockReq, mockRes, mockNext);

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Error crítico')
        );
        consoleSpy.mockRestore();
    });
});
