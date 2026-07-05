/**
 * Sistema de migraciones versionadas para SQLite.
 * Cada migración se ejecuta una sola vez, en orden, y queda registrada
 * en la tabla schema_version.
 */

const { pad4, pad5, pad6 } = require('./helpers');

// --- Registro de migraciones ---
// Cada migración tiene: id único descriptivo, version (número), y función ejecutora.
// Las migraciones se ejecutan en orden ASC de version.

const MIGRATIONS = [
    {
        version: 1,
        name: 'con_comprobante_en_gastos',
        up: (db) => {
            // Nota: Esta migración aplica solo a DBs existentes. En DBs nuevas,
            // la columna con_comprobante ya se crea en el CREATE TABLE inicial.
            db.exec("ALTER TABLE gastos ADD COLUMN con_comprobante INTEGER DEFAULT 0");
        }
    },
    {
        version: 2,
        name: 'firebase_id_en_ventas',
        up: (db) => {
            // Nota: Esta migración aplica solo a DBs existentes. En DBs nuevas,
            // la columna firebase_id ya se crea en el CREATE TABLE inicial.
            db.exec("ALTER TABLE ventas ADD COLUMN firebase_id TEXT");
            const ventasSinFbId = db.prepare("SELECT id, fecha FROM ventas WHERE firebase_id IS NULL").all();
            const updateVentaFbId = db.prepare("UPDATE ventas SET firebase_id = ? WHERE id = ?");
            for (let v of ventasSinFbId) {
                const f = v.fecha.split(' ')[0].replace(/-/g, '');
                updateVentaFbId.run(`TKT-${pad6(v.id)}-${f}`, v.id);
            }
        }
    },
    {
        version: 3,
        name: 'firebase_id_en_gastos',
        up: (db) => {
            // Nota: Esta migración aplica solo a DBs existentes. En DBs nuevas,
            // la columna firebase_id ya se crea en el CREATE TABLE inicial.
            db.exec("ALTER TABLE gastos ADD COLUMN firebase_id TEXT");
            const gastosSinFbId = db.prepare("SELECT id, fecha FROM gastos WHERE firebase_id IS NULL").all();
            const updateGastoFbId = db.prepare("UPDATE gastos SET firebase_id = ? WHERE id = ?");
            for (let g of gastosSinFbId) {
                const f = g.fecha.split(' ')[0].replace(/-/g, '');
                updateGastoFbId.run(`GAS-${pad5(g.id)}-${f}`, g.id);
            }
        }
    },
    {
        version: 4,
        name: 'sincronizado_en_insumos',
        up: (db) => {
            db.exec("ALTER TABLE insumos ADD COLUMN sincronizado INTEGER DEFAULT 1");
        }
    }
];

/**
 * Obtiene la versión actual del esquema desde la DB.
 * Si la tabla schema_version no existe, retorna 0.
 */
function getCurrentVersion(db) {
    try {
        const row = db.prepare("SELECT COALESCE(MAX(version), 0) as v FROM schema_version").get();
        return row ? row.v : 0;
    } catch (e) {
        return 0;
    }
}

/**
 * Ejecuta las migraciones pendientes en orden ascendente de versión.
 * Cada migración exitosa se registra en schema_version.
 * Las migraciones fallidas detienen el proceso y se loguean.
 */
function runMigrations(db, log) {
    // Asegurar que existe la tabla de control de versiones
    db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    const currentVersion = getCurrentVersion(db);
    const pendientes = MIGRATIONS.filter(m => m.version > currentVersion)
        .sort((a, b) => a.version - b.version);

    if (pendientes.length === 0) {
        log(`📦 Base de datos actualizada (schema v${currentVersion})`);
        return;
    }

    log(`📦 Ejecutando ${pendientes.length} migración(es) pendiente(s)...`);

    for (const migracion of pendientes) {
        try {
            log(`   ⏳ V${pad4(migracion.version)}: ${migracion.name}`);
            migracion.up(db);
            db.prepare("INSERT INTO schema_version (version, name) VALUES (?, ?)")
                .run(migracion.version, migracion.name);
            log(`   ✅ V${pad4(migracion.version)}: ${migracion.name} — OK`);
        } catch (err) {
            log(`   ❌ V${pad4(migracion.version)}: ${migracion.name} — ERROR: ${err.message}`);
            // Si la columna ya existe, no es un error real
            if (err.message && err.message.includes('duplicate column')) {
                db.prepare("INSERT OR IGNORE INTO schema_version (version, name) VALUES (?, ?)")
                    .run(migracion.version, migracion.name);
                log(`   ✅ V${pad4(migracion.version)}: ${migracion.name} — ya aplicada (columna existente)`);
            } else {
                throw err; // Error real, detener el proceso
            }
        }
    }

    const nuevaVersion = getCurrentVersion(db);
    log(`📦 Migraciones completadas. Schema v${nuevaVersion}`);
}

module.exports = { runMigrations };
