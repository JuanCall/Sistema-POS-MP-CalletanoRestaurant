import React from 'react';
import { X } from 'lucide-react';
import { agruparParaTickets } from '../utils/math';

export default function ModalCobro({
    modalRef, modalInstance, modalCloseStyle,
    tipoCobro, mesaActiva, pagos, setPagos,
    montoRecibido, setMontoRecibido,
    clienteFacturacion, setClienteFacturacion, procesarCobro
}) {
    // Calculamos el vuelto y faltante internamente
    const sumaTotalRecibida = (parseFloat(pagos.yape || 0) + parseFloat(pagos.plin || 0) + parseFloat(pagos.tarjeta || 0) + parseFloat(montoRecibido || 0));
    const montoFalta = (mesaActiva?.total || 0) > sumaTotalRecibida ? (mesaActiva.total - sumaTotalRecibida) : 0;
    const montoVuelto = sumaTotalRecibida > (mesaActiva?.total || 0) ? (sumaTotalRecibida - mesaActiva.total) : 0;

    return (
        <div className="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true">
            <div className={`modal-dialog modal-dialog-centered ${tipoCobro === 'boleta' ? 'modal-lg' : ''}`}>
                <div className="modal-content">
                    <div className="erp-modal-header" style={{background: '#120B06', borderBottom: `3px solid ${tipoCobro === 'boleta' ? '#10B981' : '#8A7060'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem'}}>
                      <h4 className="erp-modal-title" style={{margin: 0}}><i className={`fas ${tipoCobro === 'boleta' ? 'fa-file-invoice' : 'fa-receipt'}`} style={{color: tipoCobro === 'boleta' ? '#10B981' : '#8A7060', marginRight: '8px'}}></i> {tipoCobro === 'boleta' ? 'Emitir Boleta Electrónica' : 'Nota de Venta Interna'}</h4>
                      <button style={modalCloseStyle} onClick={() => modalInstance?.hide()}><X size={28} color="#FFF" /></button>
                    </div>
                    <div className="erp-modal-body">
                       <div className={tipoCobro === 'boleta' ? "row" : ""}>
                         
                         <div className={tipoCobro === 'boleta' ? "col-md-5 border-end pe-4" : ""}>
                            <div style={{textAlign: 'center', marginBottom: '1.5rem', background: '#F4F1ED', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E0D8'}}>
                              <div style={{fontSize: '0.8rem', color: '#8A7060', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em'}}>Total a Cobrar</div>
                              <div style={{fontFamily: 'Playfair Display, serif', fontSize: '3rem', fontWeight: 800, color: '#120B06', lineHeight: 1}}>
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
        
                            {/* ========================================================
                                [MÓDULO OCULTO] CÁLCULO DINÁMICO DEL VUELTO
                                Se comentó temporalmente a petición de los usuarios de caja. 
                                Para restaurar la función visual de Vuelto y Falta, 
                                simplemente quita los comentarios de este bloque de abajo.
                            ========================================================
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', padding: '1rem', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E0D8' }}>
                              <div>
                                <div style={{fontSize: '0.75rem', color: '#8A7060', fontWeight: 800, textTransform: 'uppercase'}}>Falta</div>
                                <div style={{fontSize: '1.2rem', fontWeight: 800, color: montoFalta > 0 ? '#D7263D' : '#10B981'}}>S/ {montoFalta.toFixed(2)}</div>
                              </div>
                              <div style={{textAlign: 'right'}}>
                                <div style={{fontSize: '0.75rem', color: '#8A7060', fontWeight: 800, textTransform: 'uppercase'}}>Vuelto</div>
                                <div style={{fontSize: '1.2rem', fontWeight: 800, color: '#006989'}}>S/ {montoVuelto.toFixed(2)}</div>
                              </div>
                            </div>
                            ======================================================== */}
                            
                            {tipoCobro === 'nota' && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    {(parseFloat(pagos.plin || 0) + parseFloat(pagos.tarjeta || 0)) > 0 ? (
                                        <div className="animate__animated animate__headShake" style={{ background: '#FDE8E8', color: '#D7263D', padding: '12px', borderRadius: '8px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid #D7263D' }}>
                                            <i className="fas fa-exclamation-triangle"></i> Ley SUNAT: Los pagos con Plin o Tarjeta exigen generar una Boleta. Cierra esta ventana y elige "Generar Boleta".
                                        </div>
                                    ) : (
                                        <button className="erp-btn" style={{ width: '100%', padding: '1.2rem', fontSize: '1rem', background: '#8A7060', color: '#FFF' }} onClick={() => procesarCobro(false)}>
                                          <i className="fas fa-check-circle"></i> REGISTRAR COBRO INTERNO
                                        </button>
                                    )}
                                </div>
                            )}
                         </div>
        
                         {tipoCobro === 'boleta' && (
                             <div className="col-md-7 ps-4 d-flex flex-column">
                                <div style={{ flex: 1, background: '#FFF', padding: '15px 20px', borderRadius: '4px', border: '2px solid #2D241E', fontFamily: '"Courier New", Courier, monospace', color: '#2D241E', boxShadow: '4px 4px 0px rgba(212, 168, 67, 0.3)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                  
                                  <div className="row mb-3" style={{ borderBottom: '2px solid #2D241E', paddingBottom: '15px', alignItems: 'center' }}>
                                    <div className="col-6 text-start" style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>
                                      <strong style={{ fontSize: '1.2rem', fontFamily: '"Playfair Display", serif', letterSpacing: '1px', display: 'block' }}>CALLETANO</strong>
                                      <span style={{fontWeight: 'bold'}}>De: José Eliseo Calle Calle</span><br/>
                                      C. Ampliación La Molina<br/>
                                      Bar. Nicaragua S/N<br/>
                                      Máncora Talara Piura<br/>
                                    </div>
                                    <div className="col-6 text-end">
                                      <div style={{ border: '2px solid #2D241E', borderRadius: '12px', padding: '8px', textAlign: 'center', background: '#F9F9F9' }}>
                                        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>RUC. 10449106267</div>
                                        <div style={{ fontWeight: 800, fontSize: '0.85rem', borderTop: '2px solid #2D241E', borderBottom: '2px solid #2D241E', margin: '6px 0', padding: '4px 0' }}>BOLETA DE VENTA</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>B001 - N° (Auto)</div>
                                      </div>
                                    </div>
                                  </div>
        
                                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px' }}>
                                    Fecha: {new Date().toLocaleDateString()}<br/>
                                    <div className="d-flex align-items-end mt-2">
                                      <span style={{ width: '80px' }}>Cliente:</span>
                                      <input type="text" style={{ flex: 1, border: '1px solid #E5E0D8', background: '#F4F1ED', color: '#120B06', padding: '4px 8px', borderRadius: '4px', outline: 'none', fontFamily: 'inherit', fontWeight: 'bold' }} value={clienteFacturacion.nombre} onChange={e => setClienteFacturacion({...clienteFacturacion, nombre: e.target.value.toUpperCase()})} placeholder="Escribir nombre o Razón Social" />
                                    </div>
                                    <div className="d-flex align-items-end mt-2">
                                      <span style={{ width: '80px' }}>Dirección:</span>
                                      <input type="text" style={{ flex: 1, border: '1px solid #E5E0D8', background: '#F4F1ED', color: '#120B06', padding: '4px 8px', borderRadius: '4px', outline: 'none', fontFamily: 'inherit', fontWeight: 'bold' }} value={clienteFacturacion.direccion} onChange={e => setClienteFacturacion({...clienteFacturacion, direccion: e.target.value.toUpperCase()})} placeholder="Opcional" />
                                    </div>
                                    <div className="d-flex align-items-end mt-2">
                                      <span style={{ width: '80px' }}>DNI/RUC:</span>
                                      <input type="text" style={{ width: '150px', border: '1px solid #E5E0D8', background: '#F4F1ED', color: '#120B06', padding: '4px 8px', borderRadius: '4px', outline: 'none', fontFamily: 'inherit', fontWeight: 'bold', letterSpacing: '1px' }} value={clienteFacturacion.documento} onChange={e => setClienteFacturacion({...clienteFacturacion, documento: e.target.value.replace(/\D/g, '')})} maxLength="11" placeholder="Ej: 71874502" />
                                    </div>
                                  </div>
        
                                  <div style={{ borderTop: '2px dashed #2D241E', borderBottom: '2px dashed #2D241E', padding: '10px 0', marginTop: '10px', flex: 1, overflowY: 'auto' }}>
                                    <div className="d-flex justify-content-between" style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '5px' }}><span>CANT DESCRIPCION</span><span>IMPORTE</span></div>
                                    {mesaActiva && agruparParaTickets(mesaActiva.pedido).map((it, i) => (
                                       <div key={i} className="d-flex justify-content-between" style={{ fontSize: '0.8rem', lineHeight: '1.2', marginBottom: '4px' }}>
                                         <span style={{paddingRight: '10px'}}>{it.cantidad} {it.nombre}</span>
                                         <span>S/{(it.subtotal).toFixed(2)}</span>
                                       </div>
                                    ))}
                                  </div>
                                  
                                  <div className="text-end mt-2" style={{ fontSize: '1.2rem', fontWeight: 800 }}>TOTAL S/ {mesaActiva?.total.toFixed(2)}</div>
                                </div>
        
                                <button className="erp-btn erp-btn-success" style={{ marginTop: '1.5rem', width: '100%', padding: '1.2rem', fontSize: '1rem' }} onClick={() => procesarCobro(true)}>
                                  <i className="fas fa-cloud-upload-alt"></i> EMITIR A SUNAT
                                </button>
                             </div>
                         )}
                       </div>
                    </div>
                </div>
            </div>
        </div>
    );
}