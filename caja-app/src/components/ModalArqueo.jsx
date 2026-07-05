import React from 'react';
import { X } from 'lucide-react';

export default function ModalArqueo({
    modalRef, modalInstance, modalCloseStyle,
    fechaArqueo, setFechaArqueo, cargarArqueo,
    reporte, cargandoIA, pedirConsejoIADiario, consejoIA
}) {
    return (
        <div className="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog modal-xl modal-dialog-scrollable">
                <div className="modal-content">
                    <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #D4A843', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem'}}>
                      <h4 className="erp-modal-title" style={{margin: 0}}><i className="fas fa-cash-register" style={{color: '#D4A843', marginRight: '8px'}}></i> Arqueo Gerencial</h4>
                      <button style={modalCloseStyle} onClick={() => modalInstance?.hide()}><X size={28} color="#FFF" /></button>
                    </div>
                    <div className="erp-modal-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: '#FFFFFF', padding: '1.25rem', borderRadius: '12px', border: '1px solid #E5E0D8', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                           <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2D241E', textTransform: 'uppercase' }}><i className="far fa-calendar-alt"></i> Fecha Contable</span>
                           <input type="date" className="erp-input" style={{ width: '220px', margin: 0 }} value={fechaArqueo} onChange={e => { setFechaArqueo(e.target.value); cargarArqueo(e.target.value); }} />
                        </div>
                        
                        <button 
                          className="erp-btn" 
                          style={{ background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800, boxShadow: '0 4px 15px rgba(118, 75, 162, 0.3)' }} 
                          onClick={pedirConsejoIADiario} 
                          disabled={cargandoIA}
                        >
                          {cargandoIA ? <div className="spinner-border spinner-border-sm" role="status"></div> : <i className="fas fa-magic"></i>}
                          {cargandoIA ? 'Analizando Arqueo...' : 'Consultar a Gemini AI'}
                        </button>
                    </div>
        
                      {consejoIA && consejoIA.accion && (
                        <div className="animate__animated animate__fadeInDown mb-4" style={{ background: '#FFF', borderLeft: `5px solid ${consejoIA.nivelRiesgo === 'alto' ? '#D7263D' : (consejoIA.nivelRiesgo === 'medio' ? '#D4A843' : '#10B981')}`, padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                           <div style={{ background: 'rgba(118, 75, 162, 0.1)', padding: '12px', borderRadius: '50%' }}>
                              <i className="fas fa-fire-burner" style={{ color: '#764BA2', fontSize: '1.5rem' }}></i>
                           </div>
                           <div style={{ flex: 1 }}>
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                  <h6 style={{ color: '#764BA2', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>Análisis Operativo Diario</h6>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '4px 8px', borderRadius: '4px', background: consejoIA.nivelRiesgo === 'alto' ? '#FDE8E8' : (consejoIA.nivelRiesgo === 'medio' ? '#FEF3C7' : '#D1FAE5'), color: consejoIA.nivelRiesgo === 'alto' ? '#D7263D' : (consejoIA.nivelRiesgo === 'medio' ? '#B45309' : '#065F46'), textTransform: 'uppercase' }}>Riesgo {consejoIA.nivelRiesgo}</span>
                              </div>
                              <p style={{ margin: '0 0 8px 0', color: '#2D241E', fontWeight: 600, fontSize: '0.95rem' }}><strong style={{color: '#8A7060'}}>Diagnóstico:</strong> {consejoIA.diagnostico}</p>
                              <p style={{ margin: 0, color: '#D7263D', fontWeight: 800, fontSize: '1.05rem', lineHeight: '1.4' }}>🔥 Acción: {consejoIA.accion}</p>
                           </div>
                        </div>
                      )}
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
                        <div className="pos-stat-label" style={{ marginBottom: '0.8rem' }}><i className="fas fa-star" style={{ color: '#D4A843' }}></i> Detalle de Platos Vendidos <span style={{fontSize: '0.75rem', fontWeight: 400, color: '#8A7060'}}>({reporte.topPlatos.length} platos distintos)</span></div>
                        {reporte.topPlatos.length === 0 ? <p style={{ color: '#8A7060', fontSize: '0.9rem', fontStyle: 'italic' }}>Información no disponible para el periodo.</p> : (() => {
                          const grupos = {};
                          reporte.topPlatos.forEach(p => {
                            const cat = p.categoria || 'General';
                            if (!grupos[cat]) grupos[cat] = [];
                            grupos[cat].push(p);
                          });
                          const categoriasOrdenadas = Object.keys(grupos).sort();
                          return categoriasOrdenadas.map((cat, ci) => (
                            <div key={ci} style={{marginBottom: '0.8rem'}}>
                              <div style={{fontSize: '0.75rem', fontWeight: 800, color: '#D4A843', textTransform: 'uppercase', letterSpacing: '1px', padding: '6px 0', borderBottom: '2px solid #D4A843', marginBottom: '4px', display: 'flex', justifyContent: 'space-between'}}>
                                <span>{cat}</span>
                                <span style={{color: '#8A7060'}}>{grupos[cat].reduce((acc, p) => acc + p.cant, 0)} unid.</span>
                              </div>
                              {grupos[cat].map((p, pi) => (
                                <div key={pi} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 6px 12px', borderBottom: '1px solid #F0EDE8', fontSize: '0.9rem'}}>
                                  <span style={{flex: 1, fontWeight: 600, color: '#2D241E'}}>{p.nombre}</span>
                                  <span className="pos-badge pos-badge-gray" style={{fontSize: '0.75rem', minWidth: '50px', textAlign: 'center'}}>{p.cant} unid.</span>
                                </div>
                              ))}
                            </div>
                          ));
                        })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}