// mozo-mobile/src/services/authService.js

export const authService = {
  login: async (email, password) => {
    // Simulamos que el celular se está conectando al servidor (demora medio segundo)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        
        // Validación temporal simulada
        if (email === 'mozo@calletano.com' && password === '1234') {
          resolve({
            success: true,
            token: 'simulacion-token-seguro-777',
            user: { id: 1, nombre: 'Graciela', rol: 'MOZO' }
          });
        } else {
          reject(new Error('Correo o contraseña incorrectos. Intenta con mozo@calletano.com y 1234'));
        }
        
      }, 500);
    });
  }
};