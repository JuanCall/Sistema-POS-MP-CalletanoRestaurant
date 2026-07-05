const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 🟢 Inicializar logger ANTES que cualquier otro módulo
// (Reemplaza console.log/error/warn globalmente)
const logger = require('./utils/logger');

const express = require('express');
const http = require('http'); 
const { Server } = require('socket.io'); 
const cors = require('cors');
const axios = require('axios');

// 🟢 1. IMPORTAMOS ARQUITECTURA MODULAR
const db = require('./database');
const { firestore } = require('./config/firebase');
const state = require('./store/globalState');
const { sincronizarHaciaAbajo } = require('./services/sync.service');

const app = express();
const server = http.createServer(app); 
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] } });

app.use(cors());
app.use(express.json());

// 🟢 2. INYECTAMOS EL SOCKET A TODA LA APP
app.set('io', io);

// 🟢 3. (MIGRACIONES ESTRUCTURALES: ahora se manejan en database.js via utils/migrations.js)

// 🟢 4. MIDDLEWARE DE RESPUESTA CONSISTENTE
const { responseHelpers, errorHandler } = require('./utils/response');
app.use(responseHelpers);

// 🟢 5. REGISTRO DE TODAS LAS RUTAS (MVC)
app.use('/api/inventario', require('./routes/inventario.routes'));
app.use('/api', require('./routes/finanzas.routes'));
app.use('/api', require('./routes/reportes.routes'));
app.use('/api', require('./routes/sistema.routes'));
app.use('/api', require('./routes/menu.routes'));
app.use('/api', require('./routes/sync.routes'));
app.use('/api', require('./routes/pos.routes'));

// 🟢 MIDDLEWARE GLOBAL DE ERRORES (debe ir DESPUÉS de todas las rutas)
app.use(errorHandler);

// 🟢 5. LISTENERS EN TIEMPO REAL (Fuego Firebase a SQLite)
firestore.collection('contenido').doc('configuracion').onSnapshot((docSnap) => {
    if (docSnap.exists) {
        const nuevaConfig = docSnap.data();
        if (JSON.stringify(state.estadoRestauranteGlobal) !== JSON.stringify(nuevaConfig)) {
            state.estadoRestauranteGlobal = nuevaConfig; 
            io.emit('cambio_estado_restaurante', state.estadoRestauranteGlobal); 
        }
    }
});

firestore.collection('contenido').doc('menuDiario').onSnapshot(async (docSnap) => {
    if (docSnap.exists) {
        const nuevoMenu = docSnap.data();
        if (JSON.stringify(state.rawMenuDiario) !== JSON.stringify(nuevoMenu)) {
            // 🟢 OPTIMIZADO: Pasamos los datos del snapshot para evitar releerlos de Firebase
            await sincronizarHaciaAbajo({ menuDiario: nuevoMenu });
            io.emit('actualizar_mesas'); 
        }
    }
});

io.on('connection', (socket) => { logger.info(`🟢 Socket conectado: ${socket.id}`); });

// 🟢 6. ARRANQUE DEL SERVIDOR
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => logger.info(`🚀 SERVIDOR LISTO EN PUERTO ${PORT} PARA RED LOCAL`));

// Mantenemos el auto-respaldo cada minuto
const { sincronizarHaciaArriba } = require('./services/sync.service');
setInterval(sincronizarHaciaArriba, 60000);

// 🟢 CRIT-03: Reintentos automáticos de boletas SUNAT pendientes (cada 5 minutos)
const REINTENTO_SUNAT_INTERVALO = 5 * 60 * 1000; // 5 minutos

async function reintentarBoletasPendientes() {
    try {
        const token = process.env.APISPERU_TOKEN;
        if (!token) {
            logger.warn('⏳ [SUNAT] APISPERU_TOKEN no configurado. Se omite reintento.');
            return;
        }

        const pendientes = db.prepare('SELECT * FROM sunat_pendientes ORDER BY fecha ASC').all();
        if (pendientes.length === 0) return;

        logger.info(`🔄 [SUNAT] Reintentando ${pendientes.length} boleta(s) pendiente(s)...`);

        for (const pendiente of pendientes) {
            try {
                const payload = JSON.parse(pendiente.payload);
                const numBoleta = pendiente.num_boleta;

                const sunatRes = await axios.post(
                    'https://facturacion.apisperu.com/api/v1/invoice/send',
                    payload,
                    { headers: { 'Authorization': `Bearer ${token}` }, timeout: 15000 }
                );

                // Éxito: generar PDF y XML
                const dir = path.join(os.homedir(), 'Documents', 'Calletano_Comprobantes');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                try {
                    const [pdfRes, xmlRes] = await Promise.all([
                        axios.post('https://facturacion.apisperu.com/api/v1/invoice/pdf', payload, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            responseType: 'arraybuffer',
                            timeout: 15000
                        }),
                        axios.post('https://facturacion.apisperu.com/api/v1/invoice/xml', payload, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            responseType: 'arraybuffer',
                            timeout: 15000
                        })
                    ]);
                    fs.writeFileSync(path.join(dir, `${numBoleta}.pdf`), pdfRes.data);
                    fs.writeFileSync(path.join(dir, `${numBoleta}.xml`), xmlRes.data);
                } catch (fileErr) {
                    // No crítico: el PDF/XML falló pero la boleta ya se emitió
                    logger.warn(`⚠️ [SUNAT] No se pudo generar PDF/XML para ${numBoleta}: ${fileErr.message}`);
                }

                // Eliminar de pendientes
                db.prepare('DELETE FROM sunat_pendientes WHERE id = ?').run(pendiente.id);
                logger.info(`✅ [SUNAT] Boleta ${numBoleta} emitida exitosamente (reintento automático)`);

            } catch (err) {
                // Error individual: sigue intentando con las demás
                logger.warn(`⚠️ [SUNAT] Falló reintento de boleta ${pendiente.num_boleta}: ${err.message}`);
            }
        }
    } catch (err) {
        logger.error('❌ [SUNAT] Error en el ciclo de reintentos:', err.message);
    }
}

// Ejecutar inmediatamente al iniciar y luego cada 5 minutos
reintentarBoletasPendientes();
setInterval(reintentarBoletasPendientes, REINTENTO_SUNAT_INTERVALO);