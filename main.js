const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// Forzar a Electron a permitir audios sin interacción previa del usuario
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let mainWindow;

// Detectar si estamos en producción (empaquetado) o en desarrollo
const isDev = !app.isPackaged;

// Electron SIEMPRE arranca el backend.
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