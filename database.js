const Database = require('better-sqlite3');
const path = require('path');

let dbPath = path.join(__dirname, 'calletano_local.db');
if (process.versions && process.versions.electron) {
    const { app } = require('electron');
    if (app.isPackaged) dbPath = path.join(app.getPath('userData'), 'calletano_local.db');
}

const db = new Database(dbPath, { verbose: console.log });
console.log(`Conectado a la base de datos SQLite en: ${dbPath}`);

const initDB = () => {
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
    db.exec(`CREATE TABLE IF NOT EXISTS ventas (id INTEGER PRIMARY KEY AUTOINCREMENT, mesa TEXT, total_cobrado REAL NOT NULL, metodos_pago TEXT, items TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP, sincronizado INTEGER DEFAULT 0)`);
    db.exec(`CREATE TABLE IF NOT EXISTS gastos (id INTEGER PRIMARY KEY AUTOINCREMENT, descripcion TEXT NOT NULL, monto REAL NOT NULL, categoria TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP, sincronizado INTEGER DEFAULT 0)`);
    db.exec(`CREATE TABLE IF NOT EXISTS mesas_activas (id TEXT PRIMARY KEY, estado TEXT DEFAULT 'libre', pedido TEXT DEFAULT '[]', total REAL DEFAULT 0, nota_general TEXT DEFAULT '')`);
    db.exec(`CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT)`);

    // 🟢 V2 ALMACÉN: Sin categorías, con estado para deshabilitar
    db.exec(`CREATE TABLE IF NOT EXISTS insumos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE,
        unidad_medida TEXT,
        stock_actual REAL DEFAULT 0,
        estado INTEGER DEFAULT 1 -- 1: Activo, 0: Oculto/Deshabilitado
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS movimientos_inventario (id INTEGER PRIMARY KEY AUTOINCREMENT, insumo_id INTEGER, tipo TEXT, cantidad REAL, fecha DATETIME DEFAULT CURRENT_TIMESTAMP, referencia TEXT, FOREIGN KEY(insumo_id) REFERENCES insumos(id))`);

    const countUsers = db.prepare("SELECT COUNT(*) as c FROM usuarios").get();
    if (countUsers.c === 0) {
        const insertUser = db.prepare("INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)");
        insertUser.run('calletano', '44910626', 'admin');
        insertUser.run('caja', 'caja', 'cajero');
    }
};

initDB();
module.exports = db;