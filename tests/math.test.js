const { calcularRecargoTaper, agruparItemsParaVenta, calcularTotalMesa, fusionarPedidos } = require('../utils/math');

describe('calcularRecargoTaper', () => {
    test('local no tiene recargo', () => {
        expect(calcularRecargoTaper({ modalidad: 'local' })).toBe(0);
    });

    test('sin modalidad no tiene recargo', () => {
        expect(calcularRecargoTaper({})).toBe(0);
    });

    test('isMenuDrink retorna 0 incluso con delivery', () => {
        expect(calcularRecargoTaper({ modalidad: 'delivery', isMenuDrink: true })).toBe(0);
    });

    test('delivery normal cuesta S/3', () => {
        expect(calcularRecargoTaper({ modalidad: 'delivery', categoria: 'Segundos', nombre: 'Arroz con Pollo' })).toBe(3);
    });

    test('delivery_centro cuesta S/5', () => {
        expect(calcularRecargoTaper({ modalidad: 'delivery_centro', categoria: 'Segundos', nombre: 'Arroz con Pollo' })).toBe(5);
    });

    test('llevar con taper mediano cuesta S/2', () => {
        expect(calcularRecargoTaper({ modalidad: 'llevar', categoria: 'Segundos', nombre: 'Arroz con Pollo', taper: ['mediano'] })).toBe(2);
    });

    test('llevar con taper chico cuesta S/1', () => {
        expect(calcularRecargoTaper({ modalidad: 'llevar', categoria: 'Entradas', nombre: 'Ceviche', taper: ['chico'] })).toBe(1);
    });

    test('llevar con costo_taper precalculado', () => {
        expect(calcularRecargoTaper({ modalidad: 'llevar', costo_taper: 3 })).toBe(3);
    });

    test('bebidas no tienen recargo', () => {
        expect(calcularRecargoTaper({ modalidad: 'llevar', categoria: 'BEBIDAS', nombre: 'Inka Cola' })).toBe(0);
        expect(calcularRecargoTaper({ modalidad: 'llevar', categoria: 'JUGOS NATURALES', nombre: 'Maracuya' })).toBe(0);
    });

    test('entrada sola para llevar sin taper cuesta S/1', () => {
        const item = { modalidad: 'llevar', categoria: 'Entradas', nombre: 'Ceviche (ENTRADA)' };
        expect(calcularRecargoTaper(item)).toBe(1);
    });
});

describe('calcularTotalMesa', () => {
    test('pedido vacio total 0', () => {
        expect(calcularTotalMesa([])).toBe(0);
    });

    test('item simple sin recargo', () => {
        const pedido = [{ nombre: 'Arroz con Pollo', precio: 15, cantidad: 1, categoria: 'Segundos', modalidad: 'local' }];
        expect(calcularTotalMesa(pedido)).toBe(15);
    });

    test('menu completo entrada + segundo = 15', () => {
        const pedido = [
            { nombre: 'Ceviche', precio: 8, cantidad: 1, categoria: 'Entradas', modalidad: 'local' },
            { nombre: 'Arroz con Pollo', precio: 15, cantidad: 1, categoria: 'Segundos', modalidad: 'local' }
        ];
        expect(calcularTotalMesa(pedido)).toBe(15);
    });

    test('menu completo con delivery = 18', () => {
        const pedido = [
            { nombre: 'Ceviche', precio: 8, cantidad: 1, categoria: 'Entradas', modalidad: 'delivery' },
            { nombre: 'Arroz con Pollo', precio: 15, cantidad: 1, categoria: 'Segundos', modalidad: 'delivery' }
        ];
        expect(calcularTotalMesa(pedido)).toBe(18);
    });

    test('entrada sola delivery = 9', () => {
        const pedido = [
            { nombre: 'Ceviche', precio: 8, cantidad: 1, categoria: 'Entradas', modalidad: 'delivery' }
        ];
        expect(calcularTotalMesa(pedido)).toBe(9);
    });

    test('multiples items', () => {
        const pedido = [
            { nombre: 'Arroz con Pollo', precio: 15, cantidad: 2, categoria: 'Segundos', modalidad: 'local' },
            { nombre: 'Inka Cola', precio: 3, cantidad: 2, categoria: 'Bebidas', modalidad: 'local' }
        ];
        expect(calcularTotalMesa(pedido)).toBe(36); // 30 + 6
    });
});

describe('agruparItemsParaVenta', () => {
    test('items simples se agrupan por nombre', () => {
        const items = [
            { nombre: 'Arroz con Pollo', precio: 15, cantidad: 2, categoria: 'Segundos', modalidad: 'local' }
        ];
        const result = agruparItemsParaVenta(items);
        expect(result).toHaveLength(1);
        expect(result[0].cantidad).toBe(2);
    });

    test('entrada + segundo forma menu completo', () => {
        const items = [
            { nombre: 'Ceviche', precio: 8, cantidad: 1, categoria: 'Entradas', modalidad: 'local' },
            { nombre: 'Arroz con Pollo', precio: 15, cantidad: 1, categoria: 'Segundos', modalidad: 'local' }
        ];
        const result = agruparItemsParaVenta(items);
        const menuCompleto = result.find(r => r.nombre.startsWith('MENÚ COMPLETO'));
        expect(menuCompleto).toBeDefined();
        expect(menuCompleto.precio).toBe(15);
    });

    test('domingo: segundo en modo domingo usa Almuerzo:', () => {
        const items = [
            { nombre: 'Arroz con Pollo', precio: 30, cantidad: 1, categoria: 'Segundos', modalidad: 'local', es_modo_domingo: true }
        ];
        const result = agruparItemsParaVenta(items);
        expect(result[0].nombre).toContain('Almuerzo:');
    });
});

describe('fusionarPedidos', () => {
    test('items nuevos se fusionan con existentes', () => {
        const actual = [{ nombre: 'ARROZ CON POLLO', precio: 15, cantidad: 1, modalidad: 'local', categoria: 'SEGUNDOS' }];
        const nuevos = [{ nombre: 'Arroz con Pollo', precio: 15, cantidad: 2, modalidad: 'local', categoria: 'Segundos' }];
        const result = fusionarPedidos(actual, nuevos);
        expect(result).toHaveLength(1);
        expect(result[0].cantidad).toBe(3);
    });

    test('items diferentes no se fusionan', () => {
        const actual = [{ nombre: 'ARROZ CON POLLO', precio: 15, cantidad: 1, modalidad: 'local', categoria: 'SEGUNDOS' }];
        const nuevos = [{ nombre: 'Ceviche', precio: 12, cantidad: 1, modalidad: 'local', categoria: 'Entradas' }];
        const result = fusionarPedidos(actual, nuevos);
        expect(result).toHaveLength(2);
    });

    test('pedido vacio se llena con items nuevos', () => {
        const nuevos = [{ nombre: 'Arroz con Pollo', precio: 15, cantidad: 1, modalidad: 'local', categoria: 'Segundos' }];
        const result = fusionarPedidos([], nuevos);
        expect(result).toHaveLength(1);
    });
});
