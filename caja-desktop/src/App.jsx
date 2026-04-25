import { useState, useEffect } from 'react'
import io from 'socket.io-client'
import axios from 'axios'

const socket = io('http://localhost:3000')

function App() {
  // Estados principales
  const [pedidos, setPedidos] = useState([])
  const [reporte, setReporte] = useState(null)
  
  // Estados para los nuevos Modales
  const [modalCobro, setModalCobro] = useState({ isOpen: false, pedido: null, total: 0 })
  const [pagos, setPagos] = useState({ efectivo: '', yape: '', plin: '', tarjeta: '' })
  
  const [modalGasto, setModalGasto] = useState(false)
  const [gasto, setGasto] = useState({ concepto: '', categoria: 'Insumos', monto: '' })

  // Conexión por Sockets (Tiempo Real)
  useEffect(() => {
    socket.on('alerta-caja', (nuevoPedido) => {
      setPedidos((listaActual) => [nuevoPedido, ...listaActual]);
      tocarCampana();
    });
    return () => socket.off('alerta-caja');
  }, []);

  const tocarCampana = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.2);
    } catch (e) { console.log("Audio bloqueado"); }
  }

  // ==========================================
  // LÓGICA DE COBRO MIXTO Y VUELTO
  // ==========================================
  const abrirModalCobro = (pedido) => {
    // Por defecto, asumimos que pagan todo en efectivo para agilizar
    setPagos({ efectivo: pedido.total.toFixed(2), yape: '', plin: '', tarjeta: '' });
    setModalCobro({ isOpen: true, pedido: pedido, total: pedido.total });
  }

  const calcularVuelto = () => {
    const totalPagado = (parseFloat(pagos.efectivo) || 0) + (parseFloat(pagos.yape) || 0) + 
                        (parseFloat(pagos.plin) || 0) + (parseFloat(pagos.tarjeta) || 0);
    const diferencia = totalPagado - modalCobro.total;

    if (diferencia < -0.01) return <span style={{ color: '#e74c3c' }}>Falta: S/ {Math.abs(diferencia).toFixed(2)}</span>;
    if (Math.abs(diferencia) <= 0.01) return <span style={{ color: '#27ae60' }}>✔️ Monto Exacto</span>;
    return <span style={{ color: '#f39c12' }}>Dar Vuelto: S/ {diferencia.toFixed(2)}</span>;
  }

  const procesarPagoMixto = async () => {
    const totalPagado = (parseFloat(pagos.efectivo) || 0) + (parseFloat(pagos.yape) || 0) + 
                        (parseFloat(pagos.plin) || 0) + (parseFloat(pagos.tarjeta) || 0);
    
    if (totalPagado < modalCobro.total - 0.01) {
      alert("⚠️ El monto ingresado es menor al total de la cuenta.");
      return;
    }

    try {
      // Si hay vuelto, se lo restamos al efectivo internamente para cuadrar la caja
      let efectivoReal = parseFloat(pagos.efectivo) || 0;
      const vuelto = totalPagado - modalCobro.total;
      if (vuelto > 0) efectivoReal -= vuelto;

      await axios.post('http://localhost:3000/api/pagar', {
        id_pedido: modalCobro.pedido.id_pedido,
        mesa: modalCobro.pedido.mesa,
        efectivo: efectivoReal,
        yape: parseFloat(pagos.yape) || 0,
        plin: parseFloat(pagos.plin) || 0,
        tarjeta: parseFloat(pagos.tarjeta) || 0
      });

      // Imprimir Boleta Física (Opcional)
      await axios.post('http://localhost:3000/api/imprimir-ticket', modalCobro.pedido).catch(()=>console.log("No hay impresora"));

      setPedidos((lista) => lista.filter(p => p.id_pedido !== modalCobro.pedido.id_pedido));
      setModalCobro({ isOpen: false, pedido: null, total: 0 });
      alert(`✅ Pago procesado correctamente.`);
    } catch (error) {
      console.error("Error al procesar el pago", error);
      alert("Hubo un error al procesar el pago.");
    }
  }

  // ==========================================
  // LÓGICA DE GASTOS Y REPORTES
  // ==========================================
  const guardarGasto = async () => {
    if (!gasto.concepto || !gasto.monto) return alert("Llena el concepto y el monto.");
    try {
      await axios.post('http://localhost:3000/api/gastos', gasto);
      alert("💸 Gasto registrado con éxito.");
      setModalGasto(false);
      setGasto({ concepto: '', categoria: 'Insumos', monto: '' });
    } catch (e) { alert("Error guardando el gasto."); }
  }

  const generarReporte = async () => {
    try {
      const respuesta = await axios.get('http://localhost:3000/api/reporte-diario');
      setReporte(respuesta.data);
    } catch (error) { alert("Error al generar el cierre."); }
  }

  // ==========================================
  // INTERFAZ DE USUARIO
  // ==========================================
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
      
      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: '15px', marginBottom: '20px' }}>
        <h1 style={{ color: '#2c3e50', margin: 0 }}>💻 Caja - POS Calletano</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setModalGasto(true)} style={{ padding: '10px 15px', backgroundColor: '#e67e22', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
            🛒 Registrar Gasto
          </button>
          <button onClick={generarReporte} style={{ padding: '10px 15px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
            📊 Cierre de Día
          </button>
        </div>
      </div>
      
      {/* TARJETAS DE PEDIDOS */}
      {pedidos.length === 0 ? (
        <p style={{ fontSize: '18px', color: '#7f8c8d', textAlign: 'center', marginTop: '50px' }}>La cocina está tranquila. Esperando pedidos... ☕</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          {pedidos.map((pedido, index) => (
            <div key={index} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', width: '300px', backgroundColor: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h2 style={{ margin: '0', color: '#2980b9' }}>Mesa {pedido.mesa}</h2>
                <span style={{ fontSize: '12px', color: '#95a5a6' }}>ID: #{pedido.id_pedido}</span>
              </div>
              
              <ul style={{ padding: '10px 0 10px 20px', margin: 0, color: '#34495e', minHeight: '100px' }}>
                {pedido.items.map((item, i) => (
                  <li key={i} style={{ marginBottom: '5px' }}>
                    <strong>{item.nombre}</strong> 
                    {item.notas && <span style={{ color: '#e74c3c', fontSize: '13px' }}> <br/>↳ {item.notas}</span>}
                  </li>
                ))}
              </ul>
              
              <h3 style={{ color: '#27ae60', margin: '10px 0', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                Total: S/ {pedido.total.toFixed(2)}
              </h3>
              
              <button onClick={() => abrirModalCobro(pedido)} style={{ width: '100%', padding: '12px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                Cobrar Mesa
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: COBRO MIXTO */}
      {modalCobro.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', width: '350px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: '#2c3e50', textAlign: 'center' }}>Cobrar Mesa {modalCobro.pedido?.mesa}</h3>
            <h1 style={{ color: '#27ae60', textAlign: 'center', margin: '10px 0 20px 0' }}>Total: S/ {modalCobro.total.toFixed(2)}</h1>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>💵 Efectivo:</label>
                <input type="number" value={pagos.efectivo} onChange={(e) => setPagos({...pagos, efectivo: e.target.value})} style={{ width: '120px', padding: '8px', textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>📱 Yape:</label>
                <input type="number" value={pagos.yape} onChange={(e) => setPagos({...pagos, yape: e.target.value})} style={{ width: '120px', padding: '8px', textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>📲 Plin:</label>
                <input type="number" value={pagos.plin} onChange={(e) => setPagos({...pagos, plin: e.target.value})} style={{ width: '120px', padding: '8px', textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>💳 Tarjeta:</label>
                <input type="number" value={pagos.tarjeta} onChange={(e) => setPagos({...pagos, tarjeta: e.target.value})} style={{ width: '120px', padding: '8px', textAlign: 'right' }} />
              </div>
            </div>

            <div style={{ margin: '20px 0', padding: '10px', backgroundColor: '#f9f9f9', textAlign: 'center', fontWeight: 'bold', fontSize: '18px', border: '1px dashed #ccc' }}>
              {calcularVuelto()}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setModalCobro({isOpen: false, pedido: null, total: 0})} style={{ flex: 1, padding: '10px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={procesarPagoMixto} style={{ flex: 2, padding: '10px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Confirmar Pago</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR GASTO */}
      {modalGasto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', width: '350px' }}>
            <h3 style={{ marginTop: 0, color: '#e67e22', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Registrar Gasto</h3>
            
            <label style={{ display: 'block', marginTop: '15px', fontWeight: 'bold' }}>Concepto (Ej: Pescado, Limones):</label>
            <input type="text" value={gasto.concepto} onChange={(e) => setGasto({...gasto, concepto: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginTop: '5px' }} />

            <label style={{ display: 'block', marginTop: '15px', fontWeight: 'bold' }}>Categoría:</label>
            <select value={gasto.categoria} onChange={(e) => setGasto({...gasto, categoria: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginTop: '5px' }}>
              <option value="Insumos">Insumos (Mercado, Bebidas)</option>
              <option value="Servicios">Servicios (Luz, Agua, Gas)</option>
              <option value="Otros">Otros (Movilidad, Reparaciones)</option>
            </select>

            <label style={{ display: 'block', marginTop: '15px', fontWeight: 'bold' }}>Monto a descontar (S/):</label>
            <input type="number" value={gasto.monto} onChange={(e) => setGasto({...gasto, monto: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginTop: '5px', fontSize: '20px', color: '#c0392b', fontWeight: 'bold' }} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button onClick={() => setModalGasto(false)} style={{ flex: 1, padding: '10px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarGasto} style={{ flex: 2, padding: '10px', backgroundColor: '#e67e22', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Gasto</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REPORTE DIARIO (Se mantiene igual que antes) */}
      {reporte && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', width: '400px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#2c3e50', marginTop: 0 }}>📈 Resumen del Día</h2>
            <h1 style={{ color: '#27ae60', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Ingresos: S/ {reporte.total}</h1>
            
            <h3 style={{ color: '#34495e' }}>Consolidado de Platos:</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {Object.entries(reporte.platos).map(([plato, cantidad]) => (
                <li key={plato} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #ccc' }}>
                  <span>{plato}</span><strong>{cantidad} und.</strong>
                </li>
              ))}
            </ul>

            <button onClick={() => setReporte(null)} style={{ width: '100%', padding: '12px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '5px', marginTop: '20px', cursor: 'pointer' }}>
              Cerrar Reporte
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export default App