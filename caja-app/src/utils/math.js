export const calcularRecargoVisual = (item) => {
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
        if (nom.includes('(ENTRADA)') || nom.includes('HUMITA') || nom.includes('ARROZ') || nom.includes('CAMOTE') || nom.includes('YUCA')) recargoEnvase += 1;
    }

    return recargoEnvase;
};

// 🟢 CORRECCIÓN: Distribución proporcional para que las filas multipliquen bien
export const obtenerPreciosVisuales = (pedido) => {
    let subtotales = pedido.map(() => 0); 
    let exp = [];
    
    pedido.forEach((item, idx) => {
        const cat = item.categoria ? String(item.categoria).toLowerCase().trim() : '';
        const isDomingo = item.es_modo_domingo !== undefined ? item.es_modo_domingo : false;
        for (let i = 0; i < item.cantidad; i++) exp.push({ idx, item, cat, isDomingo });
    });

    let entries = exp.filter(e => !e.isDomingo && e.cat === 'entradas');
    let mains = exp.filter(e => !e.isDomingo && e.cat === 'segundos');
    let others = exp.filter(e => e.isDomingo || (e.cat !== 'entradas' && e.cat !== 'segundos'));

    while (entries.length > 0 && mains.length > 0) {
        let e = entries.shift(); let s = mains.shift();
        
        let recargoCombo = 0;
        const isCentro = (e.item.modalidad === 'delivery_centro' || s.item.modalidad === 'delivery_centro');
        const isDelivery = (e.item.modalidad === 'delivery' || s.item.modalidad === 'delivery');
        const isLlevar = (e.item.modalidad === 'llevar' || s.item.modalidad === 'llevar');

        if (isCentro) recargoCombo = 5;
        else if (isDelivery) recargoCombo = 3;
        else if (isLlevar) {
            if (e.item.modalidad === 'llevar' && s.item.modalidad === 'llevar') recargoCombo = 2;
            else {
                [e.item, s.item].forEach(item => {
                    if (item.modalidad === 'llevar') {
                        let envaseItem = 0;
                        if (item.taper && item.taper.length > 0) {
                            const tArr = (Array.isArray(item.taper) ? item.taper : [item.taper]).map(t => String(t).toLowerCase().trim());
                            if (tArr.includes('mediano') || tArr.includes('grande')) envaseItem = 2;
                            else if (tArr.includes('chico') || tArr.includes('sopa')) envaseItem = 1;
                        } else if (item.costo_taper) envaseItem = Number(item.costo_taper);
                        else {
                            const catVal = String(item.categoria || '').toLowerCase().trim();
                            envaseItem = (catVal === 'entradas') ? 1 : 2;
                        }
                        recargoCombo += envaseItem;
                    }
                });
            }
        }
        
        // 🟢 Asignamos el precio base a la entrada y la diferencia al segundo
        let precioComboTotal = 15 + recargoCombo;
        let precioEntradaBase = e.item.precio + calcularRecargoVisual(e.item);
        let precioSegundoAjustado = precioComboTotal - precioEntradaBase;

        subtotales[e.idx] += precioEntradaBase;
        subtotales[s.idx] += precioSegundoAjustado;
    }

    entries.forEach(e => {
        if (e.item.modalidad === 'delivery' || e.item.modalidad === 'delivery_centro') subtotales[e.idx] += 9;
        else subtotales[e.idx] += (e.item.precio + calcularRecargoVisual(e.item));
    });

    [...mains, ...others].forEach(x => { subtotales[x.idx] += (x.item.precio + calcularRecargoVisual(x.item)); });

    return subtotales;
};
export const agruparParaTickets = (pedido) => {
    let finalItems = [];
    const getModTag = (mod) => {
      if (mod === 'delivery_centro') return 'Centro';
      if (mod === 'delivery') return 'Delivery';
      if (mod === 'llevar') return 'Llevar';
      return null;
    };

    // 🟢 FIX: Agrupar items por fecha_agregado para evitar emparejar entradas/segundos de diferentes días
    const itemsByDate = {};
    pedido.forEach(item => {
        if (item.isMenuDrink) return;
        const date = item.fecha_agregado || 'unknown';
        if (!itemsByDate[date]) itemsByDate[date] = [];
        const cat = item.categoria ? item.categoria.toLowerCase().trim() : '';
        const recargoAislado = calcularRecargoVisual(item);
        const subtotalUnitario = (parseFloat(item.precio) || 0) + recargoAislado;
        const itemClon = { ...item, cantidad: 1, subtotal: subtotalUnitario, cat, isDomingo: item.es_modo_domingo !== undefined ? item.es_modo_domingo : false };

        for(let i=0; i<item.cantidad; i++) {
            itemsByDate[date].push({...itemClon});
        }
    });

    // Procesar cada grupo de fecha por separado
    Object.keys(itemsByDate).forEach(date => {
        const items = itemsByDate[date];
        let entries = [];
        let mains = [];
        let others = [];

        items.forEach(item => {
            if (!item.isDomingo && item.cat === 'entradas') entries.push(item);
            else if (!item.isDomingo && item.cat === 'segundos') mains.push(item);
            else others.push(item);
        });

        let combosTemp = [];
        while (entries.length > 0 && mains.length > 0) {
          let e = entries.shift(); let s = mains.shift(); let label = "MENÚ COMPLETO";
          const tagE = getModTag(e.modalidad); const tagS = getModTag(s.modalidad);

          if (tagE && tagS) label += (e.modalidad === s.modalidad) ? ` (${tagE})` : ` (E/${tagE} S/${tagS})`;
          else if (tagE) label += ` (E/${tagE})`;
          else if (tagS) label += ` (S/${tagS})`;

          let recargoCombo = 0;
          let tapersAgrupados = [];
          const isCentro = (e.modalidad === 'delivery_centro' || s.modalidad === 'delivery_centro');
          const isDelivery = (e.modalidad === 'delivery' || s.modalidad === 'delivery');
          const isLlevar = (e.modalidad === 'llevar' || s.modalidad === 'llevar');

          if (isCentro) {
              recargoCombo = 5; 
          } else if (isDelivery) {
              recargoCombo = 3; 
          } else if (isLlevar) {
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

          combosTemp.push({
            nombre: label, precio: 15 + recargoCombo, cantidad: 1, subtotal: 15 + recargoCombo,
            modalidad: isCentro ? 'delivery_centro' : (isDelivery ? 'delivery' : (isLlevar ? 'llevar' : 'local')),
            categoria: 'combo',
            fecha_agregado: date
          });
        }

        entries.forEach(e => {
            if (e.modalidad === 'delivery' || e.modalidad === 'delivery_centro') { e.precio = 9; e.subtotal = 9; }
        });

        [...combosTemp, ...entries, ...mains, ...others].forEach(it => {
          // 🟢 FIX: Incluir fecha_agregado en la agrupación para no fusionar items de diferentes días
          let idx = finalItems.findIndex(f => 
            f.nombre === it.nombre && 
            f.categoria === it.categoria && 
            f.modalidad === it.modalidad &&
            f.fecha_agregado === it.fecha_agregado
          );
          if (idx > -1) { finalItems[idx].cantidad += 1; finalItems[idx].subtotal += it.subtotal; } 
          else { finalItems.push(it); }
        });
    });

    return finalItems;
};

export const agruparParaComandera = (pedido) => {
    let visualItems = [];

    // 🟢 FIX: Agrupar items por fecha_agregado para evitar emparejar entradas/segundos de diferentes días
    const itemsByDate = {};
    pedido.forEach(item => {
        const date = item.fecha_agregado || 'unknown';
        if (!itemsByDate[date]) itemsByDate[date] = [];
        const cat = item.categoria ? String(item.categoria).toLowerCase().trim() : '';
        const isDomingo = item.es_modo_domingo !== undefined ? item.es_modo_domingo : false;
        for(let i=0; i<item.cantidad; i++) {
            itemsByDate[date].push({...item, categoria: cat, isDomingo, cantidad: 1});
        }
    });

    // Procesar cada grupo de fecha por separado
    Object.keys(itemsByDate).forEach(date => {
        const items = itemsByDate[date];
        let expE = [];
        let expS = [];
        let others = [];

        items.forEach(item => {
            if (!item.isDomingo && (item.categoria === 'entradas' || item.categoria === 'entrada')) expE.push(item);
            else if (!item.isDomingo && (item.categoria === 'segundos' || item.categoria === 'segundo')) expS.push(item);
            else others.push(item);
        });

        // Emparejar entradas con segundos de la misma fecha
        while(expE.length > 0 && expS.length > 0) {
            let e = expE.shift(); let s = expS.shift();
            
            let recargoCombo = 0;
            const isCentro = (e.modalidad === 'delivery_centro' || s.modalidad === 'delivery_centro');
            const isDelivery = (e.modalidad === 'delivery' || s.modalidad === 'delivery');
            const isLlevar = (e.modalidad === 'llevar' || s.modalidad === 'llevar');

            if (isCentro) recargoCombo = 5;
            else if (isDelivery) recargoCombo = 3;
            else if (isLlevar) {
                if (e.modalidad === 'llevar' && s.modalidad === 'llevar') recargoCombo = 2;
                else {
                    [e, s].forEach(item => {
                        if (item.modalidad === 'llevar') {
                            let envaseItem = 0;
                            if (item.taper && item.taper.length > 0) {
                                const tArr = (Array.isArray(item.taper) ? item.taper : [item.taper]).map(t => String(t).toLowerCase().trim());
                                if (tArr.includes('mediano') || tArr.includes('grande')) envaseItem = 2;
                                else if (tArr.includes('chico') || tArr.includes('sopa')) envaseItem = 1;
                            } else if (item.costo_taper) envaseItem = Number(item.costo_taper);
                            else {
                                const catVal = String(item.categoria || '').toLowerCase().trim();
                                envaseItem = (catVal === 'entradas') ? 1 : 2;
                            }
                            recargoCombo += envaseItem;
                        }
                    });
                }
            }

            let modalidadCombo = isCentro ? 'delivery_centro' : (isDelivery ? 'delivery' : (isLlevar ? 'llevar' : 'local'));
            let notaCombo = [e.nota, s.nota].filter(Boolean).join(' | ');

            // Solo se agrupan si ya se enviaron a cocina
            if (e.impreso && s.impreso) {
                visualItems.push({
                    isCombo: true, nombre: 'MENÚ COMPLETO', detalle: ``, 
                    modalidad: modalidadCombo, subtotal: 15 + recargoCombo, cantidad: 1,
                    nota: notaCombo, cliente: e.cliente || s.cliente || null,
                    taper: [...(e.taper||[]), ...(s.taper||[])], 
                    refs: [{ refE: e, refS: s }], impreso: true
                });
            } else {
                let subE = (e.modalidad === 'delivery' || e.modalidad === 'delivery_centro') ? 9 : ((parseFloat(e.precio) || 0) + calcularRecargoVisual(e));
                let subS = (15 + recargoCombo) - subE;

                visualItems.push({ isCombo: false, nombre: e.nombre, detalle: '(Sin enviar)', modalidad: e.modalidad, subtotal: subE, cantidad: 1, nota: e.nota || '', cliente: e.cliente || null, taper: e.taper || [], refs: [{ refItem: e }], impreso: e.impreso });
                visualItems.push({ isCombo: false, nombre: s.nombre, detalle: '(Sin enviar)', modalidad: s.modalidad, subtotal: subS, cantidad: 1, nota: s.nota || '', cliente: s.cliente || null, taper: s.taper || [], refs: [{ refItem: s }], impreso: s.impreso });
            }
        }

        // Items individuales restantes de esta fecha
        expE.forEach(e => {
            let sub = (e.modalidad === 'delivery' || e.modalidad === 'delivery_centro') ? 9 : ((parseFloat(e.precio) || 0) + calcularRecargoVisual(e));
            visualItems.push({ isCombo: false, nombre: e.nombre, detalle: '', modalidad: e.modalidad, subtotal: sub, cantidad: 1, nota: e.nota || '', cliente: e.cliente || null, taper: e.taper || [], refs: [{ refItem: e }], impreso: e.impreso });
        });

        [...expS, ...others].forEach(x => {
            visualItems.push({ isCombo: false, nombre: x.nombre, detalle: '', modalidad: x.modalidad, subtotal: (parseFloat(x.precio) || 0) + calcularRecargoVisual(x), cantidad: 1, nota: x.nota || '', cliente: x.cliente || null, taper: x.taper || [], refs: [{ refItem: x }], impreso: x.impreso });
        });
    });

    // 🟢 FIX: Agrupar considerando también la fecha_agregado para no fusionar items de diferentes días
    let grouped = [];
    visualItems.forEach(vi => {
        const itemDate = vi.isCombo ? vi.refs[0].refE.fecha_agregado : vi.refs[0].refItem.fecha_agregado;
        
        if (vi.isCombo) {
            let match = grouped.find(g => 
                g.isCombo && 
                g.modalidad === vi.modalidad && 
                g.impreso === vi.impreso && 
                g.nota === vi.nota &&
                g.refs[0].refE.fecha_agregado === itemDate
            );
            if (match) { match.cantidad += 1; match.subtotal += vi.subtotal; match.refs.push(vi.refs[0]); } 
            else { grouped.push(vi); }
        } else {
            let match = grouped.find(g => 
                !g.isCombo && 
                g.nombre === vi.nombre && 
                g.modalidad === vi.modalidad && 
                g.nota === vi.nota && 
                g.impreso === vi.impreso &&
                g.refs[0].refItem.fecha_agregado === itemDate
            );
            if (match) { match.cantidad += 1; match.subtotal += vi.subtotal; match.refs.push(vi.refs[0]); } 
            else { grouped.push(vi); }
        }
    });

    return grouped;
};