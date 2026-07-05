import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal } from 'bootstrap';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler);
import { PencilLine, X, Plus, ChefHat, Minus, Trash2 } from 'lucide-react';

// 🟢 1. IMPORTACIONES DE TUS NUEVOS COMPONENTES VISUALES
import ModalGastos from './components/ModalGastos';
import ModalCobro from './components/ModalCobro';
import ModalArqueo from './components/ModalArqueo';
import ModalHistorial from './components/ModalHistorial';
import ModalDashboard from './components/ModalDashboard';
import ModalAdmin from './components/ModalAdmin';

// 🟢 2. IMPORTACIONES DE TUS HOOKS Y UTILIDADES
import useAuth from './hooks/useAuth';
import useInventario from './hooks/useInventario';
import usePOS from './hooks/usePOS';
import { calcularRecargoVisual, obtenerPreciosVisuales, agruparParaComandera } from './utils/math';
import { generarTicketCocina } from './utils/printer';
import { obtenerFechaActualLocal, formatMesaName } from './utils/helpers';

import './App.css';

const socket = io('http://localhost:3001');

export default function App() {
  const [serverStatus, setServerStatus] = useState('Iniciando...');
  const audioRef = useRef(null);

  // ─── ESTADOS DE LA INTERFAZ (MODALES Y ALERTAS) ───
  const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '', type: 'success' });
  const mostrarAlert = (title, message, type = 'success') => setAlertModal({ visible: true, title, message, type });

  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: null });
  const solicitarConfirmacion = (title, message, action) => setConfirmModal({ visible: true, title, message, onConfirm: action });
  const cerrarConfirmacion = () => setConfirmModal(prev => ({ ...prev, visible: false }));

  // Referencias para las ventanas modales de Bootstrap
  const modalRef = useRef(null);                   const [modalInstance, setModalInstance] = useState(null);
  const modalCobroRef = useRef(null);              const [modalCobroInstance, setModalCobroInstance] = useState(null);
  const modalGastosRef = useRef(null);             const [modalGastosInstance, setModalGastosInstance] = useState(null);
  const modalReporteRef = useRef(null);            const [modalReporteInstance, setModalReporteInstance] = useState(null);
  const modalHistorialRef = useRef(null);          const [modalHistorialInstance, setModalHistorialInstance] = useState(null);
  const modalDashboardRef = useRef(null);          const [modalDashboardInstance, setModalDashboardInstance] = useState(null);
  const modalAdminRef = useRef(null);              const [modalAdminInstance, setModalAdminInstance] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [ticketeraCaja, setTicketeraCaja] = useState('');
  const [ticketeraCocina, setTicketeraCocina] = useState('');
  const [impresorasUSB, setImpresorasUSB] = useState([]);

  const accionMenu = (accion) => {
    accion();
    if (window.innerWidth <= 1400) setSidebarOpen(false);
  };

  // ─── INICIALIZACIÓN DE HOOKS ───
  const { usuarioActivo, loginData, setLoginData, loginError, handleLogin, handleLogout } = useAuth();
  
  const { 
    inventario, movimientoData, setMovimientoData, insumoEditando, setInsumoEditando, 
    nuevoInsumoForm, setNuevoInsumoForm, busquedaKardex, setBusquedaKardex, 
    cargarInventario, guardarMovimientoInv, guardarNuevoInsumo, deshabilitarInsumo, habilitarInsumo 
  } = useInventario(mostrarAlert);

  const enviarAImpresora = async (html, tipoDestino) => {
    if (!window.require) {
      const win = window.open('', '_blank'); win.document.write(html); win.print();
      return;
    }
    try {
      const res = await axios.get('http://localhost:3001/api/config');
      const targetPrinter = tipoDestino === 'cocina' ? res.data.ticketera_cocina : res.data.ticketera_caja;
      window.require('electron').ipcRenderer.send('imprimir-ticket', { html: html, printerName: targetPrinter });
    } catch (e) {
      console.error("Error obteniendo configuración de impresora");
    }
  };

  // 🟢 EL CEREBRO DE LA CAJA INYECTADO AQUÍ
  const POS = usePOS(usuarioActivo, mostrarAlert, solicitarConfirmacion, cerrarConfirmacion, enviarAImpresora, modalCobroInstance);

  // ─── ESTADOS DEL PANEL DE ADMINISTRACIÓN Y REPORTES ───
  const [fechaArqueo, setFechaArqueo] = useState(obtenerFechaActualLocal());
  const [reporte, setReporte] = useState({ totales: { efectivo: 0, yape: 0, plin: 0, tarjeta: 0, totalVentas: 0, totalGastos: 0, balance: 0 }, topPlatos: [] });
  const [fechaHistorial, setFechaHistorial] = useState(obtenerFechaActualLocal());
  const [historialVentas, setHistorialVentas] = useState([]);
  const [gastosHoy, setGastosHoy] = useState([]);
  const [nuevoGasto, setNuevoGasto] = useState({ descripcion: '', monto: '', categoria: 'Insumos', con_comprobante: false });
  const [mesDashboard, setMesDashboard] = useState(obtenerFechaActualLocal().slice(0, 7));
  const [dashboardData, setDashboardData] = useState(null);
  const [consejoIA, setConsejoIA] = useState(null); 
  const [cargandoIA, setCargandoIA] = useState(false);

  const [modalReceta, setModalReceta] = useState(false);
  const [platoSeleccionado, setPlatoSeleccionado] = useState(null);
  const [ingredientesPlato, setIngredientesPlato] = useState([]);
  const [nuevaRecetaRow, setNuevaRecetaRow] = useState({ insumo_id: '', cantidad_requerida: '' });
  const [busquedaReceta, setBusquedaReceta] = useState('');

  const [adminTab, setAdminTab] = useState('menu');
  const [adminData, setAdminData] = useState({
    menuDiario: { titulo: 'MENU DEL DIA 🍽️', modoDomingo: false, entradas: [], segundos: [], refresco: '' },
    cartaCompleta: { categorias: [] },
    estado: { apertura: 12, cierre: 22, cierreForzado: '' }
  });

  const [alertaCritica, setAlertaCritica] = useState({ visible: false, menu: [], carta: [], insumos: [] });

  // ─── LÓGICA SECUNDARIA ───
  const cargarRecetaPlato = async (platoId) => {
    try {
      const res = await axios.get(`http://localhost:3001/api/platos/${platoId}/receta`);
      setIngredientesPlato(res.data);
    } catch (e) {}
  };

  const agregarIngredienteReceta = async (e) => {
    e.preventDefault();
    if(!nuevaRecetaRow.insumo_id || !nuevaRecetaRow.cantidad_requerida) return;
    try {
      await axios.post(`http://localhost:3001/api/platos/${platoSeleccionado.id}/receta`, nuevaRecetaRow);
      setNuevaRecetaRow({ insumo_id: '', cantidad_requerida: '' });
      setBusquedaReceta('');
      cargarRecetaPlato(platoSeleccionado.id);
    } catch(e) { mostrarAlert('Error', 'No se pudo añadir ingrediente', 'danger'); }
  };

  const eliminarIngredienteReceta = async (idRecetaRow) => {
    try {
      await axios.delete(`http://localhost:3001/api/recetas/${idRecetaRow}`);
      cargarRecetaPlato(platoSeleccionado.id);
    } catch(e) {}
  };

  const abrirCarpetaSUNAT = async () => {
      try { await axios.get('http://localhost:3001/api/abrir-comprobantes'); } 
      catch (e) { mostrarAlert('Error', 'No se pudo abrir la carpeta', 'danger'); }
  };

  const inicializarSistema = async () => {
    setServerStatus('Sincronizando...');
    try { 
        const resSync = await axios.get('http://localhost:3001/api/init-sync'); 
        POS.setModoDomingo(resSync.data.modoDomingo);
        setServerStatus('En línea 🟢'); 
    } catch (e) { setServerStatus('Desconectado 🔴'); }
    POS.cargarMesas(); POS.cargarCarta();
  }

  useEffect(() => {
    inicializarSistema();
    socket.on('actualizar_mesas', () => { POS.cargarMesas(); POS.cargarCarta(); });
    socket.on('alerta_sonora', () => { 
      if (audioRef.current) { 
        audioRef.current.currentTime = 0; 
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) playPromise.catch(e => console.log(e));
      } 
    });
    socket.on('imprimir_cocina', ({ mesa, items }) => { procesarImpresionCocina(mesa, items); });
    socket.on('alerta_stock_dividida', (data) => {
      setAlertaCritica(prev => ({ ...prev, menu: data.menu, carta: data.carta, insumos: data.insumos || [] }));
    });

    return () => { 
       socket.off('actualizar_mesas'); 
       socket.off('alerta_sonora'); 
       socket.off('imprimir_cocina'); 
       socket.off('alerta_stock_dividida');
    }
  }, [])

  useEffect(() => {
    if (usuarioActivo) {
      if (modalRef.current)          setModalInstance(new Modal(modalRef.current));
      if (modalCobroRef.current)     setModalCobroInstance(new Modal(modalCobroRef.current));
      if (modalGastosRef.current)    setModalGastosInstance(new Modal(modalGastosRef.current));
      if (modalReporteRef.current)   setModalReporteInstance(new Modal(modalReporteRef.current));
      if (modalHistorialRef.current) setModalHistorialInstance(new Modal(modalHistorialRef.current));
      if (modalDashboardRef.current) setModalDashboardInstance(new Modal(modalDashboardRef.current));
      if (modalAdminRef.current)     setModalAdminInstance(new Modal(modalAdminRef.current, { focus: false }));
    }
  }, [usuarioActivo])

  const abrirAdminPanel = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/admin/data-cruda');
      setAdminData({
        menuDiario: res.data.menuDiario || { titulo: 'MENU DEL DIA 🍽️', modoDomingo: false, entradas: [], segundos: [], refresco: '' },
        cartaCompleta: res.data.cartaCompleta || { categorias: [] },
        estado: res.data.estado || { apertura: 12, cierre: 22, cierreForzado: '' }
      });
      await cargarInventario();
      modalAdminInstance?.show();
    } catch(e) { mostrarAlert('Error', 'No se pudo cargar el panel administrativo', 'danger'); }
  };

  const guardarAdminMenu = async () => {
    try {
      await axios.post('http://localhost:3001/api/admin/menu', adminData.menuDiario);
      POS.setModoDomingo(adminData.menuDiario.modoDomingo);
      mostrarAlert('Éxito', 'Menú del día actualizado y sincronizado en la red.', 'success');
    } catch(e) { mostrarAlert('Error', 'Fallo al guardar menú', 'danger'); }
  };

  const guardarAdminCarta = async () => {
    try {
      await axios.post('http://localhost:3001/api/admin/carta', adminData.cartaCompleta);
      mostrarAlert('Éxito', 'Carta a la medida actualizada.', 'success');
    } catch(e) { mostrarAlert('Error', 'Fallo al guardar carta', 'danger'); }
  };

  const guardarAdminEstado = async () => {
    try {
      await axios.post('http://localhost:3001/api/admin/estado', adminData.estado);
      mostrarAlert('Éxito', 'Estado operativo actualizado.', 'success');
    } catch(e) { mostrarAlert('Error', 'Fallo al cambiar estado', 'danger'); }
  };

  const toggleDomingoAdmin = () => {
    setAdminData(p => {
      const nuevoEstado = !p.menuDiario.modoDomingo;
      const segundosActualizados = (p.menuDiario.segundos || []).map(s => ({
          ...s,
          precio: nuevoEstado ? 30 : 15,
          taper: nuevoEstado ? ['grande'] : ['mediano']
      }));
      return {
        ...p,
        menuDiario: { ...p.menuDiario, modoDomingo: nuevoEstado, titulo: nuevoEstado ? 'ESPECIALES DE DOMINGO 🍽️' : 'MENU DEL DIA 🍽️', segundos: segundosActualizados }
      };
    });
  };

  const updateMenuField = (field, val) => setAdminData(p => ({...p, menuDiario: {...p.menuDiario, [field]: val}}));
  const updateMenuArr = (type, i, field, val) => setAdminData(p => {
    const arr = [...(p.menuDiario[type]||[])]; arr[i] = { ...arr[i], [field]: val };
    return { ...p, menuDiario: { ...p.menuDiario, [type]: arr } };
  });
  
  const toggleTaperMenu = (type, idx, taperName) => {
     setAdminData(p => {
        const arr = [...p.menuDiario[type]];
        const row = { ...arr[idx] }; 
        let tapersActuales = Array.isArray(row.taper) ? [...row.taper] : (row.taper ? [row.taper] : []);
        if (tapersActuales.includes(taperName)) tapersActuales = tapersActuales.filter(t => t !== taperName);
        else tapersActuales.push(taperName);
        row.taper = tapersActuales;
        arr[idx] = row;
        return { ...p, menuDiario: { ...p.menuDiario, [type]: arr } };
     });
  };

  const addMenuRow = (type) => setAdminData(p => {
    let precioDefecto = type === 'entradas' ? 6 : 15;
    let tapersDefecto = type === 'entradas' ? ['sopa'] : ['mediano'];
    if (type === 'segundos' && p.menuDiario.modoDomingo) { precioDefecto = 30; tapersDefecto = ['grande']; }
    const nuevaFila = type === 'entradas' ? { nombre: '', precio: precioDefecto, taper: tapersDefecto, stock: '' } : { nombre: '', acomp: '', precio: precioDefecto, taper: tapersDefecto, stock: '' };
    const arr = [...(p.menuDiario[type] || []), nuevaFila];
    return { ...p, menuDiario: { ...p.menuDiario, [type]: arr } };
  });

  const delMenuRow = (type, i) => setAdminData(p => {
    const arr = [...p.menuDiario[type]]; arr.splice(i, 1);
    return { ...p, menuDiario: { ...p.menuDiario, [type]: arr } };
  });

  const updateCartaCat = (cIdx, field, val) => setAdminData(p => {
    const cats = JSON.parse(JSON.stringify(p.cartaCompleta.categorias)); cats[cIdx][field] = val;
    return { ...p, cartaCompleta: { ...p.cartaCompleta, categorias: cats } };
  });

  const updateCartaItem = (cIdx, iIdx, field, val) => setAdminData(p => {
    const cats = JSON.parse(JSON.stringify(p.cartaCompleta.categorias)); cats[cIdx].items[iIdx][field] = val;
    return { ...p, cartaCompleta: { ...p.cartaCompleta, categorias: cats } };
  });

  const addCartaCat = () => setAdminData(p => {
    const cats = JSON.parse(JSON.stringify(p.cartaCompleta.categorias || [])); cats.push({ nombre: 'Nueva Categoría', items: [] });
    return { ...p, cartaCompleta: { ...p.cartaCompleta, categorias: cats } };
  });

  const addCartaItem = (cIdx) => setAdminData(p => {
    const cats = JSON.parse(JSON.stringify(p.cartaCompleta.categorias)); cats[cIdx].items.push({ nombre: '', precio: '', precio2: '', desc: '' });
    return { ...p, cartaCompleta: { ...p.cartaCompleta, categorias: cats } };
  });

  const delCartaCat = (cIdx) => setAdminData(p => {
    const cats = JSON.parse(JSON.stringify(p.cartaCompleta.categorias)); cats.splice(cIdx, 1);
    return { ...p, cartaCompleta: { ...p.cartaCompleta, categorias: cats } };
  });

  const delCartaItem = (cIdx, iIdx) => setAdminData(p => {
    const cats = JSON.parse(JSON.stringify(p.cartaCompleta.categorias)); cats[cIdx].items.splice(iIdx, 1);
    return { ...p, cartaCompleta: { ...p.cartaCompleta, categorias: cats } };
  });

  const procesarImpresionCocina = (mesaId, itemsAImprimir) => {
      if (!itemsAImprimir || itemsAImprimir.length === 0) return;
      
      const categoriasBebidas = ['JUGOS NATURALES', 'BEBIDAS HELADAS', 'BEBIDAS CALIENTES', 'CERVEZA', 'BEBIDAS'];
      const palabrasBebida = ['REFRESCO', 'JARRA', 'VASO', 'GASEOSA', 'LIMONADA', 'COCA COLA', 'INKA COLA', 'PILSEN', 'CUSQUEÑA', 'CRISTAL'];

      const soloPlatos = itemsAImprimir.filter(it => {
          const cat = it.categoria ? it.categoria.toUpperCase().trim() : '';
          const nom = it.nombre ? it.nombre.toUpperCase() : '';
          
          const esCategoriaBebida = categoriasBebidas.includes(cat);
          const tienePalabraBebida = palabrasBebida.some(p => nom.includes(p)) || nom === 'AGUA' || nom === 'CHICHA' || nom === 'MARACUYA';
          
          // 🟢 AQUÍ ESTÁ LA NUEVA REGLA QUE EVITA IMPRIMIR TAPERS
          const esTaper = nom.includes('TAPER') || nom.includes('ENVASE'); 
          
          return !esCategoriaBebida && !tienePalabraBebida && !esTaper;
      });

      if (soloPlatos.length === 0) return;

      const itemsLocal = soloPlatos.filter(i => i.modalidad === 'local' || i.modalidad === 'llevar');
      const itemsDelivery = soloPlatos.filter(i => i.modalidad === 'delivery' || i.modalidad === 'delivery_centro');

      if (itemsLocal.length > 0) {
          const ticketLocal = generarTicketCocina(mesaId, itemsLocal, "SALÓN / LLEVAR", POS.modoDomingo);
          enviarAImpresora(ticketLocal, 'cocina');
      }
      if (itemsDelivery.length > 0) {
          setTimeout(() => {
              const ticketDelivery = generarTicketCocina(mesaId, itemsDelivery, "DELIVERY", POS.modoDomingo);
              enviarAImpresora(ticketDelivery, 'cocina');
          }, itemsLocal.length > 0 ? 1500 : 0);
      }
  };

  const cargarListaGastos = async (fecha) => { try { const res = await axios.get(`http://localhost:3001/api/gastos?fecha=${fecha}`); setGastosHoy(res.data); } catch (e) {} };
  const abrirGastos   = () => { const hoy = obtenerFechaActualLocal(); cargarListaGastos(hoy); modalGastosInstance?.show(); };
  const guardarGasto  = async (e) => { 
    e.preventDefault(); 
    try { 
        await axios.post('http://localhost:3001/api/gastos', nuevoGasto); 
        setNuevoGasto({ descripcion: '', monto: '', categoria: 'Insumos', con_comprobante: false }); 
        cargarListaGastos(obtenerFechaActualLocal()); 
    } catch (e) { mostrarAlert("Error", "Error al guardar el gasto", "danger"); } 
  };
  const eliminarGasto = (id) => {
    solicitarConfirmacion('Anular Gasto', '¿Estás seguro de que deseas eliminar este registro de gasto permanentemente?', async () => {
        try { await axios.delete(`http://localhost:3001/api/gastos/${id}`); cargarListaGastos(obtenerFechaActualLocal()); setConfirmModal(prev => ({ ...prev, visible: false })); } catch (e) {}
    });
  };

  const abrirReporte  = async () => { const hoy = obtenerFechaActualLocal(); setFechaArqueo(hoy); setConsejoIA(null); await cargarArqueo(hoy); modalReporteInstance?.show(); };
  const cargarArqueo  = async (fecha) => { try { const res = await axios.get(`http://localhost:3001/api/reporte-diario?fecha=${fecha}`); setReporte(res.data); } catch (e) {} };

  const abrirHistorial  = async () => { const hoy = obtenerFechaActualLocal(); setFechaHistorial(hoy); await cargarHistorial(hoy); modalHistorialInstance?.show(); };
  const cargarHistorial = async (fecha) => { try { const res = await axios.get(`http://localhost:3001/api/ventas?fecha=${fecha}`); setHistorialVentas(res.data); } catch (e) {} };
  const anularVenta = (idVenta) => {
    solicitarConfirmacion('Anular Venta', `⚠️ ¿ANULAR Ticket #${idVenta}? Esta acción descontará el monto del Arqueo de hoy.`, async () => {
        try { await axios.delete(`http://localhost:3001/api/ventas/${idVenta}`); await cargarHistorial(fechaHistorial); setConfirmModal(prev => ({ ...prev, visible: false })); } catch (e) {}
    });
  };

  const abrirDashboard  = async () => { const mesActual = obtenerFechaActualLocal().slice(0, 7); setMesDashboard(mesActual); setConsejoIA(null); await cargarDashboard(mesActual); modalDashboardInstance?.show(); };
  const cargarDashboard = async (mes) => { try { const res = await axios.get(`http://localhost:3001/api/dashboard?mes=${mes}`); setDashboardData(res.data); setConsejoIA(null); } catch (e) {} };

  const pedirConsejoIADiario = async () => {
      if (!reporte) return;
      setCargandoIA(true); setConsejoIA(null);
      try {
          // 🟢 NUEVO: Calculamos automáticamente qué día de la semana es (Ej: "Sábado")
          const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
          const diaIndex = new Date(fechaArqueo + "T00:00:00").getDay();
          const nombreDia = diasSemana[diaIndex];

          const res = await axios.post('http://localhost:3001/api/ia/resumen', { 
              ingresos: reporte.totales.totalVentas.toFixed(2), 
              gastos: reporte.totales.totalGastos.toFixed(2), 
              topPlatos: reporte.topPlatos.slice(0, 5),
              diaSemana: nombreDia, // Enviado a la IA
              cantidadTotalPlatos: reporte.cantidadTotalPlatos, // Enviado a la IA
              gastoMayor: reporte.gastoMayor // Enviado a la IA
          });
          setConsejoIA(res.data);
      } catch (error) { setConsejoIA({ diagnostico: 'Error de comunicación', accion: 'Verificar conexión a internet.', nivelRiesgo: 'alto' }); }
      setCargandoIA(false);
  };

  const pedirConsejoIAMensual = async () => {
      if (!dashboardData) return;
      setCargandoIA(true); setConsejoIA(null);
      try {
          const res = await axios.post('http://localhost:3001/api/ia/mensual', { 
              ingresos: dashboardData.totales.ingresos.toFixed(2), 
              gastos: dashboardData.totales.gastos.toFixed(2), 
              platoCorona: dashboardData.platoCorona ? dashboardData.platoCorona.nombre : 'Ninguno', 
              mes: mesDashboard,
              ventasPorCategoria: dashboardData.ventasPorCategoria, // Enviado a la IA
              diasOperados: dashboardData.diasOperados // Enviado a la IA
          });
          setConsejoIA(res.data);
      } catch (error) { setConsejoIA({ diagnostico: 'Error de comunicación', decision: 'Verificar conexión a internet.', nivelFinanciero: 'critico' }); }
      setCargandoIA(false);
  };

  const abrirConfiguracion = async () => {
      setModalConfig(true);
      try {
        const resPrinters = await axios.get('http://localhost:3001/api/impresoras');
        setImpresorasUSB(resPrinters.data);
        const resConfig = await axios.get('http://localhost:3001/api/config');
        if (resConfig.data.ticketera_caja) setTicketeraCaja(resConfig.data.ticketera_caja);
        if (resConfig.data.ticketera_cocina) setTicketeraCocina(resConfig.data.ticketera_cocina);
      } catch (e) {}
  };

  const guardarConfiguracion = async () => {
      try {
        await axios.post('http://localhost:3001/api/config', { ticketera_caja: ticketeraCaja, ticketera_cocina: ticketeraCocina });
        mostrarAlert('Éxito', 'Configuración actualizada', 'success');
        setModalConfig(false);
      } catch (e) { mostrarAlert('Error', 'No se pudo guardar', 'danger'); }
  };

  const modalCloseStyle = { background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' };

  // ─── PANTALLA DE LOGIN ───
  if (!usuarioActivo) {
    return (
      <div className="erp-login-wrap">
        <div className="erp-login-box">
          <div className="erp-brand"><i className="fas fa-layer-group"></i> Calletano</div>
          <div className="pos-login-subtitle" style={{marginBottom: '2rem', color: '#D4A843'}}>ERP & Punto de Venta</div>
          
          {loginError && <div className="alert alert-danger" style={{fontSize: '0.85rem'}}>{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div className="erp-input-group">
              <label className="pos-login-label">Usuario</label>
              <input type="text" className="pos-login-input" value={loginData.username} onChange={e => setLoginData({ ...loginData, username: e.target.value })} placeholder="Ej. administrador" required />
            </div>
            <div className="erp-input-group" style={{ marginTop: '1.25rem' }}>
              <label className="pos-login-label">Contraseña</label>
              <input type="password" className="pos-login-input" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} placeholder="••••••••" required />
            </div>
            <button type="submit" className="pos-login-btn" style={{marginTop: '1.5rem'}}>Acceder al Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-layout">
      <audio ref={audioRef} src="./new-order.mp3" preload="auto" />
      <div className={`erp-sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>

      <aside className={`erp-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="erp-sidebar-header">
          <div className="erp-brand"><i className="fas fa-layer-group"></i> Calletano</div>
          <div className="erp-status-badge">
            <i className={`fas fa-circle ${serverStatus.includes('En línea') ? 'text-success' : 'text-danger'}`}></i> {serverStatus}
          </div>
        </div>

        <nav className="erp-nav">
          <button className="erp-nav-item active" onClick={() => accionMenu(() => {})}><i className="fas fa-store"></i> Punto de Venta</button>
          {usuarioActivo.rol === 'admin' && (
            <>
              <button className="erp-nav-item" onClick={() => accionMenu(abrirReporte)}><i className="fas fa-cash-register"></i> Arqueo de Caja</button>
              <button className="erp-nav-item" onClick={() => accionMenu(abrirHistorial)}><i className="fas fa-history"></i> Libro de Ventas</button>
              <button className="erp-nav-item" onClick={() => accionMenu(abrirGastos)}><i className="fas fa-file-invoice-dollar"></i> Control de Gastos</button>
              <button className="erp-nav-item" onClick={() => accionMenu(abrirDashboard)}><i className="fas fa-chart-pie"></i> Analítica Integral</button>
              {/* 🟢 NUEVO BOTÓN DE NOTIFICACIONES DE INVENTARIO */}
              <button className="erp-nav-item" onClick={() => accionMenu(() => setAlertaCritica(p => ({...p, visible: true})))}>
                 <i className="fas fa-exclamation-triangle" style={{color: '#D7263D'}}></i> Alertas Stock
                 {(alertaCritica.menu.length + alertaCritica.carta.length + alertaCritica.insumos.length) > 0 && (
                     <span className="badge" style={{background: '#D7263D', marginLeft: '8px', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '12px'}}>
                         {alertaCritica.menu.length + alertaCritica.carta.length + alertaCritica.insumos.length}
                     </span>
                 )}
              </button>
              <div style={{borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0'}}></div>
              <button className="erp-nav-item" onClick={() => accionMenu(abrirAdminPanel)}><i className="fas fa-cogs" style={{color: '#D4A843'}}></i> Panel de Control</button>
              <button className="erp-nav-item" onClick={() => accionMenu(abrirConfiguracion)}><i className="fas fa-print"></i> Setup Hardware</button>
              <button className="erp-nav-item" onClick={() => accionMenu(inicializarSistema)}><i className="fas fa-sync-alt"></i> Forzar Sync</button>
            </>
          )}
        </nav>

        <div className="erp-user-footer">
          <div className="erp-user-info"><i className="fas fa-user-circle" style={{color: '#D4A843'}}></i> {usuarioActivo.username.toUpperCase()}</div>
          <button className="erp-logout-btn" onClick={handleLogout} title="Cerrar Sesión">Salir</button>
          <button className="erp-hamburger-btn" onClick={() => setSidebarOpen(true)}>☰</button>
        </div>
      </aside>

      <div className="erp-main-wrapper">
        <main className="erp-workspace">
          <section className="erp-salon-area">
            <header className="erp-salon-header-internal">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button className="erp-hamburger-btn" onClick={() => setSidebarOpen(true)}>☰</button>
                <h1 className="erp-module-title">Salón</h1>
              </div>
              {/* 🟢 BOTONES DE DELIVERY Y RECOJO JUNTOS */}
              <div className="d-flex gap-2">
                <button className="erp-btn erp-btn-outline" style={{padding: '6px 12px', fontSize: '0.8rem'}} onClick={() => POS.setModalVirtualLlevar(true)}>
                  <i className="fas fa-shopping-bag"></i> Nuevo Recojo
                </button>
                <button className="erp-btn erp-btn-outline" style={{padding: '6px 12px', fontSize: '0.8rem'}} onClick={() => POS.setModalVirtualDelivery(true)}>
                  <i className="fas fa-motorcycle"></i> Nuevo Delivery
                </button>
              </div>
            </header>

            <div className="erp-salon-scroll-box">
               <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem'}}>
                  <div style={{fontSize: '0.85rem', fontWeight: 800, color: '#8A7060', textTransform: 'uppercase'}}><i className="fas fa-th-large"></i> SALÓN Y DELIVERY</div>
               </div>

               <div className="erp-mesas-grid">
                 {/* 🟢 OCULTAMOS LAS CUENTAS ABIERTAS DE ESTE BLOQUE */}
                 {POS.mesasOrdenadas.filter(m => !String(m.id).startsWith('CTA-')).map(mesa => {
                   const ocupada = mesa.estado === 'ocupada';
                   return (
                     <div key={mesa.id} onClick={() => POS.setMesaSeleccionada(mesa.id)} className={`erp-mesa-card ${ocupada ? 'ocupada' : ''} ${mesa.id === POS.mesaSeleccionada ? 'seleccionada' : ''}`}>
                       <div className="erp-mesa-indicator"></div>
                       {ocupada && <div className="erp-pulse-dot"></div>}
                       <div className="erp-mesa-header">
                         <h3 className="erp-mesa-nombre">{formatMesaName(mesa.id)}</h3>
                         <i className={`erp-mesa-icon fas ${isNaN(mesa.id) && !String(mesa.id).startsWith('mesa_') ? 'fa-motorcycle' : 'fa-utensils'}`}></i>
                       </div>
                       <div className="erp-mesa-details">
                         <span className="erp-mesa-items">{mesa.pedido.length} ítems</span>
                         <span className="erp-mesa-total">S/ {(mesa.total || 0).toFixed(2)}</span>
                       </div>
                     </div>
                   );
                 })}
               </div>

               {/* 🟢 NUEVO BLOQUE EXCLUSIVO PARA CUENTAS ABIERTAS */}
               <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', marginTop: '2rem'}}>
                  <div style={{fontSize: '0.85rem', fontWeight: 800, color: '#D7263D', textTransform: 'uppercase'}}><i className="fas fa-book-open"></i> CUENTAS ABIERTAS FIADAS</div>
               </div>
               <div className="erp-mesas-grid">
                 {POS.mesasOrdenadas.filter(m => String(m.id).startsWith('CTA-')).map(mesa => {
                   const ocupada = mesa.estado === 'ocupada';
                   return (
                     <div key={mesa.id} onClick={() => POS.setMesaSeleccionada(mesa.id)} className={`erp-mesa-card ${ocupada ? 'ocupada' : ''} ${mesa.id === POS.mesaSeleccionada ? 'seleccionada' : ''}`}>
                       <div className="erp-mesa-indicator" style={{background: '#D7263D'}}></div>
                       {ocupada && <div className="erp-pulse-dot" style={{background: '#D7263D', boxShadow: '0 0 8px #D7263D'}}></div>}
                       <div className="erp-mesa-header">
                         <h3 className="erp-mesa-nombre" style={{color: '#D7263D'}}>{formatMesaName(mesa.id)}</h3>
                         <i className="erp-mesa-icon fas fa-user-clock" style={{color: '#D7263D'}}></i>
                       </div>
                       <div className="erp-mesa-details">
                         <span className="erp-mesa-items">{mesa.pedido.length} ítems</span>
                         <span className="erp-mesa-total" style={{color: '#D7263D', fontWeight: 'bold'}}>S/ {(mesa.total || 0).toFixed(2)}</span>
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          </section>

          <aside className="erp-comandera">
            <div className="erp-com-header">
              <div className="erp-com-title">Mesa Seleccionada</div>
              <div className="d-flex justify-content-between align-items-center">
                 <h2 className="erp-com-mesa">{POS.mesaSeleccionada ? formatMesaName(POS.mesaSeleccionada) : 'Seleccione Mesa'}</h2>
                 {POS.mesaSeleccionada && (
                   <button className="erp-btn" style={{padding: '6px 12px', fontSize: '0.8rem', background: '#006989', color: '#FFF'}} onClick={() => POS.setModalMover(true)}>
                     <i className="fas fa-exchange-alt"></i> Trasladar
                   </button>
                 )}
              </div>
              {/* 🟢 CONTADOR DE BEBIDAS PENDIENTES + BOTÓN ASIGNAR */}
              {POS.mesaActiva && POS.mesaActiva.pedido.length > 0 && (() => {
                const pendientes = POS.obtenerSegundosSinBebida(POS.mesaActiva.pedido);
                if (pendientes <= 0) return null;
                return (
                  <div style={{background: '#D1FAE5', border: '1px solid #10B981', borderRadius: '8px', padding: '6px 12px', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#065F46'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <span style={{fontSize: '1rem'}}>🥤</span>
                      <span>{pendientes} bebida(s) pendiente(s)</span>
                    </div>
                    <button 
                      style={{background: '#10B981', color: '#FFF', border: 'none', borderRadius: '6px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'}}
                      onClick={(e) => { e.stopPropagation(); POS.abrirSelectorBebida(); }}
                    >
                      + Asignar
                    </button>
                  </div>
                );
              })()}
              {POS.mesaActiva?.nota_general && <div className="pos-comandera-nota"><i className="fas fa-info-circle"></i> {POS.mesaActiva.nota_general}</div>}
            </div>

            <div className="erp-com-toolbar d-flex gap-2">
              <button 
                className="erp-btn erp-btn-outline" 
                style={{flex: 1, padding: '8px', fontSize: '0.75rem'}} 
                disabled={!POS.mesaSeleccionada} 
                onClick={() => { POS.setFiltroCarta(''); modalInstance?.show(); }}
              >
                <i className="fas fa-search"></i> Agregar Plato
              </button>
              <button 
                className="erp-btn erp-btn-outline" 
                style={{flex: 0.8, padding: '8px', fontSize: '0.75rem'}} 
                disabled={!POS.mesaSeleccionada} 
                onClick={() => POS.setModalFueraCarta(true)} 
                title="Ítem Libre"
              >
                <i className="fas fa-pen"></i> Nuevo Plato
              </button>
            </div>

            <div className="erp-com-list" style={{ overflowX: 'hidden' }}>
              {!POS.mesaActiva || POS.mesaActiva.pedido.length === 0 ? (
                <div style={{padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem'}}>
                  <i className="fas fa-file-invoice" style={{fontSize: '2.5rem', marginBottom: '10px', opacity: 0.3}}></i>
                  <div>No hay pedidos en esta mesa.</div>
                </div>
              ) : (
                <table className="erp-data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{width: '42%', paddingRight: '4px'}}>Descripción</th>
                      <th style={{width: '16%', textAlign: 'center', paddingLeft: 0, paddingRight: 0}}>Cant.</th>
                      <th style={{width: '25%', textAlign: 'right', paddingLeft: 0}}>Importe</th>
                      <th style={{width: '17%', textAlign: 'right', paddingLeft: 0}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                       let lastDate = null;
                       const itemsVisuales = POS.mesaActiva ? agruparParaComandera(POS.mesaActiva.pedido) : [];

                       return itemsVisuales.map((vItem, idx) => {
                         // 🟢 SOLUCIÓN: Buscamos los datos originales dentro del arreglo 'refs'
                         const firstRef = vItem.refs[0];
                         const itemDate = vItem.isCombo ? (firstRef.refE.fecha_agregado || obtenerFechaActualLocal()) : (firstRef.refItem.fecha_agregado || obtenerFechaActualLocal());
                         
                         const isCuenta = String(POS.mesaSeleccionada).startsWith('CTA-');
                         const showDateDivider = isCuenta && lastDate !== itemDate;
                         lastDate = itemDate;

                         return (
                           <React.Fragment key={idx}>
                             {showDateDivider && (
                               <tr>
                                 <td colSpan="4" style={{ background: '#E5E0D8', color: '#8A7060', textAlign: 'center', fontSize: '0.75rem', fontWeight: 900, padding: '6px', textTransform: 'uppercase' }}>
                                    <i className="far fa-calendar-alt"></i> Consumos del día {itemDate}
                                 </td>
                               </tr>
                             )}
                             <tr>
                               <td style={{ paddingRight: '4px', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                                 <div className="erp-item-name">
                                    {vItem.nombre}
                                    {vItem.isCombo && <span style={{color: '#8A7060', fontSize: '0.75rem', marginLeft: '6px'}}>{vItem.detalle}</span>}
                                    {/* 🟢 Leemos la categoría desde firstRef de forma segura */}
                                    {!vItem.isCombo && ['entradas', 'segundos'].includes(firstRef.refItem.categoria?.toLowerCase()) && <span style={{color: '#D4A843', fontSize: '0.75rem', marginLeft: '6px'}}>{POS.modoDomingo ? '(ALMUERZO)' : '(MENÚ)'}</span>}

                                 </div>
                                 <div className="erp-item-meta">
                                   <span 
                                     style={{cursor: vItem.nombre.toUpperCase().startsWith('TAPER ') ? 'default' : 'pointer', color: vItem.modalidad==='local' ? '#8A7060' : '#006989', userSelect: 'none'}} 
                                     onClick={(e) => !vItem.nombre.toUpperCase().startsWith('TAPER ') && POS.cambiarModalidad(e, vItem, 'forward')}
                                     onContextMenu={(e) => !vItem.nombre.toUpperCase().startsWith('TAPER ') && POS.cambiarModalidad(e, vItem, 'backward')}
                                   >
                                     [{vItem.modalidad.toUpperCase()}]
                                   </span>
                                   {vItem.modalidad !== 'local' && vItem.taper && vItem.taper.length > 0 && <span style={{color: '#8A7060', fontSize: '0.75rem'}}> (+ Envases)</span>}
                                   {vItem.cliente && <span style={{color: '#D7263D', display: 'block', marginTop: '2px'}}><i className="fas fa-map-marker-alt"></i> Dest: {vItem.cliente.nombre}</span>}
                                   {vItem.nota && <span style={{color: '#D7263D', display: 'block', marginTop: '2px', fontWeight: 'bold'}}>Nota: {vItem.nota}</span>}
                                 </div>
                               </td>
                               <td style={{ paddingLeft: 0, paddingRight: 0 }}>
                                 <div className="erp-qty-controls" style={{ transform: 'scale(0.9)', transformOrigin: 'center' }}>
                                   <button className="erp-qty-btn" onClick={() => POS.modificarCantidad(vItem, -1)}>-</button>
                                   <div className="erp-qty-val">{vItem.cantidad}</div>
                                   <button className="erp-qty-btn" onClick={() => POS.modificarCantidad(vItem, 1)}>+</button>
                                 </div>
                               </td>
                               <td className="erp-item-price" style={{ paddingLeft: 0 }}>S/ {(Number(vItem.subtotal) || 0).toFixed(2)}</td>
                               <td style={{ paddingLeft: 0 }}>
                                 <div className="d-flex gap-1 justify-content-end">
                                    <button className="erp-btn" style={{padding: 0, background: '#D4A843', border: 'none', borderRadius: '6px', width: '32px', height: '32px'}} onClick={() => POS.setNotaCaja({ visible: true, vItem, texto: vItem.nota || '', cantidadMover: 1 })}><PencilLine size={16} color="#120B06" /></button>
                                    <button className="erp-delete-btn" style={{padding: 0, width: '32px', height: '32px', borderRadius: '6px'}} onClick={() => POS.eliminarDelPedido(vItem)}><Trash2 size={16} color="#120B06" /></button>
                                 </div>
                               </td>
                             </tr>
                           </React.Fragment>
                         );
                       });
                    })()}
                  </tbody>
                </table>
              )}
            </div>

            <div className="erp-com-footer" style={{ position: 'relative' }}>
              {POS.mesaActiva && POS.mesaActiva.pedido.some(item => !item.impreso) && (
                <div className="animate__animated animate__fadeInUp" style={{ position: 'absolute', top: '-55px', left: '0', right: '0', display: 'flex', justifyContent: 'center', zIndex: 50, pointerEvents: 'none' }}>
                  <button 
                    className="erp-btn erp-btn-primary animate__animated animate__pulse animate__infinite" 
                    style={{ padding: '6px 18px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 800, boxShadow: '0 4px 15px rgba(0, 105, 137, 0.5)', border: '2px solid #FFF', pointerEvents: 'auto', letterSpacing: '0.5px', opacity: 0.8, backdropFilter: 'blur(2px)' }}
                    onClick={POS.enviarACocina}
                  >
                    <i className="fas fa-fire" style={{marginRight: '6px', color: '#FFF', fontSize: '0.75rem'}}></i> ¡ENVIAR A COCINA!
                  </button>
                </div>
              )}

              <div className="erp-action-grid">
                <button className="erp-btn erp-btn-outline" disabled={!POS.mesaActiva} onClick={() => POS.agregarPlatoDirecto('TAPER CHICO', 1.00, 'general')} style={{fontSize: '0.75rem', padding: '8px'}}><i className="fas fa-box-open"></i> Taper S/1</button>
                <button className="erp-btn erp-btn-outline" disabled={!POS.mesaActiva} onClick={() => POS.agregarPlatoDirecto('TAPER MEDIANO', 2.00, 'general')} style={{fontSize: '0.75rem', padding: '8px'}}><i className="fas fa-box"></i> Taper S/2</button>
                <button className="erp-btn erp-btn-outline" disabled={!POS.mesaActiva} onClick={() => POS.agregarPlatoDirecto('Refresco', POS.modoDomingo ? 3.50 : 2.00, 'general')} style={{gridColumn: '1 / span 2', fontSize: '0.75rem', padding: '8px'}}><i className="fas fa-glass-whiskey"></i> Refresco (S/ {POS.modoDomingo ? '3.50' : '2.00'})</button>
              </div>

              <div className="erp-totals-row">
                <span className="erp-totals-label">Subtotal Mesa</span>
                <span className={`erp-totals-value ${!POS.mesaActiva || POS.mesaActiva.total === 0 ? 'cero' : ''}`}>S/ {POS.mesaActiva ? (Number(POS.mesaActiva.total) || 0).toFixed(2) : '0.00'}</span>
              </div>

              <button className="erp-btn erp-btn-outline mb-2" style={{width: '100%'}} disabled={!POS.mesaActiva || POS.mesaActiva.pedido.length === 0} onClick={POS.imprimirPreCuenta}>
                 <i className="fas fa-print"></i> Imprimir Pre-Cuenta
              </button>

              <div className="d-flex gap-2">
                <button 
                  className="erp-btn" 
                  style={{ flex: 1, background: '#8A7060', color: '#FFF', fontSize: '0.85rem' }} 
                  disabled={!POS.mesaActiva || POS.mesaActiva.estado === 'libre'} 
                  onClick={() => { POS.setTipoCobro('nota'); POS.setPagos({ yape: 0, plin: 0, tarjeta: 0 }); POS.setMontoRecibido(POS.mesaActiva.total); modalCobroInstance?.show(); }}
                >
                  NOTA DE VENTA
                </button>
                <button 
                  className="erp-btn erp-btn-success" 
                  style={{ flex: 1.2, fontSize: '0.85rem' }} 
                  disabled={!POS.mesaActiva || POS.mesaActiva.estado === 'libre'} 
                  onClick={() => { POS.setTipoCobro('boleta'); POS.setPagos({ yape: 0, plin: 0, tarjeta: 0 }); POS.setMontoRecibido(POS.mesaActiva.total); modalCobroInstance?.show(); }}
                >
                  <i className="fas fa-file-invoice"></i> GENERAR BOLETA
                </button>
              </div>
            </div>
          </aside>
        </main>
      </div>

      {/* ─── MODALES DE LÓGICA DE CAJA (SPLIT, MOVER MESA, NOTA) ─── */}
      {POS.notaCaja.visible && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="erp-modal-header" style={{background: '#D4A843', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem'}}>
                <h5 className="erp-modal-title" style={{margin: 0, color: '#120B06', fontWeight: 800}}>Nota para Cocina</h5>
                <button style={modalCloseStyle} onClick={() => POS.setNotaCaja({ visible: false, idx: null, texto: '', cantidadMover: 1 })}><X size={24} color="#120B06" /></button>
              </div>
              <div className="erp-modal-body">
                <textarea className="erp-input" rows="3" style={{resize: 'none', marginBottom: '1.5rem'}} value={POS.notaCaja.texto} onChange={e => POS.setNotaCaja({...POS.notaCaja, texto: e.target.value.toUpperCase()})} placeholder="Ej: SIN AJI" autoFocus></textarea>
                
                {POS.mesaActiva.pedido[POS.notaCaja.idx]?.cantidad > 1 && (
                  <div className="mb-4 text-center">
                    <label className="erp-label" style={{marginBottom: '8px', color: '#8A7060'}}>¿A cuántos platos aplicar?</label>
                    <div className="d-flex justify-content-center align-items-center gap-3" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px'}}>
                      <button className="erp-btn erp-btn-outline" style={{padding: '2px 10px', fontSize: '1.2rem', fontWeight: 'bold'}} onClick={() => POS.setNotaCaja(p => ({...p, cantidadMover: Math.max(1, p.cantidadMover - 1)}))}>-</button>
                      <span style={{fontSize: '1.6rem', fontWeight: 800, minWidth: '35px', display: 'inline-block'}}>{POS.notaCaja.cantidadMover}</span>
                      <button className="erp-btn erp-btn-outline" style={{padding: '2px 10px', fontSize: '1.2rem', fontWeight: 'bold'}} onClick={() => POS.setNotaCaja(p => ({...p, cantidadMover: Math.min(POS.mesaActiva.pedido[POS.notaCaja.idx].cantidad, p.cantidadMover + 1)}))}>+</button>
                    </div>
                  </div>
                )}
                <button className="erp-btn erp-btn-success" style={{width: '100%'}} onClick={POS.guardarNotaCaja}>Guardar Nota</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {POS.uiSplit.visible && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="erp-modal-header" style={{background: '#D4A843', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem'}}>
                <h5 className="erp-modal-title" style={{margin: 0, color: '#120B06', fontWeight: 800}}>Separar Platos</h5>
                <button style={modalCloseStyle} onClick={() => POS.setUiSplit({ visible: false, idx: null, nextMod: '', cantidadTotal: 0, cantidadMover: 1 })}><X size={24} color="#120B06" /></button>
              </div>
              <div className="erp-modal-body text-center">
                <p style={{ fontWeight: 700, color: '#8A7060', marginBottom: '1.5rem' }}>
                  ¿Cuántos deseas cambiar a <strong style={{color: '#120B06'}}>{POS.uiSplit.nextMod.toUpperCase()}</strong>?
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '1.5rem' }}>
                   <button className="erp-btn" style={{ width: '45px', height: '45px', borderRadius: '50%', padding: 0, background: '#E5E0D8', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => POS.setUiSplit(p => ({...p, cantidadMover: Math.max(1, p.cantidadMover - 1)}))}> <Minus size={24} color="#120B06" /> </button>
                   <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#120B06', minWidth: '40px' }}>{POS.uiSplit.cantidadMover}</span>
                   <button className="erp-btn" style={{ width: '45px', height: '45px', borderRadius: '50%', padding: 0, background: '#E5E0D8', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => POS.setUiSplit(p => ({...p, cantidadMover: Math.min(p.cantidadTotal, p.cantidadMover + 1)}))}> <Plus size={24} color="#120B06" /> </button>
                </div>
                <button className="erp-btn erp-btn-primary" style={{width: '100%', fontSize: '1rem', padding: '12px'}} onClick={POS.confirmarSplit}>CONFIRMAR</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE LA CARTA ─── */}
      <div className="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-scrollable modal-xl">
          <div className="modal-content">
            <div className="erp-modal-header" style={{background: '#120B06', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem'}}>
              <h4 className="erp-modal-title" style={{margin: 0}}><i className="fas fa-list" style={{color: '#D4A843', marginRight: '8px'}}></i> Catálogo de Productos</h4>
              <button style={modalCloseStyle} onClick={() => modalInstance?.hide()}><X size={28} color="#FFF" /></button>
            </div>
            <div className="erp-menu-search">
              <input type="text" className="erp-input" placeholder="Filtrar catálogo (Ej: Arroz, Ceviche...)" value={POS.filtroCarta} onChange={e => POS.setFiltroCarta(e.target.value)} />
            </div>
            <div className="erp-modal-body">
              {POS.carta.filter(c => ['entradas', 'segundos'].includes(c.nombre.toLowerCase().trim())).map((cat, idx) => {
                const nombreNormalizado = cat.nombre.toLowerCase().trim();
                if (POS.modoDomingo && nombreNormalizado === 'entradas') return null;
                const itemsFiltrados = cat.items.filter(p => p.nombre.toLowerCase().includes(POS.filtroCarta.toLowerCase()));
                if (itemsFiltrados.length === 0) return null;
                return (
                  <div key={`menu-${idx}`}>
                    <div className="erp-category-title">{cat.nombre}</div>
                    <div className="erp-plato-grid">
                      {itemsFiltrados.map(plato => {
                        const agotado = plato.stock_actual !== null && plato.stock_actual <= 0;
                        const pocoStock = plato.stock_actual !== null && plato.stock_actual <= 3 && plato.stock_actual > 0;
                        return (
                          <div key={plato.id} 
                               className={`erp-plato-btn ${cat.nombre === 'entradas' ? 'entrada' : (cat.nombre === 'segundos' ? 'segundo' : '')}`} 
                               onClick={() => { if (!agotado) POS.agregarPlatoCarta(plato, cat.nombre); }}
                               style={{ opacity: agotado ? 0.5 : 1, cursor: agotado ? 'not-allowed' : 'pointer' }}>
                            <div className="pos-plato-btn-bar" style={{ backgroundColor: agotado ? '#8A7060' : '' }}></div>
                            {pocoStock && (<div style={{position: 'absolute', top: '-8px', right: '-8px', background: '#D7263D', color: '#FFF', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', zIndex: 10, border: '2px solid #FFF'}}>¡Quedan {plato.stock_actual}!</div>)}
                            <span className="erp-plato-name" style={{ textDecoration: agotado ? 'line-through' : 'none' }}>{plato.nombre}</span>
                            <span className="erp-plato-price">{agotado ? 'AGOTADO' : `S/ ${plato.precio.toFixed(2)}`}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                );
              })}

              {POS.carta.filter(c => c.nombre !== 'entradas' && c.nombre !== 'segundos').map((cat, idx) => {
                const itemsFiltrados = cat.items.filter(p => p.nombre.toLowerCase().includes(POS.filtroCarta.toLowerCase()));
                if (itemsFiltrados.length === 0) return null;
                return (
                  <div key={`carta-${idx}`}>
                    <div className="erp-category-title">{cat.nombre}</div>
                    <div className="erp-plato-grid">
                      {itemsFiltrados.map(plato => {
                        const agotado = plato.stock_actual !== null && plato.stock_actual <= 0;
                        const pocoStock = plato.stock_actual !== null && plato.stock_actual <= 3 && plato.stock_actual > 0;
                        return (
                          <div key={plato.id} className="erp-plato-btn" onClick={() => { if (!agotado) POS.agregarPlatoCarta(plato, cat.nombre); }} style={{ opacity: agotado ? 0.5 : 1, cursor: agotado ? 'not-allowed' : 'pointer' }}>
                            <div className="pos-plato-btn-bar" style={{ backgroundColor: agotado ? '#8A7060' : '' }}></div>
                            {pocoStock && (<div style={{position: 'absolute', top: '-8px', right: '-8px', background: '#D7263D', color: '#FFF', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', zIndex: 10, border: '2px solid #FFF'}}>¡Quedan {plato.stock_actual}!</div>)}
                            <span className="erp-plato-name" style={{ textDecoration: agotado ? 'line-through' : 'none' }}>{plato.nombre}</span>
                            <span className="erp-plato-price">{agotado ? 'AGOTADO' : `S/ ${plato.precio.toFixed(2)}`}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODALES DE COMPONENTES EXTERNOS ─── */}
      <ModalCobro modalRef={modalCobroRef} modalInstance={modalCobroInstance} modalCloseStyle={modalCloseStyle} tipoCobro={POS.tipoCobro} mesaActiva={POS.mesaActiva} pagos={POS.pagos} setPagos={POS.setPagos} montoRecibido={POS.montoRecibido} setMontoRecibido={POS.setMontoRecibido} clienteFacturacion={POS.clienteFacturacion} setClienteFacturacion={POS.setClienteFacturacion} procesarCobro={POS.procesarCobro} />
      <ModalGastos modalRef={modalGastosRef} modalInstance={modalGastosInstance} modalCloseStyle={modalCloseStyle} gastos={gastosHoy} nuevoGasto={nuevoGasto} setNuevoGasto={setNuevoGasto} guardarGasto={guardarGasto} eliminarGasto={eliminarGasto} />
      <ModalArqueo modalRef={modalReporteRef} modalInstance={modalReporteInstance} modalCloseStyle={modalCloseStyle} fechaArqueo={fechaArqueo} setFechaArqueo={setFechaArqueo} cargarArqueo={cargarArqueo} reporte={reporte} cargandoIA={cargandoIA} pedirConsejoIADiario={pedirConsejoIADiario} consejoIA={consejoIA} />
      <ModalHistorial modalRef={modalHistorialRef} modalInstance={modalHistorialInstance} modalCloseStyle={modalCloseStyle} fechaHistorial={fechaHistorial} setFechaHistorial={setFechaHistorial} cargarHistorial={cargarHistorial} historialVentas={historialVentas} formatMesaName={formatMesaName} anularVenta={anularVenta} abrirCarpetaSUNAT={abrirCarpetaSUNAT} />
      <ModalDashboard modalRef={modalDashboardRef} modalInstance={modalDashboardInstance} modalCloseStyle={modalCloseStyle} mesDashboard={mesDashboard} setMesDashboard={setMesDashboard} cargarDashboard={cargarDashboard} dashboardData={dashboardData} pedirConsejoIAMensual={pedirConsejoIAMensual} cargandoIA={cargandoIA} consejoIA={consejoIA} />
      <ModalAdmin modalRef={modalAdminRef} modalInstance={modalAdminInstance} modalCloseStyle={modalCloseStyle} adminTab={adminTab} setAdminTab={setAdminTab} adminData={adminData} setAdminData={setAdminData} guardarAdminMenu={guardarAdminMenu} updateMenuField={updateMenuField} toggleDomingoAdmin={toggleDomingoAdmin} addMenuRow={addMenuRow} updateMenuArr={updateMenuArr} toggleTaperMenu={toggleTaperMenu} delMenuRow={delMenuRow} addCartaCat={addCartaCat} guardarAdminCarta={guardarAdminCarta} updateCartaCat={updateCartaCat} delCartaCat={delCartaCat} updateCartaItem={updateCartaItem} delCartaItem={delCartaItem} addCartaItem={addCartaItem} setPlatoSeleccionado={setPlatoSeleccionado} cargarRecetaPlato={cargarRecetaPlato} setModalReceta={setModalReceta} guardarAdminEstado={guardarAdminEstado} insumoEditando={insumoEditando} setInsumoEditando={setInsumoEditando} nuevoInsumoForm={nuevoInsumoForm} setNuevoInsumoForm={setNuevoInsumoForm} guardarNuevoInsumo={guardarNuevoInsumo} deshabilitarInsumo={deshabilitarInsumo} habilitarInsumo={habilitarInsumo} inventario={inventario} busquedaKardex={busquedaKardex} setBusquedaKardex={setBusquedaKardex} movimientoData={movimientoData} setMovimientoData={setMovimientoData} guardarMovimientoInv={guardarMovimientoInv} />

      {/* ─── MODALES DE ESTADO SECUNDARIOS ─── */}
      {modalConfig && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #D4A843', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem'}}>
                <h4 className="erp-modal-title" style={{margin: 0}}><i className="fas fa-print" style={{color:'#D4A843', marginRight: '8px'}}></i> Hardware Setup</h4>
                <button style={modalCloseStyle} onClick={() => setModalConfig(false)}><X size={28} color="#FFF" /></button>
              </div>
              <div className="erp-modal-body" style={{padding: '2.5rem'}}>
                <div className="erp-input-group" style={{marginBottom: '2rem'}}>
                  <label className="erp-label" style={{color: '#006989'}}><i className="fas fa-desktop"></i> Impresora Principal (Caja USB)</label>
                  <select className="erp-input" style={{marginTop: '8px'}} value={ticketeraCaja} onChange={e => setTicketeraCaja(e.target.value)}><option value="">-- No asignada --</option>{impresorasUSB.map((imp, idx) => (<option key={idx} value={imp}>{imp}</option>))}</select>
                </div>
                <div className="erp-input-group" style={{marginBottom: '2.5rem'}}>
                  <label className="erp-label" style={{color: '#D7263D'}}><i className="fas fa-fire"></i> Impresora Remota (Cocina)</label>
                  <select className="erp-input" style={{marginTop: '8px'}} value={ticketeraCocina} onChange={e => setTicketeraCocina(e.target.value)}><option value="">-- No asignada --</option>{impresorasUSB.map((imp, idx) => (<option key={idx} value={imp}>{imp}</option>))}</select>
                </div>
                <button className="erp-btn erp-btn-primary" style={{width: '100%', padding: '1rem'}} onClick={guardarConfiguracion}>Aplicar Configuración</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {POS.modalVirtualDelivery && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="erp-modal-header" style={{background: '#120B06', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem'}}>
                <h4 className="erp-modal-title" style={{margin: 0}}><i className="fas fa-motorcycle" style={{color: '#D4A843', marginRight: '8px'}}></i> Crear Delivery</h4>
                <button style={modalCloseStyle} onClick={() => POS.setModalVirtualDelivery(false)}><X size={24} color="#FFF" /></button>
              </div>
              <div className="erp-modal-body">
                <form onSubmit={POS.crearMesaDelivery}>
                  <div className="erp-input-group">
                    <label className="erp-label">Nombre del Cliente</label>
                    <input type="text" className="erp-input" value={POS.datosVirtualDelivery.nombre} onChange={e => POS.setDatosVirtualDelivery({...POS.datosVirtualDelivery, nombre: e.target.value.toUpperCase()})} required autoFocus />
                  </div>
                  <div className="erp-input-group">
                    <label className="erp-label">Dirección / Ref</label>
                    <input type="text" className="erp-input" value={POS.datosVirtualDelivery.direccion} onChange={e => POS.setDatosVirtualDelivery({...POS.datosVirtualDelivery, direccion: e.target.value.toUpperCase()})} required />
                  </div>
                  <div className="erp-input-group" style={{marginBottom: '2rem'}}>
                    <label className="erp-label">Teléfono (Opcional)</label>
                    <input type="tel" className="erp-input" value={POS.datosVirtualDelivery.telefono} onChange={e => POS.setDatosVirtualDelivery({...POS.datosVirtualDelivery, telefono: e.target.value})} />
                  </div>
                  <button type="submit" className="erp-btn erp-btn-primary" style={{width: '100%'}}>Generar Orden</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {POS.modalItemDelivery && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="erp-modal-header" style={{background: '#D7263D', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem'}}>
                <h4 className="erp-modal-title" style={{margin: 0, color: '#FFF'}}><i className="fas fa-map-marker-alt" style={{marginRight: '8px'}}></i> Datos Logísticos</h4>
                <button style={modalCloseStyle} onClick={() => POS.setModalItemDelivery(false)}><X size={24} color="#FFF" /></button>
              </div>
              <div className="erp-modal-body">
                <form onSubmit={POS.guardarItemDelivery}>
                  <div className="erp-input-group">
                    <label className="erp-label">Nombre del Cliente</label>
                    <input type="text" className="erp-input" value={POS.datosItemDelivery.nombre} onChange={e => POS.setDatosItemDelivery({...POS.datosItemDelivery, nombre: e.target.value.toUpperCase()})} required autoFocus />
                  </div>
                  <div className="erp-input-group">
                    <label className="erp-label">Dirección / Ref</label>
                    <input type="text" className="erp-input" value={POS.datosItemDelivery.direccion} onChange={e => POS.setDatosItemDelivery({...POS.datosItemDelivery, direccion: e.target.value.toUpperCase()})} required />
                  </div>
                  <div className="erp-input-group" style={{marginBottom: '2rem'}}>
                    <label className="erp-label">Teléfono (Opcional)</label>
                    <input type="tel" className="erp-input" value={POS.datosItemDelivery.telefono} onChange={e => POS.setDatosItemDelivery({...POS.datosItemDelivery, telefono: e.target.value})} />
                  </div>
                  <button type="submit" className="erp-btn" style={{width: '100%', background: '#D7263D', color: '#FFF'}}>Guardar Parámetros</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {POS.modalVirtualLlevar && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="erp-modal-header" style={{background: '#006989', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem'}}>
                <h4 className="erp-modal-title" style={{margin: 0, color: '#FFF'}}><i className="fas fa-shopping-bag" style={{marginRight: '8px'}}></i> Crear Recojo</h4>
                <button style={modalCloseStyle} onClick={() => POS.setModalVirtualLlevar(false)}><X size={24} color="#FFF" /></button>
              </div>
              <div className="erp-modal-body">
                <form onSubmit={POS.crearMesaLlevar}>
                  <div className="erp-input-group">
                    <label className="erp-label">Nombre de quien recoge</label>
                    <input type="text" className="erp-input" value={POS.datosVirtualLlevar.nombre} onChange={e => POS.setDatosVirtualLlevar({...POS.datosVirtualLlevar, nombre: e.target.value.toUpperCase()})} required autoFocus />
                  </div>
                  <div className="erp-input-group" style={{marginBottom: '2rem'}}>
                    <label className="erp-label">Teléfono (Opcional)</label>
                    <input type="tel" className="erp-input" value={POS.datosVirtualLlevar.telefono} onChange={e => POS.setDatosVirtualLlevar({...POS.datosVirtualLlevar, telefono: e.target.value})} />
                  </div>
                  <button type="submit" className="erp-btn" style={{width: '100%', background: '#006989', color: '#FFF'}}>Generar Orden de Recojo</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {POS.modalFueraCarta && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #006989', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem'}}>
                <h4 className="erp-modal-title" style={{margin: 0}}><i className="fas fa-plus-circle" style={{color: '#006989', marginRight: '8px'}}></i> Ítem Libre</h4>
                <button style={modalCloseStyle} onClick={() => POS.setModalFueraCarta(false)}><X size={24} color="#FFF" /></button>
              </div>
              <div className="erp-modal-body">
                <form onSubmit={POS.guardarPlatoPersonalizado}>
                  <div className="erp-input-group">
                    <label className="erp-label">Descripción</label>
                    <input type="text" className="erp-input" value={POS.fueraCartaItem.nombre} onChange={e => POS.setFueraCartaItem({...POS.fueraCartaItem, nombre: e.target.value.toUpperCase()})} required autoFocus />
                  </div>
                  <div className="erp-input-group" style={{marginBottom: '2rem'}}>
                    <label className="erp-label">Importe (S/)</label>
                    <input type="number" step="0.10" className="erp-input" value={POS.fueraCartaItem.precio} onChange={e => POS.setFueraCartaItem({...POS.fueraCartaItem, precio: e.target.value})} required />
                  </div>
                  <button type="submit" className="erp-btn" style={{background: '#006989', color: '#FFF', width: '100%'}}>Agregar Línea</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmModal.visible && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.7)', zIndex: 2000 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', maxWidth: '380px', margin: '0 auto' }}>
              <div className="erp-modal-header py-3" style={{ background: '#D7263D', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h5 className="erp-modal-title" style={{ fontSize: '1.1rem', margin: 0, color: '#FFF' }}>{confirmModal.title}</h5>
                <button style={modalCloseStyle} onClick={() => setConfirmModal({ ...confirmModal, visible: false })}><X size={20} color="#FFF" /></button>
              </div>
              <div className="erp-modal-body text-center py-4" style={{ background: '#F4F1ED' }}>
                <i className="fas fa-exclamation-triangle mb-3" style={{ fontSize: '2.5rem', color: '#D7263D' }}></i>
                <p className="mb-4" style={{ color: '#2D241E', fontWeight: '700', fontSize: '0.95rem', padding: '0 10px' }}>{confirmModal.message}</p>
                <div className="d-flex gap-2">
                  <button className="erp-btn erp-btn-outline flex-grow-1" onClick={() => setConfirmModal({ ...confirmModal, visible: false })}>CANCELAR</button>
                  <button className="erp-btn flex-grow-1" style={{ background: '#D7263D', color: '#FFF' }} onClick={confirmModal.onConfirm}>CONFIRMAR</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {alertModal.visible && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.7)', zIndex: 2100 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', maxWidth: '350px', margin: '0 auto' }}>
              <div className="erp-modal-body text-center py-5" style={{ background: '#FFFFFF' }}>
                <i className={`fas ${alertModal.type === 'success' ? 'fa-check-circle text-success' : 'fa-exclamation-circle text-danger'} mb-3`} style={{ fontSize: '3.5rem' }}></i>
                <h4 style={{ fontFamily: 'Playfair Display', fontWeight: '800' }}>{alertModal.title}</h4>
                <p className="text-muted mb-4">{alertModal.message}</p>
                <button className="erp-btn erp-btn-primary w-100" onClick={() => setAlertModal({ ...alertModal, visible: false })}>ENTENDIDO</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalReceta && platoSeleccionado && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="erp-modal-header py-3" style={{ background: '#006989', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                <h5 className="erp-modal-title" style={{ margin: 0, color: '#FFF', fontWeight: 800 }}><i className="fas fa-receipt"></i> Receta: {platoSeleccionado.nombre}</h5>
                <button style={modalCloseStyle} onClick={() => { setModalReceta(false); setPlatoSeleccionado(null); }}><X size={24} color="#FFF" /></button>
              </div>
              <div className="erp-modal-body" style={{background: '#F4F1ED'}}>
                <form onSubmit={agregarIngredienteReceta} className="row g-2 mb-4 bg-white p-3 rounded border align-items-end">
                  <div className="col-12 col-md-6">
                    <label className="erp-label" style={{fontSize:'0.75rem'}}>Insumo del Almacén</label>
                    <input type="text" list="lista-insumos-receta" className="erp-input mb-0" style={{padding: '12px'}} placeholder="Buscar..." value={busquedaKardex} onChange={e => { setBusquedaKardex(e.target.value); const encontrado = inventario.find(i => i.nombre === e.target.value); setNuevaRecetaRow({...nuevaRecetaRow, insumo_id: encontrado ? encontrado.id : ''}); }} required />
                    <datalist id="lista-insumos-receta">{inventario.map(i => <option key={i.id} value={i.nombre}>{i.nombre} ({i.unidad_medida})</option>)}</datalist>
                  </div>
                  <div className="col-8 col-md-4">
                    <label className="erp-label" style={{fontSize:'0.75rem'}}>Cantidad</label>
                    <input type="text" className="erp-input mb-0" style={{padding: '12px'}} placeholder="Ej: 1.5" value={nuevaRecetaRow.cantidad_requerida || ''} onChange={e => { const valorLimpio = e.target.value.replace(/[^0-9.]/g, ''); setNuevaRecetaRow({...nuevaRecetaRow, cantidad_requerida: valorLimpio}); }} required />
                  </div>
                  <div className="col-4 col-md-2">
                    <button type="submit" className="erp-btn w-100" style={{height: '47px', background: '#D4A843', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center'}}><Plus size={24} color="#120B06" /></button>
                  </div>
                </form>
                <div className="bg-white rounded border overflow-hidden">
                  <table className="pos-table mb-0" style={{fontSize: '0.9rem'}}>
                    <thead>
                      <tr style={{background: '#F8F9FA'}}><th style={{padding: '8px 12px'}}>Insumo del Almacén</th><th style={{padding: '8px 12px', textAlign: 'center'}}>Porción / Gramos</th><th style={{padding: '8px 12px', textAlign: 'center'}}>Acción</th></tr>
                    </thead>
                    <tbody>
                      {ingredientesPlato.map(ing => (
                        <tr key={ing.id}>
                          <td style={{padding: '10px 12px', fontWeight: 700}}>{ing.nombre}</td>
                          <td style={{padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#006989'}}>{ing.cantidad_requerida} <span style={{fontSize: '0.75rem', fontWeight: 400, color: '#8A7060'}}>{ing.unidad_medida}</span></td>
                          <td style={{padding: '6px 12px', textAlign: 'center'}}><button className="erp-delete-btn" style={{padding: '4px 10px', height: '30px', width: '35px'}} onClick={() => eliminarIngredienteReceta(ing.id)}><Trash2 size={14} color="#120B06"/></button></td>
                        </tr>
                      ))}
                      {ingredientesPlato.length === 0 && (<tr><td colSpan="3" style={{textAlign: 'center', padding: '1.5rem', color: '#8A7060', fontSize: '0.85rem'}}>Este plato no descuenta insumos crudos actualmente.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {alertaCritica.visible && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.8)', zIndex: 2200 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="erp-modal-header py-3" style={{ background: '#D7263D', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                <h5 className="erp-modal-title" style={{ margin: 0, color: '#FFF', fontWeight: 800 }}><i className="fas fa-exclamation-triangle"></i> ¡ATENCIÓN: INVENTARIO CRÍTICO!</h5>
                <button style={modalCloseStyle} onClick={() => setAlertaCritica({ visible: false, menu: [], carta: [], insumos: [] })}><X size={24} color="#FFF" /></button>
              </div>
              <div className="erp-modal-body" style={{background: '#F4F1ED'}}>
                {alertaCritica.menu.length > 0 && (
                   <div className="mb-4 bg-white p-3 rounded border">
                      <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                         <h6 style={{color: '#006989', fontWeight: 800, margin: 0}}>RACIONES DEL MENÚ</h6>
                         <button className="erp-btn" style={{background: '#006989', color: '#FFF', padding: '4px 10px', fontSize: '0.8rem'}} onClick={() => { setAlertaCritica({...alertaCritica, visible: false}); abrirAdminPanel(); }}>Ir a Menú</button>
                      </div>
                      {alertaCritica.menu.map((m, i) => (<div key={i} className="d-flex justify-content-between my-2"><span style={{fontWeight: 700}}>{m.nombre}</span><span style={{color: '#D7263D', fontWeight: 800}}>{m.restante} raciones</span></div>))}
                   </div>
                )}
                {alertaCritica.carta.length > 0 && (
                   <div className="mb-4 bg-white p-3 rounded border" style={{borderColor: '#D4A843'}}>
                      <div className="mb-2 pb-2 border-bottom"><h6 style={{color: '#D4A843', fontWeight: 800, margin: 0}}>PLATOS A LA CARTA</h6><small style={{color: '#8A7060', fontSize: '0.75rem'}}>Solo queda stock para:</small></div>
                      {alertaCritica.carta.map((c, i) => (<div key={i} className="d-flex justify-content-between my-2"><span style={{fontWeight: 700}}>{c.nombre}</span><span style={{color: '#D7263D', fontWeight: 800}}>{c.restante} platos</span></div>))}
                   </div>
                )}
                {alertaCritica.insumos?.length > 0 && (
                   <div className="bg-white p-3 rounded border" style={{borderColor: '#10B981'}}>
                      <div className="mb-2 pb-2 border-bottom"><h6 style={{color: '#10B981', fontWeight: 800, margin: 0}}>INSUMOS Y ENVASES</h6></div>
                      {alertaCritica.insumos.map((ins, i) => (<div key={i} className="d-flex justify-content-between my-2"><span style={{fontWeight: 700}}>📦 {ins.nombre}</span><span style={{color: '#D7263D', fontWeight: 800}}>{ins.restante} unid.</span></div>))}
                   </div>
                )}
                <button className="erp-btn w-100 mt-4" style={{background: '#120B06', color: '#FFF'}} onClick={() => setAlertaCritica({ visible: false, menu: [], carta: [], insumos: [] })}>Entendido</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {POS.modalMover && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.8)', zIndex: 2200 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="erp-modal-header py-3" style={{ background: '#006989', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                <h5 className="erp-modal-title" style={{ margin: 0, color: '#FFF', fontWeight: 800 }}><i className="fas fa-exchange-alt"></i> Trasladar Cuenta</h5>
                <button style={modalCloseStyle} onClick={() => POS.setModalMover(false)}><X size={24} color="#FFF" /></button>
              </div>
              <div className="erp-modal-body" style={{background: '#F4F1ED'}}>
                <form onSubmit={POS.confirmarMoverMesa}>
                   <div className="d-flex gap-2 mb-3">
                      <button type="button" className={`erp-btn ${POS.datosMover.tipo === 'mesa' ? 'erp-btn-primary' : 'erp-btn-outline'}`} style={{flex: 1, padding: '8px'}} onClick={() => POS.setDatosMover({...POS.datosMover, tipo: 'mesa', subTipo: null})}>A Mesa</button>
                      <button type="button" className={`erp-btn ${POS.datosMover.tipo === 'cuenta' ? 'erp-btn-primary' : 'erp-btn-outline'}`} style={{flex: 1, padding: '8px'}} onClick={() => POS.setDatosMover({...POS.datosMover, tipo: 'cuenta', subTipo: 'existente'})}>Cuenta Abierta</button>
                   </div>
                   {POS.datosMover.tipo === 'mesa' ? (
                     <div className="mb-4">
                       <label className="erp-label">Seleccione Mesa Libre</label>
                       <select className="erp-input" value={POS.datosMover.destino} onChange={e => POS.setDatosMover({...POS.datosMover, destino: e.target.value})} required>
                          <option value="">-- Elegir --</option>
                          {[...Array(12)].map((_, i) => <option key={i} value={`mesa_${i+1}`}>Mesa {i+1}</option>)}
                       </select>
                     </div>
                   ) : (
                     <>
                       <div className="d-flex gap-2 mb-3">
                          <button type="button" className={`erp-btn ${POS.datosMover.subTipo === 'existente' ? 'erp-btn-primary' : 'erp-btn-outline'}`} style={{flex: 1, padding: '8px', fontSize: '0.75rem'}} onClick={() => POS.setDatosMover({...POS.datosMover, subTipo: 'existente', destino: '', nombreCuenta: ''})}>Existente</button>
                          <button type="button" className={`erp-btn ${POS.datosMover.subTipo === 'nueva' ? 'erp-btn-primary' : 'erp-btn-outline'}`} style={{flex: 1, padding: '8px', fontSize: '0.75rem'}} onClick={() => POS.setDatosMover({...POS.datosMover, subTipo: 'nueva', destino: '', nombreCuenta: ''})}>Nueva Cuenta</button>
                       </div>
                       {POS.datosMover.subTipo === 'existente' ? (
                         <div className="mb-4">
                           <label className="erp-label">Seleccione Cuenta Abierta</label>
                           <select className="erp-input" value={POS.datosMover.destino} onChange={e => POS.setDatosMover({...POS.datosMover, destino: e.target.value})} required>
                              <option value="">-- Elegir --</option>
                              {POS.mesas.filter(m => String(m.id).startsWith('CTA-') && m.id !== POS.mesaSeleccionada).map(m => (
                                <option key={m.id} value={m.id}>{m.id.replace('CTA-', '').replace(/-/g, ' ')} {(m.total || 0) > 0 ? `(S/ ${m.total.toFixed(2)})` : ''}</option>
                              ))}
                           </select>
                         </div>
                       ) : (
                         <div className="mb-4">
                           <label className="erp-label">Nombre del Cliente / Deudor</label>
                           <input type="text" className="erp-input" placeholder="Ej: Don Pepe" value={POS.datosMover.nombreCuenta} onChange={e => POS.setDatosMover({...POS.datosMover, nombreCuenta: e.target.value})} required />
                         </div>
                       )}
                     </>
                   )}
                   <button type="submit" className="erp-btn" style={{width: '100%', background: '#006989', color: '#FFF'}}>Confirmar Traslado</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {POS.modalBebidaDomingo && POS.platoPendienteBebida && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.8)', zIndex: 2200 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="erp-modal-header py-3" style={{ background: '#D4A843', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                <h5 className="erp-modal-title" style={{ margin: 0, color: '#120B06', fontWeight: 800 }}><i className="fas fa-glass-cheers"></i> Elegir Bebida</h5>
                <button style={modalCloseStyle} onClick={() => POS.setModalBebidaDomingo(false)}><X size={24} color="#120B06" /></button>
              </div>
              <div className="erp-modal-body" style={{background: '#F4F1ED'}}>
                 <p style={{textAlign: 'center', fontWeight: 800, color: '#8A7060', marginBottom: '1.5rem'}}>{POS.platoPendienteBebida.libre ? 'Selecciona una bebida para agregar a la mesa:' : `¿Con qué acompañará el ${POS.platoPendienteBebida.plato.nombre}?`}</p>
                 <div className="d-flex flex-column gap-3">
                    <button className="erp-btn" style={{background: '#F4C430', color: '#120B06', padding: '15px', fontWeight: 900, border: '2px solid #D4A843'}} onClick={() => POS.agregarBebidaAPlato('INKA COLA 296ML')}>INKA COLA 296ML</button>
                    <button className="erp-btn" style={{background: '#D7263D', color: '#FFF', padding: '15px', fontWeight: 900, border: '2px solid #8B0000'}} onClick={() => POS.agregarBebidaAPlato('COCA COLA 296ML')}>COCA COLA 296ML</button>
                    <button className="erp-btn erp-btn-outline" style={{padding: '15px', fontWeight: 900}} onClick={() => POS.agregarBebidaAPlato('REFRESCO DEL DÍA')}>REFRESCO DEL DÍA</button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}