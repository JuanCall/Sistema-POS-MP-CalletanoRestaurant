const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');
const errorLogPath = path.join(logsDir, 'error.log');

const ensureLogsDirectory = () => {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
};

const logError = ({ message, error, context }) => {
  try {
    ensureLogsDirectory();

    const logEntry = [
      '------------------------------',
      `Fecha: ${new Date().toISOString()}`,
      `Mensaje: ${message || 'Error no especificado'}`,
      `Contexto: ${context || 'Sin contexto'}`,
      `Detalle: ${error ? error.stack || error.message : 'Sin detalle'}`,
      '',
    ].join('\n');

    fs.appendFileSync(errorLogPath, logEntry, 'utf8');
  } catch (logFailure) {
    console.error('No se pudo escribir en el archivo de log:', logFailure.message);
  }
};

module.exports = {
  logError,
};
