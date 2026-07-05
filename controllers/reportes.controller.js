const db = require('../database');
const { genAI } = require('../config/ai');
const { normalizar } = require('../utils/helpers');
const { SchemaType } = require("@google/generative-ai");

const getReporteDiario = (req, res) => {
    try {
        let fechaParam = req.query.fecha || new Date().toISOString().split('T')[0];
        
        // 🟢 BLINDAJE 1: Reparación de fecha por si el navegador la envía como DD/MM/YYYY
        if (fechaParam.includes('/')) {
            let partes = fechaParam.split('/');
            fechaParam = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        }

        // 🟢 BLINDAJE 2: Usamos LIKE en vez de date() para evitar errores si la hora viene pegada
        const ventas = db.prepare("SELECT total_cobrado, metodos_pago, items FROM ventas WHERE fecha LIKE ?").all(`${fechaParam}%`);
        
        // 🟢 BLINDAJE 3: Traemos todo con * para que no crashee buscando la palabra "concepto"
        const gastos = db.prepare("SELECT * FROM gastos WHERE fecha LIKE ?").all(`${fechaParam}%`);
        
        let totales = { efectivo: 0, yape: 0, plin: 0, tarjeta: 0, totalVentas: 0, totalGastos: 0, balance: 0 }; 
        let contadorPlatos = {};
        let categoriasPlatos = {};
        let cantidadTotalPlatos = 0; 

        ventas.forEach(v => {
            const pagos = JSON.parse(v.metodos_pago || '{}');
            totales.efectivo += parseFloat(pagos.efectivo || 0); 
            totales.yape += parseFloat(pagos.yape || 0); 
            totales.plin += parseFloat(pagos.plin || 0); 
            totales.tarjeta += parseFloat(pagos.tarjeta || 0);
            totales.totalVentas += v.total_cobrado;
            
            JSON.parse(v.items || '[]').forEach(it => {
                cantidadTotalPlatos += it.cantidad; 
                // 🟢 FIX: Saltar bebidas incluidas con almuerzo (modo domingo)
                if (it.isMenuDrink) return;
                let n = normalizar(it.nombre); let c = normalizar(it.categoria || '');
                if(!['BEBIDAS HELADAS', 'BEBIDAS', 'GUARNICIONES', 'JUGOS NATURALES', 'BEBIDAS CALIENTES', 'CERVEZA'].includes(c) && !n.includes('TAPER') && !n.includes('REFRESCO') && !n.includes('(EXTRA)') && !n.includes('(SEGUNDO)') && !n.includes('(ENTRADA)') && n !== 'HUMITA') {
                    if (n.startsWith('MENÚ COMPLETO')) n = 'MENÚ COMPLETO';
                    // 🟢 FIX: Normalizar "ALMUERZO: X" a "X" para no duplicar platos
                    if (n.startsWith('ALMUERZO: ')) n = n.replace('ALMUERZO: ', '');
                    contadorPlatos[n] = (contadorPlatos[n] || 0) + it.cantidad;
                    if (!categoriasPlatos[n]) categoriasPlatos[n] = it.categoria || 'General';
                }
            });
        });

        let gastoMayor = "Sin gastos";
        let maxGasto = 0;
        gastos.forEach(g => { 
            totales.totalGastos += g.monto; 
            // 🟢 BLINDAJE 4: Buscamos descripcion o concepto de forma segura
            if(g.monto > maxGasto) { 
                maxGasto = g.monto; 
                gastoMayor = g.descripcion || g.concepto || 'Varios'; 
            } 
        }); 
        totales.balance = totales.totalVentas - totales.totalGastos;

        res.json({ 
            totales, 
            topPlatos: Object.keys(contadorPlatos).map(k => ({ nombre: k, cant: contadorPlatos[k], categoria: categoriasPlatos[k] || 'General' })).sort((a,b) => b.cant - a.cant),
            cantidadTotalPlatos, 
            gastoMayor 
        });
        
    } catch (e) {
        console.error("Error en getReporteDiario:", e);
        res.error(e.message);
    }
};

const getDashboard = (req, res) => {
    try {
        const [yearParam, monthParam] = (req.query.mes || new Date().toISOString().slice(0, 7)).split('-');
        const ventas = db.prepare("SELECT fecha, total_cobrado, metodos_pago, items FROM ventas").all(); 
        const gastos = db.prepare("SELECT fecha, monto, con_comprobante FROM gastos").all();
        
        let diasStr = []; let ingXDia = []; let gasXDia = []; for(let i=1; i<=31; i++) { diasStr.push(i.toString()); ingXDia.push(0); gasXDia.push(0); }
        let contadorPlatos = {}; 
        let totalIng = 0; let totalGas = 0;
        let totalVentasSunat = 0; let totalGastosSunat = 0;
        
        let diasOperadosSet = new Set(); // 🟢 NUEVO
        let ventasCat = {}; // 🟢 NUEVO

        ventas.forEach(v => {
            if (v.fecha.startsWith(`${yearParam}-${monthParam}`)) {
                diasOperadosSet.add(v.fecha.split(' ')[0]); // Guardamos el día para saber cuántos días se abrieron
                let dia = parseInt(v.fecha.split(' ')[0].split('-')[2]); if(!isNaN(dia)) ingXDia[dia-1] += v.total_cobrado; 
                totalIng += v.total_cobrado;
                
                const pagos = JSON.parse(v.metodos_pago || '{}');
                if (pagos.enviado_sunat === true || parseFloat(pagos.plin)>0 || parseFloat(pagos.tarjeta)>0) {
                    totalVentasSunat += v.total_cobrado;
                }

                JSON.parse(v.items || '[]').forEach(it => {
                    // 🟢 FIX: Saltar bebidas incluidas con almuerzo (modo domingo)
                    if (it.isMenuDrink) return;
                    let c = normalizar(it.categoria || 'OTROS');
                    // 🟢 NUEVO: Agrupamos las ventas en dinero por categoría
                    ventasCat[c] = (ventasCat[c] || 0) + (it.subtotal || (it.precio * it.cantidad) || 0);

                    let n = normalizar(it.nombre); 
                    if(!['BEBIDAS HELADAS', 'BEBIDAS', 'GUARNICIONES', 'JUGOS NATURALES', 'BEBIDAS CALIENTES', 'CERVEZA'].includes(c) && !n.includes('TAPER') && !n.includes('REFRESCO') && !n.includes('(EXTRA)') && !n.includes('(SEGUNDO)') && !n.includes('(ENTRADA)') && n !== 'HUMITA') {
                        if (n.startsWith('MENÚ COMPLETO')) n = 'MENÚ COMPLETO';
                        // 🟢 FIX: Normalizar "ALMUERZO: X" a "X" para no duplicar platos
                        if (n.startsWith('ALMUERZO: ')) n = n.replace('ALMUERZO: ', '');
                        contadorPlatos[n] = (contadorPlatos[n] || 0) + it.cantidad;
                    }
                });
            }
        });
        
        gastos.forEach(g => { 
            if (g.fecha.startsWith(`${yearParam}-${monthParam}`)) { 
                let dia = parseInt(g.fecha.split(' ')[0].split('-')[2]); if(!isNaN(dia)) gasXDia[dia-1] += g.monto; 
                totalGas += g.monto; 
                if (g.con_comprobante === 1) totalGastosSunat += g.monto;
            } 
        });

        let rankingAll = Object.keys(contadorPlatos).map(k => ({ nombre: k, cantidad: contadorPlatos[k] })).sort((a,b) => b.cantidad - a.cantidad);
        let restoRanking = rankingAll.slice(1);
        let ventasPorCategoria = Object.keys(ventasCat).map(k => ({ categoria: k, total: parseFloat(ventasCat[k].toFixed(2)) }));

        res.json({ 
            totales: { ingresos: totalIng, gastos: totalGas, neto: totalIng - totalGas, ventasSunat: totalVentasSunat, gastosSunat: totalGastosSunat },
            evolucion: { labels: diasStr, ingresos: ingXDia, gastos: gasXDia }, 
            platoCorona: rankingAll.length > 0 ? rankingAll[0] : null, 
            rankingMenu: restoRanking.filter(p => p.nombre === 'MENÚ COMPLETO' || p.nombre.startsWith('ALMUERZO:')).slice(0, 10), 
            rankingCarta: restoRanking.filter(p => !(p.nombre === 'MENÚ COMPLETO' || p.nombre.startsWith('ALMUERZO:'))).slice(0, 10),
            ventasPorCategoria, // Enviamos el dato a la UI
            diasOperados: diasOperadosSet.size // Enviamos el dato a la UI
        });
    } catch (e) { res.error('Error al generar dashboard'); }
};

const resumenDiarioIA = async (req, res) => {
    try {
        // Agregamos diaSemana, cantidadTotalPlatos y detalleGasto (si los tienes)
        const { ingresos, gastos, topPlatos, diaSemana, cantidadTotalPlatos, gastoMayor } = req.body;
        
        const listaPlatos = topPlatos.map((p, i) => `${i + 1}. ${p.nombre} | Cat: ${p.categoria || 'N/A'} | S/ ${parseFloat(p.precio || 0).toFixed(2)} | Vendidos: ${p.cantidad || p.cant || 0}`).join('\n');
        const margen = (parseFloat(ingresos) - parseFloat(gastos)).toFixed(2);
        const ratioGastos = ingresos > 0 ? ((gastos / ingresos) * 100).toFixed(1) : 100;

        const schemaDiario = {
            type: SchemaType.OBJECT,
            properties: {
                diagnostico: { type: SchemaType.STRING, description: "Diagnóstico operativo agudo y directo de máximo 2 líneas." },
                accion: { type: SchemaType.STRING, description: "Acción táctica inmediata a ejecutar hoy o mañana." },
                nivelRiesgo: { type: SchemaType.STRING, enum: ["bajo", "medio", "alto"] }
            },
            required: ["diagnostico", "accion", "nivelRiesgo"]
        };

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: `Eres el Jefe de Operaciones de 'Calletano', un concurrido restaurante en Máncora, Perú. 
Tu trabajo es analizar el cierre de caja diario. No conoces los costos de insumos ni el inventario crudo, por lo que tu análisis debe centrarse ESTRICTAMENTE en:
1. Ratio de Gastos vs Ingresos (Si los gastos superan el 40% del ingreso diario, levanta una alerta).
2. Tráfico y Volumen (Demanda según el día de la semana).
3. Concentración de Ventas (Si un solo plato representa más del 40% de los platos vendidos, hay dependencia).
Usa lenguaje gerencial, directo y pragmático. Cero frases genéricas como "buen trabajo" o "sigue así". Ve al grano.`,
            generationConfig: { 
                temperature: 0.6, topP: 0.8, topK: 40, 
                responseMimeType: "application/json",
                responseSchema: schemaDiario
            }
        });

        const prompt = `
Contexto: Hoy es ${diaSemana || 'un día de operación'}.
- Ingresos: S/ ${ingresos}
- Gastos Operativos: S/ ${gastos} (Ratio: ${ratioGastos}%)
- Gasto principal de hoy: ${gastoMayor || 'Múltiples gastos menores'}
- Margen Operativo Diario: S/ ${margen}
- Platos Totales Vendidos: ${cantidadTotalPlatos || 'N/D'}

Top 5 Productos Motor:
${listaPlatos}

Genera el análisis táctico.`;

        const result = await model.generateContent(prompt);
        res.json(JSON.parse(result.response.text()));
    } catch (error) {
        console.error(error);
        res.json({ diagnostico: "Falla de comunicación con el sistema de análisis.", accion: "Verifica los logs del servidor local o la conexión a la API.", nivelRiesgo: "alto" });
    }
};

const resumenMensualIA = async (req, res) => {
    try {
        const { ingresos, gastos, platoCorona, mes, ventasPorCategoria, diasOperados } = req.body;
        
        const margen = (parseFloat(ingresos) - parseFloat(gastos)).toFixed(2);
        const ratioGastos = ingresos > 0 ? ((gastos / ingresos) * 100).toFixed(1) : 100;
        const promedioDiario = diasOperados ? (ingresos / diasOperados).toFixed(2) : 'N/D';

        // Convertir el array de categorías a texto legible
        const categoriasTexto = ventasPorCategoria && ventasPorCategoria.length > 0 
            ? ventasPorCategoria.map(c => `- ${c.categoria}: S/ ${c.total}`).join('\n')
            : 'Datos de categorías no disponibles.';

        const schemaMensual = {
            type: SchemaType.OBJECT,
            properties: {
                diagnostico: { type: SchemaType.STRING, description: "Evaluación gerencial del flujo de caja, mix de ventas y eficiencia." },
                decision: { type: SchemaType.STRING, description: "Decisión estratégica comercial u operativa a implementar el próximo mes." },
                nivelFinanciero: { type: SchemaType.STRING, enum: ["saludable", "estable", "critico"] }
            },
            required: ["diagnostico", "decision", "nivelFinanciero"]
        };

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: `Eres el Director Financiero (CFO) de 'Calletano', restaurante en Máncora. 
Tu rol es evaluar el cierre mensual basándote exclusivamente en el flujo de caja operativo y el 'Sales Mix' (Desempeño de categorías). No posees datos de costo de receta.
Reglas de análisis:
1. Evalúa el peso de los Gastos sobre los Ingresos (Un restaurante sano mantiene sus gastos operativos mensuales por debajo del 60% para dejar margen a costos fijos e impuestos).
2. Identifica si hay categorías débiles (Ej: Alta venta de 'Segundos' pero baja de 'Bebidas' significa pérdida de ticket promedio).
3. Evalúa la dependencia del 'Plato Estrella'.
Tu respuesta debe ser sumamente profesional, orientada a la protección de liquidez y estrategias de 'Up-selling' o control de fuga de capital.`,
            generationConfig: { 
                temperature: 0.6, topP: 0.8, topK: 40, 
                responseMimeType: "application/json",
                responseSchema: schemaMensual
            }
        });

        const prompt = `
Cierre Financiero del Mes: ${mes} (Días operados: ${diasOperados || 'N/D'})
- Promedio de Venta Diaria: S/ ${promedioDiario}
- Ingresos Consolidados: S/ ${ingresos}
- Gastos Operativos Consolidados: S/ ${gastos} (Ratio de gasto: ${ratioGastos}%)
- Margen Operativo: S/ ${margen}

Desglose de Ingresos por Categoría (Sales Mix):
${categoriasTexto}

- Plato Estrella (Motor de ventas): ${platoCorona}

Genera el dictamen financiero y la directriz para el mes entrante.`;

        const result = await model.generateContent(prompt);
        res.json(JSON.parse(result.response.text()));
    } catch (error) {
        console.error(error);
        res.json({ diagnostico: "Bloqueo en el procesamiento de datos financieros mensuales.", decision: "Realizar arqueo manual de egresos contra ingresos.", nivelFinanciero: "critico" });
    }
};

module.exports = { getReporteDiario, getDashboard, resumenDiarioIA, resumenMensualIA };