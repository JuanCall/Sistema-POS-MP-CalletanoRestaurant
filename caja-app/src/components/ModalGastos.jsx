import React from 'react';
import { Trash2, X } from 'lucide-react';
import { Bar } from 'react-chartjs-2';

export default function ModalGastos({ 
    modalRef, modalInstance, modalCloseStyle,
    gastos, nuevoGasto, setNuevoGasto, 
    guardarGasto, eliminarGasto
}) {
    return (
        <div className="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content">
                    <div className="erp-modal-header" style={{background: '#D4A843', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem'}}>
                      <h4 className="erp-modal-title" style={{margin: 0, color: '#120B06'}}><i className="fas fa-file-invoice-dollar"></i> Registro de Egresos</h4>
                      <button style={modalCloseStyle} onClick={() => modalInstance?.hide()}><X size={28} color="#120B06" /></button>
                    </div>
                    <div className="erp-modal-body">
                      <div className="row">
                        
                        {/* Izquierda */}
                        <div className="col-md-6 border-end pe-4">
                          <form onSubmit={guardarGasto} style={{ marginBottom: '1.5rem' }}>
                            <div className="row g-2 mb-2">
                               <div className="col-8">
                                 <input type="text" className="erp-input mb-0" placeholder="Concepto del Gasto" value={nuevoGasto.descripcion} onChange={e => setNuevoGasto({ ...nuevoGasto, descripcion: e.target.value })} required />
                               </div>
                               <div className="col-4">
                                 <input type="number" step="0.10" className="erp-input mb-0" placeholder="Monto S/" value={nuevoGasto.monto} onChange={e => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })} required />
                               </div>
                            </div>
                            <div className="row g-2 mb-3">
                               <div className="col-6">
                                 <select className="erp-input mb-0" value={nuevoGasto.categoria} onChange={e => setNuevoGasto({ ...nuevoGasto, categoria: e.target.value })}>
                                   <option value="Insumos">Insumos y Alimentos</option><option value="Personal">Planilla / Personal</option><option value="Servicios">Servicios (Luz, Agua)</option><option value="Otros">Otros</option>
                                 </select>
                               </div>
                               <div className="col-6">
                                 <button type="submit" className="erp-btn erp-btn-primary w-100">Guardar</button>
                               </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: nuevoGasto.con_comprobante ? '#D1FAE5' : '#F4F1ED', padding: '10px', borderRadius: '8px', border: `1px solid ${nuevoGasto.con_comprobante ? '#10B981' : '#E5E0D8'}`, cursor: 'pointer' }} onClick={() => setNuevoGasto({ ...nuevoGasto, con_comprobante: !nuevoGasto.con_comprobante })}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${nuevoGasto.con_comprobante ? '#10B981' : '#8A7060'}`, display: 'flex', justifyContent: 'center', alignItems: 'center', background: nuevoGasto.con_comprobante ? '#10B981' : '#FFF' }}>
                                {nuevoGasto.con_comprobante && <i className="fas fa-check" style={{ color: '#FFF', fontSize: '12px' }}></i>}
                              </div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: nuevoGasto.con_comprobante ? '#065F46' : '#2D241E' }}>Tengo Factura / Boleta SUNAT</div>
                            </div>
                          </form>
                          
                          <div className="erp-category-title" style={{margin: '0 0 1rem'}}>Registro de Hoy</div>
                          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {gastos.length === 0 && <p style={{ color: '#8A7060', fontSize: '0.85rem', textAlign: 'center' }}>No existen movimientos.</p>}
                            {gastos.map(g => (
                              <div key={g.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #E5E0D8'}}>
                                <div>
                                  <div style={{fontWeight: 700, color: '#120B06', fontSize: '0.85rem'}}>{g.descripcion} {g.con_comprobante === 1 && <i className="fas fa-receipt text-success" title="Facturado"></i>}</div>
                                  <div style={{fontSize: '0.65rem', color: '#8A7060', textTransform: 'uppercase'}}>{g.categoria}</div>
                                </div>
                                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                  <span style={{fontWeight: 800, color: '#D7263D', fontSize: '0.9rem'}}>S/ {g.monto.toFixed(2)}</span>
                                  <button className="erp-delete-btn" style={{padding:'4px 8px'}} onClick={() => eliminarGasto(g.id)}><Trash2 size={14} color="#120B06"/></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
        
                        {/* Derecha */}
                        <div className="col-md-6 ps-4 d-flex flex-column">
                           <h5 style={{fontWeight: 800, color: '#006989', marginBottom: '1rem'}}>Distribución de Egresos</h5>
                           <div style={{flex: 1, minHeight: '300px'}}>
                             <Bar 
                                data={{
                                  labels: ['Insumos', 'Personal', 'Servicios', 'Otros'],
                                  datasets: [{
                                     label: 'Monto Gastado (S/)',
                                     data: ['Insumos', 'Personal', 'Servicios', 'Otros'].map(cat => gastos.filter(g => g.categoria === cat).reduce((sum, g) => sum + g.monto, 0)),
                                     backgroundColor: ['#D4A843', '#006989', '#475569', '#8A7060'],
                                     borderRadius: 6
                                  }]
                                }}
                                options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                             />
                            </div>
                        </div>
                        
                      </div>
                    </div>
                </div>
            </div>
        </div>
    );
}