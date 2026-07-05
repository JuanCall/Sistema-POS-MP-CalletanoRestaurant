const { aFechaLocal, pad2, pad4, pad5, pad6, normalizar, generarLeyenda } = require('../utils/helpers');

describe('pad functions', () => {
    test('pad2: 1 → "01"', () => {
        expect(pad2(1)).toBe('01');
    });
    test('pad2: 10 → "10"', () => {
        expect(pad2(10)).toBe('10');
    });
    test('pad4: 5 → "0005"', () => {
        expect(pad4(5)).toBe('0005');
    });
    test('pad5: 123 → "00123"', () => {
        expect(pad5(123)).toBe('00123');
    });
    test('pad6: 42 → "000042"', () => {
        expect(pad6(42)).toBe('000042');
    });
});

describe('normalizar', () => {
    test('texto normal se pasa a mayusculas sin espacios extra', () => {
        expect(normalizar('  Arroz   con  Pollo  ')).toBe('ARROZ CON POLLO');
    });
    test('string vacio retorna vacio', () => {
        expect(normalizar('')).toBe('');
    });
    test('null retorna vacio', () => {
        expect(normalizar(null)).toBe('');
    });
    test('undefined retorna vacio', () => {
        expect(normalizar(undefined)).toBe('');
    });
    test('ya normalizado se mantiene igual', () => {
        expect(normalizar('CEVICHE')).toBe('CEVICHE');
    });
});

describe('generarLeyenda', () => {
    test('monto exacto en soles', () => {
        expect(generarLeyenda(100)).toBe('SON 100 CON 00/100 SOLES');
    });
    test('monto con céntimos', () => {
        expect(generarLeyenda(15.50)).toBe('SON 15 CON 50/100 SOLES');
    });
    test('monto con un céntimo', () => {
        expect(generarLeyenda(10.01)).toBe('SON 10 CON 01/100 SOLES');
    });
    test('monto cero', () => {
        expect(generarLeyenda(0)).toBe('SON 0 CON 00/100 SOLES');
    });
    test('monto grande', () => {
        expect(generarLeyenda(1234.56)).toBe('SON 1234 CON 56/100 SOLES');
    });
});

describe('aFechaLocal', () => {
    test('convierte fecha JS a string local', () => {
        const fecha = new Date('2026-06-15T12:00:00');
        const result = aFechaLocal(fecha);
        expect(result).toMatch(/2026-06-15 \d{2}:\d{2}:\d{2}/);
    });
});
