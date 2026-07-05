const { normalizar } = require('./helpers');

function calcularRecargoTaper(item) {
    // 🟢 FIX: Las bebidas incluidas con el almuerzo (modo domingo) tienen costo 0 en cualquier modalidad
    if (item.isMenuDrink) return 0;
    if (!item.modalidad || item.modalidad === 'local') return 0;
    const cat = item.categoria ? String(item.categoria).toUpperCase().trim() : ''; 
    const nom = item.nombre ? String(item.nombre).toUpperCase().trim() : '';
    
    // 🟢 Los refrescos/bebidas adicionales siempre van a precio local sin recargo extra
    if (['JUGOS NATURALES', 'BEBIDAS HELADAS', 'BEBIDAS CALIENTES', 'CERVEZA', 'BEBIDAS'].includes(cat) || nom.includes('REFRESCO')) return 0; 

    // 🟢 Delivery y delivery_centro tienen tarifa plana (3 y 5 soles respectivamente)
    // Los tapers se descuentan del inventario pero no afectan el precio directo
    if (item.modalidad === 'delivery') return 3;
    if (item.modalidad === 'delivery_centro') return 5;

    // Para llevar: calcular costo de taper/envase
    let recargoEnvase = Number(item.costo_taper) || 0;
    if (!item.costo_taper && item.taper && item.taper.length > 0) {
        const tArr = (Array.isArray(item.taper) ? item.taper : [item.taper]).map(t => String(t).toLowerCase().trim());
        if (tArr.includes('mediano') || tArr.includes('grande')) recargoEnvase += 2;
        else if (tArr.includes('chico') || tArr.includes('sopa')) recargoEnvase += 1;
    } else if (!item.costo_taper && (!item.taper || item.taper.length === 0)) {
        if (nom.includes('(ENTRADA)')) recargoEnvase += 1;
    }
    
    return recargoEnvase; 
}

function agruparItemsParaVenta(pedido) {
    let finalItems = []; let entries = []; let mains = []; let others = [];
    
    pedido.forEach(item => {
        const cat = item.categoria ? item.categoria.toLowerCase().trim() : '';
        // 🟢 Usar flag per-item si existe, sino el global
        const isDomingo = item.es_modo_domingo !== undefined ? item.es_modo_domingo : false;
        const recargoAislado = calcularRecargoTaper(item);
        const subtotalUnitario = (parseFloat(item.precio) || 0) + recargoAislado;
        const itemClon = { ...item, cantidad: 1, subtotal: subtotalUnitario };
        
        if (!isDomingo && cat === 'entradas') { for(let i=0; i<item.cantidad; i++) entries.push({...itemClon}); }
        else if (!isDomingo && cat === 'segundos') { for(let i=0; i<item.cantidad; i++) mains.push({...itemClon}); }
        else { 
            if (isDomingo && cat === 'segundos' && !item.nombre.toUpperCase().startsWith('ALMUERZO:')) itemClon.nombre = `Almuerzo: ${itemClon.nombre}`;
            for(let i=0; i<item.cantidad; i++) others.push({...itemClon});
        }
    });

    let combosTemp = [];
    while (entries.length > 0 && mains.length > 0) {
        let e = entries.shift(); let s = mains.shift(); let label = "MENÚ COMPLETO";
        const getModTag = (mod) => {
            if (mod === 'delivery_centro') return 'Centro';
            if (mod === 'delivery') return 'Delivery';
            if (mod === 'llevar') return 'Llevar';
            return null; 
        };
        const tagE = getModTag(e.modalidad); const tagS = getModTag(s.modalidad);
        
        if (tagE && tagS) label += (e.modalidad === s.modalidad) ? ` (${tagE})` : ` (E/${tagE} S/${tagS})`;
        else if (tagE) label += ` (E/${tagE})`; 
        else if (tagS) label += ` (S/${tagS})`; 
        
        let recargoCombo = 0;
        let tapersAgrupados = [];

        const isCentro = (e.modalidad === 'delivery_centro' || s.modalidad === 'delivery_centro');
        const isDelivery = (e.modalidad === 'delivery' || s.modalidad === 'delivery');
        const isLlevar = (e.modalidad === 'llevar' || s.modalidad === 'llevar');

        if (isCentro) { recargoCombo = 5; } 
        else if (isDelivery) { recargoCombo = 3; } 
        else if (isLlevar) {
            if (e.modalidad === 'llevar' && s.modalidad === 'llevar') {
                recargoCombo = 2; 
            } else {
                [e, s].forEach(item => {
                    if (item.modalidad === 'llevar') {
                        let envaseItem = 0;
                        if (item.taper && item.taper.length > 0) {
                            const tArr = (Array.isArray(item.taper) ? item.taper : [item.taper]).map(t => String(t).toLowerCase().trim());
                            if (tArr.includes('mediano') || tArr.includes('grande')) envaseItem = 2;
                            else if (tArr.includes('chico') || tArr.includes('sopa')) envaseItem = 1;
                        } else if (item.costo_taper) {
                            envaseItem = Number(item.costo_taper);
                        } else {
                            const catVal = String(item.categoria || '').toLowerCase().trim();
                            envaseItem = (catVal === 'entradas') ? 1 : 2;
                        }
                        recargoCombo += envaseItem;
                    }
                });
            }
        }

        [e, s].forEach(item => {
            if (item.modalidad !== 'local' && item.taper) {
                const tArr = Array.isArray(item.taper) ? item.taper : [item.taper];
                tArr.forEach(t => tapersAgrupados.push(t));
            }
        });

        combosTemp.push({ nombre: label, precio: 15 + recargoCombo, cantidad: 1, subtotal: 15 + recargoCombo, modalidad: isCentro ? 'delivery_centro' : (isDelivery ? 'delivery' : (isLlevar ? 'llevar' : 'local')), taper: tapersAgrupados, categoria: 'combo' });
    }

    // 🟢 REGLA DE NEGOCIO: Entradas solas para Delivery a 9 soles fijos (SUNAT)
    entries.forEach(e => {
        if (e.modalidad === 'delivery' || e.modalidad === 'delivery_centro') {
            e.precio = 9;
            e.subtotal = 9;
        }
    });

    [...combosTemp, ...entries, ...mains, ...others].forEach(it => {
        let idx = finalItems.findIndex(f => f.nombre === it.nombre && normalizar(f.categoria || '') === normalizar(it.categoria || '') && f.modalidad === it.modalidad);
        if (idx > -1) { finalItems[idx].cantidad += 1; finalItems[idx].subtotal += it.subtotal; } 
        else { finalItems.push({...it}); }
    });
    return finalItems;
}

function calcularTotalMesa(pedido) {
    let total = 0; let expE = []; let expS = []; let otros = [];
    pedido.forEach(item => {
        const catExacta = item.categoria ? String(item.categoria).toLowerCase().trim() : ''; 
        // 🟢 Usar flag per-item si existe, sino el global
        const isDomingo = item.es_modo_domingo !== undefined ? item.es_modo_domingo : false;
        if (!isDomingo && (catExacta === 'entradas' || catExacta === 'entrada')) { for(let i=0; i<item.cantidad; i++) expE.push({...item, cantidad: 1}); } 
        else if (!isDomingo && (catExacta === 'segundos' || catExacta === 'segundo')) { for(let i=0; i<item.cantidad; i++) expS.push({...item, cantidad: 1}); } 
        else { for(let i=0; i<item.cantidad; i++) otros.push({...item, cantidad: 1}); }
    });

    while (expE.length > 0 && expS.length > 0) {
        let e = expE.shift(); let s = expS.shift(); let recargoCombo = 0;
        const isCentro = (e.modalidad === 'delivery_centro' || s.modalidad === 'delivery_centro');
        const isDelivery = (e.modalidad === 'delivery' || s.modalidad === 'delivery');
        const isLlevar = (e.modalidad === 'llevar' || s.modalidad === 'llevar');

        if (isCentro) { recargoCombo = 5; } 
        else if (isDelivery) { recargoCombo = 3; } 
        else if (isLlevar) {
            if (e.modalidad === 'llevar' && s.modalidad === 'llevar') {
                recargoCombo = 2; 
            } else {
                [e, s].forEach(item => {
                    if (item.modalidad === 'llevar') {
                        let envaseItem = 0;
                        if (item.taper && item.taper.length > 0) {
                            const tArr = (Array.isArray(item.taper) ? item.taper : [item.taper]).map(t => String(t).toLowerCase().trim());
                            if (tArr.includes('mediano') || tArr.includes('grande')) envaseItem = 2;
                            else if (tArr.includes('chico') || tArr.includes('sopa')) envaseItem = 1;
                        } else if (item.costo_taper) {
                            envaseItem = Number(item.costo_taper);
                        } else {
                            const catVal = String(item.categoria || '').toLowerCase().trim();
                            envaseItem = (catVal === 'entradas') ? 1 : 2;
                        }
                        recargoCombo += envaseItem;
                    }
                });
            }
        }
        total += (15 + recargoCombo);
    }

    // 🟢 REGLA DE NEGOCIO: Entradas solas para Delivery a 9 soles fijos en el Total
    expE.forEach(e => {
        if (e.modalidad === 'delivery' || e.modalidad === 'delivery_centro') {
            total += 9;
        } else {
            total += ((parseFloat(e.precio) || 0) + calcularRecargoTaper(e));
        }
    });

    [...expS, ...otros].forEach(item => { total += ((parseFloat(item.precio) || 0) + calcularRecargoTaper(item)); });
    return total;
}

function fusionarPedidos(pedidoActual, itemsNuevos) {
    let fusionado = [...pedidoActual];
    itemsNuevos.forEach(nuevo => {
        const nomNormalizado = normalizar(nuevo.nombre);
        const catNormalizado = normalizar(nuevo.categoria || 'GENERAL');
        const modalidad = nuevo.modalidad || 'local';
        const notaStr = normalizar(nuevo.nota || '');
        const taperStr = JSON.stringify(nuevo.taper || []);

        let idx = fusionado.findIndex(i => 
            normalizar(i.nombre) === nomNormalizado && 
            normalizar(i.categoria || 'GENERAL') === catNormalizado && 
            (i.modalidad || 'local') === modalidad && 
            normalizar(i.nota || '') === notaStr && 
            JSON.stringify(i.taper || []) === taperStr &&
            (i.fecha_agregado === nuevo.fecha_agregado) 
        );
        
        if (idx > -1) fusionado[idx].cantidad += nuevo.cantidad;
        else fusionado.push({ 
            nombre: nomNormalizado, precio: parseFloat(nuevo.precio) || 0, cantidad: nuevo.cantidad, 
            modalidad: modalidad, categoria: nuevo.categoria || 'GENERAL', nota: notaStr, impreso: nuevo.impreso || false, 
            cliente: nuevo.cliente || null, taper: nuevo.taper || [], costo_taper: nuevo.costo_taper || 0,
            fecha_agregado: nuevo.fecha_agregado || new Date().toISOString().split('T')[0],
            isMenuDrink: nuevo.isMenuDrink || false
        });
    });
    fusionado.forEach(item => { item.subtotal = item.cantidad * ((item.precio || 0) + calcularRecargoTaper(item)); });
    return fusionado;
}

module.exports = { calcularRecargoTaper, agruparItemsParaVenta, calcularTotalMesa, fusionarPedidos };