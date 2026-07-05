import { useState, useMemo } from 'react';
import { POSService, MenuService } from '../services/api';
import { obtenerFechaActualLocal } from '../utils/helpers';
import { generarTicketHTML } from '../utils/printer';

export default function usePOS(usuarioActivo, mostrarAlert, solicitarConfirmacion, cerrarConfirmacion, enviarAImpresora, modalCobroInstance) {
  const [mesas, setMesas] = useState([]);
  const [carta, setCarta] = useState([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [filtroCarta, setFiltroCarta] = useState('');
  const [modoDomingo, setModoDomingo] = useState(false);

  const [pagos, setPagos] = useState({ efectivo: 0, yape: 0, plin: 0, tarjeta: 0 });
  const [montoRecibido, setMontoRecibido] = useState('');
  const [clienteFacturacion, setClienteFacturacion] = useState({ documento: '', nombre: '', direccion: '' });
  const [tipoCobro, setTipoCobro] = useState('nota');

  const [modalMover, setModalMover] = useState(false);
  const [datosMover, setDatosMover] = useState({ tipo: 'mesa', destino: '', nombreCuenta: '' });

  const [notaCaja, setNotaCaja] = useState({ visible: false, idx: null, texto: '', cantidadMover: 1 });
  const [uiSplit, setUiSplit] = useState({ visible: false, idx: null, nextMod: '', cantidadTotal: 0, cantidadMover: 1 });

  const [modalBebidaDomingo, setModalBebidaDomingo] = useState(false);
  const [platoPendienteBebida, setPlatoPendienteBebida] = useState(null);

  const [modalFueraCarta, setModalFueraCarta] = useState(false);
  const [fueraCartaItem, setFueraCartaItem] = useState({ nombre: '', precio: '' });

  const [modalVirtualDelivery, setModalVirtualDelivery] = useState(false);
  const [datosVirtualDelivery, setDatosVirtualDelivery] = useState({ nombre: '', direccion: '', telefono: '' });

  const [modalVirtualLlevar, setModalVirtualLlevar] = useState(false);
  const [datosVirtualLlevar, setDatosVirtualLlevar] = useState({ nombre: '', telefono: '' });

  const [modalItemDelivery, setModalItemDelivery] = useState(false);
  const [datosItemDelivery, setDatosItemDelivery] = useState({ nombre: '', direccion: '', telefono: '', idx: null, mod: '' });

  const mesasOrdenadas = useMemo(() => {
    return [...mesas].sort((a, b) => {
      const numA = parseInt(String(a.id).replace(/\D/g, ''));
      const numB = parseInt(String(b.id).replace(/\D/g, ''));
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [mesas]);

  const mesaActiva = mesas.find(m => m.id === mesaSeleccionada);

  const cargarMesas = async () => { try { const res = await MenuService.getMesas(); setMesas(res.data); } catch (e) {} };
  const cargarCarta = async () => { try { const res = await MenuService.getCarta(); setCarta(res.data); } catch (e) {} };

  const actualizarPedidoMesa = async (mesaId, nuevoPedido) => {
    try {
      await POSService.actualizarPedidoMesa(mesaId, { pedido: nuevoPedido });
      cargarMesas();
    } catch (error) {
      const msg = error.response?.data?.error || 'No se pudo actualizar el pedido';
      mostrarAlert('Operación Bloqueada', msg, 'danger');
      cargarMesas(); 
    }
  };

  const matchesRef = (i, ref) => {
    const taperI = JSON.stringify(i.taper || []);
    const taperRef = JSON.stringify(ref.taper || []);
    return i.nombre === ref.nombre && 
           (i.categoria || '').toLowerCase() === (ref.categoria || '').toLowerCase() && 
           i.modalidad === ref.modalidad && 
           (i.nota || '') === (ref.nota || '') && 
           i.impreso === ref.impreso &&
           taperI === taperRef;
  };

  const consolidarPedido = (arr) => {
    let agrupado = [];
    arr.filter(i => i.cantidad > 0).forEach(it => {
        let match = agrupado.findIndex(f => matchesRef(f, it) && f.fecha_agregado === it.fecha_agregado);
        if (match > -1) agrupado[match].cantidad += it.cantidad;
        else agrupado.push(it);
    });
    return agrupado;
  };

  const modificarCantidad = (vItem, cambio) => {
    const indexMesa = mesas.findIndex(m => m.id === mesaSeleccionada);
    if (indexMesa === -1) return;
    let nuevo = [...mesas[indexMesa].pedido].map(item => ({...item}));
    
    let targetRef = vItem.refs[vItem.refs.length - 1]; // Toma el último de la lista visual
    const refsToChange = vItem.isCombo ? [targetRef.refE, targetRef.refS] : [targetRef.refItem];

    if (cambio > 0) {
        for (let ref of refsToChange) {
            let platoEnCarta = null;
            for (let cat of carta) {
                const found = cat.items.find(p => p.nombre === ref.nombre);
                if (found) { platoEnCarta = found; break; }
            }
            if (platoEnCarta && platoEnCarta.stock_actual !== null) {
                const cantTotal = nuevo.filter(i => i.nombre === ref.nombre).reduce((a,c) => a + c.cantidad, 0);
                if (cantTotal >= platoEnCarta.stock_actual) return mostrarAlert('Stock Agotado', `Límite alcanzado para ${ref.nombre}.`, 'danger');
            }
        }
    }

    for (let ref of refsToChange) {
        const idx = nuevo.findIndex(i => matchesRef(i, ref));
        if (idx > -1) {
            if (cambio > 0 && nuevo[idx].impreso) nuevo.push({ ...nuevo[idx], cantidad: 1, impreso: false });
            else nuevo[idx].cantidad += cambio;
        }
        // 🟢 FIX: Si decrementamos un segundo de modo domingo, también decrementar su bebida incluida
        if (cambio < 0 && ref.es_modo_domingo && ref.categoria === 'segundos') {
            const bebidaIdx = nuevo.findIndex(i => i.isMenuDrink && i.modalidad === ref.modalidad && i.fecha_agregado === ref.fecha_agregado);
            if (bebidaIdx > -1) nuevo[bebidaIdx].cantidad -= 1;
        }
    }
    
    nuevo = consolidarPedido(nuevo);
    
    setMesas(prevMesas => {
        const nuevasMesas = [...prevMesas];
        const iM = nuevasMesas.findIndex(m => m.id === mesaSeleccionada);
        if (iM > -1) nuevasMesas[iM] = { ...nuevasMesas[iM], pedido: nuevo };
        return nuevasMesas;
    });

    // 🟢 Si la mesa quedó vacía y es temporal, deseleccionarla de la vista
    // 🟢 Si la mesa quedó vacía y es temporal, deseleccionarla de la vista
    if (nuevo.length === 0 && (String(mesaSeleccionada).startsWith('DEL-') || String(mesaSeleccionada).startsWith('CTA-') || String(mesaSeleccionada).startsWith('REC-'))) {
        setMesaSeleccionada(null);
    }

    actualizarPedidoMesa(mesaSeleccionada, nuevo);
  };

  const eliminarDelPedido = (vItem) => {
    solicitarConfirmacion('Eliminar', '¿Eliminar permanentemente?', () => {
        const indexMesa = mesas.findIndex(m => m.id === mesaSeleccionada);
        if (indexMesa === -1) { cerrarConfirmacion(); return; }
        let nuevo = [...mesas[indexMesa].pedido].map(item => ({...item}));
        
        for (let targetRef of vItem.refs) {
            const refsToChange = vItem.isCombo ? [targetRef.refE, targetRef.refS] : [targetRef.refItem];
            for (let ref of refsToChange) {
                const idx = nuevo.findIndex(i => matchesRef(i, ref));
                if (idx > -1) nuevo[idx].cantidad -= 1;
                // 🟢 FIX: Si eliminamos un segundo de modo domingo, también eliminar su bebida incluida
                if (ref.es_modo_domingo && ref.categoria === 'segundos') {
                    const bebidaIdx = nuevo.findIndex(i => i.isMenuDrink && i.modalidad === ref.modalidad && i.fecha_agregado === ref.fecha_agregado);
                    if (bebidaIdx > -1) nuevo[bebidaIdx].cantidad -= 1;
                }
            }
        }
        
        nuevo = consolidarPedido(nuevo);
        
        setMesas(prevMesas => {
            const nuevasMesas = [...prevMesas];
            const iM = nuevasMesas.findIndex(m => m.id === mesaSeleccionada);
            if (iM > -1) nuevasMesas[iM] = { ...nuevasMesas[iM], pedido: nuevo };
            return nuevasMesas;
        });

        // 🟢 Si la mesa quedó vacía y es temporal, deseleccionarla de la vista
        if (nuevo.length === 0 && (String(mesaSeleccionada).startsWith('DEL-') || String(mesaSeleccionada).startsWith('CTA-') || String(mesaSeleccionada).startsWith('REC-'))) {
            setMesaSeleccionada(null);
        }

        actualizarPedidoMesa(mesaSeleccionada, nuevo);
        cerrarConfirmacion();
    });
  };

  const cambiarModalidad = async (e, vItem, direction = 'forward') => {
    if (e) e.preventDefault();
    if (vItem.nombre.toUpperCase().startsWith('TAPER ')) return;

    const modActual = vItem.modalidad || 'local';
    const orden = ['local', 'llevar', 'delivery', 'delivery_centro'];
    let indexOrden = orden.indexOf(modActual);
    if (direction === 'forward') indexOrden = (indexOrden + 1) % orden.length;
    else indexOrden = (indexOrden - 1 + orden.length) % orden.length;
    const nextMod = orden[indexOrden];

    if (vItem.cantidad > 1) {
        setUiSplit({ visible: true, vItem, nextMod, cantidadTotal: vItem.cantidad, cantidadMover: 1 });
        return;
    }

    const indexMesa = mesas.findIndex(m => m.id === mesaSeleccionada);
    if (indexMesa === -1) return;
    let n = [...mesas[indexMesa].pedido].map(item => ({...item}));
    
    let targetRef = vItem.refs[0];
    const refsToChange = vItem.isCombo ? [targetRef.refE, targetRef.refS] : [targetRef.refItem];
    let requireDeliveryModal = false;

    for (let ref of refsToChange) {
        const idx = n.findIndex(i => matchesRef(i, ref));
        if (idx > -1) {
            if ((nextMod === 'delivery' || nextMod === 'delivery_centro') && (modActual !== 'delivery' && modActual !== 'delivery_centro')) {
                requireDeliveryModal = true;
            }
            n[idx].cantidad -= 1;
            const newItem = { ...n[idx], cantidad: 1, modalidad: nextMod };
            if (nextMod !== 'delivery' && nextMod !== 'delivery_centro') newItem.cliente = null;
            n.push(newItem);
        }
    }

    n = consolidarPedido(n);

    setMesas(prevMesas => {
        const nuevasMesas = [...prevMesas];
        const iM = nuevasMesas.findIndex(m => m.id === mesaSeleccionada);
        if (iM > -1) nuevasMesas[iM] = { ...nuevasMesas[iM], pedido: n };
        return nuevasMesas;
    });

    if (requireDeliveryModal) {
        setDatosItemDelivery({ nombre: '', direccion: '', telefono: '', vItem, mod: nextMod });
        setModalItemDelivery(true);
    }

    actualizarPedidoMesa(mesaSeleccionada, n);
  };

  const confirmarSplit = () => {
    const { vItem, nextMod, cantidadMover } = uiSplit;
    const indexMesa = mesas.findIndex(m => m.id === mesaSeleccionada);
    if (indexMesa === -1) return;
    let n = [...mesas[indexMesa].pedido].map(item => ({...item}));
    let requireDeliveryModal = false;

    for (let j = 0; j < cantidadMover; j++) {
        let targetRef = vItem.refs[j];
        const refsToChange = vItem.isCombo ? [targetRef.refE, targetRef.refS] : [targetRef.refItem];
        
        for (let ref of refsToChange) {
            const idx = n.findIndex(i => matchesRef(i, ref));
            if (idx > -1) {
                n[idx].cantidad -= 1;
                const newItem = { ...n[idx], cantidad: 1, modalidad: nextMod };
                if (nextMod !== 'delivery' && nextMod !== 'delivery_centro') newItem.cliente = null;
                n.push(newItem);
                
                if ((nextMod === 'delivery' || nextMod === 'delivery_centro') && (vItem.modalidad !== 'delivery' && vItem.modalidad !== 'delivery_centro')) {
                    requireDeliveryModal = true;
                }
            }
        }
    }

    n = consolidarPedido(n);

    setMesas(prevMesas => {
        const nuevasMesas = [...prevMesas];
        const iM = nuevasMesas.findIndex(m => m.id === mesaSeleccionada);
        if (iM > -1) nuevasMesas[iM] = { ...nuevasMesas[iM], pedido: n };
        return nuevasMesas;
    });

    if (requireDeliveryModal) {
        setDatosItemDelivery({ nombre: '', direccion: '', telefono: '', vItem, mod: nextMod });
        setModalItemDelivery(true);
    }

    actualizarPedidoMesa(mesaSeleccionada, n);
    setUiSplit({ visible: false, vItem: null, nextMod: '', cantidadTotal: 0, cantidadMover: 1 });
  };

  const guardarNotaCaja = () => {
    const indexMesa = mesas.findIndex(m => m.id === mesaSeleccionada);
    if (indexMesa === -1) return;
    let n = [...mesas[indexMesa].pedido].map(item => ({...item}));

    const { cantidadMover, texto, vItem } = notaCaja;
    const textoNota = texto.toUpperCase().trim();

    for (let j = 0; j < cantidadMover; j++) {
        let targetRef = vItem.refs[j];
        const refsToChange = vItem.isCombo ? [targetRef.refE, targetRef.refS] : [targetRef.refItem];
        
        for (let ref of refsToChange) {
            const idx = n.findIndex(i => matchesRef(i, ref));
            if (idx > -1) {
                n[idx].cantidad -= 1;
                const newItem = { ...n[idx], cantidad: 1, nota: textoNota, impreso: false };
                n.push(newItem);
            }
        }
    }

    n = consolidarPedido(n);

    setMesas(prevMesas => {
        const nuevasMesas = [...prevMesas];
        const iM = nuevasMesas.findIndex(m => m.id === mesaSeleccionada);
        if (iM > -1) nuevasMesas[iM] = { ...nuevasMesas[iM], pedido: n };
        return nuevasMesas;
    });

    actualizarPedidoMesa(mesaSeleccionada, n);
    setNotaCaja({ visible: false, vItem: null, texto: '', cantidadMover: 1 });
  };

  const guardarItemDelivery = (e) => {
    e.preventDefault();
    const indexMesa = mesas.findIndex(m => m.id === mesaSeleccionada);
    if (indexMesa === -1) return;
    let n = [...mesas[indexMesa].pedido].map(item => ({...item}));
    
    const { vItem, mod, nombre, direccion, telefono } = datosItemDelivery;

    for (let targetRef of vItem.refs) {
        const refsToChange = vItem.isCombo ? [targetRef.refE, targetRef.refS] : [targetRef.refItem];
        for (let ref of refsToChange) {
            const idx = n.findIndex(i => matchesRef(i, ref) && i.modalidad === mod);
            if (idx > -1) n[idx].cliente = { nombre, direccion, telefono };
        }
    }

    n = consolidarPedido(n);

    setMesas(prevMesas => {
        const nuevasMesas = [...prevMesas];
        const iM = nuevasMesas.findIndex(m => m.id === mesaSeleccionada);
        if (iM > -1) nuevasMesas[iM] = { ...nuevasMesas[iM], pedido: n };
        return nuevasMesas;
    });

    actualizarPedidoMesa(mesaSeleccionada, n);
    setModalItemDelivery(false);
  };

  const agregarPlatoDirecto = async (nombre, precio, categoriaNombre) => {
    if (!mesaSeleccionada) return;
    const indexMesa = mesas.findIndex(m => m.id === mesaSeleccionada);
    if (indexMesa === -1) return;

    const isDelivery = String(mesaSeleccionada).startsWith('DEL-');
    const mod = isDelivery ? 'delivery' : 'local';
    const fechaHoy = obtenerFechaActualLocal(); 
    
    let nuevo = [...(mesas[indexMesa].pedido || [])].map(item => ({...item}));
    
    const idx = nuevo.findIndex(i => i.nombre === nombre && i.modalidad === mod && !i.impreso && !i.nota && !i.cliente && i.fecha_agregado === fechaHoy);
    if (idx > -1) {
        nuevo[idx].cantidad += 1;
    } else {
        nuevo.push({ nombre, precio, cantidad: 1, categoria: categoriaNombre, modalidad: mod, impreso: false, fecha_agregado: fechaHoy });
    }
    
    setMesas(prevMesas => {
        const nuevasMesas = [...prevMesas];
        const iM = nuevasMesas.findIndex(m => m.id === mesaSeleccionada);
        if (iM > -1) nuevasMesas[iM] = { ...nuevasMesas[iM], pedido: nuevo };
        return nuevasMesas;
    });

    actualizarPedidoMesa(mesaSeleccionada, nuevo);
  };

  const agregarPlatoCarta = async (plato, categoriaNombre, bebidaSeleccionada = null) => {
    if (!mesaSeleccionada) return;
    // 🟢 NUEVO FLUJO: Si modo domingo y segundo sin bebida, agregar solo el plato (sin modal)
    // La bebida se seleccionará antes de enviar a cocina
    if (modoDomingo && categoriaNombre === 'segundos' && !bebidaSeleccionada) {
        // Simplemente continuamos y agregamos solo el segundo
    } else if (modoDomingo && categoriaNombre === 'segundos' && bebidaSeleccionada) {
        // Ya viene con bebida seleccionada, continuar normal
    }
    
    const indexMesa = mesas.findIndex(m => m.id === mesaSeleccionada);
    if (indexMesa === -1) return;

    let nuevoPedido = [...(mesas[indexMesa].pedido || [])].map(item => ({...item}));

    const cantEnMesa = nuevoPedido.filter(i => i.nombre === plato.nombre).reduce((acc, curr) => acc + curr.cantidad, 0);
    if (plato.stock_actual !== null && cantEnMesa >= plato.stock_actual) {
        mostrarAlert('Stock Agotado', `Solo quedan ${plato.stock_actual} raciones.`, 'danger');
        return;
    }

    const isDelivery = String(mesaSeleccionada).startsWith('DEL-');
    const isRecojo = String(mesaSeleccionada).startsWith('REC-');
    const mod = isDelivery ? 'delivery' : (isRecojo ? 'llevar' : 'local');
    const fechaHoy = obtenerFechaActualLocal(); 
    
    // 🟢 Agregamos el Segundo/Almuerzo SIN nota
    const idx = nuevoPedido.findIndex(i => 
        i.nombre === plato.nombre && i.categoria === categoriaNombre && 
        i.modalidad === mod && !i.impreso && i.fecha_agregado === fechaHoy && (i.nota || '') === ''
    );

    if (idx > -1) { nuevoPedido[idx].cantidad += 1; } 
    else {
        nuevoPedido.push({ 
            nombre: plato.nombre, precio: plato.precio, cantidad: 1, 
            categoria: categoriaNombre, modalidad: mod, impreso: false, 
            taper: plato.taper || [], costo_taper: plato.costo_taper || 0, 
            fecha_agregado: fechaHoy, nota: '' ,
            es_modo_domingo: modoDomingo
        });
    }

    // 🟢 Agregamos la BEBIDA como un ítem de S/ 0 con la bandera "isMenuDrink"
    if (bebidaSeleccionada) {
        const idxBebida = nuevoPedido.findIndex(i => 
            i.nombre === bebidaSeleccionada && i.isMenuDrink === true && i.modalidad === mod && !i.impreso && i.fecha_agregado === fechaHoy
        );
        if (idxBebida > -1) { nuevoPedido[idxBebida].cantidad += 1; } 
        else {
            nuevoPedido.push({
                nombre: bebidaSeleccionada, precio: 0, cantidad: 1,
                categoria: 'BEBIDAS', modalidad: mod, impreso: false,
                taper: [], costo_taper: 0, fecha_agregado: fechaHoy, nota: '',
                isMenuDrink: true // ESTO ES CLAVE PARA OCULTARLA EN EL TICKET
            });
        }
    }
    
    setMesas(prevMesas => {
        const nuevasMesas = [...prevMesas];
        const iM = nuevasMesas.findIndex(m => m.id === mesaSeleccionada);
        if (iM > -1) nuevasMesas[iM] = { ...nuevasMesas[iM], pedido: nuevoPedido };
        return nuevasMesas;
    });

    actualizarPedidoMesa(mesaSeleccionada, nuevoPedido);
    setModalBebidaDomingo(false);
  };

  // 🟢 NUEVO: Busca un plato en la carta por nombre y categoría
  const buscarPlatoEnCarta = (nombre, categoria) => {
    for (let cat of carta) {
      if (cat.nombre.toLowerCase().trim() === categoria.toLowerCase().trim()) {
        const found = cat.items.find(p => p.nombre === nombre);
        if (found) return found;
      }
    }
    return null;
  };

  // 🟢 NUEVO: Abre el selector de bebida para un ítem específico del pedido
  const seleccionarBebidaParaItem = (rawItem) => {
    const platoCarta = buscarPlatoEnCarta(rawItem.nombre, rawItem.categoria);
    if (platoCarta) {
      // Guardamos también modalidad y fecha para poder reemplazar la bebida existente
      setPlatoPendienteBebida({ 
        plato: platoCarta, 
        categoriaNombre: rawItem.categoria,
        modalidad: rawItem.modalidad,
        fecha_agregado: rawItem.fecha_agregado
      });
      setModalBebidaDomingo(true);
    }
  };

  // 🟢 NUEVO: Abre el selector de bebida en modo libre (sin asociar a un almuerzo específico)
  const abrirSelectorBebida = () => {
    setPlatoPendienteBebida({ libre: true });
    setModalBebidaDomingo(true);
  };

  // 🟢 NUEVO: Solo agrega la bebida isMenuDrink al pedido (sin duplicar el plato)
  // Si ya existe una bebida para este almuerzo (misma modalidad y fecha_agregado), la reemplaza
  // Si se abre desde el botón libre (sin datos de almuerzo), solo suma una bebida genérica
  const agregarBebidaAPlato = (bebidaNombre) => {
    if (!mesaSeleccionada) return;
    const indexMesa = mesas.findIndex(m => m.id === mesaSeleccionada);
    if (indexMesa === -1) return;
    let nuevoPedido = [...(mesas[indexMesa].pedido || [])].map(item => ({...item}));

    const isDelivery = String(mesaSeleccionada).startsWith('DEL-');
    const isRecojo = String(mesaSeleccionada).startsWith('REC-');
    const mod = isDelivery ? 'delivery' : (isRecojo ? 'llevar' : 'local');
    const fechaHoy = obtenerFechaActualLocal();

    // 🟢 FIX: Si este almuerzo ya tiene una bebida asignada, reemplazarla
    // Usamos los datos guardados en platoPendienteBebida (modalidad y fecha_agregado del almuerzo)
    if (platoPendienteBebida?.modalidad && platoPendienteBebida?.fecha_agregado) {
      const modLunch = platoPendienteBebida.modalidad;
      const fechaLunch = platoPendienteBebida.fecha_agregado;
      // Buscar bebidas existentes de este almuerzo y decrementarlas
      nuevoPedido.forEach(item => {
        if (item.isMenuDrink && item.modalidad === modLunch && item.fecha_agregado === fechaLunch) {
          item.cantidad = 0; // Se eliminará en consolidarPedido
        }
      });
    }

    const idxBebida = nuevoPedido.findIndex(i => 
      i.nombre === bebidaNombre && i.isMenuDrink === true && i.modalidad === mod && !i.impreso && i.fecha_agregado === fechaHoy
    );
    if (idxBebida > -1) {
      nuevoPedido[idxBebida].cantidad += 1;
    } else {
      nuevoPedido.push({
        nombre: bebidaNombre, precio: 0, cantidad: 1,
        categoria: 'BEBIDAS', modalidad: mod, impreso: false,
        taper: [], costo_taper: 0, fecha_agregado: fechaHoy, nota: '',
        isMenuDrink: true
      });
    }

    // Consolidar para limpiar items con cantidad 0
    nuevoPedido = consolidarPedido(nuevoPedido);

    setMesas(prevMesas => {
      const nuevasMesas = [...prevMesas];
      const iM = nuevasMesas.findIndex(m => m.id === mesaSeleccionada);
      if (iM > -1) nuevasMesas[iM] = { ...nuevasMesas[iM], pedido: nuevoPedido };
      return nuevasMesas;
    });
    actualizarPedidoMesa(mesaSeleccionada, nuevoPedido);
    setModalBebidaDomingo(false);
  };

  // 🟢 NUEVO: Verifica si hay segundos de modo domingo sin bebida asignada
  const obtenerSegundosSinBebida = (pedido) => {
    const catSegundos = ['segundos', 'segundo'];
    const domingoSegundos = pedido.filter(i => i.es_modo_domingo && catSegundos.includes((i.categoria || '').toLowerCase().trim()));
    const totalDomingoSegundos = domingoSegundos.reduce((acc, i) => acc + i.cantidad, 0);
    const totalBebidas = pedido.filter(i => i.isMenuDrink).reduce((acc, i) => acc + i.cantidad, 0);
    return totalDomingoSegundos - totalBebidas;
  };

  const enviarACocina = async () => {
    if (!mesaActiva || mesaActiva.pedido.length === 0) return mostrarAlert("Aviso", "El pedido está vacío.", "danger");
    
    // 🟢 Verificar si hay segundos de modo domingo sin bebida asignada
    const pendientes = obtenerSegundosSinBebida(mesaActiva.pedido);
    if (pendientes > 0) {
      return solicitarConfirmacion('Bebidas Pendientes', 
        `Hay ${pendientes} almuerzo(s) sin bebida incluida. ¿Deseas enviar a cocina igualmente o prefieres asignar las bebidas primero? Usa el botón "+ Asignar" en el encabezado para agregar las bebidas.`,
        () => { ejecutarEnvioCocina(); cerrarConfirmacion(); }
      );
    }
    
    ejecutarEnvioCocina();
  };

  const ejecutarEnvioCocina = async () => {
    const itemsNuevos = mesaActiva.pedido.filter(i => !i.impreso);
    if (itemsNuevos.length === 0) return mostrarAlert("Aviso", "No hay platos nuevos para enviar a cocina.", "danger");
    try {
      await POSService.crearPedido({ mesa: mesaSeleccionada, items: itemsNuevos, nota_general: mesaActiva.nota_general });
      mostrarAlert("Éxito", "Comandas enviadas a COCINA", "success");
    } catch(error) {
      const msg = error.response?.data?.error || error.message || 'Error de conexión con el servidor.';
      mostrarAlert("Operación Bloqueada", msg, "danger");
    }
  };

  const crearMesaDelivery = async (e) => {
    e.preventDefault();
    const nombreBase = datosVirtualDelivery.nombre.trim().split(' ')[0].toUpperCase() || 'CLIENTE';
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const idMesa = `DEL-${nombreBase}-${randomSuffix}`;
    const nota = `CLIENTE: ${datosVirtualDelivery.nombre} | DIR: ${datosVirtualDelivery.direccion} | TEL: ${datosVirtualDelivery.telefono}`;
    try {
        await POSService.crearPedido({ mesa: idMesa, items: [], nota_general: nota });
        setModalVirtualDelivery(false);
        setDatosVirtualDelivery({ nombre: '', direccion: '', telefono: '' });
        setMesaSeleccionada(idMesa);
    } catch(e) { mostrarAlert("Error", "Error al crear mesa de delivery", "danger"); }
  };

  const crearMesaLlevar = async (e) => {
    e.preventDefault();
    const nombreBase = datosVirtualLlevar.nombre.trim().split(' ')[0].toUpperCase() || 'CLIENTE';
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const idMesa = `REC-${nombreBase}-${randomSuffix}`; // Prefijo REC-
    const nota = `RECOJO: ${datosVirtualLlevar.nombre} | TEL: ${datosVirtualLlevar.telefono}`;
    try {
        await POSService.crearPedido({ mesa: idMesa, items: [], nota_general: nota });
        setModalVirtualLlevar(false);
        setDatosVirtualLlevar({ nombre: '', telefono: '' });
        setMesaSeleccionada(idMesa);
    } catch(e) { mostrarAlert("Error", "Error al crear mesa de recojo", "danger"); }
  };

  const guardarPlatoPersonalizado = async (e) => {
    e.preventDefault();
    if (!fueraCartaItem.nombre || !fueraCartaItem.precio) return;
    await agregarPlatoDirecto(`${fueraCartaItem.nombre} (Extra)`, parseFloat(fueraCartaItem.precio), 'general');
    setFueraCartaItem({ nombre: '', precio: '' });
    setModalFueraCarta(false);
  };

  const procesarCobro = async (enviarSunat) => { 
    const valYape = parseFloat(pagos.yape || 0); const valPlin = parseFloat(pagos.plin || 0);
    const valTarjeta = parseFloat(pagos.tarjeta || 0); const efectivoDigitado = parseFloat(montoRecibido || 0);
    const sumaPagosDigitales = valYape + valPlin + valTarjeta;
    const sumaTotalRecibida  = sumaPagosDigitales + efectivoDigitado;
    
    if (sumaTotalRecibida < mesaActiva.total) return mostrarAlert("Aviso", "Monto insuficiente.", "danger");
    
    const vuelto = sumaTotalRecibida > mesaActiva.total ? sumaTotalRecibida - mesaActiva.total : 0;
    const efectivoReal = efectivoDigitado - vuelto;
    const pagosFinales = { efectivo: efectivoReal > 0 ? efectivoReal : 0, yape: valYape, plin: valPlin, tarjeta: valTarjeta, enviado_sunat: enviarSunat };
    
    const pedidoImpresion = [...mesaActiva.pedido];
    const totalImpresion = mesaActiva.total;
    const idMesaImpresion = mesaSeleccionada;
    
    try {
      const mesaNumeroLimpio = String(mesaSeleccionada).startsWith('mesa_') ? parseInt(String(mesaSeleccionada).replace('mesa_', ''), 10) : mesaSeleccionada;
      
      // 🟢 Recibimos la respuesta del Backend con el número de boleta
      const resServer = await POSService.cobrarMesa({ mesaId: mesaSeleccionada, mesaNum: mesaNumeroLimpio, totalCobrado: mesaActiva.total, metodosPago: pagosFinales, items: mesaActiva.pedido, clienteFacturacion });
      const numBoletaGenerada = resServer.data.numBoleta;
      
      modalCobroInstance?.hide(); 
      setPagos({ efectivo: 0, yape: 0, plin: 0, tarjeta: 0 }); 
      setMontoRecibido('');
      setMesaSeleccionada(null); // Soltar mesa
      
      solicitarConfirmacion('Venta Registrada', '¿Desea imprimir el comprobante de pago para el cliente?', () => {
           // 🟢 Pasamos las banderas de SUNAT
           const ticketHTML = generarTicketHTML(idMesaImpresion, pedidoImpresion, totalImpresion, pagosFinales, efectivoDigitado, vuelto, usuarioActivo, modoDomingo, false, enviarSunat, clienteFacturacion, numBoletaGenerada);
           enviarAImpresora(ticketHTML, 'caja');
           cerrarConfirmacion();
        }
      );
    } catch (e) { mostrarAlert('Error', 'No se pudo procesar el cobro', 'danger'); }
  };

  const confirmarMoverMesa = async (e) => {
    e.preventDefault();
    if (!mesaSeleccionada) return;
    let destinoFinal = datosMover.tipo === 'mesa' 
        ? datosMover.destino 
        : (datosMover.subTipo === 'existente' 
            ? datosMover.destino 
            : `CTA-${datosMover.nombreCuenta.toUpperCase().replace(/\s+/g, '-')}`);
    if (!destinoFinal) return mostrarAlert("Aviso", "Indica el destino.", "danger");
    try {
      const res = await POSService.moverMesa({ origen: mesaSeleccionada, destino: destinoFinal });
      setMesaSeleccionada(res.data.nuevoId);
      setModalMover(false);
      setDatosMover({ tipo: 'mesa', destino: '', nombreCuenta: '', subTipo: null });
      mostrarAlert("Éxito", "Cuenta movida correctamente.", "success");
    } catch (error) { mostrarAlert("Error", "Error al mover mesa", "danger"); }
  };

  const imprimirPreCuenta = () => {
    if (!mesaActiva || mesaActiva.pedido.length === 0) return mostrarAlert("Aviso", "El pedido está vacío.", "danger");
    // 🟢 esPrecuenta = true
    const ticketHTML = generarTicketHTML(mesaSeleccionada, mesaActiva.pedido, mesaActiva.total, {efectivo: 0, yape: 0, plin: 0, tarjeta: 0}, 0, 0, usuarioActivo, modoDomingo, true, false, null, null);
    if (window.require) enviarAImpresora(ticketHTML, 'caja');
    else { const win = window.open('', '_blank'); win.document.write(ticketHTML); win.print(); }
  };

  return {
    mesas, setMesas, carta, setCarta, mesaSeleccionada, setMesaSeleccionada, filtroCarta, setFiltroCarta, modoDomingo, setModoDomingo,
    pagos, setPagos, montoRecibido, setMontoRecibido, clienteFacturacion, setClienteFacturacion, tipoCobro, setTipoCobro,
    modalMover, setModalMover, datosMover, setDatosMover, notaCaja, setNotaCaja, uiSplit, setUiSplit,
    modalBebidaDomingo, setModalBebidaDomingo, platoPendienteBebida, setPlatoPendienteBebida,
    modalFueraCarta, setModalFueraCarta, fueraCartaItem, setFueraCartaItem,
    modalVirtualDelivery, setModalVirtualDelivery, datosVirtualDelivery, setDatosVirtualDelivery,
    modalVirtualLlevar, setModalVirtualLlevar, datosVirtualLlevar, setDatosVirtualLlevar,
    modalItemDelivery, setModalItemDelivery, datosItemDelivery, setDatosItemDelivery,
    mesasOrdenadas, mesaActiva, cargarMesas, cargarCarta, actualizarPedidoMesa, agregarPlatoDirecto, agregarPlatoCarta,
    modificarCantidad, guardarNotaCaja, enviarACocina, cambiarModalidad, confirmarSplit, guardarItemDelivery, eliminarDelPedido,
    crearMesaDelivery, crearMesaLlevar, guardarPlatoPersonalizado, procesarCobro, confirmarMoverMesa, imprimirPreCuenta,
    seleccionarBebidaParaItem, abrirSelectorBebida, obtenerSegundosSinBebida, agregarBebidaAPlato
  };
}