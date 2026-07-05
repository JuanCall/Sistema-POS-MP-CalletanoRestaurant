/**
 * Tests para store/globalState.js
 *
 * Almacén centralizado en memoria: modoDomingoGlobal,
 * estadoRestauranteGlobal, rawMenuDiario, rawCartaCompleta.
 */

const state = require('../store/globalState');

describe('globalState', () => {
    test('modoDomingoGlobal inicia como false', () => {
        expect(state.modoDomingoGlobal).toBe(false);
    });

    test('estadoRestauranteGlobal tiene valores por defecto', () => {
        expect(state.estadoRestauranteGlobal).toEqual({
            apertura: 12,
            cierre: 22,
            cierreForzado: '',
        });
    });

    test('rawMenuDiario inicia como objeto vacío', () => {
        expect(state.rawMenuDiario).toEqual({});
    });

    test('rawCartaCompleta inicia como objeto vacío', () => {
        expect(state.rawCartaCompleta).toEqual({});
    });

    test('permite modificar modoDomingoGlobal', () => {
        state.modoDomingoGlobal = true;
        expect(state.modoDomingoGlobal).toBe(true);
        // Restaurar para no afectar otros tests
        state.modoDomingoGlobal = false;
    });

    test('permite modificar estadoRestauranteGlobal', () => {
        const original = { ...state.estadoRestauranteGlobal };
        state.estadoRestauranteGlobal.apertura = 10;
        expect(state.estadoRestauranteGlobal.apertura).toBe(10);
        state.estadoRestauranteGlobal = original;
    });

    test('permite asignar rawMenuDiario con datos', () => {
        state.rawMenuDiario = {
            entradas: [{ nombre: 'Ceviche', stock: 10, precio: 8 }],
            segundos: [],
        };
        expect(state.rawMenuDiario.entradas).toHaveLength(1);
        expect(state.rawMenuDiario.entradas[0].nombre).toBe('Ceviche');
        state.rawMenuDiario = {};
    });

    test('permite asignar rawCartaCompleta con datos', () => {
        state.rawCartaCompleta = {
            categorias: [{ nombre: 'Entradas', items: [] }],
        };
        expect(state.rawCartaCompleta.categorias).toHaveLength(1);
        expect(state.rawCartaCompleta.categorias[0].nombre).toBe('Entradas');
        state.rawCartaCompleta = {};
    });

    test('el objeto es un singleton (misma referencia siempre)', () => {
        const state2 = require('../store/globalState');
        expect(state2).toBe(state);
        expect(state2.estadoRestauranteGlobal).toBe(state.estadoRestauranteGlobal);
    });
});
