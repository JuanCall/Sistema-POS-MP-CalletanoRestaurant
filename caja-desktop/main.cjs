const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  // Configuramos cómo se verá la ventana de tu programa
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    title: "Calletano POS - Caja",
    autoHideMenuBar: true, // Oculta los menús de "Archivo, Editar, Ver..."
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Si estamos en desarrollo, abrimos el servidor de React (Vite)
  // En producción, aquí leeremos el archivo index.html compilado
  const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  
  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Cuando Electron esté listo, abrimos la ventana
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Cerrar el programa cuando se cierren todas las ventanas
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});