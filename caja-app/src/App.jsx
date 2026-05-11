import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'
import 'bootstrap/dist/css/bootstrap.min.css'
import { Modal } from 'bootstrap'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import './App.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);

const socket = io('http://localhost:3001')

export default function App() {
  const [serverStatus, setServerStatus]           = useState('Iniciando...')
  const [mesas, setMesas]                         = useState([])
  const [carta, setCarta]                         = useState([])
  const [mesaSeleccionada, setMesaSeleccionada]   = useState(null)
  const [usuarioActivo, setUsuarioActivo]         = useState(null)
  const [loginData, setLoginData]                 = useState({ username: '', password: '' })
  const [loginError, setLoginError]               = useState('')
  const [filtroCarta, setFiltroCarta]             = useState('')
  
  // 🟢 Estado Global del Modo Domingo controlado por Firebase (a través del Servidor)
  const [modoDomingo, setModoDomingo]             = useState(false) 

  const audioRef = useRef(null)

  const modalRef          = useRef(null); const [modalInstance, setModalInstance]                   = useState(null);
  const modalCobroRef     = useRef(null); const [modalCobroInstance, setModalCobroInstance]         = useState(null);
  const modalGastosRef    = useRef(null); const [modalGastosInstance, setModalGastosInstance]       = useState(null);
  const modalReporteRef   = useRef(null); const [modalReporteInstance, setModalReporteInstance]     = useState(null);
  const modalHistorialRef = useRef(null); const [modalHistorialInstance, setModalHistorialInstance] = useState(null);
  const modalDashboardRef = useRef(null); const [modalDashboardInstance, setModalDashboardInstance] = useState(null);

  const [modalConfig, setModalConfig] = useState(false);
  const [impresorasUSB, setImpresorasUSB] = useState([]);
  const [ticketeraCaja, setTicketeraCaja] = useState('');
  const [ticketeraCocina, setTicketeraCocina] = useState('');

  const [modalFueraCarta, setModalFueraCarta] = useState(false);
  const [fueraCartaItem, setFueraCartaItem] = useState({ nombre: '', precio: '' });

  const [modalVirtualDelivery, setModalVirtualDelivery] = useState(false);
  const [datosVirtualDelivery, setDatosVirtualDelivery] = useState({ nombre: '', direccion: '', telefono: '' });
  
  const [modalItemDelivery, setModalItemDelivery] = useState(false);
  const [datosItemDelivery, setDatosItemDelivery] = useState({ nombre: '', direccion: '', telefono: '', idx: null, mod: '' });

  const [pagos, setPagos]             = useState({ efectivo: 0, yape: 0, plin: 0, tarjeta: 0 });
  const [montoRecibido, setMontoRecibido] = useState('');

  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: null });
  const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '', type: 'success' });
  const mostrarAlert = (title, message, type = 'success') => setAlertModal({ visible: true, title, message, type });

  const obtenerFechaActualLocal = () => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
  };

  const solicitarConfirmacion = (title, message, action) => {
    setConfirmModal({ visible: true, title, message, onConfirm: action });
  };

  const [fechaArqueo, setFechaArqueo]     = useState(obtenerFechaActualLocal());
  const [reporte, setReporte]             = useState({ totales: { efectivo: 0, yape: 0, plin: 0, tarjeta: 0, totalVentas: 0, totalGastos: 0, balance: 0 }, topPlatos: [] });
  const [fechaHistorial, setFechaHistorial] = useState(obtenerFechaActualLocal());
  const [historialVentas, setHistorialVentas] = useState([]);
  const [gastosHoy, setGastosHoy]         = useState([]);
  const [nuevoGasto, setNuevoGasto]       = useState({ descripcion: '', monto: '', categoria: 'Insumos' });
  const [mesDashboard, setMesDashboard]   = useState(obtenerFechaActualLocal().slice(0, 7));
  const [dashboardData, setDashboardData] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const accionMenu = (accion) => {
    accion();
    if (window.innerWidth <= 1400) setSidebarOpen(false);
  };

  const cargarMesas = async () => { try { const res = await axios.get('http://localhost:3001/api/mesas'); setMesas(res.data); } catch (e) {} }
  const cargarCarta = async () => { try { const res = await axios.get('http://localhost:3001/api/carta'); setCarta(res.data); } catch (e) {} }

  const inicializarSistema = async () => {
    setServerStatus('Sincronizando...');
    try { 
        const resSync = await axios.get('http://localhost:3001/api/init-sync'); 
        setModoDomingo(resSync.data.modoDomingo); // 🟢 Leemos el estado validado por el servidor
        setServerStatus('En línea 🟢'); 
    } catch (e) { setServerStatus('Desconectado 🔴'); }
    cargarMesas(); cargarCarta();
  }

  const handleLogin = async (e) => {
    e.preventDefault(); setLoginError('');
    try {
      const res = await axios.post('http://localhost:3001/api/login', loginData);
      setUsuarioActivo(res.data.user);
    } catch (e) { setLoginError('Credenciales incorrectas.'); }
  }

  useEffect(() => {
    inicializarSistema();
    socket.on('actualizar_mesas', () => cargarMesas());
    socket.on('alerta_sonora', () => { 
      if (audioRef.current) { 
        audioRef.current.currentTime = 0; 
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) playPromise.catch(e => console.log(e));
      } 
    });
    socket.on('imprimir_cocina', ({ mesa, items }) => { procesarImpresionCocina(mesa, items); });
    return () => { socket.off('actualizar_mesas'); socket.off('alerta_sonora'); socket.off('imprimir_cocina'); }
  }, [])

  useEffect(() => {
    if (usuarioActivo) {
      if (modalRef.current)          setModalInstance(new Modal(modalRef.current));
      if (modalCobroRef.current)     setModalCobroInstance(new Modal(modalCobroRef.current));
      if (modalGastosRef.current)    setModalGastosInstance(new Modal(modalGastosRef.current));
      if (modalReporteRef.current)   setModalReporteInstance(new Modal(modalReporteRef.current));
      if (modalHistorialRef.current) setModalHistorialInstance(new Modal(modalHistorialRef.current));
      if (modalDashboardRef.current) setModalDashboardInstance(new Modal(modalDashboardRef.current));
    }
  }, [usuarioActivo])

  const formatMesaName = (id) => {
    if (!id) return '';
    let idStr = String(id).replace('.0', '');
    if (idStr.startsWith('DEL-')) return idStr;
    return `MESA ${idStr.replace('mesa_', '')}`;
  };

  const mesasOrdenadas = [...mesas].sort((a, b) => {
    const numA = parseInt(String(a.id).replace(/\D/g, ''));
    const numB = parseInt(String(b.id).replace(/\D/g, ''));
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return String(a.id).localeCompare(String(b.id));
  });

  const agregarPlatoDirecto = async (nombre, precio, categoriaNombre) => {
    if (!mesaSeleccionada) return;
    const isDelivery = String(mesaSeleccionada).startsWith('DEL-');
    const mod = isDelivery ? 'delivery' : 'local';
    
    let nuevo = [...mesaActiva.pedido];
    const idx = nuevo.findIndex(i => i.nombre === nombre && i.modalidad === mod && !i.impreso && !i.nota && !i.cliente);
    if (idx > -1) nuevo[idx].cantidad += 1;
    else nuevo.push({ nombre, precio, cantidad: 1, categoria: categoriaNombre, modalidad: mod, impreso: false });
    actualizarPedidoMesa(mesaSeleccionada, nuevo);
  };

  const agregarPlatoCarta = async (plato, categoriaNombre) => {
    if (!mesaSeleccionada) return;
    const isDelivery = String(mesaSeleccionada).startsWith('DEL-');
    const mod = isDelivery ? 'delivery' : 'local';
    
    let nuevo = [...mesaActiva.pedido];
    const idx = nuevo.findIndex(i => i.nombre === plato.nombre && i.modalidad === mod && !i.impreso && !i.nota && !i.cliente);
    if (idx > -1) nuevo[idx].cantidad += 1;
    else nuevo.push({ nombre: plato.nombre, precio: plato.precio, cantidad: 1, categoria: categoriaNombre, modalidad: mod, impreso: false });
    
    actualizarPedidoMesa(mesaSeleccionada, nuevo);
  };

  const mesaActiva = mesas.find(m => m.id === mesaSeleccionada);

  const actualizarPedidoMesa = async (mesaId, nuevoPedido) => {
    try { await axios.put(`http://localhost:3001/api/mesas/${mesaId}/pedido`, { pedido: nuevoPedido }); }
    catch (e) { mostrarAlert("Error", "Error al actualizar pedido", "danger"); }
  }

  const modificarCantidad = (idx, cambio) => {
    let nuevo = [...mesaActiva.pedido];
    if (cambio > 0 && nuevo[idx].impreso) {
        nuevo.push({ ...nuevo[idx], cantidad: 1, impreso: false });
    } else {
        nuevo[idx].cantidad += cambio;
        if (nuevo[idx].cantidad <= 0) nuevo.splice(idx, 1);
    }
    actualizarPedidoMesa(mesaSeleccionada, nuevo);
  };

  const enviarACocina = () => {
    if (!mesaActiva || mesaActiva.pedido.length === 0) return mostrarAlert("Aviso", "El pedido está vacío.", "danger");
    const itemsNuevos = mesaActiva.pedido.filter(i => !i.impreso);
    if (itemsNuevos.length === 0) return mostrarAlert("Aviso", "No hay platos nuevos para enviar a cocina.", "danger");
    procesarImpresionCocina(mesaSeleccionada, itemsNuevos);
    const pedidoActualizado = mesaActiva.pedido.map(i => ({...i, impreso: true}));
    actualizarPedidoMesa(mesaSeleccionada, pedidoActualizado);
    mostrarAlert("Éxito", "Comandas enviadas a COCINA", "success");
  };
  
  const cambiarModalidad = (idx) => {
    let nuevo = [...mesaActiva.pedido];
    const modActual = nuevo[idx].modalidad || 'local';
    let nextMod = '';
    if (modActual === 'local') nextMod = 'llevar';
    else if (modActual === 'llevar') nextMod = 'delivery';
    else if (modActual === 'delivery') nextMod = 'delivery_centro';
    else nextMod = 'local';

    if ((nextMod === 'delivery' || nextMod === 'delivery_centro') && (modActual !== 'delivery' && modActual !== 'delivery_centro')) {
       setDatosItemDelivery({ nombre: nuevo[idx].cliente?.nombre || '', direccion: nuevo[idx].cliente?.direccion || '', telefono: nuevo[idx].cliente?.telefono || '', idx, mod: nextMod });
       setModalItemDelivery(true);
    } else {
       nuevo[idx].modalidad = nextMod; 
       if (nextMod !== 'delivery' && nextMod !== 'delivery_centro') nuevo[idx].cliente = null;
       actualizarPedidoMesa(mesaSeleccionada, nuevo);
    }
  };

  const guardarItemDelivery = (e) => {
    e.preventDefault();
    let nuevo = [...mesaActiva.pedido];
    nuevo[datosItemDelivery.idx].modalidad = datosItemDelivery.mod;
    nuevo[datosItemDelivery.idx].cliente = { nombre: datosItemDelivery.nombre, direccion: datosItemDelivery.direccion, telefono: datosItemDelivery.telefono };
    actualizarPedidoMesa(mesaSeleccionada, nuevo);
    setModalItemDelivery(false);
  };

  const eliminarDelPedido = (idx) => {
    solicitarConfirmacion('Eliminar Plato', '¿Eliminar plato permanentemente?', () => {
      let nuevo = [...mesaActiva.pedido];
      nuevo.splice(idx, 1);
      actualizarPedidoMesa(mesaSeleccionada, nuevo);
      setConfirmModal(prev => ({ ...prev, visible: false }));
    });
  };

  const crearMesaDelivery = async (e) => {
    e.preventDefault();
    const idMesa = `DEL-${Math.floor(1000 + Math.random() * 9000)}`;
    const nota = `CLIENTE: ${datosVirtualDelivery.nombre} | DIR: ${datosVirtualDelivery.direccion} | TEL: ${datosVirtualDelivery.telefono}`;
    try {
        await axios.post('http://localhost:3001/api/pedidos', { mesa: idMesa, items: [], nota_general: nota });
        setModalVirtualDelivery(false);
        setDatosVirtualDelivery({ nombre: '', direccion: '', telefono: '' });
        setMesaSeleccionada(idMesa);
    } catch(e) { mostrarAlert("Error", "Error al crear mesa de delivery", "danger"); }
  };

  const generarTicketHTML = (mesa, pedido, total, pagos, recibido, vuelto, esPrecuenta = false) => {
    const fecha = new Date().toLocaleString(); let itemsHTML = '';
    const tituloPrincipal = esPrecuenta ? "PRE-CUENTA" : "CALLETANO";
    const subTitulo = esPrecuenta ? "CALLETANO - RESTAURANT" : "RESTAURANT";
    const nombreMesaLimpio = formatMesaName(mesa);
    pedido.forEach(item => { itemsHTML += `<tr><td style="padding:3px 0;border-bottom:1px dashed #ccc;">${item.cantidad}</td><td style="padding:3px 0;border-bottom:1px dashed #ccc;">${item.nombre} ${item.modalidad !== 'local' ? `<br><small style="font-size:10px">*[${item.modalidad.toUpperCase()}]</small>` : ''}</td><td style="padding:3px 0;border-bottom:1px dashed #ccc;text-align:right;">S/ ${item.subtotal.toFixed(2)}</td></tr>`; });
    return `<html><head><style>@page{margin:0;}body{font-family:'Courier New',Courier,monospace;width:265px;margin:0;padding:5px 10px 5px 0px;font-size:12px;color:#000;}.negrita{font-weight:bold;}.linea{border-top:2px dashed #000;margin:10px 0;}table{width:100%;border-collapse:collapse;margin-bottom:10px;}</style></head><body><div class="centrado"><h2 style="margin:0">${tituloPrincipal}</h2><h4 style="margin:0;font-weight:normal">${subTitulo}</h4></div><div class="linea"></div><p><span class="negrita">Fecha:</span> ${fecha}<br><span class="negrita">Ref:</span> ${nombreMesaLimpio}<br><span class="negrita">Cajero:</span> ${usuarioActivo.username}</p><div class="linea"></div><table><thead><tr><th style="text-align:left;border-bottom:1px solid #000;">Cant</th><th style="text-align:left;border-bottom:1px solid #000;">Desc</th><th style="text-align:right;border-bottom:1px solid #000;">Imp</th></tr></thead><tbody>${itemsHTML}</tbody></table><div style="text-align:right;font-size:16px;" class="negrita">TOTAL: S/ ${total.toFixed(2)}</div><div class="linea"></div>${!esPrecuenta ? `
      <div style="font-size:11px; margin-top:5px;">
        <span class="negrita">Métodos de Pago:</span><br>
        ${pagos.efectivo > 0 ? `EFECTIVO: S/ ${pagos.efectivo.toFixed(2)}<br>` : ''}
        ${pagos.yape > 0 ? `YAPE: S/ ${pagos.yape.toFixed(2)}<br>` : ''}
        ${pagos.plin > 0 ? `PLIN: S/ ${pagos.plin.toFixed(2)}<br>` : ''}
        ${pagos.tarjeta > 0 ? `TARJETA: S/ ${pagos.tarjeta.toFixed(2)}<br>` : ''}
        <div class="linea" style="margin: 5px 0;"></div>
        ${recibido > 0 ? `Efectivo Entregado: S/ ${recibido.toFixed(2)}<br>Vuelto: S/ ${vuelto.toFixed(2)}` : ''}
      </div>
      <div class="linea"></div>
      <div class="centrado"><p>¡Gracias por su preferencia!</p></div>` 
    : '<div class="centrado"><p>Por favor revise su pedido.<br>Documento no válido como comprobante.</p></div>'}</body></html>`;
      };

  const generarTicketCocina = (mesaId, items, tipoComanda) => {
    let itemsHTML = '';
    const nombreMesaLimpio = formatMesaName(mesaId);
    
    items.forEach(item => { 
      let mod = item.modalidad !== 'local' ? `<br><small style="font-size:12px; font-weight:bold;">*[${item.modalidad.toUpperCase()}]*</small>` : '';
      let cliente = item.cliente 
        ? `<br><small style="font-size:13px; font-weight:bold;">Enviar a: ${item.cliente.nombre} - ${item.cliente.direccion}</small>` 
        : '';
        
      let nota = item.nota 
        ? `<br><span style="font-size:14px; font-weight:bold;">&nbsp;&nbsp;>> NOTA: ${item.nota.toUpperCase()}</span>` 
        : '';

      itemsHTML += `
        <tr>
          <td style="padding:8px 0; border-bottom:1px dashed #000; font-size:18px; font-weight:bold; vertical-align:top;">${item.cantidad}</td>
          <td style="padding:8px 0; border-bottom:1px dashed #000; font-size:16px;">
            <span style="font-weight:bold;">${item.nombre}</span>${mod}${cliente}${nota}
          </td>
        </tr>`; 
    });

    return `
      <html>
        <head>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 265px; 
              margin: 0; 
              padding: 5px 10px 0px 0px;
              color: #000; 
            }
            .centrado { text-align: center; }
            .linea { border-top: 2px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          <div class="centrado">
            <h2 style="margin:0; font-weight:bold;">COCINA</h2>
            <h3 style="margin:5px 0; background:#000; color:#fff; padding:5px; display:inline-block; font-weight:bold; font-size:18px;">
              ${tipoComanda.toUpperCase()}
            </h3>
          </div>
          <div class="linea"></div>
          <p style="font-size:16px; margin:5px 0">
            <span style="font-weight:bold">Ref:</span> ${nombreMesaLimpio}<br>
            <span style="font-weight:bold">Hora:</span> ${new Date().toLocaleTimeString()}
          </p>
          <div class="linea"></div>
          <table>
            <thead>
              <tr>
                <th style="text-align:left; border-bottom:2px solid #000; font-size:14px; font-weight:bold;">Cant</th>
                <th style="text-align:left; border-bottom:2px solid #000; font-size:14px; font-weight:bold;">Plato</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
          </body>
      </html>`;
  };

  const procesarImpresionCocina = (mesaId, itemsAImprimir) => {
      if (!itemsAImprimir || itemsAImprimir.length === 0) return;

      const categoriasBebidas = ['JUGOS NATURALES', 'BEBIDAS HELADAS', 'BEBIDAS CALIENTES', 'CERVEZA'];
      
      const soloPlatos = itemsAImprimir.filter(it => {
          const cat = it.categoria ? it.categoria.toUpperCase().trim() : '';
          const nom = it.nombre ? it.nombre.toUpperCase() : '';
          return !categoriasBebidas.includes(cat) && !nom.includes('REFRESCO');
      });

      if (soloPlatos.length === 0) return;

      const itemsLocal = soloPlatos.filter(i => i.modalidad === 'local' || i.modalidad === 'llevar');
      const itemsDelivery = soloPlatos.filter(i => i.modalidad === 'delivery' || i.modalidad === 'delivery_centro');

      if (itemsLocal.length > 0) {
          const ticketLocal = generarTicketCocina(mesaId, itemsLocal, "SALÓN / LLEVAR");
          enviarAImpresora(ticketLocal, 'cocina');
      }
      if (itemsDelivery.length > 0) {
          setTimeout(() => {
              const ticketDelivery = generarTicketCocina(mesaId, itemsDelivery, "DELIVERY");
              enviarAImpresora(ticketDelivery, 'cocina');
          }, itemsLocal.length > 0 ? 1500 : 0);
      }
  };

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

  const imprimirPreCuenta = () => {
    if (!mesaActiva || mesaActiva.pedido.length === 0) return mostrarAlert("Aviso", "El pedido está vacío.", "danger");
    const ticketHTML = generarTicketHTML(mesaSeleccionada, mesaActiva.pedido, mesaActiva.total, {efectivo: 0, yape: 0, plin: 0, tarjeta: 0}, 0, 0, true);
    if (window.require) enviarAImpresora(ticketHTML, 'caja');
    else { const win = window.open('', '_blank'); win.document.write(ticketHTML); win.print(); }
  };

  const guardarPlatoPersonalizado = async (e) => {
    e.preventDefault();
    if (!fueraCartaItem.nombre || !fueraCartaItem.precio) return;
    await agregarPlatoDirecto(`${fueraCartaItem.nombre} (Extra)`, parseFloat(fueraCartaItem.precio), 'general');
    setFueraCartaItem({ nombre: '', precio: '' });
    setModalFueraCarta(false);
  };

  const procesarCobro = async () => {
    const sumaPagosDigitales = parseFloat(pagos.yape || 0) + parseFloat(pagos.plin || 0) + parseFloat(pagos.tarjeta || 0);
    const efectivoDigitado   = parseFloat(montoRecibido || 0);
    const sumaTotalRecibida  = sumaPagosDigitales + efectivoDigitado;
    if (sumaTotalRecibida < mesaActiva.total) return mostrarAlert("Aviso", "Monto insuficiente.", "danger");
    const vuelto       = sumaTotalRecibida > mesaActiva.total ? sumaTotalRecibida - mesaActiva.total : 0;
    const efectivoReal = efectivoDigitado - vuelto;
    const pagosFinales = { ...pagos, efectivo: efectivoReal > 0 ? efectivoReal : 0 };
    
    try {
      const mesaNumeroLimpio = String(mesaSeleccionada).startsWith('mesa_') ? parseInt(String(mesaSeleccionada).replace('mesa_', ''), 10) : mesaSeleccionada;
      await axios.post('http://localhost:3001/api/cobrar', { mesaId: mesaSeleccionada, mesaNum: mesaNumeroLimpio, totalCobrado: mesaActiva.total, metodosPago: pagosFinales, items: mesaActiva.pedido });
      
      modalCobroInstance?.hide(); 
      setPagos({ efectivo: 0, yape: 0, plin: 0, tarjeta: 0 }); 
      setMontoRecibido('');
      
      solicitarConfirmacion(
        'Venta Registrada',
        '¿Desea imprimir el comprobante de pago para el cliente?',
        () => {
           const ticketHTML = generarTicketHTML(mesaSeleccionada, mesaActiva.pedido, mesaActiva.total, pagosFinales, efectivoDigitado, vuelto, false);
           enviarAImpresora(ticketHTML, 'caja');
           setConfirmModal(prev => ({ ...prev, visible: false }));
           mostrarAlert('Completado', 'El ticket se ha enviado a la impresora.', 'success');
        }
      );
    } catch (e) { mostrarAlert('Error', 'No se pudo procesar el cobro', 'danger'); }
  }

  const cargarListaGastos = async (fecha) => { try { const res = await axios.get(`http://localhost:3001/api/gastos?fecha=${fecha}`); setGastosHoy(res.data); } catch (e) {} };
  const abrirGastos   = () => { const hoy = obtenerFechaActualLocal(); cargarListaGastos(hoy); modalGastosInstance?.show(); };
  const guardarGasto  = async (e) => { e.preventDefault(); try { await axios.post('http://localhost:3001/api/gastos', nuevoGasto); setNuevoGasto({ descripcion: '', monto: '', categoria: 'Insumos' }); cargarListaGastos(obtenerFechaActualLocal()); } catch (e) { mostrarAlert("Error", "Error al guardar el gasto", "danger"); } };
  const eliminarGasto = (id) => {
    solicitarConfirmacion(
      'Anular Gasto',
      '¿Estás seguro de que deseas eliminar este registro de gasto permanentemente?',
      async () => {
        try { 
          await axios.delete(`http://localhost:3001/api/gastos/${id}`); 
          cargarListaGastos(obtenerFechaActualLocal()); 
          setConfirmModal(prev => ({ ...prev, visible: false }));
        } catch (e) {}
      }
    );
  };

  const abrirReporte  = async () => { const hoy = obtenerFechaActualLocal(); setFechaArqueo(hoy); await cargarArqueo(hoy); modalReporteInstance?.show(); };
  const cargarArqueo  = async (fecha) => { try { const res = await axios.get(`http://localhost:3001/api/reporte-diario?fecha=${fecha}`); setReporte(res.data); } catch (e) {} };

  const abrirHistorial  = async () => { const hoy = obtenerFechaActualLocal(); setFechaHistorial(hoy); await cargarHistorial(hoy); modalHistorialInstance?.show(); };
  const cargarHistorial = async (fecha) => { try { const res = await axios.get(`http://localhost:3001/api/ventas?fecha=${fecha}`); setHistorialVentas(res.data); } catch (e) {} };
  const anularVenta = (idVenta) => {
    solicitarConfirmacion(
      'Anular Venta',
      `⚠️ ¿ANULAR Ticket #${idVenta}? Esta acción descontará el monto del Arqueo de hoy.`,
      async () => {
        try { 
          await axios.delete(`http://localhost:3001/api/ventas/${idVenta}`); 
          await cargarHistorial(fechaHistorial); 
          setConfirmModal(prev => ({ ...prev, visible: false }));
        } catch (e) { mostrarAlert("Error", "Error al anular la venta", "danger"); }
      }
    );
  };

  const abrirDashboard  = async () => { const mesActual = obtenerFechaActualLocal().slice(0, 7); setMesDashboard(mesActual); await cargarDashboard(mesActual); modalDashboardInstance?.show(); };
  const cargarDashboard = async (mes) => { try { const res = await axios.get(`http://localhost:3001/api/dashboard?mes=${mes}`); setDashboardData(res.data); } catch (e) {} };

  const modLabel = (mod) => {
    if (mod === 'local') return 'Local';
    if (mod === 'llevar') return 'Llevar';
    if (mod === 'delivery') return 'Delivery';
    if (mod === 'delivery_centro') return 'Centro';
    return mod;
  };
  const modIcon = (mod) => {
    if (mod === 'local') return 'fa-store';
    if (mod === 'llevar') return 'fa-shopping-bag';
    return 'fa-motorcycle';
  };

  const abrirConfiguracion = async () => {
      setModalConfig(true);
      try {
        const resPrinters = await axios.get('http://localhost:3001/api/impresoras');
        setImpresorasUSB(resPrinters.data);
        const resConfig = await axios.get('http://localhost:3001/api/config');
        if (resConfig.data.ticketera_caja) setTicketeraCaja(resConfig.data.ticketera_caja);
        if (resConfig.data.ticketera_cocina) setTicketeraCocina(resConfig.data.ticketera_cocina);
      } catch (e) { console.error(e); }
  };
  
  const guardarConfiguracion = async () => {
      try {
        await axios.post('http://localhost:3001/api/config', { 
            ticketera_caja: ticketeraCaja, 
            ticketera_cocina: ticketeraCocina
        });
        socket.emit('actualizar_mesas'); 
        mostrarAlert('Éxito', 'Configuración actualizada', 'success');
        setModalConfig(false);
      } catch (e) { mostrarAlert('Error', 'No se pudo guardar', 'danger'); }
  };

  // ─── PANTALLA DE LOGIN (Estilo ERP) ───
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

  // CÁLCULOS EN VIVO PARA MODAL COBRO
  const sumaTotalRecibida = (parseFloat(pagos.yape || 0) + parseFloat(pagos.plin || 0) + parseFloat(pagos.tarjeta || 0) + parseFloat(montoRecibido || 0));
  const montoFalta = (mesaActiva?.total || 0) > sumaTotalRecibida ? (mesaActiva.total - sumaTotalRecibida) : 0;
  const montoVuelto = sumaTotalRecibida > (mesaActiva?.total || 0) ? (sumaTotalRecibida - mesaActiva.total) : 0;

  // ─── PANTALLA PRINCIPAL ERP ───
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
              <div style={{borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0'}}></div>
              <button className="erp-nav-item" onClick={() => accionMenu(abrirConfiguracion)}><i className="fas fa-print"></i> Setup Hardware</button>
              <button className="erp-nav-item" onClick={() => accionMenu(inicializarSistema)}><i className="fas fa-sync-alt"></i> Forzar Sync</button>
            </>
          )}
        </nav>

        <div className="erp-user-footer">
          <div className="erp-user-info"><i className="fas fa-user-circle" style={{color: '#D4A843'}}></i> {usuarioActivo.username.toUpperCase()}</div>
          <button className="erp-logout-btn" onClick={() => setUsuarioActivo(null)} title="Cerrar Sesión">Salir</button>

          <button className="erp-hamburger-btn" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
        </div>
      </aside>

      <div className="erp-main-wrapper">
        <header className="erp-topbar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="erp-hamburger-btn" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
            <h1 className="erp-module-title">Salón</h1>
          </div>
          <div className="erp-topbar-actions">
             <button className="erp-btn erp-btn-outline" onClick={() => setModalVirtualDelivery(true)}>
              <i className="fas fa-motorcycle"></i> <span className="d-none d-sm-inline">Nuevo Delivery</span>
            </button>
          </div>
        </header>

        <main className="erp-workspace">
          <section className="erp-salon-area">
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem'}}>
               <div style={{fontSize: '0.85rem', fontWeight: 800, color: '#8A7060', textTransform: 'uppercase'}}><i className="fas fa-th-large"></i> VISOR DE MESAS ({mesas.length})</div>
            </div>

            <div className="erp-mesas-grid">
              {mesasOrdenadas.map(mesa => {
                const ocupada = mesa.estado === 'ocupada';
                return (
                  <div key={mesa.id} onClick={() => setMesaSeleccionada(mesa.id)} className={`erp-mesa-card ${ocupada ? 'ocupada' : ''} ${mesa.id === mesaSeleccionada ? 'seleccionada' : ''}`}>
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
          </section>

          <aside className="erp-comandera">
            <div className="erp-com-header">
              <div className="erp-com-title">Mesa Seleccionada</div>
              <h2 className="erp-com-mesa">
                {mesaSeleccionada ? formatMesaName(mesaSeleccionada) : 'Seleccione Mesa'}
              </h2>
              {mesaActiva?.nota_general && <div className="pos-comandera-nota"><i className="fas fa-info-circle"></i> {mesaActiva.nota_general}</div>}
            </div>

            <div className="erp-com-toolbar d-flex gap-2">
              <button 
                className="erp-btn erp-btn-outline" 
                style={{flex: 1}} 
                disabled={!mesaSeleccionada} 
                onClick={() => {
                  setFiltroCarta('');
                  modalInstance?.show();
                }}
              >
                <i className="fas fa-search"></i> Agregar Plato
              </button>
              <button className="erp-btn erp-btn-outline" style={{flex: 0.8}} disabled={!mesaSeleccionada} onClick={() => setModalFueraCarta(true)} title="Ítem Libre">
                <i className="fas fa-pen"></i> Nuevo Plato
              </button>
            </div>

            <div className="erp-com-list">
              {!mesaActiva || mesaActiva.pedido.length === 0 ? (
                <div style={{padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem'}}>
                  <i className="fas fa-file-invoice" style={{fontSize: '2.5rem', marginBottom: '10px', opacity: 0.3}}></i>
                  <div>No hay pedidos en esta mesa.</div>
                </div>
              ) : (
                <table className="erp-data-table">
                  <thead>
                    <tr>
                      <th style={{width: '50%'}}>Descripción</th>
                      <th style={{textAlign: 'center'}}>Cant.</th>
                      <th style={{textAlign: 'right'}}>Importe</th>
                      <th style={{width: '30px'}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mesaActiva.pedido.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className="erp-item-name">{item.nombre}</div>
                          <div className="erp-item-meta">
                            <span style={{cursor: 'pointer', color: item.modalidad==='local' ? '#8A7060' : '#006989'}} onClick={() => cambiarModalidad(idx)}>
                              [{item.modalidad.toUpperCase()}]
                            </span>
                            {item.cliente && <span style={{color: '#D7263D', display: 'block', marginTop: '2px'}}><i className="fas fa-map-marker-alt"></i> Dest: {item.cliente.nombre}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="erp-qty-controls">
                            <button className="erp-qty-btn" onClick={() => modificarCantidad(idx, -1)}>-</button>
                            <div className="erp-qty-val">{item.cantidad}</div>
                            <button className="erp-qty-btn" onClick={() => modificarCantidad(idx, 1)}>+</button>
                          </div>
                        </td>
                        <td className="erp-item-price">S/ {(item.subtotal || 0).toFixed(2)}</td>
                        <td><button className="erp-delete-btn" onClick={() => eliminarDelPedido(idx)}><i className="fas fa-trash-alt"></i></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="erp-com-footer">
              <div className="erp-action-grid">
                <button className="erp-btn erp-btn-outline" disabled={!mesaActiva} onClick={() => agregarPlatoDirecto('Taper (Chico)', 1.00, 'general')} style={{fontSize: '0.75rem', padding: '8px'}}><i className="fas fa-box-open"></i> Taper S/1</button>
                <button className="erp-btn erp-btn-outline" disabled={!mesaActiva} onClick={() => agregarPlatoDirecto('Taper (Grande)', 2.00, 'general')} style={{fontSize: '0.75rem', padding: '8px'}}><i className="fas fa-box"></i> Taper S/2</button>
                
                {/* 🟢 El precio dinámico del Refresco cambia automáticamente */}
                <button className="erp-btn erp-btn-outline" disabled={!mesaActiva} onClick={() => agregarPlatoDirecto('Refresco', modoDomingo ? 3.50 : 2.00, 'general')} style={{gridColumn: '1 / span 2', fontSize: '0.75rem', padding: '8px'}}><i className="fas fa-glass-whiskey"></i> Refresco (S/ {modoDomingo ? '3.50' : '2.00'})</button>
              </div>

              <div className="erp-totals-row">
                <span className="erp-totals-label">Subtotal Mesa</span>
                <span className={`erp-totals-value ${!mesaActiva || mesaActiva.total === 0 ? 'cero' : ''}`}>S/ {mesaActiva ? mesaActiva.total.toFixed(2) : '0.00'}</span>
              </div>

              <div className="erp-action-grid">
                <button className="erp-btn erp-btn-primary" disabled={!mesaActiva || mesaActiva.pedido.length === 0} onClick={enviarACocina}>
                  <i className="fas fa-fire"></i> A Cocina
                </button>
                <button className="erp-btn erp-btn-outline" disabled={!mesaActiva || mesaActiva.pedido.length === 0} onClick={imprimirPreCuenta}>
                  <i className="fas fa-print"></i> Pre-Cuenta
                </button>
              </div>

              <button className="erp-btn erp-btn-success" style={{width: '100%', marginTop: '10px'}} disabled={!mesaActiva || mesaActiva.estado === 'libre'} onClick={() => { setPagos({ yape: 0, plin: 0, tarjeta: 0 }); setMontoRecibido(mesaActiva.total); modalCobroInstance?.show(); }}>
                COBRAR MESA <i className="fas fa-arrow-right" style={{marginLeft: '8px'}}></i>
              </button>
            </div>
          </aside>

        </main>
      </div>

      {/* 1. MODAL CARTA ERP */}
      <div className="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-scrollable modal-xl">
          <div className="modal-content">
            <div className="erp-modal-header">
              <h4 className="erp-modal-title"><i className="fas fa-list" style={{color: '#D4A843', marginRight: '8px'}}></i> Catálogo de Productos</h4>
              <button className="erp-modal-close" onClick={() => modalInstance?.hide()}><i className="fas fa-times"></i></button>
            </div>
            <div className="erp-menu-search">
              <input type="text" className="erp-input" placeholder="Filtrar catálogo (Ej: Arroz, Ceviche...)" value={filtroCarta} onChange={e => setFiltroCarta(e.target.value)} />
            </div>
            <div className="erp-modal-body">
              {carta.filter(c => 
                ['entradas', 'segundos'].includes(c.nombre.toLowerCase().trim())
              ).map((cat, idx) => {
                const nombreNormalizado = cat.nombre.toLowerCase().trim();
                
                // 🟢 Filtro estricto evaluado con el estado del servidor
                if (modoDomingo && nombreNormalizado === 'entradas') return null;

                const itemsFiltrados = cat.items.filter(p => 
                  p.nombre.toLowerCase().includes(filtroCarta.toLowerCase())
                );
                
                if (itemsFiltrados.length === 0) return null;
                return (
                  <div key={`menu-${idx}`}>
                    <div className="erp-category-title">{cat.nombre}</div>
                    <div className="erp-plato-grid">
                      {itemsFiltrados.map(plato => (
                        <div key={plato.id} className={`erp-plato-btn ${cat.nombre === 'entradas' ? 'entrada' : (cat.nombre === 'segundos' ? 'segundo' : '')}`} onClick={() => agregarPlatoCarta(plato, cat.nombre)}>
                          <div className="pos-plato-btn-bar"></div>
                          <span className="erp-plato-name">{plato.nombre}</span>
                          <span className="erp-plato-price">S/ {plato.precio.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {carta.filter(c => c.nombre !== 'entradas' && c.nombre !== 'segundos').map((cat, idx) => {
                const itemsFiltrados = cat.items.filter(p => p.nombre.toLowerCase().includes(filtroCarta.toLowerCase()));
                if (itemsFiltrados.length === 0) return null;
                return (
                  <div key={`carta-${idx}`}>
                    <div className="erp-category-title">{cat.nombre}</div>
                    <div className="erp-plato-grid">
                      {itemsFiltrados.map(plato => (
                        <div key={plato.id} className="erp-plato-btn" onClick={() => agregarPlatoCarta(plato, cat.nombre)}>
                          <div className="pos-plato-btn-bar"></div>
                          <span className="erp-plato-name">{plato.nombre}</span>
                          <span className="erp-plato-price">S/ {plato.precio.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. MODAL COBRO ERP (VUELTO EN VIVO) */}
      <div className="modal fade" ref={modalCobroRef} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #10B981'}}>
              <h4 className="erp-modal-title"><i className="fas fa-money-bill-wave" style={{color: '#10B981', marginRight: '8px'}}></i> Liquidación de Documento</h4>
              <button className="erp-modal-close" onClick={() => modalCobroInstance?.hide()}><i className="fas fa-times"></i></button>
            </div>
            <div className="erp-modal-body">
              <div style={{textAlign: 'center', marginBottom: '1.5rem', background: '#FFFFFF', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E0D8'}}>
                <div style={{fontSize: '0.8rem', color: '#8A7060', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em'}}>Total a Cobrar</div>
                <div style={{fontFamily: 'Playfair Display, serif', fontSize: '3.5rem', fontWeight: 800, color: '#10B981', lineHeight: 1}}>
                  S/ {mesaActiva?.total.toFixed(2)}
                </div>
              </div>

              <div className="erp-input-group">
                <label className="erp-label" style={{color: '#065F46'}}><i className="fas fa-money-bill-wave"></i> Efectivo Recibido</label>
                <input type="number" className="erp-input" style={{fontSize: '1.5rem', fontWeight: 800, textAlign: 'right', color: '#120B06', background: '#D1FAE5', borderColor: '#10B981'}} value={montoRecibido} onChange={e => setMontoRecibido(e.target.value)} placeholder="0.00" />
              </div>

              <div style={{fontSize: '0.75rem', fontWeight: 800, color: '#8A7060', textTransform: 'uppercase', margin: '1.5rem 0 0.75rem'}}>Billeteras y Tarjetas</div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                {['yape', 'plin', 'tarjeta'].map(m => (
                  <div key={m} className="erp-input-group" style={{marginBottom: 0, gridColumn: m === 'tarjeta' ? '1 / span 2' : 'auto'}}>
                    <label className="erp-label" style={{textTransform: 'capitalize'}}><i className={`fas ${m === 'tarjeta' ? 'fa-credit-card' : 'fa-mobile-alt'}`}></i> {m}</label>
                    <input type="number" className="erp-input" style={{textAlign: 'right', fontWeight: 700}} value={pagos[m]} onChange={e => setPagos({ ...pagos, [m]: e.target.value })} placeholder="0.00" />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', padding: '1rem 1.25rem', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E0D8' }}>
                 <div>
                   <div style={{fontSize: '0.75rem', color: '#8A7060', fontWeight: 800, textTransform: 'uppercase'}}>Falta Pagar</div>
                   <div style={{fontSize: '1.4rem', fontWeight: 800, color: montoFalta > 0 ? '#D7263D' : '#10B981'}}>S/ {montoFalta.toFixed(2)}</div>
                 </div>
                 <div style={{textAlign: 'right'}}>
                   <div style={{fontSize: '0.75rem', color: '#8A7060', fontWeight: 800, textTransform: 'uppercase'}}>Vuelto</div>
                   <div style={{fontSize: '1.4rem', fontWeight: 800, color: '#006989'}}>S/ {montoVuelto.toFixed(2)}</div>
                 </div>
              </div>

              <button className="erp-btn erp-btn-success" style={{marginTop: '1.5rem', width: '100%', padding: '1.2rem', fontSize: '1rem'}} onClick={procesarCobro}>
                EMITIR COMPROBANTE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MODAL GASTOS ERP */}
      <div className="modal fade" ref={modalGastosRef} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="erp-modal-header" style={{background: '#D4A843', borderBottom: 'none'}}>
              <h4 className="erp-modal-title" style={{color: '#120B06'}}><i className="fas fa-file-invoice-dollar"></i> Registro de Egresos</h4>
              <button className="erp-modal-close" style={{color: '#120B06'}} onClick={() => modalGastosInstance?.hide()}><i className="fas fa-times"></i></button>
            </div>
            <div className="erp-modal-body">
              <form onSubmit={guardarGasto} style={{ marginBottom: '2rem' }}>
                <div className="erp-input-group">
                  <label className="erp-label">Concepto del Gasto</label>
                  <input type="text" className="erp-input" value={nuevoGasto.descripcion} onChange={e => setNuevoGasto({ ...nuevoGasto, descripcion: e.target.value })} required />
                </div>
                <div className="erp-input-group">
                  <label className="erp-label">Monto Exacto (S/)</label>
                  <input type="number" step="0.10" className="erp-input" value={nuevoGasto.monto} onChange={e => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })} required />
                </div>
                <div className="erp-input-group">
                  <label className="erp-label">Categoría Contable</label>
                  <select className="erp-input" value={nuevoGasto.categoria} onChange={e => setNuevoGasto({ ...nuevoGasto, categoria: e.target.value })}>
                    <option value="Insumos">Insumos y Alimentos</option>
                    <option value="Personal">Planilla / Personal</option>
                    <option value="Servicios">Servicios (Luz, Agua)</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                <button type="submit" className="erp-btn erp-btn-primary" style={{width: '100%'}}>Guardar Egreso en Libro</button>
              </form>
              
              <div className="erp-category-title" style={{margin: '0 0 1rem'}}>Registro Diario (Hoy)</div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {gastosHoy.length === 0 && <p style={{ color: '#8A7060', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>No existen movimientos.</p>}
                {gastosHoy.map(g => (
                  <div key={g.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '12px 16px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #E5E0D8'}}>
                    <div>
                      <div style={{fontWeight: 700, color: '#120B06', fontSize: '0.9rem'}}>{g.descripcion}</div>
                      <div style={{fontSize: '0.7rem', color: '#8A7060', textTransform: 'uppercase'}}>{g.categoria}</div>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                      <span style={{fontWeight: 800, color: '#D7263D', fontSize: '1rem'}}>S/ {g.monto.toFixed(2)}</span>
                      <button className="erp-delete-btn" onClick={() => eliminarGasto(g.id)}><i className="fas fa-trash-alt"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MODAL ARQUEO ERP */}
      <div className="modal fade" ref={modalReporteRef} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #D4A843'}}>
              <h4 className="erp-modal-title"><i className="fas fa-cash-register" style={{color: '#D4A843', marginRight: '8px'}}></i> Arqueo Gerencial</h4>
              <button className="erp-modal-close" onClick={() => modalReporteInstance?.hide()}><i className="fas fa-times"></i></button>
            </div>
            <div className="erp-modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: '#FFFFFF', padding: '1.25rem', borderRadius: '12px', border: '1px solid #E5E0D8' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2D241E', textTransform: 'uppercase' }}><i className="far fa-calendar-alt"></i> Fecha Contable</span>
                <input type="date" className="erp-input" style={{ width: '220px', margin: 0 }} value={fechaArqueo} onChange={e => { setFechaArqueo(e.target.value); cargarArqueo(e.target.value); }} />
              </div>
              <div className="row g-4 mb-4">
                <div className="col-md-6">
                  <div className="pos-stat-card h-100">
                    <div className="pos-stat-label">Desglose de Ingresos (Flujo)</div>
                    <hr style={{ margin: '1rem 0', borderColor: '#E5E0D8' }} />
                    {[['Efectivo', reporte.totales.efectivo], ['Yape', reporte.totales.yape], ['Plin', reporte.totales.plin], ['Tarjeta', reporte.totales.tarjeta]].map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', fontSize: '1rem' }}>
                        <span style={{ color: '#8A7060', fontWeight: 700 }}>{label}</span><strong style={{color: '#120B06'}}>S/ {val.toFixed(2)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-md-6 d-flex flex-column gap-3">
                  <div className="pos-stat-card" style={{ borderLeft: '4px solid #10B981', padding: '1.25rem' }}><div className="pos-stat-label">Ingreso Bruto</div><div className="pos-stat-value green">S/ {reporte.totales.totalVentas.toFixed(2)}</div></div>
                  <div className="pos-stat-card" style={{ borderLeft: '4px solid #D7263D', padding: '1.25rem' }}><div className="pos-stat-label">Egresos Totales</div><div className="pos-stat-value red">S/ {reporte.totales.totalGastos.toFixed(2)}</div></div>
                  <div className="pos-stat-card" style={{ background: '#120B06', border: 'none', padding: '1.25rem' }}><div className="pos-stat-label" style={{ color: '#D4A843' }}>Ganancia Neta Operativa</div><div className="pos-stat-value" style={{ color: '#FFFFFF' }}>S/ {reporte.totales.balance.toFixed(2)}</div></div>
                </div>
              </div>
              <div className="pos-stat-card">
                <div className="pos-stat-label" style={{ marginBottom: '1rem' }}><i className="fas fa-star" style={{ color: '#D4A843' }}></i> Rendimiento de Platos (Top 5)</div>
                {reporte.topPlatos.length === 0 ? <p style={{ color: '#8A7060', fontSize: '0.9rem', fontStyle: 'italic' }}>Información no disponible para el periodo.</p> : reporte.topPlatos.map((p, i) => (
                  <div key={i} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #E5E0D8', fontSize: '0.9rem'}}>
                    <span style={{fontWeight: 800, color: '#D4A843', width: '30px'}}>0{i + 1}</span>
                    <span style={{flex: 1, fontWeight: 700, color: '#2D241E'}}>{p.nombre}</span>
                    <span className="pos-badge pos-badge-gray" style={{fontSize: '0.8rem'}}>{p.cant} unid.</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. MODAL HISTORIAL ERP */}
      <div className="modal fade" ref={modalHistorialRef} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #D7263D'}}>
              <h4 className="erp-modal-title"><i className="fas fa-history" style={{color: '#D7263D', marginRight: '8px'}}></i> Libro de Ventas</h4>
              <button className="erp-modal-close" onClick={() => modalHistorialInstance?.hide()}><i className="fas fa-times"></i></button>
            </div>
            <div className="erp-modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: '#FFFFFF', padding: '1.25rem', borderRadius: '12px', border: '1px solid #E5E0D8' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2D241E', textTransform: 'uppercase' }}><i className="far fa-calendar-alt"></i> Filtrar Documentos</span>
                <input type="date" className="erp-input" style={{ width: '220px', margin: 0 }} value={fechaHistorial} onChange={e => { setFechaHistorial(e.target.value); cargarHistorial(e.target.value); }} />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="pos-table">
                  <thead><tr><th>Ref</th><th>Hora</th><th>Origen</th><th style={{ width: '30%' }}>Detalle de Consumo</th><th>Liquidación</th><th style={{textAlign: 'right'}}>Total</th><th style={{ textAlign: 'center' }}>Acción</th></tr></thead>
                  <tbody>
                    {historialVentas.map(v => {
                      const pg = JSON.parse(v.metodos_pago || '{}'); const items = JSON.parse(v.items || '[]'); const h = new Date(v.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={v.id}>
                          <td><span className="pos-badge pos-badge-gray">#{v.id}</span></td><td style={{ color: '#8A7060' }}>{h}</td><td style={{ color: '#006989', fontWeight: 800 }}>{formatMesaName(v.mesa)}</td>
                          <td><ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.85rem' }}>{items.map((it, idx) => (<li key={idx}><strong style={{color:'#D4A843'}}>{it.cantidad}x</strong> {it.nombre}</li>))}</ul></td>
                          <td><ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.75rem', color: '#8A7060' }}>{pg.efectivo > 0 && <li>EFE: S/{pg.efectivo}</li>}{pg.yape > 0 && <li>YAP: S/{pg.yape}</li>}{pg.plin > 0 && <li>PLI: S/{pg.plin}</li>}{pg.tarjeta > 0 && <li>TAR: S/{pg.tarjeta}</li>}</ul></td>
                          <td style={{ fontWeight: 800, color: '#10B981', fontSize: '1.1rem', textAlign: 'right' }}>S/ {v.total_cobrado.toFixed(2)}</td>
                          <td style={{ textAlign: 'center' }}><button className="pos-anular-btn" onClick={() => anularVenta(v.id)}>Anular</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {historialVentas.length === 0 && <p style={{ textAlign: 'center', color: '#8A7060', padding: '3rem', fontSize: '0.95rem', fontStyle: 'italic' }}>Sin documentos emitidos en esta fecha.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. MODAL DASHBOARD ERP */}
      <div className="modal fade" ref={modalDashboardRef} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-scrollable" style={{ maxWidth: '95vw' }}>
          <div className="modal-content" style={{ minHeight: '90vh' }}>
            <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #006989'}}>
              <h4 className="erp-modal-title"><i className="fas fa-chart-pie" style={{color: '#006989', marginRight: '8px'}}></i> Analítica Avanzada</h4>
              <button className="erp-modal-close" onClick={() => modalDashboardInstance?.hide()}><i className="fas fa-times"></i></button>
            </div>
            <div className="erp-modal-body d-flex flex-column" style={{background: '#F4F1ED'}}>
              <div style={{ marginBottom: '1.5rem' }} className="erp-input-group">
                <label className="erp-label">Periodo Fiscal</label>
                <input type="month" className="erp-input" style={{ maxWidth: '250px' }} value={mesDashboard} onChange={e => { setMesDashboard(e.target.value); cargarDashboard(e.target.value); }} />
              </div>
              {!dashboardData ? (<div style={{display: 'flex', justifyContent: 'center', padding: '4rem'}}><div className="spinner-border" style={{color: '#006989'}} role="status"></div></div>) : (
                <>
                  <div className="row mb-4 flex-grow-1">
                    <div className="col-12 col-md-3 d-flex flex-column gap-3 mb-3 mb-md-0">
                      <div className="pos-stat-card" style={{ borderLeft: '4px solid #10B981' }}><div className="pos-stat-label">Ingresos Consolidados</div><div className="pos-stat-value green">S/ {dashboardData.totales.ingresos.toFixed(2)}</div></div>
                      <div className="pos-stat-card" style={{ borderLeft: '4px solid #D7263D' }}><div className="pos-stat-label">Gastos Consolidados</div><div className="pos-stat-value red">S/ {dashboardData.totales.gastos.toFixed(2)}</div></div>
                      <div className="pos-stat-card flex-grow-1 d-flex flex-column justify-content-center" style={{ background: '#120B06', border: 'none', minHeight: '120px' }}><div className="pos-stat-label" style={{ color: '#D4A843' }}>Flujo Neto (Caja)</div><div className="pos-stat-value" style={{ color: dashboardData.totales.neto < 0 ? '#D7263D' : '#FFFFFF', fontSize: '2.5rem' }}>S/ {dashboardData.totales.neto.toFixed(2)}</div></div>
                    </div>
                    <div className="col-12 col-md-9 d-flex flex-column">
                      <div className="pos-stat-card flex-grow-1" style={{ minHeight: '350px' }}>
                        <Line 
                          data={{ 
                            labels: dashboardData.evolucion.labels, 
                            datasets: [
                              { label: 'Ingresos', data: dashboardData.evolucion.ingresos, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,.1)', tension: 0.4, fill: true }, 
                              { label: 'Egresos', data: dashboardData.evolucion.gastos, borderColor: '#D7263D', backgroundColor: 'rgba(215,38,61,.05)', tension: 0.4, fill: true }
                            ] 
                          }} 
                          options={{ 
                            maintainAspectRatio: false, 
                            interaction: { mode: 'index', intersect: false },
                            plugins: { legend: { labels: { font: { family: 'Plus Jakarta Sans' } } } } 
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="pos-stat-card mt-auto">
                    <div className="pos-stat-label" style={{ marginBottom: '1.5rem' }}><i className="fas fa-trophy" style={{ color: '#D4A843' }}></i> Mapas de Comportamiento del Consumidor</div>
                    <div className="row align-items-center">
                      <div className="col-12 col-md-3 mb-3 mb-md-0"><div style={{ background: '#120B06', borderRadius: '16px', padding: '2rem', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><i className="fas fa-gem fa-2x" style={{ color: '#D4A843', marginBottom: '1rem' }}></i><div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8A7060', marginBottom: '8px' }}>Producto Lider</div><div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '1.1rem', marginBottom: '15px', fontFamily: 'Playfair Display' }}>{dashboardData.platoCorona?.nombre ?? 'Sin registros'}</div><div><span style={{ background: '#D4A843', color: '#120B06', fontSize: '0.8rem', fontWeight: 800, padding: '6px 14px', borderRadius: '99px' }}>{dashboardData.platoCorona?.cantidad ?? 0} unidades</span></div></div></div>
                      <div className="col-12 col-md-4 mb-3 mb-md-0"><div className="pos-stat-label" style={{ textAlign: 'center', marginBottom: '1rem' }}>Cuota de Menús</div><div style={{ height: '260px' }}><Doughnut data={{ labels: dashboardData.rankingMenu.map(p => p.nombre), datasets: [{ data: dashboardData.rankingMenu.map(p => p.cantidad), backgroundColor: ['#006989','#10B981','#D4A843','#D7263D','#475569','#8A7060','#0F172A'] }] }} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 11 } } } } }} /></div></div>
                      <div className="col-12 col-md-5"><div className="pos-stat-label" style={{ textAlign: 'center', marginBottom: '1rem' }}>Cuota de Carta</div><div style={{ height: '260px' }}><Doughnut data={{ labels: dashboardData.rankingCarta.map(p => p.nombre), datasets: [{ data: dashboardData.rankingCarta.map(p => p.cantidad), backgroundColor: ['#006989','#10B981','#D4A843','#D7263D','#475569','#8A7060','#0F172A'] }] }} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 11 } } } } }} /></div></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 7. MODALES STATE-BASED */}
      
      {/* MODAL TICKETERAS */}
      {modalConfig && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #D4A843'}}>
                <h4 className="erp-modal-title"><i className="fas fa-print" style={{color:'#D4A843', marginRight: '8px'}}></i> Hardware Setup</h4>
                <button className="erp-modal-close" onClick={() => setModalConfig(false)}><i className="fas fa-times"></i></button>
              </div>
              <div className="erp-modal-body" style={{padding: '2.5rem'}}>
                <div className="erp-input-group" style={{marginBottom: '2rem'}}>
                  <label className="erp-label" style={{color: '#006989'}}><i className="fas fa-desktop"></i> Impresora Principal (Caja USB)</label>
                  <select className="erp-input" style={{marginTop: '8px'}} value={ticketeraCaja} onChange={e => setTicketeraCaja(e.target.value)}><option value="">-- No asignada --</option>{impresorasUSB.map((imp, idx) => (<option key={idx} value={imp}>{imp}</option>))}</select>
                </div>
                <div className="erp-input-group" style={{marginBottom: '2.5rem'}}>
                  <label className="erp-label" style={{color: '#D7263D'}}><i className="fas fa-fire"></i> Impresora Remota (Cocina)</label>
                  <select className="erp-input" style={{marginTop: '8px'}} value={ticketeraCocina} onChange={e => setTicketeraCocina(e.target.value)}>
                    <option value="">-- No asignada --</option>
                    {impresorasUSB.map((imp, idx) => (<option key={idx} value={imp}>{imp}</option>))}
                  </select>
                </div>
                {/* 🟢 SE ELIMINÓ EL TOGGLE MANUAL DE DOMINGO DE AQUÍ */}
                <button className="erp-btn erp-btn-primary" style={{width: '100%', padding: '1rem'}} onClick={guardarConfiguracion}>Aplicar Configuración</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO DELIVERY VIRTUAL */}
      {modalVirtualDelivery && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="erp-modal-header" style={{background: '#120B06'}}>
                <h4 className="erp-modal-title"><i className="fas fa-motorcycle" style={{color: '#D4A843', marginRight: '8px'}}></i> Crear Delivery</h4>
                <button className="erp-modal-close" onClick={() => setModalVirtualDelivery(false)}><i className="fas fa-times"></i></button>
              </div>
              <div className="erp-modal-body">
                <form onSubmit={crearMesaDelivery}>
                  <div className="erp-input-group">
                    <label className="erp-label">Nombre del Cliente</label>
                    <input type="text" className="erp-input" value={datosVirtualDelivery.nombre} onChange={e => setDatosVirtualDelivery({...datosVirtualDelivery, nombre: e.target.value.toUpperCase()})} required autoFocus />
                  </div>
                  <div className="erp-input-group">
                    <label className="erp-label">Dirección / Ref</label>
                    <input type="text" className="erp-input" value={datosVirtualDelivery.direccion} onChange={e => setDatosVirtualDelivery({...datosVirtualDelivery, direccion: e.target.value.toUpperCase()})} required />
                  </div>
                  <div className="erp-input-group" style={{marginBottom: '2rem'}}>
                    <label className="erp-label">Teléfono (Opcional)</label>
                    <input type="tel" className="erp-input" value={datosVirtualDelivery.telefono} onChange={e => setDatosVirtualDelivery({...datosVirtualDelivery, telefono: e.target.value})} />
                  </div>
                  <button type="submit" className="erp-btn erp-btn-primary" style={{width: '100%'}}>Generar Orden</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DATOS DELIVERY POR PLATO */}
      {modalItemDelivery && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="erp-modal-header" style={{background: '#D7263D', borderBottom: 'none'}}>
                <h4 className="erp-modal-title"><i className="fas fa-map-marker-alt" style={{marginRight: '8px'}}></i> Datos Logísticos</h4>
                <button className="erp-modal-close" onClick={() => setModalItemDelivery(false)}><i className="fas fa-times"></i></button>
              </div>
              <div className="erp-modal-body">
                <form onSubmit={guardarItemDelivery}>
                  <div className="erp-input-group">
                    <label className="erp-label">Nombre del Cliente</label>
                    <input type="text" className="erp-input" value={datosItemDelivery.nombre} onChange={e => setDatosItemDelivery({...datosItemDelivery, nombre: e.target.value.toUpperCase()})} required autoFocus />
                  </div>
                  <div className="erp-input-group">
                    <label className="erp-label">Dirección / Ref</label>
                    <input type="text" className="erp-input" value={datosItemDelivery.direccion} onChange={e => setDatosItemDelivery({...datosItemDelivery, direccion: e.target.value.toUpperCase()})} required />
                  </div>
                  <div className="erp-input-group" style={{marginBottom: '2rem'}}>
                    <label className="erp-label">Teléfono (Opcional)</label>
                    <input type="tel" className="erp-input" value={datosItemDelivery.telefono} onChange={e => setDatosItemDelivery({...datosItemDelivery, telefono: e.target.value})} />
                  </div>
                  <button type="submit" className="erp-btn" style={{width: '100%', background: '#D7263D', color: '#FFF'}}>Guardar Parámetros</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PLATO FUERA DE CARTA */}
      {modalFueraCarta && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #006989'}}>
                <h4 className="erp-modal-title"><i className="fas fa-plus-circle" style={{color: '#006989', marginRight: '8px'}}></i> Ítem Libre</h4>
                <button className="erp-modal-close" onClick={() => setModalFueraCarta(false)}><i className="fas fa-times"></i></button>
              </div>
              <div className="erp-modal-body">
                <form onSubmit={guardarPlatoPersonalizado}>
                  <div className="erp-input-group">
                    <label className="erp-label">Descripción</label>
                    <input type="text" className="erp-input" value={fueraCartaItem.nombre} onChange={e => setFueraCartaItem({...fueraCartaItem, nombre: e.target.value.toUpperCase()})} required autoFocus />
                  </div>
                  <div className="erp-input-group" style={{marginBottom: '2rem'}}>
                    <label className="erp-label">Importe (S/)</label>
                    <input type="number" step="0.10" className="erp-input" value={fueraCartaItem.precio} onChange={e => setFueraCartaItem({...fueraCartaItem, precio: e.target.value})} required />
                  </div>
                  <button type="submit" className="erp-btn" style={{background: '#006989', color: '#FFF', width: '100%'}}>Agregar Línea</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN ESTILIZADO */}
      {confirmModal.visible && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(18,11,6,0.7)', zIndex: 2000 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', maxWidth: '380px', margin: '0 auto' }}>
              <div className="erp-modal-header py-3" style={{ background: '#D7263D', borderBottom: 'none' }}>
                <h5 className="erp-modal-title" style={{ fontSize: '1.1rem' }}>{confirmModal.title}</h5>
                <button className="erp-modal-close" onClick={() => setConfirmModal({ ...confirmModal, visible: false })}>✕</button>
              </div>
              <div className="erp-modal-body text-center py-4" style={{ background: '#F4F1ED' }}>
                <i className="fas fa-exclamation-triangle mb-3" style={{ fontSize: '2.5rem', color: '#D7263D' }}></i>
                <p className="mb-4" style={{ color: '#2D241E', fontWeight: '700', fontSize: '0.95rem', padding: '0 10px' }}>
                  {confirmModal.message}
                </p>
                <div className="d-flex gap-2">
                  <button className="erp-btn erp-btn-outline flex-grow-1" onClick={() => setConfirmModal({ ...confirmModal, visible: false })}>
                    CANCELAR
                  </button>
                  <button className="erp-btn flex-grow-1" style={{ background: '#D7263D', color: '#FFF' }} onClick={confirmModal.onConfirm}>
                    CONFIRMAR
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALERTAS ESTILIZADO */}
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

    </div>
  );
}