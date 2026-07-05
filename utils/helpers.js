// Funciones de ayuda general
const aFechaLocal = (jsDate) => {
    const tzOffset = jsDate.getTimezoneOffset() * 60000;
    return new Date(jsDate.getTime() - tzOffset).toISOString().slice(0, 19).replace('T', ' ');
};

const pad2 = (num) => String(num).padStart(2, '0'); 
const pad4 = (num) => String(num).padStart(4, '0'); 
const pad5 = (num) => String(num).padStart(5, '0'); 
const pad6 = (num) => String(num).padStart(6, '0'); 

const normalizar = (txt) => txt ? txt.toUpperCase().replace(/\s+/g, ' ').trim() : '';

// Extraer enteros y céntimos para la Leyenda de SUNAT
const generarLeyenda = (montoTotal) => {
    const enteros = Math.floor(montoTotal);
    const centimos = Math.round((montoTotal - enteros) * 100);
    return `SON ${enteros} CON ${String(centimos).padStart(2, '0')}/100 SOLES`;
};

module.exports = { aFechaLocal, pad2, pad4, pad5, pad6, normalizar, generarLeyenda };