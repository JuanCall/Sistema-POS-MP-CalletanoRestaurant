import { useState } from 'react';
import { SistemaService } from '../services/api';

export default function useAuth() {
  const [usuarioActivo, setUsuarioActivo] = useState(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      // Usamos el servicio centralizado en lugar de axios.post directo
      const res = await SistemaService.login(loginData);
      setUsuarioActivo(res.data.user);
    } catch (error) {
      setLoginError('Credenciales incorrectas.');
    }
  };

  const handleLogout = () => setUsuarioActivo(null);

  return { 
    usuarioActivo, 
    loginData, 
    setLoginData, 
    loginError, 
    handleLogin, 
    handleLogout 
  };
}