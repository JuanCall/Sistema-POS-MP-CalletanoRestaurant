const db = require('../database');
const { firestore } = require('../config/firebase');
const state = require('../store/globalState');
const { normalizar } = require('../utils/helpers');

// 🟢 FUNCIÓN INTERNA: Actualiza la receta en Firebase
function actualizarRecetaEnCartaFirebase(nombrePlatoDB, listaReceta) {
    if (state.rawCartaCompleta && state.rawCartaCompleta.categorias) {
        const nombreLimpio = normalizar(nombrePlatoDB).replace(' (PERSONAL)', '').replace(' (VASO)', '');
        state.rawCartaCompleta.categorias.forEach(cat => {
            if (cat.items) {
                cat.items.forEach(it => {
                    if (normalizar(it.nombre) === nombreLimpio) {
                        it.receta = listaReceta;
                    }
                });
            }
        });
        firestore.collection('contenido').doc('cartaCompleta').set(state.rawCartaCompleta).catch(err => console.error("Error subiendo carta:", err));
    }
}

const getMesas = (req, res) => {
    res.json(db.prepare('SELECT * FROM mesas_activas').all().map(m => ({ ...m, pedido: JSON.parse(m.pedido) })));
};

const getCarta = (req, res) => {
    try {
        const insumosDisponibles = {};
        const insumosNombres = {};
        db.prepare('SELECT id, stock_actual, nombre FROM insumos').all().forEach(i => {
            insumosDisponibles[i.id] = i.stock_actual;
            insumosNombres[i.id] = i.nombre;
        });

        const cartaDirecta = db.prepare('SELECT * FROM categorias').all().map(cat => ({ 
            nombre: cat.nombre, 
            items: db.prepare('SELECT * FROM platos WHERE categoria_id = ?').all(cat.id).map(plato => {
                let costo_taper = 0;
                let tapersAsignados = [];
                
                const catNom = normalizar(cat.nombre);
                if ((catNom === 'ENTRADAS' || catNom === 'ENTRADA') && state.rawMenuDiario.entradas) {
                    const found = state.rawMenuDiario.entradas.find(e => normalizar(e.nombre) === normalizar(plato.nombre));
                    if (found && found.taper) tapersAsignados = Array.isArray(found.taper) ? found.taper : [found.taper];
                } else if ((catNom === 'SEGUNDOS' || catNom === 'SEGUNDO') && state.rawMenuDiario.segundos) {
                    const found = state.rawMenuDiario.segundos.find(s => normalizar(s.nombre) === normalizar(plato.nombre));
                    if (found && found.taper) tapersAsignados = Array.isArray(found.taper) ? found.taper : [found.taper];
                }

                // 🟢 FIX: Calcular taper y costo_taper SIEMPRE para ítems del menú,
                // independientemente de si tienen stock_diario configurado o no.
                // Antes esto estaba dentro del bloque `if (plato.stock_diario !== null)`,
                // lo que causaba que items sin stock (stock_diario = null) no tuvieran
                // el recargo de envase/descartable al cambiar a modalidad 'llevar'.
                if ((catNom === 'ENTRADAS' || catNom === 'ENTRADA' || catNom === 'SEGUNDOS' || catNom === 'SEGUNDO') && tapersAsignados.length > 0) {
                    plato.taper = tapersAsignados;
                    tapersAsignados.forEach(t => {
                        if (t === 'chico' || t === 'sopa') costo_taper += 1;
                        if (t === 'mediano' || t === 'grande') costo_taper += 2;
                    });
                }

                if (plato.stock_diario !== null) {
                    plato.stock_actual = plato.stock_diario;
                } else if (plato.receta_json) {
                    const receta = JSON.parse(plato.receta_json);
                    if (receta.length > 0) {
                        let maxPortions = Infinity;
                        let hasNonTaper = false;
                        receta.forEach(r => {
                            const stock = insumosDisponibles[r.insumo_id] || 0;
                            const nomInsumo = normalizar(insumosNombres[r.insumo_id] || '');
                            
                            if (nomInsumo.includes('TAPER') || nomInsumo.includes('ENVASE')) {
                                if (nomInsumo.includes('CHICO') || nomInsumo.includes('SOPA')) costo_taper += (1 * r.cantidad_requerida);
                                if (nomInsumo.includes('MEDIANO') || nomInsumo.includes('GRANDE')) costo_taper += (2 * r.cantidad_requerida);
                            } else {
                                hasNonTaper = true;
                                const posibles = Math.floor(stock / r.cantidad_requerida);
                                if (posibles < maxPortions) maxPortions = posibles;
                            }
                        });
                        plato.stock_actual = hasNonTaper ? (maxPortions === Infinity ? 0 : maxPortions) : null;
                    } else { plato.stock_actual = null; }
                } else { plato.stock_actual = null; }
                
                plato.costo_taper = costo_taper;
                return plato;
            })
        }));
        res.json(cartaDirecta);
    } catch (e) { res.error(e.message); }
};

const getDataCruda = (req, res) => {
    try {
        let cartaConIds = JSON.parse(JSON.stringify(state.rawCartaCompleta));
        if (cartaConIds.categorias) {
            cartaConIds.categorias.forEach(cat => {
                const esJugo = cat.nombre.toLowerCase().includes('jugo') || cat.nombre.toLowerCase().includes('bebida');
                if (cat.items) {
                    cat.items.forEach(it => {
                        const nomNormalizado = normalizar(it.nombre);
                        let sufijo = '';
                        if (parseFloat(it.precio2) > 0) sufijo = esJugo ? ' (VASO)' : ' (PERSONAL)';
                        const row = db.prepare('SELECT id FROM platos WHERE UPPER(nombre) = ?').get(nomNormalizado + sufijo);
                        if (row) it.id = row.id;
                    });
                }
            });
        }
        res.json({ menuDiario: state.rawMenuDiario, cartaCompleta: cartaConIds, estado: state.estadoRestauranteGlobal });
    } catch (e) { res.json({ menuDiario: state.rawMenuDiario, cartaCompleta: state.rawCartaCompleta, estado: state.estadoRestauranteGlobal }); }
};

const getReceta = (req, res) => {
    try {
        const plato = db.prepare('SELECT receta_json FROM platos WHERE id = ?').get(req.params.id);
        if (!plato || !plato.receta_json) return res.json([]);
        const lista = JSON.parse(plato.receta_json);
        const resultado = lista.map(item => {
            const insumo = db.prepare('SELECT nombre, unidad_medida FROM insumos WHERE id = ?').get(item.insumo_id);
            return {
                id: `${req.params.id}-${item.insumo_id}`,
                insumo_id: item.insumo_id, nombre: insumo ? insumo.nombre : 'Insumo Desconocido',
                cantidad_requerida: item.cantidad_requerida, text_unidad: insumo ? insumo.unidad_medida : 'g', unidad_medida: insumo ? insumo.unidad_medida : 'g'
            };
        });
        res.json(resultado);
    } catch (e) { res.error(e.message); }
};

const agregarInsumoReceta = async (req, res) => {
    try {
        const platoId = req.params.id;
        const { insumo_id, cantidad_requerida } = req.body;
        const plato = db.prepare('SELECT nombre, receta_json FROM platos WHERE id = ?').get(platoId);
        if (!plato) return res.error('Plato no encontrado', 404);

        let lista = plato.receta_json ? JSON.parse(plato.receta_json) : [];
        lista = lista.filter(r => r.insumo_id !== Number(insumo_id));
        lista.push({ insumo_id: Number(insumo_id), cantidad_requerida: parseFloat(cantidad_requerida) });

        db.prepare('UPDATE platos SET receta_json = ? WHERE id = ?').run(JSON.stringify(lista), platoId);
        actualizarRecetaEnCartaFirebase(plato.nombre, lista);
        res.json({ success: true });
    } catch (e) { res.error(e.message); }
};

const eliminarInsumoReceta = async (req, res) => {
    try {
        const [platoId, insumoId] = req.params.id.split('-');
        if (!platoId || !insumoId) return res.error('Identificador compuesto inválido', 400);
        const plato = db.prepare('SELECT nombre, receta_json FROM platos WHERE id = ?').get(platoId);
        if (!plato) return res.error('Plato no encontrado', 404);

        let lista = plato.receta_json ? JSON.parse(plato.receta_json) : [];
        lista = lista.filter(r => r.insumo_id !== Number(insumoId));
        db.prepare('UPDATE platos SET receta_json = ? WHERE id = ?').run(lista.length > 0 ? JSON.stringify(lista) : null, platoId);

        actualizarRecetaEnCartaFirebase(plato.nombre, lista);
        res.json({ success: true });
    } catch (e) { res.error(e.message); }
};

module.exports = { getMesas, getCarta, getDataCruda, getReceta, agregarInsumoReceta, eliminarInsumoReceta };