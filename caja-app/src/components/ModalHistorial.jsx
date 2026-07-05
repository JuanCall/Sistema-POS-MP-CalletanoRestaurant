import React from 'react';
import { X } from 'lucide-react';

export default function ModalHistorial({
    modalRef, modalInstance, modalCloseStyle,
    fechaHistorial, setFechaHistorial, cargarHistorial,
    historialVentas, formatMesaName, anularVenta, abrirCarpetaSUNAT
}) {
    return (
        <div className="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #D7263D', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem'}}>
              <h4 className="erp-modal-title" style={{margin: 0}}><i className="fas fa-history" style={{color: '#D7263D', marginRight: '8px'}}></i> Libro de Ventas</h4>
              <button style={modalCloseStyle} onClick={() => modalInstance?.hide()}><X size={28} color="#FFF" /></button>
            </div>
            <div className="erp-modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: '#FFFFFF', padding: '1.25rem', borderRadius: '12px', border: '1px solid #E5E0D8' }}>
                <div>
                   <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2D241E', textTransform: 'uppercase', display:'block', marginBottom:'8px' }}><i className="far fa-calendar-alt"></i> Filtrar Documentos</span>
                   <input type="date" className="erp-input" style={{ width: '220px', margin: 0 }} value={fechaHistorial} onChange={e => { setFechaHistorial(e.target.value); cargarHistorial(e.target.value); }} />
                </div>
                <button className="erp-btn erp-btn-success" onClick={abrirCarpetaSUNAT}><i className="fas fa-folder-open"></i> Ver Boletas SUNAT (PDF/XML)</button>
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
    );
}