import { useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, limit, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../app/_firebase-config';
import { obtenerFechaActualLocal, generarId, pad5 } from '../utils/helpers';

const CACHE_TTL = 30 * 1000; // 30 segundos antes de re-fetchear (reporte diario)
const CACHE_RADAR_TTL = 5 * 60 * 1000; // 5 minutos para el radar mensual (evita lecturas frecuentes)
const CACHE_RADAR_KEY = 'cache_radar_mensual';

export default function useAdmin(appData: any, setAppData: any, ipServidor: string = 'localhost') {
  const [admin, setAdmin] = useState({
    reporte: null as any, gastos: [] as any[], refreshing: false,
    radarMensual: null as any, // { ventasSunat, gastosSunat } del mes
    modalMenu: false, menuData: { titulo: '', modoDomingo: false, entradas: [], segundos: [], refresco: '' },
    guarnicionGlobal: '',
    modalGasto: false, gastoData: { descripcion: '', monto: '', categoria: 'Insumos', con_comprobante: false }
  });

  const ultimaActualizacion = useRef(0);
  const ultimaActualizacionRadar = useRef(0);
  const cacheFecha = useRef('');

  // 🟢 Cache: guardar reporte en AsyncStorage
  const guardarCacheReporte = async (reporte: any, gastos: any[]) => {
    try {
      const fecha = obtenerFechaActualLocal();
      const payload = JSON.stringify({ reporte, gastos, timestamp: Date.now(), fecha });
      await AsyncStorage.setItem('admin_cache_reporte', payload);
    } catch (e) { /* silencioso */ }
  };

  // 🟢 Cache: cargar reporte y radar desde AsyncStorage al montar
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('admin_cache_reporte');
        if (raw) {
          const cache = JSON.parse(raw);
          const hoy = obtenerFechaActualLocal();
          if (cache.fecha === hoy && cache.reporte && cache.gastos) {
            setAdmin(prev => ({ ...prev, reporte: cache.reporte, gastos: cache.gastos }));
            cacheFecha.current = hoy;
            ultimaActualizacion.current = cache.timestamp || 0;
          }
        }
      } catch (e) { /* silencioso */ }
      // Cargar radar mensual (usa su propio caché)
      cargarRadarTributario(false);
    })();
  }, []);

  const cargarReporteDueño = async (forzar = false) => {
    try {
      // 🟢 Cache: si el cache es reciente, no re-fetcheamos
      const ahora = Date.now();
      if (!forzar && ultimaActualizacion.current > 0 && (ahora - ultimaActualizacion.current) < CACHE_TTL) {
        return;
      }

      const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
      const finDia = new Date(); finDia.setHours(23, 59, 59, 999);

      const qVentas = query(collection(db, 'ventas_historicas'), where('fecha', '>=', Timestamp.fromDate(inicioDia)), where('fecha', '<=', Timestamp.fromDate(finDia)));
      const ventasSnap = await getDocs(qVentas);
      
      const qGastos = query(collection(db, 'gastos'), where('fecha', '>=', Timestamp.fromDate(inicioDia)), where('fecha', '<=', Timestamp.fromDate(finDia)));
      const gastosSnap = await getDocs(qGastos);

      let totalV = 0;
      ventasSnap.forEach(d => { 
          totalV += d.data().total_cobrado || 0; 
      });
      
      let totalG = 0; let listaG: any[] = [];
      gastosSnap.forEach(docSnap => { 
        const d = docSnap.data();
        totalG += d.monto || 0; 
        listaG.push({ id: docSnap.id, ...d });
      });

      const nuevoReporte = { totales: { totalVentas: totalV, totalGastos: totalG, balance: totalV - totalG } };

      setAdmin(prev => ({ 
        ...prev, gastos: listaG, reporte: nuevoReporte
      }));

      // 🟢 Cache: guardar en AsyncStorage
      ultimaActualizacion.current = Date.now();
      cacheFecha.current = obtenerFechaActualLocal();
      guardarCacheReporte(nuevoReporte, listaG);
    } catch (e) { console.log("Error cargando reporte remoto", e); }
  };

  // 🟢 Radar Tributario: ventas y gastos CON COMPROBANTE del MES actual
  // Cache de 5 minutos para no consumir lecturas en cada refresh
  const cargarRadarTributario = async (forzar = false) => {
    try {
      const ahora = Date.now();
      if (!forzar && ultimaActualizacionRadar.current > 0 && (ahora - ultimaActualizacionRadar.current) < CACHE_RADAR_TTL) {
        return;
      }

      // Intentar desde caché primero
      if (!forzar) {
        try {
          const cached = await AsyncStorage.getItem(CACHE_RADAR_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            const mesCache = Object.keys(parsed)[0];
            const mesActual = obtenerFechaActualLocal().slice(0, 7);
            if (mesCache === mesActual && parsed[mesActual]) {
              setAdmin(prev => ({ ...prev, radarMensual: parsed[mesActual] }));
              ultimaActualizacionRadar.current = ahora;
              return;
            }
          }
        } catch (_) {}
      }

      // Consultar Firestore: desde el inicio del mes hasta hoy
      const hoy = new Date();
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      inicioMes.setHours(0, 0, 0, 0);
      const finDia = new Date(); finDia.setHours(23, 59, 59, 999);

      // Ventas del mes con métodos que generan comprobante
      const qVentas = query(collection(db, 'ventas_historicas'), 
        where('fecha', '>=', Timestamp.fromDate(inicioMes)), 
        where('fecha', '<=', Timestamp.fromDate(finDia)));
      const ventasSnap = await getDocs(qVentas);
      let ventasSunat = 0;
      ventasSnap.forEach(d => {
        const pg = d.data().metodos_pago || {};
        if (pg.enviado_sunat === true || parseFloat(pg.plin) > 0 || parseFloat(pg.tarjeta) > 0) {
          ventasSunat += d.data().total_cobrado || 0;
        }
      });

      // Gastos del mes con comprobante
      const qGastos = query(collection(db, 'gastos'),
        where('fecha', '>=', Timestamp.fromDate(inicioMes)),
        where('fecha', '<=', Timestamp.fromDate(finDia)));
      const gastosSnap = await getDocs(qGastos);
      let gastosSunat = 0;
      gastosSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.con_comprobante) gastosSunat += d.monto || 0;
      });

      const radarData = { ventasSunat, gastosSunat };
      
      setAdmin(prev => ({ ...prev, radarMensual: radarData }));
      ultimaActualizacionRadar.current = Date.now();

      // Cachear en AsyncStorage con el mes como clave
      const mesActual = obtenerFechaActualLocal().slice(0, 7);
      await AsyncStorage.setItem(CACHE_RADAR_KEY, JSON.stringify({ [mesActual]: radarData }));
    } catch (e) {
      console.log("Error cargando radar mensual", e);
    }
  };

  const eliminarGastoAdmin = (idGasto: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar este registro permanentemente?')) {
        deleteDoc(doc(db, 'gastos', idGasto)).then(() => { 
          // 🟢 OPTIMIZADO: Mutar estado local en lugar de re-fetchear
          setAdmin(prev => {
            const nuevosGastos = prev.gastos.filter((g: any) => g.id !== idGasto);
            const nuevoTotalG = nuevosGastos.reduce((sum: number, g: any) => sum + (g.monto || 0), 0);
            const nuevoGastosSunat = nuevosGastos.filter((g: any) => g.con_comprobante).reduce((sum: number, g: any) => sum + (g.monto || 0), 0);
            const oldReporte = prev.reporte?.totales;
            const nuevoReporte = oldReporte ? {
              totales: {
                ...oldReporte,
                totalGastos: nuevoTotalG,
                gastosSunat: nuevoGastosSunat,
                balance: oldReporte.totalVentas - nuevoTotalG
              }
            } : prev.reporte;
            guardarCacheReporte(nuevoReporte, nuevosGastos);
            return { ...prev, gastos: nuevosGastos, reporte: nuevoReporte };
          });
          Alert.alert('Éxito', 'Gasto eliminado.'); 
        }).catch(() => {});
      }
      return;
    }
    Alert.alert('Anular Gasto', '¿Eliminar este registro permanentemente?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'ELIMINAR', style: 'destructive', onPress: async () => {
        try { 
          await deleteDoc(doc(db, 'gastos', idGasto)); 
          // 🟢 OPTIMIZADO: Mutar estado local en lugar de re-fetchear
          setAdmin(prev => {
            const nuevosGastos = prev.gastos.filter((g: any) => g.id !== idGasto);
            const nuevoTotalG = nuevosGastos.reduce((sum: number, g: any) => sum + (g.monto || 0), 0);
            const nuevoGastosSunat = nuevosGastos.filter((g: any) => g.con_comprobante).reduce((sum: number, g: any) => sum + (g.monto || 0), 0);
            const oldReporte = prev.reporte?.totales;
            const nuevoReporte = oldReporte ? {
              totales: {
                ...oldReporte,
                totalGastos: nuevoTotalG,
                gastosSunat: nuevoGastosSunat,
                balance: oldReporte.totalVentas - nuevoTotalG
              }
            } : prev.reporte;
            guardarCacheReporte(nuevoReporte, nuevosGastos);
            return { ...prev, gastos: nuevosGastos, reporte: nuevoReporte };
          });
          Alert.alert('Éxito', 'Gasto eliminado.'); 
        } catch (e) {}
      }}
    ]);
  };

  // ================================================================
  // 🟢 CONTADOR CACHEADO PARA ID DE GASTOS
  // ================================================================
  // La primera vez lee los últimos 50 docs de Firestore para sembrar.
  // Las siguientes veces usa AsyncStorage → 0 lecturas Firestore.
  // Si orderBy falla (falta índice), lee todos los docs UNA SOLA VEZ.
  // ================================================================
  const CACHE_ULTIMO_GASTO_KEY = 'cache_ultimo_numero_gasto';

  const sembrarUltimoNumeroGasto = async (): Promise<number> => {
    // 🟢 1. Leer últimos 50 docs ordenados por ID descendente (eficiente)
    try {
      const q = query(collection(db, 'gastos'), orderBy('__name__', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      let maxNum = 0;
      snapshot.forEach(docSnap => {
        const match = docSnap.id.match(/^GAS-(\d{5})-/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      await AsyncStorage.setItem(CACHE_ULTIMO_GASTO_KEY, String(maxNum));
      return maxNum;
    } catch (_) {
      // 🟡 2. Fallback: leer todos (solo UNA VEZ si falta índice)
      try {
        const snapshot = await getDocs(collection(db, 'gastos'));
        let maxNum = 0;
        snapshot.forEach(docSnap => {
          const match = docSnap.id.match(/^GAS-(\d{5})-/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        });
        await AsyncStorage.setItem(CACHE_ULTIMO_GASTO_KEY, String(maxNum));
        return maxNum;
      } catch (_) {
        return -1;
      }
    }
  };

  const obtenerUltimoNumeroGasto = async (): Promise<number> => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_ULTIMO_GASTO_KEY);
      if (cached !== null) {
        const num = parseInt(cached, 10);
        if (!isNaN(num)) return num;
      }
      return await sembrarUltimoNumeroGasto();
    } catch (_) {
      return -1;
    }
  };

  const guardarGastoAdmin = async () => {
    if (!admin.gastoData.descripcion || !admin.gastoData.monto) return Alert.alert('Aviso', 'Ingresa un concepto y un monto.');
    
    const payload = {
      descripcion: admin.gastoData.descripcion,
      monto: parseFloat(admin.gastoData.monto),
      categoria: admin.gastoData.categoria || 'Otros',
      con_comprobante: admin.gastoData.con_comprobante === true
    };
    
    const fechaLimpia = obtenerFechaActualLocal().replace(/-/g, '');
    const fechaISO = new Date().toISOString();
    const gastoParaFirebase = {
      categoria: payload.categoria,
      concepto: payload.descripcion,
      monto: payload.monto,
      fecha: Timestamp.fromDate(new Date()),
      con_comprobante: payload.con_comprobante
    };
    
    // 🟢 1. Backend local (misma red) — SQLite auto-increment, 0 lecturas Firestore
    // ✅ No llamamos cargarReporteDueño(true) para evitar lecturas innecesarias
    if (ipServidor && ipServidor !== 'localhost') {
      try {
        await axios.post(`http://${ipServidor}:3001/api/gastos`, payload, { timeout: 3000 });
        // Mutar estado: cerrar modal y limpiar form (el gasto se verá en el próximo refresh automático)
        setAdmin(prev => ({ ...prev, gastoData: { descripcion: '', monto: '', categoria: 'Insumos', con_comprobante: false }, modalGasto: false }));
        return Alert.alert('Éxito', 'Gasto registrado ✅');
      } catch (_) { /* intentar siguiente */ }
    }
    
    // 🟢 2. Contador cacheado en AsyncStorage — formato GAS-XXXXX-AAAAMMDD
    try {
      const ultimoNum = await obtenerUltimoNumeroGasto();
      if (ultimoNum >= 0) {
        // Intentar hasta 5 números adelante (por si el doc ya existe)
        for (let i = 1; i <= 5; i++) {
          const nextNum = ultimoNum + i;
          const idFirestore = `GAS-${pad5(nextNum)}-${fechaLimpia}`;
          
          const docRef = doc(db, 'gastos', idFirestore);
          const docSnap = await getDoc(docRef);
          
          if (!docSnap.exists()) {
            await setDoc(docRef, gastoParaFirebase);
            await AsyncStorage.setItem(CACHE_ULTIMO_GASTO_KEY, String(nextNum));
            
            const gastoLocal = { id: idFirestore, ...gastoParaFirebase, fecha: fechaISO };
            setAdmin(prev => {
              const nuevosGastos = [gastoLocal, ...prev.gastos];
              const nuevoTotalG = nuevosGastos.reduce((sum: number, g: any) => sum + (g.monto || 0), 0);
              const nuevoGastosSunat = nuevosGastos.filter((g: any) => g.con_comprobante).reduce((sum: number, g: any) => sum + (g.monto || 0), 0);
              const oldReporte = prev.reporte?.totales;
              const nuevoReporte = oldReporte ? {
                totales: {
                  ...oldReporte,
                  totalGastos: nuevoTotalG,
                  gastosSunat: nuevoGastosSunat,
                  balance: oldReporte.totalVentas - nuevoTotalG
                }
              } : prev.reporte;
              guardarCacheReporte(nuevoReporte, nuevosGastos);
              return { ...prev, gastos: nuevosGastos, reporte: nuevoReporte, gastoData: { descripcion: '', monto: '', categoria: 'Insumos', con_comprobante: false }, modalGasto: false };
            });
            return Alert.alert('Éxito', `Gasto registrado ☁️`);
          }
        }
      }
    } catch (_) { /* intentar fallback */ }
    
    // 🟡 3. Fallback: directo a Firestore (formato random)
    try {
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const idFirestore = `GAS-${timestamp}${random}-${fechaLimpia}`;
      
      await setDoc(doc(db, 'gastos', idFirestore), gastoParaFirebase);
      
      const gastoLocal = { id: idFirestore, ...gastoParaFirebase, fecha: fechaISO };
      setAdmin(prev => {
        const nuevosGastos = [gastoLocal, ...prev.gastos];
        const nuevoTotalG = nuevosGastos.reduce((sum: number, g: any) => sum + (g.monto || 0), 0);
        const nuevoGastosSunat = nuevosGastos.filter((g: any) => g.con_comprobante).reduce((sum: number, g: any) => sum + (g.monto || 0), 0);
        const oldReporte = prev.reporte?.totales;
        const nuevoReporte = oldReporte ? {
          totales: {
            ...oldReporte,
            totalGastos: nuevoTotalG,
            gastosSunat: nuevoGastosSunat,
            balance: oldReporte.totalVentas - nuevoTotalG
          }
        } : prev.reporte;
        guardarCacheReporte(nuevoReporte, nuevosGastos);
        return { ...prev, gastos: nuevosGastos, reporte: nuevoReporte, gastoData: { descripcion: '', monto: '', categoria: 'Insumos', con_comprobante: false }, modalGasto: false };
      });
      
      Alert.alert('Aviso', 'Gasto guardado offline ⚠️');
    } catch (fallbackError: any) {
      Alert.alert('Error', `No se pudo registrar: ${fallbackError.message}`);
    }
  };

  const onRefreshAdmin = async () => {
    setAdmin(prev => ({ ...prev, refreshing: true }));
    await Promise.all([
      cargarReporteDueño(true),     // 🟢 forzar daily
      cargarRadarTributario(true)   // 🟢 forzar radar mensual
    ]);
    setAdmin(prev => ({ ...prev, refreshing: false }));
  };

  const abrirEditorMenu = async () => {
    try {
      const snap = await getDoc(doc(db, 'contenido', 'menuDiario'));
      if (snap.exists()) setAdmin(prev => ({ ...prev, menuData: snap.data() as any }));
      setAdmin(prev => ({ ...prev, modalMenu: true }));
    } catch (e) { Alert.alert('Error', 'No se pudo cargar el menú desde la nube'); }
  };

  const guardarAdminMenu = async () => {
    try {
      const dataLimpia = JSON.parse(JSON.stringify(admin.menuData));
      await setDoc(doc(db, 'contenido', 'menuDiario'), dataLimpia);
      setAppData((prev: any) => ({ ...prev, modoDomingo: admin.menuData.modoDomingo }));
      setAdmin(prev => ({ ...prev, modalMenu: false }));
      Alert.alert('Éxito', 'Menú actualizado en la Nube ☁️');
    } catch (e: any) { Alert.alert('Error', `Detalle técnico: ${e.message}`); }
  };

  const updateAdminMenu = (updates: any) => setAdmin(prev => ({ ...prev, menuData: { ...prev.menuData, ...updates } }));
  
  const toggleDomingoAdmin = () => {
    setAdmin(p => {
      const nuevoEstado = !p.menuData.modoDomingo;
      const segundosActualizados = (p.menuData.segundos || []).map((s: any) => ({
          ...s, precio: nuevoEstado ? "30" : "15", taper: nuevoEstado ? ['grande'] : ['mediano']
      }));
      return { ...p, menuData: { ...p.menuData, modoDomingo: nuevoEstado, titulo: nuevoEstado ? 'ESPECIALES DE DOMINGO 🍽️' : 'MENU DEL DIA 🍽️', segundos: segundosActualizados } };
    });
  };

  const updateMenuArr = (tipo: string, idx: number, campo: string, valor: any) => {
    const arr = [...((admin.menuData as any)[tipo]||[])]; arr[idx][campo] = valor; updateAdminMenu({ [tipo]: arr });
  };

  const toggleTaperMenu = (type: string, idx: number, taperName: string) => {
     setAdmin(p => {
        const arr = [...(p.menuData as any)[type]]; const row = { ...arr[idx] }; 
        let tapersActuales = Array.isArray(row.taper) ? [...row.taper] : (row.taper ? [row.taper] : []);
        if (tapersActuales.includes(taperName)) tapersActuales = tapersActuales.filter(t => t !== taperName);
        else tapersActuales.push(taperName);
        row.taper = tapersActuales; arr[idx] = row;
        return { ...p, menuData: { ...p.menuData, [type]: arr } };
     });
  };

  const addMenuRow = (tipo: string) => setAdmin(p => {
    let precioDefecto = tipo === 'entradas' ? 6 : 15;
    let tapersDefecto = tipo === 'entradas' ? ['sopa'] : ['mediano'];
    if (tipo === 'segundos' && p.menuData.modoDomingo) { precioDefecto = 30; tapersDefecto = ['grande']; }
    const nuevaFila = tipo === 'entradas' ? { id: generarId(), nombre: '', precio: String(precioDefecto), taper: tapersDefecto, stock: '' } : { id: generarId(), nombre: '', acomp: '', precio: String(precioDefecto), taper: tapersDefecto, stock: '' };
    return { ...p, menuData: { ...p.menuData, [tipo]: [...((p.menuData as any)[tipo]||[]), nuevaFila] } };
  });

  const delMenuRow = (tipo: string, idx: number) => { const arr = [...(admin.menuData as any)[tipo]]; arr.splice(idx, 1); updateAdminMenu({ [tipo]: arr }); };

  const marcarImpuestoPagado = async () => {
    const mesActual = obtenerFechaActualLocal().slice(0, 7);
    const nuevoEstado = { ...appData.estadoRestaurante, mesImpuestoPagado: mesActual };
    try {
      await setDoc(doc(db, 'contenido', 'configuracion'), nuevoEstado, { merge: true });
      setAppData((prev: any) => ({ ...prev, estadoRestaurante: nuevoEstado }));
      Alert.alert('SUNAT', 'Impuesto marcado como pagado por este mes.');
    } catch(e) { }
  };

  const aplicarGuarnicionGlobal = () => {
    if (!admin.guarnicionGlobal.trim()) return Alert.alert('Aviso', 'Escribe una guarnición primero.');
    const nuevosSegundos = (admin.menuData.segundos || []).map((s: any) => ({ ...s, acomp: admin.guarnicionGlobal }));
    updateAdminMenu({ segundos: nuevosSegundos });
    setAdmin(prev => ({ ...prev, guarnicionGlobal: '' }));
  };

  return {
    admin, setAdmin, cargarReporteDueño, cargarRadarTributario, eliminarGastoAdmin, guardarGastoAdmin, onRefreshAdmin,
    abrirEditorMenu, guardarAdminMenu, updateAdminMenu, toggleDomingoAdmin, updateMenuArr, toggleTaperMenu,
    addMenuRow, delMenuRow, marcarImpuestoPagado, aplicarGuarnicionGlobal
  };
}