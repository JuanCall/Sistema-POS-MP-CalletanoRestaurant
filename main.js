const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// Forzar a Electron a permitir audios sin interacción previa del usuario
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const dotenv = require('dotenv');
const fs = require('fs');

let mainWindow;

// Detectar si estamos en producción (empaquetado) o en desarrollo
const isDev = !app.isPackaged;

// 🔐 Cargar variables de entorno desde ubicación segura
// En desarrollo: desde la raíz del proyecto
// En producción (empaquetado): desde el directorio userData de la app
if (isDev) {
    dotenv.config({ path: path.join(__dirname, '.env') });
} else {
    const envPath = path.join(app.getPath('userData'), '.env');
    // Si no existe el .env en userData, crearlo con valores por defecto
    if (!fs.existsSync(envPath)) {
        const defaultEnv = `# ============================================
# 🔐 CONFIGURACIÓN SEGURA — CALLETANO POS
# ============================================
# Copia este archivo como .env y completa tus claves

# 🔑 Google Gemini AI — https://aistudio.google.com/app/apikey
GEMINI_API_KEY=tu_clave_de_gemini_aqui

# 🔑 ApisPeru SUNAT Token — https://apisperu.com
APISPERU_TOKEN=tu_token_de_apisperu_aqui
`;
        fs.writeFileSync(envPath, defaultEnv, 'utf-8');
        console.log(`📄 Archivo .env creado en: ${envPath}`);
        console.log('⚠️  Edítalo y agrega tus claves de API antes de usar SUNAT o Gemini.');
    }
    dotenv.config({ path: envPath });
}

// Electron SIEMPRE arranca el backend (server.js ya tiene dotenv como fallback para desarrollo)
require('./server.js');

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, // Un poco más ancho para que la grilla responsive luzca bien
        height: 800,
        title: "Calletano POS",
        autoHideMenuBar: true, // Oculta la barra de "Archivo, Editar, Ver..."
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Requerido para que React pueda llamar a ipcRenderer
            autoplayPolicy: 'no-user-gesture-required',
            webSecurity: false
        }
    });

    mainWindow.maximize();

    // En desarrollo, Electron cargará tu React de Vite
    // En producción, cargará los archivos compilados
    if (isDev) {
        // Esperamos 3 segundos para que Vite termine de arrancar antes de abrir la ventana
        setTimeout(() => {
            mainWindow.loadURL('http://localhost:5173');
        }, 3000);
    } else {
        mainWindow.loadFile(path.join(__dirname, 'caja-app/dist/index.html'));
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

// ==========================================================
// MOTOR DE IMPRESIÓN INVISIBLE (HARDWARE INTEGRATION)
// ==========================================================
ipcMain.on('imprimir-ticket', (event, data) => {
  // Extraemos los datos (soportando el formato nuevo y el viejo por si acaso)
  let htmlContent = typeof data === 'string' ? data : data.html;
  let targetPrinter = typeof data === 'string' ? '' : data.printerName;

  let printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true } });
  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
  
  printWindow.webContents.on('did-finish-load', () => {
    const printOptions = { silent: true };
    
    // Si el frontend especificó una impresora (y no está en blanco), la usamos
    if (targetPrinter && targetPrinter.trim() !== '') {
      printOptions.deviceName = targetPrinter;
    }

    printWindow.webContents.print(printOptions, (success, failureReason) => {
      if (!success) console.error('Error al imprimir:', failureReason);
      printWindow.close();
    });
  });
});

// Iniciar Electron
app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Cerrar el programa cuando se cierran todas las ventanas
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});