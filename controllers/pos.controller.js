const db = require('../database');
const { firestore, admin } = require('../config/firebase');
const state = require('../store/globalState');
const { normalizar, pad2, pad4, pad6, generarLeyenda } = require('../utils/helpers');
const { calcularRecargoTaper, agruparItemsParaVenta, calcularTotalMesa, fusionarPedidos } = require('../utils/math');
const { sincronizarHaciaArriba } = require('../services/sync.service');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- FUNCIONES INTERNAS DEL POS ---

function actualizarStockMenuFirebase(nombrePlatoDB, cantidadCambio, categoria) {
    let modificado = false;
    const nomNormalizado = normalizar(nombrePlatoDB);
    const cat = normalizar(categoria);

    if ((cat === 'ENTRADAS' || cat === 'ENTRADA') && state.rawMenuDiario.entradas) {
        state.rawMenuDiario.entradas.forEach(e => {
            if (normalizar(e.nombre) === nomNormalizado && e.stock !== null && e.stock !== undefined && e.stock !== '') {
                e.stock = Math.max(0, (parseFloat(e.stock) || 0) + cantidadCambio);
                modificado = true;
            }
        });
    }
    if ((cat === 'SEGUNDOS' || cat === 'SEGUNDO') && state.rawMenuDiario.segundos) {
        state.rawMenuDiario.segundos.forEach(s => {
            if (normalizar(s.nombre) === nomNormalizado && s.stock !== null && s.stock !== undefined && s.stock !== '') {
                s.stock = Math.max(0, (parseFloat(s.stock) || 0) + cantidadCambio);
                modificado = true;
            }
        });
    }
    if (modificado) firestore.collection('contenido').doc('menuDiario').set(state.rawMenuDiario).catch(()=>{});
}

function registrarMovimientoInventario(insumoNombre, cantidad, tipo, referencia) {
    try {
        const nomNorm = normalizar(insumoNombre);
        const insumo = db.prepare('SELECT id, stock_actual, nombre FROM insumos WHERE UPPER(nombre) = ?').get(nomNorm);
        if (insumo) {
            // 🟢 FIX: No permitir stock negativo
            const nuevoStock = Math.max(0, insumo.stock_actual + cantidad);
            db.prepare('UPDATE insumos SET stock_actual = ?, sincronizado = 0 WHERE id = ?').run(nuevoStock, insumo.id);
            const info = db.prepare(`INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, referencia) VALUES (?, ?, ?, ?)`).run(insumo.id, tipo, cantidad, referencia);
            
            const firestoreInsumoId = `INS-${pad4(insumo.id)}`;
            const d = new Date();
            const yyyymmdd = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
            const firestoreMovId = `MOV-${pad6(info.lastInsertRowid)}-${yyyymmdd}-${firestoreInsumoId}`;

            firestore.collection('insumos').doc(firestoreInsumoId).set({ stock_actual: nuevoStock }, { merge: true }).catch(()=>{});
            firestore.collection('movimientos_inventario').doc(firestoreMovId).set({
                insumo_id: firestoreInsumoId, tipo, cantidad, referencia, fecha: admin.firestore.FieldValue.serverTimestamp()
            }).catch(()=>{});
        }
    } catch(e) { console.error("Error en inventario:", e.message); }
}

function calcularUsoInventario(pedido) {
    let uso = {}; 
    pedido.forEach(item => {
        const nom = normalizar(item.nombre);
        const cat = normalizar(item.categoria);
        const qty = item.cantidad;
        
        // 🟢 NUEVO: Descontar bebidas directamente por nombre si el Mozo las elige en almuerzos
        if (nom === 'INKA COLA 296ML') uso['INKA COLA 296ML'] = (uso['INKA COLA 296ML'] || 0) + qty;
        if (nom === 'COCA COLA 296ML') uso['COCA COLA 296ML'] = (uso['COCA COLA 296ML'] || 0) + qty;
        // 🟢 REFRESCO DEL DÍA NO se descuenta del inventario (es preparado en el día)
        
        if (nom.startsWith('TAPER ')) { uso[nom] = (uso[nom] || 0) + qty; return; }

        if (item.modalidad !== 'local' && item.taper) {
            const tapers = Array.isArray(item.taper) ? item.taper : [item.taper];
            tapers.forEach(t => { if (t && String(t).trim() !== '') uso[`TAPER ${normalizar(t)}`] = (uso[`TAPER ${normalizar(t)}`] || 0) + qty; });
        }

        const esFuente = nom.includes('(FUENTE)') || nom.includes('(JARRA)');
        let nombreBase = nom;
        if (nom.includes(' (FUENTE)')) nombreBase = nom.replace(' (FUENTE)', ' (PERSONAL)');
        if (nom.includes(' (JARRA)')) nombreBase = nom.replace(' (JARRA)', ' (VASO)');

        const plato = db.prepare(`SELECT p.receta_json FROM platos p JOIN categorias c ON p.categoria_id = c.id WHERE UPPER(p.nombre) = ? AND UPPER(c.nombre) = ?`).get(nombreBase, cat);

        if (plato && plato.receta_json) {
            const ingredientes = JSON.parse(plato.receta_json);
            ingredientes.forEach(ing => {
                const insumoRow = db.prepare('SELECT nombre FROM insumos WHERE id = ?').get(ing.insumo_id);
                if (insumoRow) {
                    const nombreInsumo = normalizar(insumoRow.nombre);
                    if ((nombreInsumo.includes('TAPER') || nombreInsumo.includes('ENVASE')) && item.modalidad === 'local') return;
                    const multiplicador = esFuente ? 2 : 1;
                    uso[nombreInsumo] = (uso[nombreInsumo] || 0) + (ing.cantidad_requerida * qty * multiplicador);
                }
            });
        }
    });

    pedido.forEach(p => {
        if (p.nota) {
            const notaUpper = p.nota.toUpperCase();
            const cantidadBebida = p.cantidad || 1;
            if (notaUpper.includes('INKA COLA 296ML')) uso['INKA COLA 296ML'] = (uso['INKA COLA 296ML'] || 0) + cantidadBebida;
            if (notaUpper.includes('COCA COLA 296ML')) uso['COCA COLA 296ML'] = (uso['COCA COLA 296ML'] || 0) + cantidadBebida;
        }
    });

    return uso;
}

function procesarRecetasVenta(items, refTicket, esRestauracion = false) {
    const factorMates = esRestauracion ? 1 : -1;
    const uso = calcularUsoInventario(items);
    Object.keys(uso).forEach(insumo => { registrarMovimientoInventario(insumo, uso[insumo] * factorMates, esRestauracion ? 'RESTAURACION' : 'CONSUMO', refTicket); });

    const stockPlatos = {};
    items.forEach(i => {
        const key = normalizar(i.nombre) + '|' + normalizar(i.categoria);
        stockPlatos[key] = (stockPlatos[key] || 0) + i.cantidad;
    });

    Object.keys(stockPlatos).forEach(key => {
        const [platoNom, platoCat] = key.split('|');
        const plato = db.prepare(`SELECT p.id, p.stock_diario FROM platos p JOIN categorias c ON p.categoria_id = c.id WHERE UPPER(p.nombre) = ? AND UPPER(c.nombre) = ?`).get(platoNom, platoCat);
        if (plato && plato.stock_diario !== null) {
            const cambio = stockPlatos[key] * factorMates;
            // 🟢 FIX: No permitir stock_diario negativo
            const nuevoStock = Math.max(0, plato.stock_diario + cambio);
            db.prepare('UPDATE platos SET stock_diario = ? WHERE id = ?').run(nuevoStock, plato.id);
            actualizarStockMenuFirebase(platoNom, cambio, platoCat);
        }
    });
}

function auditarStockYAlertar(io) {
    const alertasMenu = []; const alertasCarta = []; const alertasInsumos = []; 
    
    const platosMenu = db.prepare(`SELECT p.nombre, p.stock_diario, c.nombre as categoria FROM platos p JOIN categorias c ON p.categoria_id = c.id WHERE p.stock_diario IS NOT NULL`).all();
    platosMenu.forEach(p => {
        const catExacta = p.categoria ? String(p.categoria).toUpperCase().trim() : '';
        if (state.modoDomingoGlobal && (catExacta === 'ENTRADAS' || catExacta === 'ENTRADA')) return;
        // 🟢 LÍMITE CAMBIADO: Salta cuando queda 1 o 0
        if (p.stock_diario <= 1 && p.stock_diario >= 0) alertasMenu.push({ nombre: p.nombre, restante: p.stock_diario });
    });

    const insumosDisponibles = {}; const insumosNombres = {};
    db.prepare('SELECT id, stock_actual, nombre FROM insumos').all().forEach(i => {
        insumosDisponibles[i.id] = i.stock_actual; insumosNombres[i.id] = normalizar(i.nombre);
    });
    
    const platosCarta = db.prepare('SELECT id, nombre, receta_json FROM platos WHERE stock_diario IS NULL').all();
    platosCarta.forEach(plato => {
        if (plato.receta_json) {
            const receta = JSON.parse(plato.receta_json);
            if (receta.length > 0) {
                let maxPortions = Infinity; let hasNonTaper = false;
                receta.forEach(r => {
                    const stockInsumo = insumosDisponibles[r.insumo_id] || 0;
                    const nomInsumo = insumosNombres[r.insumo_id] || '';
                    if (!nomInsumo.includes('TAPER') && !nomInsumo.includes('ENVASE')) {
                        hasNonTaper = true;
                        // Calcula para cuántos platos alcanza
                        const porcionesPosibles = Math.floor(stockInsumo / r.cantidad_requerida);
                        if (porcionesPosibles < maxPortions) maxPortions = porcionesPosibles;
                    }
                });
                // 🟢 LÍMITE CAMBIADO: Salta si los insumos alcanzan para 1 plato o menos
                if (hasNonTaper && maxPortions <= 1 && maxPortions >= 0) alertasCarta.push({ nombre: plato.nombre, restante: maxPortions });
            }
        }
    });

    Object.keys(insumosDisponibles).forEach(id => {
        const nom = insumosNombres[id]; const stock = insumosDisponibles[id];
        // 🟢 LÍMITE CAMBIADO: Salta cuando queda 1 envase o menos
        if ((nom.includes('TAPER') || nom.includes('ENVASE')) && stock <= 1 && stock >= 0) alertasInsumos.push({ nombre: nom, restante: stock }); 
    });

    if (alertasMenu.length > 0 || alertasCarta.length > 0 || alertasInsumos.length > 0) {
        if(io) io.emit('alerta_stock_dividida', { menu: alertasMenu, carta: alertasCarta, insumos: alertasInsumos });
    }
}


// --- RUTAS DEL CONTROLADOR ---

const crearPedido = (req, res) => {
    const io = req.app.get('io');
    try {
        const { mesa, items, nota_general } = req.body;
        const usoNew = calcularUsoInventario(items);
        const faltantes = [];
        Object.keys(usoNew).forEach(insumo => {
            const insumoRow = db.prepare('SELECT stock_actual FROM insumos WHERE UPPER(nombre) = ?').get(insumo);
            if (insumoRow && insumoRow.stock_actual < usoNew[insumo]) faltantes.push(`${insumo} (Solo hay ${Math.max(0, insumoRow.stock_actual)})`);
        });
        if (faltantes.length > 0) return res.error('Stock agotado: ' + faltantes.join(', '), 400);

        const refComanda = `COM-${String(mesa).replace('mesa_', '')}-${Date.now().toString().slice(-4)}`;
        procesarRecetasVenta(items, refComanda, false);
        items.forEach(i => i.impreso = true);
        
        db.prepare(`INSERT OR IGNORE INTO mesas_activas (id, estado, pedido, total, nota_general) VALUES (?, 'libre', '[]', 0, '')`).run(mesa);
        
        let row = db.prepare('SELECT pedido FROM mesas_activas WHERE id = ?').get(mesa);
        let pedidoViejo = row && row.pedido ? JSON.parse(row.pedido) : [];
        let pedidoSoloImpresos = pedidoViejo.filter(i => i.impreso);
        
        let nuevoPedido = fusionarPedidos(pedidoSoloImpresos, items);
        let nuevoTotal = calcularTotalMesa(nuevoPedido);
        
        db.prepare(`UPDATE mesas_activas SET estado = 'ocupada', pedido = ?, total = ?, nota_general = COALESCE(NULLIF(nota_general, ''), ?) WHERE id = ?`).run(JSON.stringify(nuevoPedido), nuevoTotal, nota_general || '', mesa);
        
        if(io) { io.emit('alerta_sonora'); io.emit('actualizar_mesas'); }
        if (items.length > 0 && io) io.emit('imprimir_cocina', { mesa: mesa, items: items }); 
        
        auditarStockYAlertar(io); 
        res.json({ success: true });
    } catch (e) { res.error(e.message); }
};

const modificarPedido = (req, res) => {
    const io = req.app.get('io');
    try {
        const mesaId = req.params.id; const pedidoNuevo = req.body.pedido;
        const row = db.prepare('SELECT pedido FROM mesas_activas WHERE id = ?').get(mesaId);
        const pedidoViejo = row ? JSON.parse(row.pedido) : [];

        const oldImpresos = pedidoViejo.filter(i => i.impreso);
        const newImpresos = pedidoNuevo.filter(i => i.impreso);
        const usoOld = calcularUsoInventario(oldImpresos); const usoNew = calcularUsoInventario(newImpresos);
        
        const allInsumos = new Set([...Object.keys(usoOld), ...Object.keys(usoNew)]);
        const faltantes = [];
        allInsumos.forEach(insumo => {
            const diff = (usoNew[insumo] || 0) - (usoOld[insumo] || 0);
            if (diff > 0) {
                const insumoRow = db.prepare('SELECT stock_actual FROM insumos WHERE UPPER(nombre) = ?').get(insumo);
                if (insumoRow && insumoRow.stock_actual < diff) faltantes.push(`${insumo} (Faltan ${diff - insumoRow.stock_actual})`);
            }
        });
        if (faltantes.length > 0) return res.error('Stock agotado de: ' + faltantes.join(', '), 400);

        allInsumos.forEach(insumo => {
            const diff = (usoNew[insumo] || 0) - (usoOld[insumo] || 0);
            if (diff > 0) registrarMovimientoInventario(insumo, diff * -1, 'CONSUMO (MODIFICACION)', `MOD-${mesaId}`);
            else if (diff < 0) registrarMovimientoInventario(insumo, Math.abs(diff), 'RESTAURACION', `MOD-${mesaId}`);
        });
        
        const stockOld = {}; const stockNew = {};
        oldImpresos.forEach(i => { const k = normalizar(i.nombre) + '|' + normalizar(i.categoria); stockOld[k] = (stockOld[k] || 0) + i.cantidad; });
        newImpresos.forEach(i => { const k = normalizar(i.nombre) + '|' + normalizar(i.categoria); stockNew[k] = (stockNew[k] || 0) + i.cantidad; });
        
        const allPlatos = new Set([...Object.keys(stockOld), ...Object.keys(stockNew)]);
        allPlatos.forEach(key => {
            const diff = (stockNew[key] || 0) - (stockOld[key] || 0);
            if (diff !== 0) {
                const [platoNom, platoCat] = key.split('|');
                const plato = db.prepare(`SELECT p.id, p.stock_diario FROM platos p JOIN categorias c ON p.categoria_id = c.id WHERE UPPER(p.nombre) = ? AND UPPER(c.nombre) = ?`).get(platoNom, platoCat);
                if (plato && plato.stock_diario !== null) {
                    // 🟢 FIX: No permitir stock_diario negativo
                    const nuevoStock = Math.max(0, plato.stock_diario - diff);
                    db.prepare('UPDATE platos SET stock_diario = ? WHERE id = ?').run(nuevoStock, plato.id);
                    actualizarStockMenuFirebase(platoNom, diff * -1, platoCat);
                }
            }
        });

        pedidoNuevo.forEach(item => { item.subtotal = item.cantidad * ((parseFloat(item.precio) || 0) + calcularRecargoTaper(item)); });
        let nuevoTotal = calcularTotalMesa(pedidoNuevo);
        
        // 🟢 NUEVA REGLA: Si la mesa es temporal y quedó vacía, se destruye.
        if (pedidoNuevo.length === 0 && (String(mesaId).startsWith('DEL-') || String(mesaId).startsWith('CTA-') || String(mesaId).startsWith('REC-'))) {
            db.prepare(`DELETE FROM mesas_activas WHERE id = ?`).run(mesaId);
        } else {
            let nuevoEstado = pedidoNuevo.length === 0 ? 'libre' : 'ocupada';
            db.prepare(`UPDATE mesas_activas SET estado = ?, pedido = ?, total = ? WHERE id = ?`).run(nuevoEstado, JSON.stringify(pedidoNuevo), nuevoTotal, mesaId);
        }

        if(io) io.emit('actualizar_mesas'); 
        res.json({ success: true, totalCalculado: nuevoTotal });
    } catch (e) { res.error('Error al actualizar pedido'); }
};

const moverMesa = (req, res) => {
    const io = req.app.get('io');
    try {
        const { origen, destino } = req.body;
        const row = db.prepare('SELECT * FROM mesas_activas WHERE id = ?').get(origen);
        if(!row) return res.error('Origen no existe', 404);

        const destRow = db.prepare('SELECT * FROM mesas_activas WHERE id = ?').get(destino);
        let pedidoFinal = JSON.parse(row.pedido);
        let totalFinal = row.total;
        let notaFinal = row.nota_general;

        // 🟢 NUEVA LÓGICA: Si el destino existe y está ocupado, comprobamos si es una Cuenta Abierta para "fusionarlas"
        if(destRow && destRow.estado === 'ocupada') {
            if (String(destino).startsWith('CTA-')) {
                const pedidoDestino = JSON.parse(destRow.pedido);
                pedidoFinal = fusionarPedidos(pedidoDestino, pedidoFinal);
                totalFinal = calcularTotalMesa(pedidoFinal);
                notaFinal = [destRow.nota_general, row.nota_general].filter(Boolean).join(' | ');
            } else {
                return res.error('La mesa de destino física ya está ocupada', 400);
            }
        }

        db.prepare(`INSERT OR IGNORE INTO mesas_activas (id, estado, pedido, total, nota_general) VALUES (?, 'libre', '[]', 0, '')`).run(destino);
        db.prepare('UPDATE mesas_activas SET estado = ?, pedido = ?, total = ?, nota_general = ? WHERE id = ?').run('ocupada', JSON.stringify(pedidoFinal), totalFinal, notaFinal, destino);

        // 🟢 Asegurarnos que también se limpie correctamente si el origen era REC- (Recojo)
        if (String(origen).startsWith('DEL-') || String(origen).startsWith('REC-') || String(origen).startsWith('CTA-')) db.prepare(`DELETE FROM mesas_activas WHERE id = ?`).run(origen);
        else db.prepare(`UPDATE mesas_activas SET estado = 'libre', pedido = '[]', total = 0, nota_general = '' WHERE id = ?`).run(origen);

        if(io) io.emit('actualizar_mesas');        res.json({ success: true, nuevoId: destino });
    } catch (e) { res.error(e.message); }
};

const cobrarMesa = (req, res) => {
    const io = req.app.get('io');
    try {
        const { mesaId, mesaNum, metodosPago, totalCobrado, items, clienteFacturacion } = req.body;
        const itemsAgrupados = agruparItemsParaVenta(items);
        
        const result = db.prepare(`INSERT INTO ventas (mesa, total_cobrado, metodos_pago, items, fecha, sincronizado) VALUES (?, ?, ?, ?, datetime('now', 'localtime'), 0)`).run(mesaNum, totalCobrado, JSON.stringify(metodosPago), JSON.stringify(itemsAgrupados));
        const ventaId = result.lastInsertRowid;
        const fechaLimpia = new Date().toISOString().split('T')[0].replace(/-/g, ''); 
        const ticketRef = `TKT-${pad6(ventaId)}-${fechaLimpia}`;
        
        const itemsVentaDirecta = items.filter(i => !i.impreso);
        if (itemsVentaDirecta.length > 0) {
            const agrupadosDirectos = agruparItemsParaVenta(itemsVentaDirecta);
            procesarRecetasVenta(agrupadosDirectos, ticketRef, false);
        }

        if (String(mesaId).startsWith('DEL-') || String(mesaId).startsWith('CTA-')) db.prepare(`DELETE FROM mesas_activas WHERE id = ?`).run(mesaId);
        else db.prepare(`UPDATE mesas_activas SET estado = 'libre', pedido = '[]', total = 0, nota_general = '' WHERE id = ?`).run(mesaId);
        
        let numBoletaOficial = null; // 🟢 Capturamos el número para el Frontend

        // Emisión Electrónica a SUNAT
        if (metodosPago.enviado_sunat === true) {
            const rowCorr = db.prepare("SELECT numero FROM sunat_correlativos WHERE serie = 'B001'").get();
            let numBoleta = rowCorr ? rowCorr.numero + 1 : 1;
            db.prepare("UPDATE sunat_correlativos SET numero = ? WHERE serie = 'B001'").run(numBoleta);
            
            numBoletaOficial = `B001-${String(numBoleta).padStart(8, '0')}`; // Ej: B001-00000015

            db.prepare("UPDATE sunat_correlativos SET numero = ? WHERE serie = 'B001'").run(numBoleta);

            const totalMonto = parseFloat(totalCobrado);
            const mtoOperGravadas = +(totalMonto / 1.18).toFixed(2);
            const mtoIGV = +(totalMonto - mtoOperGravadas).toFixed(2);

            const d = new Date();
            const fechaEmisionSUNAT = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}-05:00`;

            const docCliente = (clienteFacturacion && clienteFacturacion.documento.trim() !== '') ? clienteFacturacion.documento : "00000000";
            const nomCliente = (clienteFacturacion && clienteFacturacion.nombre.trim() !== '') ? clienteFacturacion.nombre : "CLIENTES VARIOS";
            const dirCliente = (clienteFacturacion && clienteFacturacion.direccion && clienteFacturacion.direccion.trim() !== '') ? clienteFacturacion.direccion : "LIMA";
            const tipoDocCliente = docCliente === "00000000" ? "-" : "1";

            const payloadSunat = {
                "ublVersion": "2.1", "tipoOperacion": "0101", "tipoDoc": "03", "serie": "B001", "correlativo": numBoleta.toString(), "fechaEmision": fechaEmisionSUNAT,
                "formaPago": { "moneda": "PEN", "tipo": "Contado" }, "tipoMoneda": "PEN",
                "client": { "tipoDoc": tipoDocCliente, "numDoc": docCliente, "rznSocial": nomCliente, "address": { "direccion": dirCliente, "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101" } },
                "company": { "ruc": "20600695771", "razonSocial": "EMPRESA DE PRUEBA S.A.C.", "nombreComercial": "EMPRESA DE PRUEBA S.A.C.", "address": { "direccion": "Lima, Perú", "provincia": "LIMA", "departamento": "LIMA", "distrito": "LIMA", "ubigueo": "150101" } },
                "mtoOperGravadas": mtoOperGravadas, "mtoIGV": mtoIGV, "valorVenta": mtoOperGravadas, "totalImpuestos": mtoIGV, "subTotal": totalMonto, "mtoImpVenta": totalMonto,
                "details": itemsAgrupados.filter(item => !(item.precio === 0 && ['INKA COLA 296ML', 'COCA COLA 296ML', 'REFRESCO DEL DÍA', 'REFRESCO DEL DIA'].includes(item.nombre))).map((item, index) => {
                    const cantidad = item.cantidad; const precioUnitarioConIgv = item.subtotal / cantidad; const valorUnitarioSinIgv = precioUnitarioConIgv / 1.18;
                    const valorVentaItem = valorUnitarioSinIgv * cantidad; const igvItem = valorVentaItem * 0.18;
                    return {
                        "codProducto": `P${pad4(index + 1)}`, "unidad": "NIU", "descripcion": item.nombre, "cantidad": cantidad, "mtoValorUnitario": +valorUnitarioSinIgv.toFixed(5),
                        "mtoValorVenta": +valorVentaItem.toFixed(2), "mtoBaseIgv": +valorVentaItem.toFixed(2), "porcentajeIgv": 18, "igv": +igvItem.toFixed(2), "tipAfeIgv": 10,
                        "totalImpuestos": +igvItem.toFixed(2), "mtoPrecioUnitario": +precioUnitarioConIgv.toFixed(5)
                    };
                }),
                "legends": [ { "code": "1000", "value": generarLeyenda(totalMonto) } ]
            };

            const TOKEN_APISPERU = process.env.APISPERU_TOKEN || '';

            if (!TOKEN_APISPERU) {
                console.error('❌ APISPERU_TOKEN no configurado. La boleta queda como pendiente.');
                db.prepare("INSERT INTO sunat_pendientes (payload, num_boleta) VALUES (?, ?)").run(JSON.stringify(payloadSunat), numBoletaOficial);
            } else {
                axios.post('https://facturacion.apisperu.com/api/v1/invoice/send', payloadSunat, { headers: { 'Authorization': `Bearer ${TOKEN_APISPERU}` } })
            .then(async sunatRes => {
                const dir = path.join(os.homedir(), 'Documents', 'Calletano_Comprobantes');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                try {
                    const pdfRes = await axios.post('https://facturacion.apisperu.com/api/v1/invoice/pdf', payloadSunat, { headers: { 'Authorization': `Bearer ${TOKEN_APISPERU}` }, responseType: 'arraybuffer' });
                    fs.writeFileSync(path.join(dir, `B001-${numBoleta}.pdf`), pdfRes.data);
                    const xmlRes = await axios.post('https://facturacion.apisperu.com/api/v1/invoice/xml', payloadSunat, { headers: { 'Authorization': `Bearer ${TOKEN_APISPERU}` }, responseType: 'arraybuffer' });
                    fs.writeFileSync(path.join(dir, `B001-${numBoleta}.xml`), xmlRes.data);
                } catch (fileErr) {}
            }).catch(err => {
                db.prepare("INSERT INTO sunat_pendientes (payload, num_boleta) VALUES (?, ?)").run(JSON.stringify(payloadSunat), numBoletaOficial);
            });
        }
        }

        if(io) io.emit('actualizar_mesas'); 
        auditarStockYAlertar(io); 
        sincronizarHaciaArriba();
        res.json({ success: true, numBoleta: numBoletaOficial }); // 🟢 Devolvemos el número
    } catch (e) { res.error(e.message); }
};

module.exports = { crearPedido, modificarPedido, moverMesa, cobrarMesa };