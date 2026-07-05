import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView,
  Alert, Modal, Platform,
  KeyboardAvoidingView, BackHandler, RefreshControl, Pressable, PanResponder
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// 🟢 TUS IMPORTACIONES MODULARES
import { C, s } from '../src/styles/theme';
import { obtenerFechaActualLocal, formatMesaName, modLabelText } from '../src/utils/helpers';
import useAppSystem from '../src/hooks/useAppSystem';
import useAdmin from '../src/hooks/useAdmin';
import useMozo from '../src/hooks/useMozo';

// ─── COMPONENTES PUROS EXTRAÍDOS ───
const ModIcon = ({ mod, color }: { mod: string, color: string }) => {
  if (mod === 'local') return <MaterialCommunityIcons name="silverware-fork-knife" size={16} color={color} />;
  if (mod === 'llevar') return <Feather name="shopping-bag" size={16} color={color} />;
  return <MaterialCommunityIcons name="motorbike" size={18} color={color} />;
};

const Touchable = ({ style, activeOpacity = 0.7, children, disabled, onPress, hitSlop }: any) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    hitSlop={hitSlop}
    style={({ pressed }) => {
      const baseStyle = typeof style === 'function' ? style({ pressed }) : style;
      return [baseStyle, { opacity: pressed && !disabled ? activeOpacity : (disabled ? 0.5 : 1) }];
    }}
  >
    {children}
  </Pressable>
);

export default function App() {

  // 🟢 1. Cerebro principal (Red, Sockets y Login)
  const { sys, setSys, authData, setAuthData, appData, setAppData, guardarIP, handleLogin, toggleEstadoLocal } = useAppSystem(() => cargarReporteDueño());

  // 🟢 2. Lógica del Dueño / Administrador
  const { 
    admin, setAdmin, cargarReporteDueño, cargarRadarTributario, eliminarGastoAdmin, guardarGastoAdmin, onRefreshAdmin,
    abrirEditorMenu, guardarAdminMenu, updateAdminMenu, toggleDomingoAdmin, updateMenuArr, toggleTaperMenu,
    addMenuRow, delMenuRow, marcarImpuestoPagado, aplicarGuarnicionGlobal
  } = useAdmin(appData, setAppData, sys.ipServidor);

  // 🟢 3. Lógica del Mozo / Comandera
  const { 
    mozo, setMozo, carrito, cartVisible, setCartVisible,
    uiSplit, setUiSplit, ui, setUi, totalItems,
    abrirMesa, agregarAlCarrito, modificarCantidad, calcularRecargoTaperMozo,
    ciclarModalidad, confirmarSplit, confirmarDatosDelivery, guardarPlatoFueraCarta,
    guardarNota, enviarComanda, asignarBebidasAlmuerzos, removerBebidaAsignada
  } = useMozo(sys.ipServidor, appData);

  useEffect(() => {
    const backAction = () => {
      if (authData.usuarioActivo && authData.usuarioActivo.rol !== 'admin' && mozo.vistaActual === 'comandar') {
        setMozo(prev => ({ ...prev, vistaActual: 'mesas' }));
        return true; 
      }
      return false; 
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove(); 
  }, [mozo.vistaActual, authData.usuarioActivo]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy > 50) setCartVisible(false);
      }
    })
  ).current;

  const cerrarSesion = () => {
    setAuthData(prev => ({ ...prev, usuarioActivo: null, username: '', password: '' }));
    setMozo(prev => ({ ...prev, vistaActual: 'mesas' }));
  };

  const mesasOrdenadas = appData.mesas.slice()
    .filter((m: any) => !String(m.id).startsWith('CTA-') && !String(m.id).startsWith('DEL-')) // 🟢 FILTRO DE MOZOS
    .sort((a: any, b: any) => {
      const numA = parseInt(String(a.id).replace(/\D/g, ''));
      const numB = parseInt(String(b.id).replace(/\D/g, ''));
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a.id).localeCompare(String(b.id));
  });

  const elRestauranteEstaCerrado = appData.estadoRestaurante.cierreForzado === obtenerFechaActualLocal();

  return (
    <View style={s.safeAreaBlue}>
      <StatusBar style="light" />
      
      {/* ─── PANTALLA 1: CONFIGURAR IP ─── */}
      {sys.modoConfig && (
        <View style={s.cfgScreen}>
          <View style={s.cfgCard}>
            <View style={s.cfgLogoWrap}>
              <Text style={s.cfgLogo}>Calletano</Text>
              <Text style={s.cfgLogoSub}>SISTEMA POS · CONFIGURACIÓN</Text>
            </View>
            <View style={s.cfgDivider} />
            <Text style={s.cfgLabel}>Dirección IP de la Caja</Text>
            <TextInput style={s.cfgInput} placeholder="Ej: 192.168.1.50" placeholderTextColor={C.textMuted} value={sys.ipInput} onChangeText={t => setSys(prev => ({ ...prev, ipInput: t }))} keyboardType="numeric" returnKeyType="done" />
            <Touchable style={s.btnPrimary} onPress={guardarIP}><Text style={s.btnPrimaryText}>Guardar y Conectar</Text></Touchable>
            {sys.ipServidor !== '' && <Touchable style={s.btnSecondary} onPress={() => setSys(prev => ({ ...prev, modoConfig: false }))}><Text style={s.btnSecondaryText}>← Volver al sistema</Text></Touchable>}
          </View>
        </View>
      )}

      {/* ─── PANTALLA 2: LOGIN ─── */}
      {!sys.modoConfig && !authData.usuarioActivo && (
        <View style={s.cfgScreen}>
          <View style={s.cfgCard}>
            <View style={s.cfgLogoWrap}>
              <Text style={s.cfgLogo}>Calletano</Text>
              <Text style={s.cfgLogoSub}>SISTEMA DE CONTROL</Text>
            </View>
            {authData.error !== '' && <Text style={{color: C.danger, textAlign: 'center', marginBottom: 15, fontWeight: '800', fontSize: 13}}>{authData.error}</Text>}
            <TextInput style={[s.cfgInput, {textAlign: 'left'}]} placeholder="Usuario" placeholderTextColor={C.textMuted} value={authData.username} onChangeText={t => setAuthData(prev => ({ ...prev, username: t }))} autoCapitalize="none" />
            <TextInput style={[s.cfgInput, {textAlign: 'left', marginBottom: 25}]} placeholder="Contraseña" placeholderTextColor={C.textMuted} value={authData.password} onChangeText={t => setAuthData(prev => ({ ...prev, password: t }))} secureTextEntry />
            <Touchable style={s.btnPrimary} onPress={handleLogin}><Text style={s.btnPrimaryText}>Ingresar</Text></Touchable>
            <Touchable style={{marginTop: 30, alignItems: 'center'}} onPress={() => setSys(prev => ({ ...prev, modoConfig: true }))}><Text style={{color: C.textMuted, fontSize: 12, fontWeight: '800'}}>⚙️ Cambiar IP de Servidor</Text></Touchable>
          </View>
        </View>
      )}

      {/* ─── PANTALLA 3: APP DEL DUEÑO ─── */}
      {!sys.modoConfig && authData.usuarioActivo && authData.usuarioActivo.rol === 'admin' && (
        <>
          <View style={s.navbar}>
            <Text style={s.navBrand}>Dueño <Text style={{fontSize: 14, color: C.gold}}>POS</Text></Text>
            <View style={s.navRight}>
              <View style={[s.statusPill, sys.conectado ? s.statusPillOn : s.statusPillOff]}>
                <View style={[s.statusDot, { backgroundColor: sys.conectado ? C.success : C.danger }]} />
                <Text style={s.statusPillText} numberOfLines={1}>{sys.serverStatus}</Text>
              </View>
              <Touchable onPress={cerrarSesion} style={s.cfgIconBtn}><Feather name="log-out" size={20} color={C.surface} /></Touchable>
            </View>
          </View>

          <ScrollView style={s.scrollBase} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} contentInsetAdjustmentBehavior="automatic" refreshControl={<RefreshControl refreshing={admin.refreshing} onRefresh={onRefreshAdmin} tintColor={C.gold} />}>
            <Text style={s.seccionTitle}>ACCIONES ADMINISTRATIVAS</Text>
            <View style={{flexDirection: 'row', gap: 12, marginBottom: 24}}>
               <Touchable style={[s.quickBtn, {backgroundColor: C.surface, borderColor: C.gold}]} onPress={abrirEditorMenu}>
                  <Feather name="edit-3" size={24} color={C.gold} style={{marginBottom: 8}}/>
                  <Text style={{fontSize: 11, fontWeight: '800', color: C.textDark}}>EDITAR MENÚ</Text>
               </Touchable>
               <Touchable style={[s.quickBtn, {backgroundColor: C.surface, borderColor: C.danger}]} onPress={() => setAdmin(prev => ({ ...prev, modalGasto: true }))}>
                  <Feather name="dollar-sign" size={24} color={C.danger} style={{marginBottom: 8}}/>
                  <Text style={{fontSize: 11, fontWeight: '800', color: C.textDark}}>NUEVO GASTO</Text>
               </Touchable>
            </View>

            {/* 🟢 RADAR TRIBUTARIO PRIVADO DEL DUEÑO */}
            <Text style={s.seccionTitle}>RADAR TRIBUTARIO SUNAT (S/ 5,000)</Text>
            <View style={{backgroundColor: C.surface, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 2, borderColor: C.gold}}>
               
               {new Date().getDate() <= 20 && appData.estadoRestaurante.mesImpuestoPagado !== obtenerFechaActualLocal().slice(0, 7) && (
                 <View style={{backgroundColor: C.dangerSoft, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: C.danger, marginBottom: 20}}>
                   <Text style={{color: C.danger, fontWeight: '800', fontSize: 13, textAlign: 'center', marginBottom: 10}}>🚨 ¡HOY TOCA PAGAR LOS S/ 20 A SUNAT!</Text>
                   <Touchable style={[s.btnPrimary, {backgroundColor: C.danger, padding: 10}]} onPress={marcarImpuestoPagado}>
                     <Text style={s.btnPrimaryText}>Ya lo pagué ✔️</Text>
                   </Touchable>
                 </View>
               )}

               <Text style={{fontSize: 11, color: C.textMuted, marginBottom: 12, textAlign: 'center'}}>
                 Acumulado del mes {obtenerFechaActualLocal().slice(0, 7)} — Límite S/ 5,000
               </Text>
               {/* Ventas */}
               <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
                 <Text style={{fontWeight: '800', color: C.success, fontSize: 12}}>VENTAS BOLETA</Text>
                 <Text style={{fontWeight: '800'}}>S/ {(admin.radarMensual?.ventasSunat || 0).toFixed(2)}</Text>
               </View>
               <View style={{height: 10, backgroundColor: C.bg, borderRadius: 5, marginBottom: 20, overflow: 'hidden'}}>
                 <View style={{height: '100%', backgroundColor: C.success, width: `${Math.min(100, ((admin.radarMensual?.ventasSunat || 0) / 5000) * 100)}%`}} />
               </View>

               {/* Gastos */}
               <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
                 <Text style={{fontWeight: '800', color: '#006989', fontSize: 12}}>COMPRAS FACTURADAS</Text>
                 <Text style={{fontWeight: '800'}}>S/ {(admin.radarMensual?.gastosSunat || 0).toFixed(2)}</Text>
               </View>
               <View style={{height: 10, backgroundColor: C.bg, borderRadius: 5, overflow: 'hidden'}}>
                 <View style={{height: '100%', backgroundColor: '#006989', width: `${Math.min(100, ((admin.radarMensual?.gastosSunat || 0) / 5000) * 100)}%`}} />
               </View>
            </View>
            <Text style={s.seccionTitle}>ARQUEO EN VIVO (HOY)</Text>
            <View style={{backgroundColor: C.surface, borderRadius: 16, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: C.border}}>
              <Text style={{fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 8}}>INGRESO BRUTO</Text>
              <Text style={{fontSize: 36, fontWeight: '800', color: C.success, marginBottom: 24}}>S/ {admin.reporte?.totales?.totalVentas?.toFixed(2) || '0.00'}</Text>
              <Text style={{fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 8}}>EGRESOS REGISTRADOS</Text>
              <Text style={{fontSize: 24, fontWeight: '800', color: C.danger, marginBottom: 24}}>S/ {admin.reporte?.totales?.totalGastos?.toFixed(2) || '0.00'}</Text>
              <View style={{height: 1, backgroundColor: C.border, marginVertical: 10, marginBottom: 20}} />
              <Text style={{fontSize: 12, fontWeight: '800', color: C.gold, letterSpacing: 1, marginBottom: 8}}>GANANCIA NETA OPERATIVA</Text>
              <Text style={{fontSize: 28, fontWeight: '800', color: C.primary}}>S/ {admin.reporte?.totales?.balance?.toFixed(2) || '0.00'}</Text>
            </View>

            <Text style={s.seccionTitle}>DETALLE DE GASTOS (HOY)</Text>
            <View style={{backgroundColor: C.surface, borderRadius: 16, padding: 12, marginBottom: 24, borderWidth: 1, borderColor: C.border}}>
              {admin.gastos.length === 0 ? (
                <Text style={{textAlign: 'center', color: C.textMuted, padding: 20, fontSize: 13}}>No hay gastos registrados hoy.</Text>
              ) : (
                admin.gastos.map((g, index) => (
                  <View key={g.id} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index === admin.gastos.length - 1 ? 0 : 1, borderBottomColor: C.border}}>
                    <View style={{flex: 1}}>
                      <Text style={{fontSize: 14, fontWeight: '700', color: C.textDark}}>{g.concepto}</Text>
                      <Text style={{fontSize: 11, color: C.textMuted, textTransform: 'uppercase'}}>{g.categoria}</Text>
                    </View>
                    <Text style={{fontSize: 15, fontWeight: '800', color: C.danger, marginRight: 15}}>S/ {g.monto.toFixed(2)}</Text>
                    <Touchable onPress={() => eliminarGastoAdmin(g.id)} style={{padding: 8}}>
                      <Feather name="trash-2" size={18} color={C.textMuted} />
                    </Touchable>
                  </View>
                ))
              )}
            </View>

            <Text style={s.seccionTitle}>CONTROL REMOTO</Text>
            <View style={{backgroundColor: C.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: C.border, alignItems: 'center'}}>
               <MaterialCommunityIcons name={elRestauranteEstaCerrado ? 'door-closed-lock' : 'door-open'} size={48} color={elRestauranteEstaCerrado ? C.danger : C.success} style={{marginBottom: 16}} />
               <Text style={{fontSize: 18, fontWeight: '800', color: C.textDark, marginBottom: 24}}>
                 El restaurante está {elRestauranteEstaCerrado ? 'CERRADO' : 'ABIERTO'}
               </Text>
               <Touchable style={[s.btnPrimary, {width: '100%', backgroundColor: elRestauranteEstaCerrado ? C.success : C.danger}]} onPress={toggleEstadoLocal}>
                 <Text style={s.btnPrimaryText}>{elRestauranteEstaCerrado ? 'ABRIR RESTAURANTE AHORA' : 'CERRAR POR HOY'}</Text>
               </Touchable>
            </View>
          </ScrollView>

          {/* Modal Gasto */}
          <Modal visible={admin.modalGasto} transparent animationType="fade">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Registrar Gasto</Text>
                <Text style={s.modalSubtitle}>Se descontará del flujo neto de hoy</Text>
                <TextInput style={s.modalInputCompact} placeholder="Concepto (Ej. Verduras)" placeholderTextColor={C.textMuted} value={admin.gastoData.descripcion} onChangeText={t => setAdmin(prev => ({ ...prev, gastoData: { ...prev.gastoData, descripcion: t } }))} />
                <TextInput style={s.modalInputCompact} placeholder="Monto (S/)" placeholderTextColor={C.textMuted} value={admin.gastoData.monto} onChangeText={t => setAdmin(prev => ({ ...prev, gastoData: { ...prev.gastoData, monto: t } }))} keyboardType="decimal-pad" />
                <Text style={{fontSize: 12, fontWeight: '800', color: C.textMuted, marginBottom: 8, marginTop: 10}}>CATEGORÍA CONTABLE</Text>
                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20}}>
                   {['Insumos', 'Personal', 'Servicios', 'Otros'].map(c => (
                     <Touchable key={c} onPress={() => setAdmin(prev => ({ ...prev, gastoData: { ...prev.gastoData, categoria: c } }))} 
                       style={{paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: admin.gastoData.categoria === c ? C.danger : C.border, borderRadius: 8, backgroundColor: admin.gastoData.categoria === c ? C.danger : C.surface}}>
                        <Text style={{color: admin.gastoData.categoria === c ? C.surface : C.textMuted, fontWeight: '700', fontSize: 13}}>{c}</Text>
                     </Touchable>
                   ))}
                </View>
                <Touchable 
                   style={{flexDirection: 'row', alignItems: 'center', backgroundColor: admin.gastoData.con_comprobante ? C.successSoft : C.bg, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: admin.gastoData.con_comprobante ? C.success : C.border, marginBottom: 20}} 
                   onPress={() => setAdmin(prev => ({ ...prev, gastoData: { ...prev.gastoData, con_comprobante: !prev.gastoData.con_comprobante } }))}
                >
                   <MaterialCommunityIcons name={admin.gastoData.con_comprobante ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={admin.gastoData.con_comprobante ? C.success : C.textMuted} />
                   <Text style={{marginLeft: 10, fontWeight: '800', color: admin.gastoData.con_comprobante ? C.success : C.textDark}}>Tengo Factura/Boleta (SUNAT)</Text>
                </Touchable>
                <Touchable style={[s.btnPrimary, {backgroundColor: C.danger}]} onPress={guardarGastoAdmin}><Text style={s.btnPrimaryText}>Guardar Gasto</Text></Touchable>
                <Touchable style={s.btnSecondary} onPress={() => setAdmin(prev => ({ ...prev, modalGasto: false }))}><Text style={s.btnSecondaryText}>Cancelar</Text></Touchable>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* Modal Editor Menú */}
          <Modal visible={admin.modalMenu} animationType="slide">
            <SafeAreaView style={{flex: 1, backgroundColor: C.bg}}>
              <View style={[s.navbar, {justifyContent: 'space-between'}]}>
                 <Touchable onPress={() => setAdmin(prev => ({ ...prev, modalMenu: false }))} style={{padding: 10}}><Feather name="x" size={26} color={C.surface} /></Touchable>
                 <Text style={[s.navTitle, {fontSize: 18}]}>Editor de Menú</Text>
                 <Touchable onPress={guardarAdminMenu} style={{padding: 10}}><Feather name="check" size={26} color={C.surface} /></Touchable>
              </View>
              <ScrollView contentContainerStyle={{padding: 16}} contentInsetAdjustmentBehavior="automatic">
                 <Text style={s.seccionTitle}>CONFIGURACIÓN GENERAL</Text>
                 <TextInput style={s.modalInputCompact} placeholder="Título a mostrar" value={admin.menuData.titulo} onChangeText={t => updateAdminMenu({titulo: t})} />
                 <Touchable style={[s.quickBtn, {backgroundColor: admin.menuData.modoDomingo ? C.dangerSoft : C.surface, borderColor: admin.menuData.modoDomingo ? C.danger : C.border, marginBottom: 20}]} onPress={toggleDomingoAdmin}>
                    <Text style={{fontWeight: '800', color: admin.menuData.modoDomingo ? C.danger : C.textDark}}>{admin.menuData.modoDomingo ? 'ACTIVADO: MODO DOMINGO' : 'DESACTIVADO: DÍA NORMAL'}</Text>
                 </Touchable>

                 {!admin.menuData.modoDomingo && (
                   <View style={{backgroundColor: C.surface, padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: C.border}}>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16}}>
                         <Text style={{fontWeight: '800', color: C.gold, fontSize: 16}}>ENTRADAS</Text>
                         <Touchable onPress={() => addMenuRow('entradas')}><Text style={{color: C.gold, fontWeight: '800', fontSize: 14}}>+ Añadir</Text></Touchable>
                      </View>
                      {(admin.menuData.entradas||[]).map((e: any, idx: number) => (
                        <View key={e.id || `ent-${idx}`} style={{backgroundColor: C.surface, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: C.border}}>
                           <View style={{flexDirection: 'row', gap: 8}}>
                             <TextInput style={[s.modalInputCompact, {flex: 1, marginBottom: 0, paddingVertical: 10}]} placeholder="Nombre de Entrada" value={e.nombre} onChangeText={t => updateMenuArr('entradas', idx, 'nombre', t)} />
                             <View style={{alignItems: 'center'}}>
                               <Text style={{fontSize: 9, color: C.primary, fontWeight: 'bold', marginBottom: 2}}>PRECIO S/</Text>
                               <TextInput style={[s.modalInputCompact, {width: 60, marginBottom: 0, paddingVertical: 10, textAlign: 'center'}]} placeholder="S/" value={String(e.precio)} onChangeText={t => updateMenuArr('entradas', idx, 'precio', t)} keyboardType="decimal-pad" />
                             </View>
                             <View style={{alignItems: 'center'}}>
                               <Text style={{fontSize: 9, color: '#006989', fontWeight: 'bold', marginBottom: 2}}>📦 STOCK</Text>
                               <TextInput style={[s.modalInputCompact, {width: 60, marginBottom: 0, paddingVertical: 10, textAlign: 'center', borderColor: '#006989', color: '#006989'}]} placeholder="Stock" value={String(e.stock || '')} onChangeText={t => updateMenuArr('entradas', idx, 'stock', t)} keyboardType="number-pad" />
                             </View>
                             <Touchable onPress={() => delMenuRow('entradas', idx)} style={{justifyContent: 'center', paddingHorizontal: 4}}><Feather name="trash-2" size={22} color={C.danger}/></Touchable>
                           </View>
                           
                           <Text style={{fontSize: 10, fontWeight: '800', color: C.textMuted, marginTop: 8, marginBottom: 4}}>ENVASES (LLEVAR/DELIVERY)</Text>
                           <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>
                             {['chico', 'sopa', 'mediano', 'grande'].map(t => {
                                const tapersAct = Array.isArray(e.taper) ? e.taper : (e.taper ? [e.taper] : []);
                                const activo = tapersAct.includes(t);
                                return (
                                   <Touchable key={t} onPress={() => toggleTaperMenu('entradas', idx, t)} style={{backgroundColor: activo ? C.gold : C.bg, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: activo ? C.gold : C.border}}>
                                      <Text style={{fontSize: 10, fontWeight: 'bold', color: activo ? C.primary : C.textMuted}}>{t.toUpperCase()}</Text>
                                   </Touchable>
                                );
                             })}
                           </View>
                        </View>
                      ))}
                   </View>
                 )}

                 <View style={{backgroundColor: C.surface, padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: C.border}}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16}}>
                       <Text style={{fontWeight: '800', color: C.danger, fontSize: 16}}>SEGUNDOS</Text>
                       <Touchable onPress={() => addMenuRow('segundos')}><Text style={{color: C.danger, fontWeight: '800', fontSize: 14}}>+ Añadir</Text></Touchable>
                    </View>
                    <View style={{flexDirection: 'row', gap: 8, marginBottom: 16, backgroundColor: C.dangerSoft, padding: 8, borderRadius: 8, alignItems: 'center'}}>
                       <TextInput style={[s.modalInputCompact, {flex: 1, marginBottom: 0, paddingVertical: 6, backgroundColor: C.surface}]} placeholder="Guarnición general" value={admin.guarnicionGlobal} onChangeText={t => setAdmin(prev => ({ ...prev, guarnicionGlobal: t }))} />
                       <Touchable style={{backgroundColor: C.danger, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center'}} onPress={aplicarGuarnicionGlobal}><Text style={{color: C.surface, fontWeight: '800', fontSize: 11}}>APLICAR A TODOS</Text></Touchable>
                    </View>
                    {(admin.menuData.segundos||[]).map((sItem: any, idx: number) => (
                      <View key={sItem.id || `seg-${idx}`} style={{backgroundColor: C.bg, padding: 12, borderRadius: 8, marginBottom: 12}}>
                          <View style={{flexDirection: 'row', gap: 8}}>
                            <View style={{flex: 1, gap: 8}}>
                              <TextInput style={[s.modalInputCompact, {marginBottom: 0, paddingVertical: 10}]} placeholder="Nombre de Fondo" value={sItem.nombre} onChangeText={t => updateMenuArr('segundos', idx, 'nombre', t)} />
                              <TextInput style={[s.modalInputCompact, {marginBottom: 0, fontSize: 13, paddingVertical: 8}]} placeholder="Acompañamiento (Opcional)" value={sItem.acomp||''} onChangeText={t => updateMenuArr('segundos', idx, 'acomp', t)} />
                            </View>
                            <View style={{justifyContent: 'space-between', alignItems: 'center', gap: 8}}>
                              <View style={{alignItems: 'center'}}>
                                <Text style={{fontSize: 9, color: C.danger, fontWeight: 'bold', marginBottom: 2}}>PRECIO S/</Text>
                                <TextInput style={[s.modalInputCompact, {width: 75, marginBottom: 0, textAlign: 'center', color: C.danger, fontWeight: '800'}]} placeholder="S/" value={String(sItem.precio)} onChangeText={t => updateMenuArr('segundos', idx, 'precio', t)} keyboardType="decimal-pad" />
                              </View>
                              <View style={{alignItems: 'center'}}>
                                <Text style={{fontSize: 9, color: '#006989', fontWeight: 'bold', marginBottom: 2}}>📦 STOCK</Text>
                                <TextInput style={[s.modalInputCompact, {width: 75, marginBottom: 0, textAlign: 'center', borderColor: '#006989', color: '#006989', fontWeight: '800'}]} placeholder="Stock" value={String(sItem.stock || '')} onChangeText={t => updateMenuArr('segundos', idx, 'stock', t)} keyboardType="number-pad" />
                              </View>
                              <Touchable onPress={() => delMenuRow('segundos', idx)} style={{padding: 8}}><Feather name="trash-2" size={22} color={C.danger}/></Touchable>
                            </View>
                          </View>
                          
                          <Text style={{fontSize: 10, fontWeight: '800', color: C.textMuted, marginTop: 8, marginBottom: 4}}>ENVASES (LLEVAR/DELIVERY)</Text>
                           <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>
                             {['chico', 'sopa', 'mediano', 'grande'].map(t => {
                                const tapersAct = Array.isArray(sItem.taper) ? sItem.taper : (sItem.taper ? [sItem.taper] : []);
                                const activo = tapersAct.includes(t);
                                return (
                                   <Touchable key={t} onPress={() => toggleTaperMenu('segundos', idx, t)} style={{backgroundColor: activo ? C.danger : C.surface, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: activo ? C.danger : C.border}}>
                                      <Text style={{fontSize: 10, fontWeight: 'bold', color: activo ? C.surface : C.textMuted}}>{t.toUpperCase()}</Text>
                                   </Touchable>
                                );
                             })}
                           </View>
                      </View>
                    ))}
                 </View>

                 <Text style={s.seccionTitle}>BEBIDA INCLUIDA</Text>
                 <TextInput 
                    style={[s.modalInputCompact, { minHeight: 80, textAlignVertical: 'top' }]} 
                    placeholder="Ej: Chicha Morada..." 
                    value={admin.menuData.refresco || ''} 
                    onChangeText={t => updateAdminMenu({refresco: t})} 
                    multiline 
                  />
                 <Touchable style={[s.btnPrimary, {marginTop: 20, marginBottom: 40}]} onPress={guardarAdminMenu}><Text style={s.btnPrimaryText}>Publicar Menú en Caja</Text></Touchable>
              </ScrollView>
            </SafeAreaView>
          </Modal>
        </>
      )}

      {/* ─── PANTALLA 4: COMANDERA TÁCTIL ─── */}
      {!sys.modoConfig && authData.usuarioActivo && authData.usuarioActivo.rol !== 'admin' && mozo.vistaActual === 'comandar' && mozo.mesaActiva && (
        <>
          <View style={s.navbar}>
            <Touchable style={s.navBackBtn} onPress={() => setMozo(prev => ({ ...prev, vistaActual: 'mesas' }))} hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}>
              <Feather name="chevron-left" size={28} color={C.surface} />
              <Text style={s.navBackText}>Mesas</Text>
            </Touchable>
            <Text style={s.navTitle} numberOfLines={1}>{mozo.mesaActiva ? formatMesaName(mozo.mesaActiva.id) : ''}</Text>
            <View style={{ width: 80 }} />
          </View>

          <ScrollView style={s.scrollBase} contentContainerStyle={{ padding: 12, paddingBottom: carrito.length > 0 ? 320 : 40 }} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
            <View style={s.searchWrap}>
              <Feather name="search" size={20} color={C.textMuted} style={s.searchIcon} />
              <TextInput style={s.searchInput} placeholder="Buscar plato..." placeholderTextColor={C.textMuted} value={mozo.filtroCarta} onChangeText={t => setMozo(prev => ({ ...prev, filtroCarta: t }))} />
              {mozo.filtroCarta.length > 0 && <Touchable onPress={() => setMozo(prev => ({ ...prev, filtroCarta: '' }))} style={s.searchClear}><Feather name="x-circle" size={20} color={C.textMuted} /></Touchable>}
            </View>

            {mozo.filtroCarta === '' && (
              <>
                <View style={s.quickGrid}>
                  <Touchable style={[s.quickBtn, {borderColor: '#006989', backgroundColor: 'rgba(0,105,137,0.05)'}]} onPress={() => agregarAlCarrito({ nombre: 'TAPER CHICO', precio: 1.0 }, 'GENERAL')}>
                    <MaterialCommunityIcons name="cube-outline" size={28} color={C.primary} style={{marginBottom: 4}} />
                    <Text style={s.quickBtnLabel}>T. Chico</Text>
                    <Text style={s.quickBtnPrice}>S/ 1.00</Text>
                  </Touchable>
                  <Touchable style={[s.quickBtn, {borderColor: C.danger, backgroundColor: C.dangerSoft}]} onPress={() => agregarAlCarrito({ nombre: 'TAPER MEDIANO', precio: 2.0 }, 'GENERAL')}>
                    <MaterialCommunityIcons name="cube" size={28} color={C.danger} style={{marginBottom: 4}} />
                    <Text style={[s.quickBtnLabel, {color: C.danger}]}>T. Mediano</Text>
                    <Text style={[s.quickBtnPrice, {color: C.danger}]}>S/ 2.00</Text>
                  </Touchable>
                </View>
                <View style={[s.quickGrid, {marginBottom: 16}]}>
                  <Touchable style={[s.quickBtn, {backgroundColor: C.surface}]} onPress={() => agregarAlCarrito({ nombre: 'HUMITA', precio: 3.0 }, 'ENTRADAS')}>
                    <MaterialCommunityIcons name="corn" size={28} color={C.gold} style={{marginBottom: 4}} />
                    <Text style={[s.quickBtnLabel, {color: C.gold}]}>Humita</Text>
                    <Text style={s.quickBtnPrice}>S/ 3.00</Text>
                  </Touchable>
                  <Touchable style={[s.quickBtn, {backgroundColor: C.surface}]} onPress={() => agregarAlCarrito({ nombre: 'REFRESCO', precio: appData.modoDomingo ? 3.5 : 2.0 }, 'BEBIDAS')}>
                    <MaterialCommunityIcons name="glass-cocktail" size={28} color={C.primary} style={{marginBottom: 4}} />
                    <Text style={[s.quickBtnLabel, {color: C.primary}]}>Refresco</Text>
                    <Text style={s.quickBtnPrice}>S/ {appData.modoDomingo ? '3.50' : '2.00'}</Text>
                  </Touchable>
                </View>
                <Touchable style={s.fueraCarta} onPress={() => setUi(prev => ({ ...prev, modalFueraCarta: true }))}>
                  <Feather name="edit-3" size={18} color={C.textMuted} /><Text style={s.fueraCartaText}>Plato fuera de carta</Text>
                </Touchable>
              </>
            )}

            {mozo.mesaActiva.pedido?.length > 0 && mozo.filtroCarta === '' && (
              <View style={s.yaPedidoCard}>
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                  <Feather name="list" size={16} color={C.primary} /><Text style={s.yaPedidoTitle}>Ya en esta mesa</Text>
                </View>
                {mozo.mesaActiva.pedido.map((p: any, i: number) => (
                  <View key={p.id || `pedido-${i}`} style={s.yaPedidoRow}>
                    <Text style={s.yaPedidoItem}>
                      <Text style={{ color: C.danger, fontWeight: '700' }}>{p.cantidad}×  </Text>
                      <Text style={{ color: C.textDark, fontWeight: '600' }}>{p.nombre}</Text>
                      {['entradas', 'segundos'].includes(p.categoria?.toLowerCase()) && <Text style={{ color: C.gold, fontSize: 11, fontWeight: '800' }}> (MENÚ)</Text>}
                      {p.modalidad !== 'local' && <Text style={{ color: C.textMuted }}> · {p.modalidad}</Text>}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {appData.carta.filter((c: any) => ['entradas', 'segundos'].includes(c.nombre.toLowerCase().trim())).map((cat: any) => {
              if (appData.modoDomingo && cat.nombre.toLowerCase().trim() === 'entradas') return null;
              const items = cat.items.filter((p: any) => p.nombre.toLowerCase().includes(mozo.filtroCarta.toLowerCase()));
              if (items.length === 0) return null;
              const esEntrada = cat.nombre === 'entradas';
              return (
                <View key={cat.nombre} style={{ marginBottom: 10 }}>
                  <Text style={s.catLabel}>{cat.nombre}</Text>
                  <View style={s.platosGrid}>
                    {items.map((plato: any) => {
                      const cantEnCarrito = carrito.filter(i => i.nombre === plato.nombre && i.categoria === cat.nombre).reduce((acc, curr) => acc + curr.cantidad, 0);
                      const agotado = plato.stock_actual !== null && plato.stock_actual <= 0;
                      const pocoStock = plato.stock_actual !== null && plato.stock_actual <= 3 && plato.stock_actual > 0;

                      return (
                        <Touchable 
                           key={plato.id || plato.nombre} 
                           style={[s.platoBtn, agotado && { opacity: 0.4, backgroundColor: C.border }]} 
                           disabled={agotado}
                           onPress={() => agregarAlCarrito(plato, cat.nombre)}
                        >
                          <View style={[s.platoBtnBar, { backgroundColor: agotado ? C.textMuted : (esEntrada ? C.primary : C.danger) }]} />
                          {pocoStock && (
                            <View style={[s.badgeComanda, { backgroundColor: C.danger }]}>
                              <Text style={s.badgeComandaText}>¡Solo quedan {plato.stock_actual}!</Text>
                            </View>
                          )}
                          {cantEnCarrito > 0 && !pocoStock && (
                            <View style={s.badgeComanda}>
                              <Text style={s.badgeComandaText}>{cantEnCarrito} pedidos</Text>
                            </View>
                          )}
                          <Text style={[s.platoNombre, agotado && { textDecorationLine: 'line-through', color: C.textMuted }]} numberOfLines={2}>{plato.nombre}</Text>
                          <Text style={[s.platoPrecio, { color: agotado ? C.textMuted : (esEntrada ? C.primary : C.danger) }]}>
                            {agotado ? 'AGOTADO' : `S/ ${plato.precio.toFixed(2)}`}
                          </Text>
                        </Touchable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {appData.carta.filter((c: any) => c.nombre !== 'entradas' && c.nombre !== 'segundos').map((cat: any) => {
              const items = cat.items.filter((p: any) => p.nombre.toLowerCase().includes(mozo.filtroCarta.toLowerCase()));
              if (items.length === 0) return null;
              return (
                <View key={cat.nombre} style={s.seccionWrap}>
                  <Text style={s.seccionTitle}><Feather name="book-open" size={18} color={C.textMuted}/> {cat.nombre}</Text>
                  <View style={s.platosGrid}>
                    {items.map((plato: any) => {
                      const cantEnCarrito = carrito.filter(i => i.nombre === plato.nombre && i.categoria === cat.nombre).reduce((acc, curr) => acc + curr.cantidad, 0);
                      const agotado = plato.stock_actual !== null && plato.stock_actual <= 0;
                      const pocoStock = plato.stock_actual !== null && plato.stock_actual <= 3 && plato.stock_actual > 0;
                      return (
                        <Touchable key={plato.id || plato.nombre} style={[s.platoBtn, agotado && { opacity: 0.4, backgroundColor: C.border }]} disabled={agotado} onPress={() => agregarAlCarrito(plato, cat.nombre)}>
                          <View style={[s.platoBtnBar, { backgroundColor: agotado ? C.textMuted : (cat.nombre === 'entradas' ? C.primary : (cat.nombre === 'segundos' ? C.danger : C.textDark)) }]} />
                          {pocoStock && (
                            <View style={[s.badgeComanda, { backgroundColor: C.danger }]}>
                              <Text style={s.badgeComandaText}>¡Solo quedan {plato.stock_actual}!</Text>
                            </View>
                          )}
                          {cantEnCarrito > 0 && !pocoStock && (
                            <View style={s.badgeComanda}>
                              <Text style={s.badgeComandaText}>{cantEnCarrito} pedidos</Text>
                            </View>
                          )}
                          <Text style={[s.platoNombre, agotado && { textDecorationLine: 'line-through', color: C.textMuted }]} numberOfLines={2}>{plato.nombre}</Text>
                          <Text style={[s.platoPrecio, { color: agotado ? C.textMuted : (cat.nombre === 'entradas' ? C.primary : (cat.nombre === 'segundos' ? C.danger : C.textDark)) }]}>
                            {agotado ? 'AGOTADO' : `S/ ${plato.precio.toFixed(2)}`}
                          </Text>
                        </Touchable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* ─── BURBUJA FLOTANTE (FAB) ─── */}
          {carrito.length > 0 && (
            <Touchable style={s.fabBtn} onPress={() => setCartVisible(true)}>
              <Feather name="shopping-bag" size={26} color={C.surface} />
              <View style={s.fabBadge}><Text style={s.fabBadgeText}>{totalItems}</Text></View>
            </Touchable>
          )}

          {/* ─── TELÓN DE LA COMANDA (SWIPE-TO-CLOSE) ─── */}
          <Modal visible={cartVisible} animationType="slide" transparent={true} onRequestClose={() => setCartVisible(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{ height: '90%', backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>

                {/* 🟢 CABECERA TÁCTIL: JALA ESTO PARA CERRAR */}
                <View {...panResponder.panHandlers} style={{ backgroundColor: C.surface, alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <View style={{ width: 50, height: 5, backgroundColor: C.borderFocus, borderRadius: 10, marginBottom: 12 }} />
                  <Text style={s.carritoHeaderTitle}>Por Enviar a Cocina ({totalItems})</Text>
                </View>

                <ScrollView style={{ paddingHorizontal: 16, flex: 1 }} contentInsetAdjustmentBehavior="automatic">
                  {carrito.map((item, idx) => {
                    const esLocal = item.modalidad === 'local';
                    return (
                      <View key={item.id} style={s.carritoItem}>
                        <View style={s.carritoItemRow1}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.carritoItemNombre} numberOfLines={2}>
                               <Text style={{ color: C.primary, fontWeight: '800' }}>{item.cantidad}×  </Text>
                               {item.nombre}
                               {['entradas', 'segundos'].includes(item.categoria?.toLowerCase()) && <Text style={{color: C.gold, fontSize: 11}}> (MENÚ)</Text>}
                            </Text>
                            {item.modalidad !== 'local' && item.taper && <Text style={{fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: 'bold'}}>+ Envase {Array.isArray(item.taper) ? item.taper.join(' y ') : item.taper}</Text>}
                            {item.cliente && <Text style={s.carritoItemNota}><Feather name="map-pin" size={12}/> Delivery a: {item.cliente.nombre}</Text>}
                            {item.nota ? <Text style={s.carritoItemNota}><Feather name="alert-circle" size={12}/> {item.nota}</Text> : null}
                          </View>
                          <Text style={s.carritoItemPrecio}>S/ {((item.precio + calcularRecargoTaperMozo(item)) * item.cantidad).toFixed(2)}</Text>
                        </View>
                        <View style={s.carritoItemRow2}>
                          <Touchable style={[s.modBtn, !esLocal && s.modBtnActiva]} onPress={() => ciclarModalidad(idx)}>
                            <ModIcon mod={item.modalidad} color={esLocal ? C.textMuted : C.white} />
                            <Text style={[s.modBtnText, !esLocal && s.modBtnTextActiva]}>{modLabelText(item.modalidad)}</Text>
                            <Feather name="refresh-cw" size={12} color={esLocal ? C.textMuted : C.white} style={{marginLeft: 4}}/>
                          </Touchable>
                          <View style={s.carritoControles}>
                            <Touchable style={s.notaBtn} onPress={() => { setUi(prev => ({ ...prev, itemEditando: idx, notaInput: carrito[idx].nota || '', modalNota: true, notaCantidadMover: 1 })); }}><Feather name="file-text" size={18} color={C.textMuted} /></Touchable>
                            <View style={s.qtyControls}>
                              <Touchable style={s.qtyBtn} onPress={() => modificarCantidad(idx, -1)}><Feather name="minus" size={20} color={C.textDark} /></Touchable>
                              <Text style={s.qtyNumber}>{item.cantidad}</Text>
                              <Touchable style={s.qtyBtn} onPress={() => modificarCantidad(idx, 1)}><Feather name="plus" size={20} color={C.textDark} /></Touchable>
                            </View>
                            <Touchable style={s.eliminarBtn} onPress={() => {
                              modificarCantidad(idx, -item.cantidad);
                              if(carrito.length === 1) setCartVisible(false);
                            }}><Feather name="trash-2" size={18} color={C.danger} /></Touchable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={s.carritoFooter}>
                  <Touchable style={s.btnPrimary} onPress={() => { setCartVisible(false); enviarComanda(); }}>
                    <Feather name="send" size={20} color={C.white} style={{marginRight: 8}} />
                    <Text style={s.btnPrimaryText}>Enviar a Cocina</Text>
                  </Touchable>
                </View>
              </View>
            </View>
          </Modal>

          {/* ─── MINI-MODAL PARA SEPARAR CANTIDADES ─── */}
          <Modal visible={uiSplit.visible} transparent animationType="fade">
            <View style={s.modalOverlay}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Separar Platos</Text>
                <Text style={s.modalSubtitle}>¿Cuántos deseas cambiar a {uiSplit.nextMod.toUpperCase()}?</Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, marginVertical: 20 }}>
                  <Touchable 
                    style={[s.qtyBtn, {backgroundColor: C.bg, width: 50, height: 50, borderRadius: 25}]} 
                    onPress={() => setUiSplit(p => ({...p, cantidadMover: Math.max(1, p.cantidadMover - 1)}))}
                  >
                    <Feather name="minus" size={24} color={C.textDark} />
                  </Touchable>
                  
                  <Text style={{ fontSize: 40, fontWeight: '800', color: C.textDark, minWidth: 50, textAlign: 'center' }}>
                    {uiSplit.cantidadMover}
                  </Text>
                  
                  <Touchable 
                    style={[s.qtyBtn, {backgroundColor: C.bg, width: 50, height: 50, borderRadius: 25}]} 
                    onPress={() => setUiSplit(p => ({...p, cantidadMover: Math.min(p.cantidadTotal, p.cantidadMover + 1)}))}
                  >
                    <Feather name="plus" size={24} color={C.textDark} />
                  </Touchable>
                </View>

                <Touchable style={[s.btnPrimary, {marginBottom: 10}]} onPress={confirmarSplit}>
                  <Text style={s.btnPrimaryText}>Confirmar</Text>
                </Touchable>
                <Touchable style={s.btnSecondary} onPress={() => setUiSplit({ visible: false, idx: null, nextMod: '', cantidadTotal: 0, cantidadMover: 1 })}>
                  <Text style={s.btnSecondaryText}>Cancelar</Text>
                </Touchable>
              </View>
            </View>
          </Modal>

          {/* Modal Nota con Fraccionamiento Integrado */}
          <Modal visible={ui.modalNota} transparent animationType="fade">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Nota para cocina</Text>
                <Text style={s.modalSubtitle}>Ej: sin cebolla, poca sal</Text>
                <TextInput style={s.modalInput} placeholder="Escribe la nota..." placeholderTextColor={C.border} value={ui.notaInput} onChangeText={t => setUi(prev => ({ ...prev, notaInput: t }))} multiline />
                
                {ui.itemEditando !== null && carrito[ui.itemEditando]?.cantidad > 1 && (
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>¿A cuántos platos aplicar nota?</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                      <Touchable style={[s.qtyBtn, {backgroundColor: C.bg, width: 44, height: 44, borderRadius: 22}]} onPress={() => setUi(prev => ({ ...prev, notaCantidadMover: Math.max(1, prev.notaCantidadMover - 1) }))}>
                        <Feather name="minus" size={20} color={C.textDark} />
                      </Touchable>
                      <Text style={{ fontSize: 26, fontWeight: '800', color: C.textDark, minWidth: 40, textAlign: 'center' }}>{ui.notaCantidadMover}</Text>
                      <Touchable style={[s.qtyBtn, {backgroundColor: C.bg, width: 44, height: 44, borderRadius: 22}]} onPress={() => setUi(prev => ({ ...prev, notaCantidadMover: Math.min(carrito[ui.itemEditando].cantidad, prev.notaCantidadMover + 1) }))}>
                        <Feather name="plus" size={20} color={C.textDark} />
                      </Touchable>
                    </View>
                  </View>
                )}

                <Touchable style={s.btnPrimary} onPress={guardarNota}><Text style={s.btnPrimaryText}>Guardar Nota</Text></Touchable>
                <Touchable style={s.btnSecondary} onPress={() => setUi(prev => ({ ...prev, modalNota: false }))}><Text style={s.btnSecondaryText}>Cancelar</Text></Touchable>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <Modal visible={ui.modalDelivery} transparent animationType="fade">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Datos de Delivery</Text><Text style={s.modalSubtitle}>¿A dónde enviamos este plato?</Text>
                <TextInput style={s.modalInputCompact} placeholder="Nombre del Cliente" placeholderTextColor={C.textMuted} value={ui.datosDelivery.nombre} onChangeText={t => setUi(prev => ({ ...prev, datosDelivery: { ...prev.datosDelivery, nombre: t } }))} />
                <TextInput style={s.modalInputCompact} placeholder="Dirección / Ref" placeholderTextColor={C.textMuted} value={ui.datosDelivery.direccion} onChangeText={t => setUi(prev => ({ ...prev, datosDelivery: { ...prev.datosDelivery, direccion: t } }))} />
                <TextInput style={s.modalInputCompact} placeholder="Teléfono (Opcional)" placeholderTextColor={C.textMuted} value={ui.datosDelivery.telefono} onChangeText={t => setUi(prev => ({ ...prev, datosDelivery: { ...prev.datosDelivery, telefono: t } }))} keyboardType="phone-pad" />
                <Touchable style={[s.btnPrimary, {backgroundColor: C.primary}]} onPress={confirmarDatosDelivery}><Text style={s.btnPrimaryText}>Confirmar Envío</Text></Touchable>
                <Touchable style={s.btnSecondary} onPress={() => setUi(prev => ({ ...prev, modalDelivery: false }))}><Text style={s.btnSecondaryText}>Cancelar</Text></Touchable>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <Modal visible={ui.modalFueraCarta} transparent animationType="fade">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Plato Especial</Text><Text style={s.modalSubtitle}>Ingresa los datos del extra</Text>
                <TextInput style={s.modalInputCompact} placeholder="Nombre del plato" placeholderTextColor={C.textMuted} value={ui.fueraCartaItem.nombre} onChangeText={t => setUi(prev => ({ ...prev, fueraCartaItem: { ...prev.fueraCartaItem, nombre: t } }))} />
                <TextInput style={s.modalInputCompact} placeholder="Precio (S/)" placeholderTextColor={C.textMuted} value={ui.fueraCartaItem.precio} onChangeText={t => setUi(prev => ({ ...prev, fueraCartaItem: { ...prev.fueraCartaItem, precio: t } }))} keyboardType="decimal-pad" />
                <Touchable style={s.btnPrimary} onPress={guardarPlatoFueraCarta}><Text style={s.btnPrimaryText}>Añadir al pedido</Text></Touchable>
                <Touchable style={s.btnSecondary} onPress={() => setUi(prev => ({ ...prev, modalFueraCarta: false }))}><Text style={s.btnSecondaryText}>Cancelar</Text></Touchable>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </>
      )}

      {/* ─── PANTALLA 5: MAPA DE MESAS ─── */}
      {!sys.modoConfig && authData.usuarioActivo && authData.usuarioActivo.rol !== 'admin' && (mozo.vistaActual !== 'comandar' || !mozo.mesaActiva) && (
        <>
          <View style={s.navbar}>
            <Text style={s.navBrand}>Calletano</Text>
            <View style={s.navRight}>
              <View style={[s.statusPill, sys.conectado ? s.statusPillOn : s.statusPillOff]}>
                <View style={[s.statusDot, { backgroundColor: sys.conectado ? C.success : C.danger }]} />
                <Text style={s.statusPillText} numberOfLines={1}>{sys.serverStatus}</Text>
              </View>
              <Touchable onPress={cerrarSesion} style={s.cfgIconBtn}><Feather name="log-out" size={20} color={C.surface} /></Touchable>
            </View>
          </View>

          <ScrollView style={s.scrollBase} contentContainerStyle={{ padding: 14, paddingBottom: 32 }} contentInsetAdjustmentBehavior="automatic">
            {elRestauranteEstaCerrado ? (
               <View style={{backgroundColor: C.dangerSoft, padding: 30, borderRadius: 16, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: C.danger}}>
                  <Feather name="lock" size={40} color={C.danger} style={{marginBottom: 10}} />
                  <Text style={{color: C.danger, fontSize: 18, fontWeight: '800', textAlign: 'center'}}>RESTAURANTE CERRADO</Text>
                  <Text style={{color: C.danger, textAlign: 'center', marginTop: 10, fontWeight: '600'}}>El administrador ha cerrado el sistema de comandas por hoy.</Text>
               </View>
            ) : (
              <>
                <Text style={s.mesasSectionLabel}>SALÓN - Selecciona una mesa</Text>
                <View style={s.mesasGrid}>
                  {mesasOrdenadas.map((mesa: any) => {
                    const ocupada = mesa.estado === 'ocupada';
                    return (
                      <Touchable key={mesa.id} style={[s.mesaCard, ocupada && s.mesaCardOcupada]} onPress={() => abrirMesa(mesa)}>
                        <View style={[s.mesaCardBar, { backgroundColor: ocupada ? C.danger : C.gold }]} />
                        <Text style={[s.mesaCardNombre, { color: ocupada ? C.textDark : C.gold }]} numberOfLines={1}>{formatMesaName(mesa.id)}</Text>
                        <View style={[s.mesaCardBadge, { backgroundColor: ocupada ? C.dangerSoft : C.goldSoft }]}><Text style={[s.mesaCardBadgeText, { color: ocupada ? C.danger : C.gold }]}>{ocupada ? 'Ocupada' : 'Libre'}</Text></View>
                        <View style={s.mesaCardFooter}><Text style={s.mesaCardItems}>{mesa.pedido?.length ?? 0} ítems</Text><Text style={[s.mesaCardTotal, mesa.total > 0 && s.mesaCardTotalActivo]}>S/ {(mesa.total ?? 0).toFixed(2)}</Text></View>
                      </Touchable>
                    );
                  })}
                </View>
              </>
            )}
            {appData.mesas.length === 0 && sys.conectado && !elRestauranteEstaCerrado && <Text style={s.emptyText}>No hay mesas configuradas.</Text>}
            {!sys.conectado && <Text style={s.emptyText}>Sin conexión · Verifica la IP en Ajustes</Text>}
          </ScrollView>
        </>
      )}

      {/* 🟢 MODAL: SELECCIÓN DE BEBIDA MODO DOMINGO MOZO - TOQUE INDIVIDUAL + QUITAR */}
      <Modal visible={ui.modalBebidaDomingo} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={[s.modalTitle, {textAlign: 'center'}]}>Asignar Bebidas</Text>
            {(() => {
              const pendientes = carrito.filter(i => i.necesitaBebida).reduce((sum, i) => sum + i.cantidad, 0);
              const bebidasAsignadas = carrito.filter(i => i.isMenuDrink).reduce((acc: any, i) => {
                const exist = acc.find((a: any) => a.nombre === i.nombre);
                if (exist) exist.cantidad += i.cantidad;
                else acc.push({ nombre: i.nombre, cantidad: i.cantidad });
                return acc;
              }, []);
              
              if (pendientes === 0 && bebidasAsignadas.length === 0) {
                return (
                  <>
                    <Text style={[s.modalSubtitle, {textAlign: 'center', marginBottom: 20}]}>
                      No hay almuerzos en el carrito.
                    </Text>
                    <Touchable style={s.btnSecondary} onPress={() => setUi(prev => ({ ...prev, modalBebidaDomingo: false }))}>
                      <Text style={s.btnSecondaryText}>Cerrar</Text>
                    </Touchable>
                  </>
                );
              }
              
              return (
                <>
                  {/* ─── ASIGNAR NUEVAS ─── */}
                  {pendientes > 0 && (
                    <>
                      <Text style={[s.modalSubtitle, {textAlign: 'center', marginBottom: 10}]}>
                        Quedan <Text style={{fontWeight: '800', fontSize: 20, color: C.danger}}>{pendientes}</Text> almuerzo(s) sin bebida.
                        {'\n'}Toca una bebida para asignarla al siguiente:
                      </Text>
                      <Touchable style={[s.btnPrimary, {backgroundColor: '#F4C430', marginBottom: 10, borderWidth: 2, borderColor: '#D4A843'}]} onPress={() => asignarBebidasAlmuerzos('INKA COLA 296ML')}>
                        <Text style={[s.btnPrimaryText, {color: '#120B06'}]}>INKA COLA 296ML</Text>
                      </Touchable>
                      <Touchable style={[s.btnPrimary, {backgroundColor: C.danger, marginBottom: 10}]} onPress={() => asignarBebidasAlmuerzos('COCA COLA 296ML')}>
                        <Text style={s.btnPrimaryText}>COCA COLA 296ML</Text>
                      </Touchable>
                      <Touchable style={[s.btnPrimary, {backgroundColor: C.bg, borderWidth: 2, borderColor: C.border, marginBottom: 12}]} onPress={() => asignarBebidasAlmuerzos('REFRESCO DEL DÍA')}>
                        <Text style={[s.btnPrimaryText, {color: C.textDark}]}>REFRESCO DEL DÍA</Text>
                      </Touchable>
                    </>
                  )}

                  {pendientes === 0 && (
                    <Text style={[s.modalSubtitle, {textAlign: 'center', marginBottom: 14, color: C.success, fontWeight: '800'}]}>
                      ✅ Todas las bebidas están asignadas.
                    </Text>
                  )}

                  {/* ─── BEBIDAS YA ASIGNADAS ─── */}
                  {bebidasAsignadas.length > 0 && (
                    <>
                      <View style={{height: 1, backgroundColor: C.border, marginVertical: 8}} />
                      <Text style={{fontSize: 12, fontWeight: '800', color: C.textMuted, marginBottom: 8, textAlign: 'center', textTransform: 'uppercase'}}>
                        Bebidas asignadas (toca ✕ para cambiar)
                      </Text>
                      {bebidasAsignadas.map((b: any) => (
                        <View key={b.nombre} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: C.border}}>
                          <Text style={{fontWeight: '700', fontSize: 15, color: C.textDark}}>
                            {b.nombre} <Text style={{color: C.primary, fontWeight: '800'}}>×{b.cantidad}</Text>
                          </Text>
                          <Touchable 
                            onPress={() => removerBebidaAsignada(b.nombre)}
                            style={{backgroundColor: C.dangerSoft, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center'}}
                          >
                            <Feather name="x" size={18} color={C.danger} />
                          </Touchable>
                        </View>
                      ))}
                    </>
                  )}

                  {/* ─── BOTONES DE ACCIÓN ─── */}
                  {pendientes === 0 ? (
                    <Touchable style={[s.btnPrimary, {marginTop: 12}]} onPress={() => setUi(prev => ({ ...prev, modalBebidaDomingo: false }))}>
                      <Text style={s.btnPrimaryText}>Listo</Text>
                    </Touchable>
                  ) : (
                    <Touchable style={s.btnSecondary} onPress={() => setUi(prev => ({ ...prev, modalBebidaDomingo: false }))}>
                      <Text style={s.btnSecondaryText}>Continuar después</Text>
                    </Touchable>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

    </View>
  );
}