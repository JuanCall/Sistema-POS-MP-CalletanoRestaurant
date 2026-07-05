// Almacén centralizado en memoria
const state = {
    modoDomingoGlobal: false,
    estadoRestauranteGlobal: { apertura: 12, cierre: 22, cierreForzado: '' },
    rawMenuDiario: {},
    rawCartaCompleta: {}
};

module.exports = state;