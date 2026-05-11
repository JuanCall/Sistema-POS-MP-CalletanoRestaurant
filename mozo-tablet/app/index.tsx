import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Modal, SafeAreaView, Platform,
  StatusBar as RNStatusBar, Dimensions, Animated, KeyboardAvoidingView, BackHandler
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SW } = Dimensions.get('window');

// ── Paleta Corporativa ERP (High-End POS) ─────────────────────
const C = {
  bg:          '#F4F1ED', // Crema cálido (Fondo base)
  surface:     '#FFFFFF', // Blanco puro (Tarjetas)
  primary:     '#120B06', // Espresso profundo
  primarySoft: 'rgba(18, 11, 6, 0.05)',
  gold:        '#D4A843', // Oro/Ámbar
  goldSoft:    'rgba(212, 168, 67, 0.12)',
  danger:      '#D7263D', // Carmesí
  dangerSoft:  '#FDE8E8',
  success:     '#10B981', // Esmeralda
  successSoft: 'rgba(16, 185, 129, 0.12)',
  textDark:    '#2D241E', // Texto principal (Hierarchy 1)
  textMuted:   '#8A7060', // Texto secundario (Hierarchy 2)
  border:      '#E5E0D8', // Separación estándar (Border Progression)
  borderFocus: '#D1C9C0', // Separación con énfasis
  overlay:     'rgba(18, 11, 6, 0.7)', // Backdrop
  white: '#FFFFFF',
};

export default function App() {
  const [ipServidor, setIpServidor]   = useState('');
  const [ipInput, setIpInput]         = useState('');
  const [modoConfig, setModoConfig]   = useState(true);

  const [mesas, setMesas]             = useState([]);
  const [carta, setCarta]             = useState([]);
  const [serverStatus, setServerStatus] = useState('Sin conexión');
  const [conectado, setConectado]     = useState(false);

  const [vistaActual, setVistaActual] = useState('mesas');
  const [mesaActiva, setMesaActiva]   = useState(null);
  const [carrito, setCarrito]         = useState([]);
  const [filtroCarta, setFiltroCarta] = useState('');

  const [modalNotaVisible, setModalNotaVisible] = useState(false);
  const [notaInput, setNotaInput]     = useState('');
  const [itemEditando, setItemEditando] = useState(null);

  const [modalFueraCartaVisible, setModalFueraCartaVisible] = useState(false);
  const [fueraCartaItem, setFueraCartaItem] = useState({ nombre: '', precio: '' });

  const [modalDeliveryVisible, setModalDeliveryVisible] = useState(false);
  const [datosDelivery, setDatosDelivery] = useState({ nombre: '', direccion: '', telefono: '', idx: null, mod: '' });

  const socketRef   = useRef(null);
  const carritoAnim = useRef(new Animated.Value(0)).current;
  
  // 🟢 Iniciamos en false, el servidor mandará la verdad absoluta
  const [modoDomingo, setModoDomingo] = useState(false);

  useEffect(() => {
    Animated.spring(carritoAnim, {
      toValue: carrito.length > 0 ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [carrito.length > 0]);

  useEffect(() => {
    AsyncStorage.getItem('pos_ip').then(ip => {
      if (ip) { setIpServidor(ip); setIpInput(ip); setModoConfig(false); }
    });
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (vistaActual === 'comandar') {
        setVistaActual('mesas');
        return true; 
      }
      return false; 
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove(); 
  }, [vistaActual]);

  useEffect(() => {
    if (!ipServidor || modoConfig) return;
    const API_URL = `http://${ipServidor}:3001`;
    setServerStatus('Conectando...');
    socketRef.current = io(API_URL, { timeout: 4000 });

    const cargarDatos = async () => {
      try {
        // 🟢 Se cambian las llamadas a la API para solicitar directamente el estado del Domingo
        const [resMesas, resCarta, resDomingo] = await Promise.all([
          axios.get(`${API_URL}/api/mesas`, { timeout: 4000 }),
          axios.get(`${API_URL}/api/carta`, { timeout: 4000 }),
          axios.get(`${API_URL}/api/modo-domingo`, { timeout: 4000 })
        ]);
        setMesas(resMesas.data);
        setCarta(resCarta.data);
        setModoDomingo(resDomingo.data.modoDomingo); // Sincronizado
        
        setServerStatus('Conectado');
        setConectado(true);
      } catch {
        setServerStatus('Error · Revisa IP');
        setConectado(false);
        Alert.alert(
          'Sin conexión',
          'No encontramos la Caja. Verifica que el celular y la computadora estén en el mismo Wi-Fi.',
          [{ text: 'Corregir IP', onPress: () => setModoConfig(true) }]
        );
      }
    };

    socketRef.current.on('connect',       () => cargarDatos());
    socketRef.current.on('disconnect',    () => { setServerStatus('Desconectado'); setConectado(false); });
    socketRef.current.on('connect_error', () => { if (mesas.length === 0) cargarDatos(); });
    socketRef.current.on('actualizar_mesas', () => cargarDatos());

    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [ipServidor, modoConfig]);

  const guardarIP = async () => {
    const ipLimpia = ipInput.trim();
    if (!ipLimpia) return Alert.alert('Error', 'Ingresa una IP válida');
    await AsyncStorage.setItem('pos_ip', ipLimpia);
    setIpServidor(ipLimpia);
    setModoConfig(false);
  };

  const borrarIP = async () => {
    await AsyncStorage.removeItem('pos_ip');
    setIpInput(''); setIpServidor('');
  };

  const abrirMesa = (mesa) => {
    setMesaActiva(mesa); setCarrito([]); setFiltroCarta('');
    setVistaActual('comandar');
  };

  const agregarAlCarrito = (plato, catNombre) => {
    const index = carrito.findIndex(i => i.nombre === plato.nombre && i.modalidad === 'local' && i.nota === '');
    if (index > -1) { modificarCantidad(index, 1); }
    else {
      setCarrito(prev => [...prev, {
        nombre: plato.nombre, precio: plato.precio,
        cantidad: 1, categoria: catNombre, modalidad: 'local', nota: '', cliente: null
      }]);
    }
  };

  const modificarCantidad = (index, cambio) => {
    setCarrito(prev => {
      const n = [...prev];
      n[index] = { ...n[index], cantidad: n[index].cantidad + cambio };
      if (n[index].cantidad <= 0) n.splice(index, 1);
      return n;
    });
  };

  const ciclarModalidad = (index) => {
    const orden = ['local', 'llevar', 'delivery', 'delivery_centro'];
    const modActual = carrito[index].modalidad;
    const nextMod = orden[(orden.indexOf(modActual) + 1) % orden.length];

    if ((nextMod === 'delivery' || nextMod === 'delivery_centro') && (modActual !== 'delivery' && modActual !== 'delivery_centro')) {
      setDatosDelivery({ 
        nombre: carrito[index].cliente?.nombre || '', 
        direccion: carrito[index].cliente?.direccion || '', 
        telefono: carrito[index].cliente?.telefono || '', 
        idx: index, 
        mod: nextMod 
      });
      setModalDeliveryVisible(true);
    } else {
      setCarrito(prev => {
        const n = [...prev];
        const clienteActual = n[index].cliente;
        n[index] = { ...n[index], modalidad: nextMod, cliente: (nextMod === 'delivery' || nextMod === 'delivery_centro') ? clienteActual : null };
        return n;
      });
    }
  };

  const confirmarDatosDelivery = () => {
    if (!datosDelivery.nombre || !datosDelivery.direccion) {
      Alert.alert('Faltan datos', 'El nombre y dirección son obligatorios para Delivery.');
      return;
    }
    setCarrito(prev => {
      const n = [...prev];
      n[datosDelivery.idx] = { 
        ...n[datosDelivery.idx], 
        modalidad: datosDelivery.mod,
        cliente: { nombre: datosDelivery.nombre, direccion: datosDelivery.direccion, telefono: datosDelivery.telefono }
      };
      return n;
    });
    setModalDeliveryVisible(false);
  };

  const guardarPlatoFueraCarta = () => {
    const p = parseFloat(fueraCartaItem.precio);
    if (!fueraCartaItem.nombre || isNaN(p)) {
      Alert.alert('Error', 'Ingrese un nombre y un precio válido.');
      return;
    }
    setCarrito(prev => [...prev, { 
      nombre: `${fueraCartaItem.nombre} (Extra)`, 
      precio: p, cantidad: 1, categoria: 'GENERAL', modalidad: 'local', nota: '' 
    }]);
    setFueraCartaItem({ nombre: '', precio: '' });
    setModalFueraCartaVisible(false);
  };

  const abrirModalNota = (index) => {
    setItemEditando(index);
    setNotaInput(carrito[index].nota || '');
    setModalNotaVisible(true);
  };

  const guardarNota = () => {
    if (itemEditando !== null) {
      setCarrito(prev => {
        const n = [...prev];
        n[itemEditando] = { ...n[itemEditando], nota: notaInput };
        return n;
      });
    }
    setModalNotaVisible(false);
  };

  const enviarComanda = async () => {
    if (carrito.length === 0) return Alert.alert('Aviso', 'El carrito está vacío');
    try {
      await axios.post(`http://${ipServidor}:3001/api/pedidos`, { mesa: mesaActiva.id, items: carrito });
      setVistaActual('mesas');
      Alert.alert('✅ ¡Enviado!', 'La orden se ha impreso en cocina.');
    } catch { Alert.alert('Error', '❌ No se pudo enviar la comanda'); }
  };

  const ModIcon = ({ mod, color }) => {
    if (mod === 'local') return <MaterialCommunityIcons name="silverware-fork-knife" size={16} color={color} />;
    if (mod === 'llevar') return <Feather name="shopping-bag" size={16} color={color} />;
    return <MaterialCommunityIcons name="motorbike" size={18} color={color} />;
  };

  const modLabelText = (mod) => {
    if (mod === 'local') return 'Local';
    if (mod === 'llevar') return 'Llevar';
    if (mod === 'delivery') return 'Delivery';
    if (mod === 'delivery_centro') return 'Centro';
    return mod;
  };

  const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0);

  const formatMesaName = (id) => {
    if (!id) return '';
    const idStr = String(id).replace('.0', ''); 
    if (idStr.startsWith('DEL-')) return idStr;
    return `MESA ${idStr.replace('mesa_', '')}`;
  };

  const mesasOrdenadas = [...mesas].sort((a, b) => {
    const numA = parseInt(String(a.id).replace(/\D/g, ''));
    const numB = parseInt(String(b.id).replace(/\D/g, ''));
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return String(a.id).localeCompare(String(b.id));
  });

  // ═══════════════════════════════════════════════════════════
  // PANTALLA: CONFIGURAR IP
  // ═══════════════════════════════════════════════════════════
  if (modoConfig) {
    return (
      <SafeAreaView style={s.safeAreaBlue}>
        <StatusBar style="light" />
        <View style={s.cfgScreen}>
          <View style={s.cfgCard}>
            <View style={s.cfgLogoWrap}>
              <Text style={s.cfgLogo}>Calletano</Text>
              <Text style={s.cfgLogoSub}>SISTEMA POS · CONFIGURACIÓN</Text>
            </View>

            <View style={s.cfgDivider} />

            <Text style={s.cfgLabel}>Dirección IP de la Caja</Text>
            <TextInput
              style={s.cfgInput}
              placeholder="Ej: 192.168.1.50"
              placeholderTextColor={C.textMuted}
              value={ipInput}
              onChangeText={setIpInput}
              keyboardType="numeric"
              returnKeyType="done"
            />

            <TouchableOpacity style={s.btnPrimary} onPress={guardarIP} activeOpacity={0.85}>
              <Text style={s.btnPrimaryText}>Guardar y Conectar</Text>
            </TouchableOpacity>

            {ipServidor !== '' && (
              <TouchableOpacity style={s.btnSecondary} onPress={() => setModoConfig(false)} activeOpacity={0.7}>
                <Text style={s.btnSecondaryText}>← Volver al sistema</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.btnDangerOutline} onPress={borrarIP} activeOpacity={0.7}>
              <Feather name="trash-2" size={16} color={C.danger} />
              <Text style={s.btnDangerOutlineText}>Limpiar IP</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PANTALLA: COMANDERA TÁCTIL
  // ═══════════════════════════════════════════════════════════
  if (vistaActual === 'comandar' && mesaActiva) {
    const menuDelDia = carta.filter(c => 
      ['entradas', 'segundos'].includes(c.nombre.toLowerCase().trim())
    );
    const cartaGeneral = carta.filter(c => c.nombre !== 'entradas' && c.nombre !== 'segundos');

    const sheetTranslate = carritoAnim.interpolate({ inputRange: [0, 1], outputRange: [380, 0] });

    return (
      <SafeAreaView style={s.safeAreaBlue}>
        <StatusBar style="light" />
        <View style={s.navbar}>
          <TouchableOpacity 
            style={s.navBackBtn} 
            onPress={() => setVistaActual('mesas')} 
            activeOpacity={0.75}
            hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }} 
          >
            <Feather name="chevron-left" size={28} color={C.surface} /> 
            <Text style={s.navBackText}>Mesas</Text> 
          </TouchableOpacity>
          <Text style={s.navTitle} numberOfLines={1}>
            {mesaActiva ? formatMesaName(mesaActiva.id) : ''}
          </Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView style={s.scrollBase} contentContainerStyle={{ padding: 12, paddingBottom: carrito.length > 0 ? 320 : 40 }} keyboardShouldPersistTaps="handled">
          
          <View style={s.searchWrap}>
            <Feather name="search" size={20} color={C.textMuted} style={s.searchIcon} />
            <TextInput
              style={s.searchInput}
              placeholder="Buscar plato..."
              placeholderTextColor={C.textMuted}
              value={filtroCarta}
              onChangeText={setFiltroCarta}
            />
            {filtroCarta.length > 0 && (
              <TouchableOpacity onPress={() => setFiltroCarta('')} style={s.searchClear}>
                <Feather name="x-circle" size={20} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {filtroCarta === '' && (
            <>
              <View style={s.quickGrid}>
                <TouchableOpacity 
                  style={[s.quickBtn, s.quickBtnBlue]} 
                  onPress={() => agregarAlCarrito({ nombre: 'Refresco', precio: modoDomingo ? 3.5 : 2.0 }, 'GENERAL')} 
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="cup-water" size={28} color={C.primary} style={{marginBottom: 4}} />
                  <Text style={s.quickBtnLabel}>Refresco</Text>
                  <Text style={s.quickBtnPrice}>S/ {modoDomingo ? '3.50' : '2.00'}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[s.quickBtn, s.quickBtnRed]} 
                  onPress={() => agregarAlCarrito({ nombre: 'Humita', precio: modoDomingo ? 4.0 : 3.0 }, 'GENERAL')} 
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="corn" size={28} color={C.danger} style={{marginBottom: 4}} />
                  <Text style={[s.quickBtnLabel, {color: C.danger}]}>Humita</Text>
                  <Text style={[s.quickBtnPrice, {color: C.danger}]}>S/ {modoDomingo ? '4.00' : '3.00'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={s.fueraCarta} onPress={() => setModalFueraCartaVisible(true)} activeOpacity={0.75}>
                <Feather name="edit-3" size={18} color={C.textMuted} />
                <Text style={s.fueraCartaText}>Plato fuera de carta</Text>
              </TouchableOpacity>
            </>
          )}

          {mesaActiva.pedido?.length > 0 && filtroCarta === '' && (
            <View style={s.yaPedidoCard}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                <Feather name="list" size={16} color={C.primary} />
                <Text style={s.yaPedidoTitle}>Ya en esta mesa</Text>
              </View>
              {mesaActiva.pedido.map((p, i) => (
                <View key={i} style={s.yaPedidoRow}>
                  <Text style={s.yaPedidoItem}>
                    <Text style={{ color: C.danger, fontWeight: '700' }}>{p.cantidad}×  </Text>
                    <Text style={{ color: C.textDark, fontWeight: '600' }}>{p.nombre}</Text>
                    {p.modalidad !== 'local' && <Text style={{ color: C.textMuted }}> · {p.modalidad}</Text>}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {menuDelDia.length > 0 && (
            <View style={s.seccionWrap}>
              <Text style={s.seccionTitle}><MaterialCommunityIcons name="silverware-clean" size={18} color={C.textMuted}/> MENÚ DEL DÍA</Text>
              {menuDelDia.map((cat, idx) => {
                if (modoDomingo && cat.nombre.toLowerCase().trim() === 'entradas') return null;
                
                const items = cat.items.filter(p => p.nombre.toLowerCase().includes(filtroCarta.toLowerCase()));
                if (items.length === 0) return null;
                const esEntrada = cat.nombre === 'entradas';
                return (
                  <View key={idx} style={{ marginBottom: 10 }}>
                    <Text style={s.catLabel}>{cat.nombre}</Text>
                    <View style={s.platosGrid}>
                      {items.map(plato => (
                        <TouchableOpacity key={plato.id} style={s.platoBtn} onPress={() => agregarAlCarrito(plato, cat.nombre)} activeOpacity={0.75}>
                          <View style={[s.platoBtnBar, { backgroundColor: esEntrada ? C.primary : C.danger }]} />
                          <Text style={s.platoNombre} numberOfLines={2}>{plato.nombre}</Text>
                          <Text style={[s.platoPrecio, { color: esEntrada ? C.primary : C.danger }]}>S/ {plato.precio.toFixed(2)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {cartaGeneral.map((cat, idx) => {
            const items = cat.items.filter(p => p.nombre.toLowerCase().includes(filtroCarta.toLowerCase()));
            if (items.length === 0) return null;
            return (
              <View key={idx} style={s.seccionWrap}>
                <Text style={s.seccionTitle}><Feather name="book-open" size={18} color={C.textMuted}/> {cat.nombre}</Text>
                <View style={s.platosGrid}>
                  {items.map(plato => (
                    <TouchableOpacity key={plato.id} style={s.platoBtn} onPress={() => agregarAlCarrito(plato, cat.nombre)} activeOpacity={0.75}>
                      <View style={[s.platoBtnBar, { backgroundColor: C.textDark }]} />
                      <Text style={s.platoNombre} numberOfLines={2}>{plato.nombre}</Text>
                      <Text style={[s.platoPrecio, { color: C.textDark }]}>S/ {plato.precio.toFixed(2)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {carrito.length > 0 && (
          <Animated.View style={[s.carritoSheet, { transform: [{ translateY: sheetTranslate }] }]}>
            <View style={s.carritoHandle}><View style={s.carritoHandleBar} /></View>
            <View style={s.carritoHeader}>
              <Text style={s.carritoHeaderTitle}>Por Enviar a Cocina</Text>
              <View style={s.carritoHeaderBadge}><Text style={s.carritoHeaderBadgeText}>{totalItems}</Text></View>
            </View>

            <ScrollView style={s.carritoLista} keyboardShouldPersistTaps="handled">
              {carrito.map((item, idx) => {
                const esLocal = item.modalidad === 'local';
                return (
                  <View key={idx} style={s.carritoItem}>
                    <View style={s.carritoItemRow1}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.carritoItemNombre} numberOfLines={2}>
                          <Text style={{ color: C.primary, fontWeight: '800' }}>{item.cantidad}×  </Text>
                          {item.nombre}
                        </Text>
                        {item.cliente ? <Text style={s.carritoItemNota}><Feather name="map-pin" size={12}/> Delivery a: {item.cliente.nombre}</Text> : null}
                        {item.nota ? <Text style={s.carritoItemNota}><Feather name="alert-circle" size={12}/> {item.nota}</Text> : null}
                      </View>
                      <Text style={s.carritoItemPrecio}>S/ {(item.precio * item.cantidad).toFixed(2)}</Text>
                    </View>

                    <View style={s.carritoItemRow2}>
                      <TouchableOpacity style={[s.modBtn, !esLocal && s.modBtnActiva]} onPress={() => ciclarModalidad(idx)} activeOpacity={0.75}>
                        <ModIcon mod={item.modalidad} color={esLocal ? C.textMuted : C.white} />
                        <Text style={[s.modBtnText, !esLocal && s.modBtnTextActiva]}>{modLabelText(item.modalidad)}</Text>
                        <Feather name="refresh-cw" size={12} color={esLocal ? C.textMuted : C.white} style={{marginLeft: 4}}/>
                      </TouchableOpacity>

                      <View style={s.carritoControles}>
                        <TouchableOpacity style={s.notaBtn} onPress={() => abrirModalNota(idx)} activeOpacity={0.75}>
                          <Feather name="file-text" size={18} color={C.textMuted} />
                        </TouchableOpacity>
                        <View style={s.qtyControls}>
                          <TouchableOpacity style={s.qtyBtn} onPress={() => modificarCantidad(idx, -1)} activeOpacity={0.7}>
                            <Feather name="minus" size={20} color={C.textDark} />
                          </TouchableOpacity>
                          <Text style={s.qtyNumber}>{item.cantidad}</Text>
                          <TouchableOpacity style={s.qtyBtn} onPress={() => modificarCantidad(idx, 1)} activeOpacity={0.7}>
                            <Feather name="plus" size={20} color={C.textDark} />
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={s.eliminarBtn} onPress={() => modificarCantidad(idx, -item.cantidad)} activeOpacity={0.75}>
                          <Feather name="trash-2" size={18} color={C.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={s.carritoFooter}>
              <TouchableOpacity style={s.btnPrimary} onPress={enviarComanda} activeOpacity={0.85}>
                <Feather name="send" size={20} color={C.white} style={{marginRight: 8}} />
                <Text style={s.btnPrimaryText}>Enviar a Cocina</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        <Modal visible={modalNotaVisible} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Nota para cocina</Text>
              <Text style={s.modalSubtitle}>Ej: sin cebolla, poca sal</Text>
              <TextInput style={s.modalInput} placeholder="Escribe la nota..." placeholderTextColor={C.border} value={notaInput} onChangeText={setNotaInput} autoFocus multiline />
              <TouchableOpacity style={s.btnPrimary} onPress={guardarNota}><Text style={s.btnPrimaryText}>Guardar Nota</Text></TouchableOpacity>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setModalNotaVisible(false)}><Text style={s.btnSecondaryText}>Cancelar</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={modalDeliveryVisible} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Datos de Delivery</Text>
              <Text style={s.modalSubtitle}>¿A dónde enviamos este plato?</Text>
              <TextInput style={s.modalInputCompact} placeholder="Nombre del Cliente" placeholderTextColor={C.textMuted} value={datosDelivery.nombre} onChangeText={t => setDatosDelivery({...datosDelivery, nombre: t})} autoFocus />
              <TextInput style={s.modalInputCompact} placeholder="Dirección / Ref" placeholderTextColor={C.textMuted} value={datosDelivery.direccion} onChangeText={t => setDatosDelivery({...datosDelivery, direccion: t})} />
              <TextInput style={s.modalInputCompact} placeholder="Teléfono (Opcional)" placeholderTextColor={C.textMuted} value={datosDelivery.telefono} onChangeText={t => setDatosDelivery({...datosDelivery, telefono: t})} keyboardType="phone-pad" />
              <TouchableOpacity style={[s.btnPrimary, {backgroundColor: C.primary}]} onPress={confirmarDatosDelivery}><Text style={s.btnPrimaryText}>Confirmar Envío</Text></TouchableOpacity>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setModalDeliveryVisible(false)}><Text style={s.btnSecondaryText}>Cancelar</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={modalFueraCartaVisible} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Plato Especial</Text>
              <Text style={s.modalSubtitle}>Ingresa los datos del extra</Text>
              <TextInput style={s.modalInputCompact} placeholder="Nombre del plato" placeholderTextColor={C.textMuted} value={fueraCartaItem.nombre} onChangeText={t => setFueraCartaItem({...fueraCartaItem, nombre: t})} autoFocus />
              <TextInput style={s.modalInputCompact} placeholder="Precio (S/)" placeholderTextColor={C.textMuted} value={fueraCartaItem.precio} onChangeText={t => setFueraCartaItem({...fueraCartaItem, precio: t})} keyboardType="decimal-pad" />
              <TouchableOpacity style={s.btnPrimary} onPress={guardarPlatoFueraCarta}><Text style={s.btnPrimaryText}>Añadir al pedido</Text></TouchableOpacity>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setModalFueraCartaVisible(false)}><Text style={s.btnSecondaryText}>Cancelar</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PANTALLA: MAPA DE MESAS
  // ═══════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.safeAreaBlue}>
      <StatusBar style="light" />
      <View style={s.navbar}>
        <Text style={s.navBrand}>Calletano</Text>
        <View style={s.navRight}>
          <View style={[s.statusPill, conectado ? s.statusPillOn : s.statusPillOff]}>
            <View style={[s.statusDot, { backgroundColor: conectado ? C.success : C.danger }]} />
            <Text style={s.statusPillText} numberOfLines={1}>{serverStatus}</Text>
          </View>
          <TouchableOpacity 
            style={s.cfgIconBtn} 
            onPress={() => setModoConfig(true)} 
            activeOpacity={0.75}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} 
          >
            <Feather name="settings" size={20} color={C.surface} /> 
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.scrollBase} contentContainerStyle={{ padding: 14, paddingBottom: 32 }}>
        <Text style={s.mesasSectionLabel}>SALÓN — Selecciona una mesa</Text>

        <View style={s.mesasGrid}>
          {mesasOrdenadas.map(mesa => {
            const ocupada = mesa.estado === 'ocupada';
            return (
              <TouchableOpacity key={mesa.id} style={[s.mesaCard, ocupada && s.mesaCardOcupada]} onPress={() => abrirMesa(mesa)} activeOpacity={0.8}>
                <View style={[s.mesaCardBar, { backgroundColor: ocupada ? C.danger : C.primary }]} />
                
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 6}}>
                  <MaterialCommunityIcons name="table-chair" size={26} color={ocupada ? C.danger : C.primary} />
                </View>

                <Text style={s.mesaCardNombre} numberOfLines={1}>
                  {formatMesaName(mesa.id)}
                </Text>
                
                <View style={[s.mesaCardBadge, { backgroundColor: ocupada ? C.dangerSoft : C.primarySoft }]}>
                  <Text style={[s.mesaCardBadgeText, { color: ocupada ? C.danger : C.primary }]}>
                    {ocupada ? 'Ocupada' : 'Libre'}
                  </Text>
                </View>
                
                <View style={s.mesaCardFooter}>
                  <Text style={s.mesaCardItems}>{mesa.pedido?.length ?? 0} ítems</Text>
                  <Text style={[s.mesaCardTotal, mesa.total > 0 && s.mesaCardTotalActivo]}>
                    S/ {(mesa.total ?? 0).toFixed(2)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {mesas.length === 0 && conectado && <Text style={s.emptyText}>No hay mesas configuradas.</Text>}
        {!conectado && <Text style={s.emptyText}>Sin conexión · Verifica la IP en Ajustes</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════
// ESTILOS 
// ═══════════════════════════════════════════════════════════
const PT = Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0;

const s = StyleSheet.create({
  safeAreaBlue: { flex: 1, backgroundColor: C.primary, paddingTop: PT },
  scrollBase:   { flex: 1, backgroundColor: C.bg },

  cfgScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: C.bg },
  cfgCard: {
    backgroundColor: C.surface, borderRadius: 24, padding: 32, width: '100%', maxWidth: 380,
    borderWidth: 1, borderColor: C.borderFocus,
  },
  cfgLogoWrap: { marginBottom: 24, alignItems: 'center' },
  cfgLogo:     { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 32, fontWeight: '700', color: C.gold, letterSpacing: -0.5 },
  cfgLogoSub:  { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: C.textMuted, marginTop: 6 },
  cfgDivider:  { height: 1, backgroundColor: C.border, marginBottom: 24 },
  cfgLabel:    { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase' },
  cfgInput: {
    backgroundColor: C.surface, color: C.textDark, fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 1,
    borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.borderFocus,
  },

  navbar: {
    backgroundColor: C.primary, height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
    borderBottomWidth: 2, borderBottomColor: C.gold
  },
  navBrand: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 24, fontWeight: '700', color: C.gold },
  navTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 20, fontWeight: '700', color: C.surface, pointerEvents: 'none' },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navBackBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 8, 
    marginLeft: -4 
  },
  navBackText: { color: C.surface, fontWeight: '700', fontSize: 16, marginLeft: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontSize: 11, fontWeight: '700', color: C.surface, textTransform: 'uppercase', letterSpacing: 0.5 },
  cfgIconBtn: { padding: 18 },

  mesasSectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: C.textMuted, marginBottom: 16, marginLeft: 4, textTransform: 'uppercase' },
  mesasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  mesaCard: {
    width: (SW - 40) / 2, backgroundColor: C.surface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden'
  },
  mesaCardOcupada: { backgroundColor: C.surface, borderColor: C.danger, borderWidth: 2 },
  mesaCardBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  mesaCardNombre: { fontSize: 16, fontWeight: '800', color: C.textDark, marginBottom: 8, marginTop: 4 },
  mesaCardBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 12, borderWidth: 1 },
  mesaCardBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  mesaCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  mesaCardItems: { fontSize: 12, color: C.textMuted, fontWeight: '700' },
  mesaCardTotal: { fontSize: 14, fontWeight: '800', color: C.textMuted },
  mesaCardTotalActivo: { color: C.primary, fontWeight: '800' },
  emptyText: { color: C.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14, fontWeight: '600' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: C.borderFocus },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, color: C.textDark, fontSize: 16, fontWeight: '600', paddingVertical: 16 },
  searchClear: { padding: 8 },

  quickGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  quickBtn: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  quickBtnLabel: { color: C.primary, fontWeight: '800', fontSize: 14, marginBottom: 4 },
  quickBtnPrice: { color: C.textMuted, fontWeight: '700', fontSize: 13 },
  
  fueraCarta: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: C.borderFocus, borderStyle: 'dashed' },
  fueraCartaText: { color: C.textDark, fontWeight: '700', fontSize: 14 },

  yaPedidoCard: { backgroundColor: C.surface, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: C.border },
  yaPedidoTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: C.primary, marginLeft: 6, textTransform: 'uppercase' },
  yaPedidoRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  yaPedidoItem: { fontSize: 14 },

  seccionWrap: { marginBottom: 24 },
  seccionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: C.textMuted, textTransform: 'uppercase', paddingBottom: 8, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  catLabel: { fontSize: 12, fontWeight: '800', color: C.primary, textTransform: 'uppercase', marginBottom: 12, marginTop: 4 },
  platosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  platoBtn: { width: (SW - 36) / 2, backgroundColor: C.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border },
  platoBtnBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  platoNombre: { color: C.textDark, fontWeight: '700', fontSize: 14, lineHeight: 18, marginTop: 8, marginBottom: 8 },
  platoPrecio: { fontWeight: '800', fontSize: 15 },

  carritoSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '55%', borderWidth: 1, borderColor: C.borderFocus },
  carritoHandle: { alignItems: 'center', paddingTop: 12, paddingBottom: 12 },
  carritoHandleBar: { width: 48, height: 4, backgroundColor: C.borderFocus, borderRadius: 99 },
  carritoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  carritoHeaderTitle: { fontSize: 14, fontWeight: '800', color: C.textDark, textTransform: 'uppercase', letterSpacing: 0.5 },
  carritoHeaderBadge: { backgroundColor: C.primary, width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  carritoHeaderBadgeText:{ color: C.surface, fontWeight: '800', fontSize: 13 },
  carritoLista: { paddingHorizontal: 16, maxHeight: 200 },
  carritoItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  carritoItemRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  carritoItemNombre:{ color: C.textDark, fontWeight: '700', fontSize: 15, flex: 1, lineHeight: 22 },
  carritoItemNota: { color: C.danger, fontSize: 12, marginTop: 6, fontWeight: '600' },
  carritoItemPrecio:{ color: C.textMuted, fontWeight: '800', fontSize: 15, marginLeft: 12 },
  carritoItemRow2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  modBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  modBtnActiva: { backgroundColor: C.primary, borderColor: C.primary },
  modBtnText: { color: C.textDark, fontWeight: '700', fontSize: 12, marginLeft: 6 },
  modBtnTextActiva: { color: C.surface },

  carritoControles: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notaBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  qtyBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  qtyNumber: { color: C.textDark, fontWeight: '800', fontSize: 16, minWidth: 28, textAlign: 'center' },
  eliminarBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.dangerSoft },

  carritoFooter: { padding: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  
  btnPrimary: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  btnPrimaryText: { color: C.surface, fontWeight: '800', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
  btnSecondary: { padding: 16, alignItems: 'center', marginTop: 4 },
  btnSecondaryText: { color: C.textMuted, fontWeight: '800', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  btnDangerOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 4, borderWidth: 1, borderColor: C.danger, borderRadius: 12 },
  btnDangerOutlineText: { color: C.danger, fontWeight: '800', fontSize: 14, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: C.surface, borderRadius: 24, padding: 24, width: '85%', borderWidth: 1, borderColor: C.borderFocus },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.textDark, marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: C.textMuted, marginBottom: 24, fontWeight: '600' },
  modalInput: { backgroundColor: C.bg, color: C.textDark, borderRadius: 12, padding: 16, fontSize: 16, fontWeight: '500', marginBottom: 24, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: C.border },
  modalInputCompact: { backgroundColor: C.bg, color: C.textDark, borderRadius: 12, padding: 16, fontSize: 16, fontWeight: '500', marginBottom: 12, borderWidth: 1, borderColor: C.border },

});