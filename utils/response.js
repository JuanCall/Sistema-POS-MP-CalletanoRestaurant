/**
 * Helpers de respuesta consistente para la API REST.
 * Toda respuesta sigue el formato: { success: boolean, data?: any, error?: string }
 */

function success(res, data = null, statusCode = 200) {
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        // Si ya tiene success, no lo duplicamos
        return res.status(statusCode).json({ success: true, ...data });
    }
    return res.status(statusCode).json({ success: true, data });
}

function error(res, message = 'Error interno del servidor', statusCode = 500) {
    return res.status(statusCode).json({ success: false, error: message });
}

/**
 * Middleware que agrega helpers res.success() y res.error() a Express.
 * Uso: app.use(responseHelpers);
 */
function responseHelpers(req, res, next) {
    res.success = (data, statusCode) => success(res, data, statusCode);
    res.error = (message, statusCode) => error(res, message, statusCode);
    next();
}

/**
 * Middleware global de manejo de errores.
 * Captura errores no manejados (next(err) o throw en rutas async).
 * Uso: app.use(errorHandler);
 */
function errorHandler(err, req, res, next) {
    const status = err.statusCode || err.status || 500;
    const message = err.expose ? err.message : 'Error interno del servidor';

    // Loggear el error real (el logger ya reemplazó console.error globalmente)
    console.error(`[ERROR] ${status} - ${err.message}`);
    if (status === 500 && err.stack) {
        console.error(err.stack);
    }

    res.status(status).json({ success: false, error: message });
}

module.exports = { success, error, responseHelpers, errorHandler };
