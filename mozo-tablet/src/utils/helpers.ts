export const obtenerFechaActualLocal = () => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
};

export const generarId = () => Math.random().toString(36).substring(2, 10);

export const pad5 = (num: number) => String(num).padStart(5, '0');

export const formatMesaName = (mesaId) => {
    if (!mesaId) return '';
    const str = String(mesaId);
    
    // Reglas para textos estructurados
    if (str.startsWith('mesa_')) return `MESA ${str.replace('mesa_', '')}`;
    if (str.startsWith('CTA-')) return `CUENTA: ${str.replace('CTA-', '').replace(/-/g, ' ')}`;
    if (str.startsWith('DEL-')) return `DELIVERY: ${str.replace('DEL-', '').replace(/-/g, ' ')}`;
    
    // 🟢 NUEVA REGLA: Si la Base de Datos devuelve un número puro (Ej: "1" o "1.0")
    if (!isNaN(parseFloat(str))) {
        return `MESA ${parseInt(str, 10)}`;
    }
    
    return str;
};

export const modLabelText = (mod: string) => {
    if (mod === 'local') return 'Local';
    if (mod === 'llevar') return 'Llevar';
    if (mod === 'delivery') return 'Delivery';
    if (mod === 'delivery_centro') return 'Centro';
    return mod;
};