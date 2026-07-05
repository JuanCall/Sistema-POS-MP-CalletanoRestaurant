const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

let dbPath = path.join(__dirname, 'calletano_local.db');
if (process.versions && process.versions.electron) {
    const { app } = require('electron');
    if (app.isPackaged) dbPath = path.join(app.getPath('userData'), 'calletano_local.db');
}

// Usar logger si ya fue inicializado, de lo contrario console.log como fallback
let log = (msg) => { try { const l = require('./utils/logger'); l.info(msg); } catch(e) { console.log(msg); } };

const db = new Database(dbPath, { verbose: null });
log(`Conectado a la base de datos SQLite en: ${dbPath}`);

const initDB = () => {
    // ============================================================
    // 🏗️ ESQUEMA BASE (CREATE TABLE IF NOT EXISTS — siempre seguro)
    // ============================================================
    db.exec(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, rol TEXT NOT NULL)`);
    db.exec(`CREATE TABLE IF NOT EXISTS categorias (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL)`);
    db.exec(`CREATE TABLE IF NOT EXISTS platos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        categoria_id INTEGER, 
        nombre TEXT NOT NULL, 
        precio REAL NOT NULL, 
        estado INTEGER DEFAULT 1, 
        stock_diario REAL DEFAULT NULL,
        receta_json TEXT DEFAULT NULL
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS ventas (id INTEGER PRIMARY KEY AUTOINCREMENT, firebase_id TEXT UNIQUE, mesa TEXT, total_cobrado REAL NOT NULL, metodos_pago TEXT, items TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP, sincronizado INTEGER DEFAULT 0)`);
    db.exec(`CREATE TABLE IF NOT EXISTS gastos (id INTEGER PRIMARY KEY AUTOINCREMENT, firebase_id TEXT UNIQUE, descripcion TEXT NOT NULL, monto REAL NOT NULL, categoria TEXT, con_comprobante INTEGER DEFAULT 0, fecha DATETIME DEFAULT CURRENT_TIMESTAMP, sincronizado INTEGER DEFAULT 0)`);
    db.exec(`CREATE TABLE IF NOT EXISTS mesas_activas (id TEXT PRIMARY KEY, estado TEXT DEFAULT 'libre', pedido TEXT DEFAULT '[]', total REAL DEFAULT 0, nota_general TEXT DEFAULT '')`);
    db.exec(`CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT)`);
    db.exec(`CREATE TABLE IF NOT EXISTS sunat_correlativos (serie TEXT PRIMARY KEY, numero INTEGER DEFAULT 0)`);
    db.exec(`CREATE TABLE IF NOT EXISTS sunat_pendientes (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT, num_boleta TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.exec(`CREATE TABLE IF NOT EXISTS insumos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE,
        unidad_medida TEXT,
        stock_actual REAL DEFAULT 0,
        estado INTEGER DEFAULT 1
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS movimientos_inventario (id INTEGER PRIMARY KEY AUTOINCREMENT, insumo_id INTEGER, tipo TEXT, cantidad REAL, fecha DATETIME DEFAULT CURRENT_TIMESTAMP, referencia TEXT, FOREIGN KEY(insumo_id) REFERENCES insumos(id))`);

    // ============================================================
    // 📦 MIGRACIONES ESTRUCTURALES VERSIONADAS
    // ============================================================
    const { runMigrations } = require('./utils/migrations');
    runMigrations(db, log);

    // ============================================================
    // 🌱 DATOS INICIALES (solo si la tabla está vacía)
    // ============================================================

    // Serie SUNAT por defecto
    const countSeries = db.prepare("SELECT COUNT(*) as c FROM sunat_correlativos WHERE serie = 'B001'").get();
    if (countSeries.c === 0) {
        db.prepare("INSERT INTO sunat_correlativos (serie, numero) VALUES ('B001', 0)").run();
    }

    // Usuarios por defecto
    const countUsers = db.prepare("SELECT COUNT(*) as c FROM usuarios").get();
    if (countUsers.c === 0) {
        const insertUser = db.prepare("INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)");
        insertUser.run('calletano', bcrypt.hashSync('44910626', SALT_ROUNDS), 'admin');
        insertUser.run('caja', bcrypt.hashSync('caja', SALT_ROUNDS), 'cajero');
    }

    // Migrar contraseñas existentes en texto plano a bcrypt
    const usuariosTextoPlano = db.prepare("SELECT * FROM usuarios WHERE password NOT LIKE '$2b$%' AND password NOT LIKE '$2a$%' AND password NOT LIKE '$2y$%'").all();
    const updatePassword = db.prepare("UPDATE usuarios SET password = ? WHERE id = ?");
    for (const user of usuariosTextoPlano) {
        const hashed = bcrypt.hashSync(user.password, SALT_ROUNDS);
        updatePassword.run(hashed, user.id);
        log(`🔐 Contraseña migrada a bcrypt para usuario: ${user.username}`);
    }
};

initDB();
module.exports = db;
module.exports.SALT_ROUNDS = SALT_ROUNDS;