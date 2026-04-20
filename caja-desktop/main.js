const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  // Crea la ventana del navegador (Tu aplicación de escritorio).
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true, // Oculta la barra superior tipo navegador
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // Permite usar JS clásico por ahora
    }
  });

  // Carga tu archivo HTML principal
  mainWindow.loadFile(path.join(__dirname, 'src', '.html'));
  
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});