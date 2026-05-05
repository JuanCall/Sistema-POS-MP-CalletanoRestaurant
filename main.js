const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

// Detectar si estamos en producción (empaquetado) o en desarrollo
const isDev = !app.isPackaged;

// MÁGIA DEFINITIVA: Electron SIEMPRE arranca el backend.
// Esto evita el error NODE_MODULE_VERSION porque usamos su motor interno de Node.
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
            autoplayPolicy: 'no-user-gesture-required'
        }
    });

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
ipcMain.on('imprimir-ticket', (event, contenidoHtml) => {
    // Creamos una ventana invisible solo para imprimir
    let winPrint = new BrowserWindow({ show: false }); 
    
    // Cargamos el diseño del ticket que nos mandó React
    winPrint.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(contenidoHtml)}`);
    
    winPrint.webContents.on('did-finish-load', () => {
        // 'silent: true' hace que imprima directo a la impresora predeterminada sin preguntar
        winPrint.webContents.print({ silent: true, printBackground: true }, (success, failureReason) => {
            if (!success) console.log("Error al imprimir:", failureReason);
            winPrint.close(); // Cerramos la ventana invisible al terminar
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