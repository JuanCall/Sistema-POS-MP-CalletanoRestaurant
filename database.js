const Database = require('better-sqlite3');
const path = require('path');

// 1. Ruta por defecto para DESARROLLO (en tu carpeta del proyecto)
let dbPath = path.join(__dirname, 'calletano_local.db');

// 2. Ruta segura para PRODUCCIÓN (.exe)
if (process.versions && process.versions.electron) {
    const { app } = require('electron');
    // SOLO si la app está empaquetada (compilada), la ocultamos en AppData
    if (app.isPackaged) {
        dbPath = path.join(app.getPath('userData'), 'calletano_local.db');
    }
}

const db = new Database(dbPath, { verbose: console.log });

console.log(`Conectado a la base de datos SQLite en: ${dbPath}`);

const initDB = () => {
    // 1. Tabla de Usuarios
    db.exec(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, rol TEXT NOT NULL)`);

    // 2. Tabla de Categorías y Platos
    db.exec(`CREATE TABLE IF NOT EXISTS categorias (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL)`);
    db.exec(`CREATE TABLE IF NOT EXISTS platos (id INTEGER PRIMARY KEY AUTOINCREMENT, categoria_id INTEGER, nombre TEXT NOT NULL, precio REAL NOT NULL, estado INTEGER DEFAULT 1)`);

    // 3. ACTUALIZADO: Tabla de Ventas Históricas con flag de sincronización
    db.exec(`CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        mesa TEXT, 
        total_cobrado REAL NOT NULL, 
        metodos_pago TEXT, 
        items TEXT, 
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        sincronizado INTEGER DEFAULT 0 -- 0: No, 1: Sí
    )`);

    // TABLA: Gastos diarios
    db.exec(`CREATE TABLE IF NOT EXISTS gastos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion TEXT NOT NULL,
        monto REAL NOT NULL,
        categoria TEXT, -- ej: 'Insumos', 'Personal'
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        sincronizado INTEGER DEFAULT 0
    )`);
    
    // 4. TABLA: Estado de las Mesas en Vivo
    db.exec(`
        CREATE TABLE IF NOT EXISTS mesas_activas (
            id TEXT PRIMARY KEY,
            estado TEXT DEFAULT 'libre',
            pedido TEXT DEFAULT '[]', -- Guardaremos los items como JSON String
            total REAL DEFAULT 0,
            nota_general TEXT DEFAULT ''
        )
    `);

    db.exec(`CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT
    )`);

    // 6.  LÓGICA: Pre-poblar Usuario Admin si la tabla está vacía
    const countUsers = db.prepare("SELECT COUNT(*) as c FROM usuarios").get();
    if (countUsers.c === 0) {
        const insertUser = db.prepare("INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)");
        // Creamos el admin por defecto
        insertUser.run('calletano', '44910626', 'admin');
        // Crear un cajero para probar los roles
        insertUser.run('caja', 'caja', 'cajero');
    }
};

initDB();
module.exports = db;