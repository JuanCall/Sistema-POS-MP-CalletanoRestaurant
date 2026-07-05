const db = require('../database');
const bcrypt = require('bcryptjs');
const state = require('../store/globalState');
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const getStatus = (req, res) => res.json({ status: 'online' });
const getModoDomingo = (req, res) => res.json({ modoDomingo: state.modoDomingoGlobal, estadoRestaurante: state.estadoRestauranteGlobal });

const login = (req, res) => {
    const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(req.body.username);
    if (!user) return res.error('Credenciales incorrectas', 401);

    let passwordValida = false;
    const esHashBcrypt = user.password && (user.password.startsWith('$2b$') || user.password.startsWith('$2a$') || user.password.startsWith('$2y$'));
    const SALT_ROUNDS = db.SALT_ROUNDS || 10;

    if (esHashBcrypt) {
        passwordValida = bcrypt.compareSync(req.body.password, user.password);
    } else {
        // Compatibilidad hacia atrás: contraseña en texto plano
        passwordValida = (req.body.password === user.password);
        if (passwordValida) {
            // Migrar a bcrypt inmediatamente
            const hashed = bcrypt.hashSync(req.body.password, SALT_ROUNDS);
            db.prepare('UPDATE usuarios SET password = ? WHERE id = ?').run(hashed, user.id);
            console.log(`🔐 Contraseña migrada a bcrypt para usuario: ${user.username} (login)`);
        }
    }

    if (passwordValida) {
        res.json({ success: true, user: { username: user.username, rol: user.rol } });
    } else {
        res.error('Credenciales incorrectas', 401);
    }
};

const abrirComprobantes = (req, res) => {
    const dir = path.join(os.homedir(), 'Documents', 'Calletano_Comprobantes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let command = process.platform === 'win32' ? 'explorer' : (process.platform === 'darwin' ? 'open' : 'xdg-open');
    exec(`${command} "${dir}"`);
    res.json({ success: true });
};

const getImpresoras = (req, res) => {
  exec('powershell -Command "Get-Printer | Select-Object Name | ConvertTo-Json"', (error, stdout) => {
    if (error) return res.json([]);
    try { const printers = JSON.parse(stdout); res.json(Array.isArray(printers) ? printers.map(p => p.Name) : [printers.Name]); } catch (e) { res.json([]); }
  });
};

const getConfig = (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM configuracion`).all();
    const config = {}; rows.forEach(row => { config[row.clave] = row.valor; });
    res.json(config);
  } catch (err) { res.error(err.message); }
};

const setConfig = (req, res) => {
  try {
    const stmt = db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)`);
    stmt.run('ticketera_caja', req.body.ticketera_caja); stmt.run('ticketera_cocina', req.body.ticketera_cocina);
    res.json({ message: 'Configuración guardada' });
  } catch (err) { res.error(err.message); }
};

module.exports = { getStatus, getModoDomingo, login, abrirComprobantes, getImpresoras, getConfig, setConfig };