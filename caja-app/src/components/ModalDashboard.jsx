import React from 'react';
import { X } from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';

export default function ModalDashboard({
    modalRef, modalInstance, modalCloseStyle,
    mesDashboard, setMesDashboard, cargarDashboard,
    dashboardData, pedirConsejoIAMensual, cargandoIA, consejoIA
}) {
    return (
        <div className="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-scrollable" style={{ maxWidth: '95vw' }}>
          <div className="modal-content" style={{ minHeight: '90vh' }}>
            <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #006989', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem'}}>
              <h4 className="erp-modal-title" style={{margin: 0}}><i className="fas fa-chart-pie" style={{color: '#006989', marginRight: '8px'}}></i> Analítica Avanzada</h4>
              <button style={modalCloseStyle} onClick={() => modalInstance?.hide()}><X size={28} color="#FFF" /></button>
            </div>
            <div className="erp-modal-body d-flex flex-column" style={{background: '#F4F1ED'}}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px' }}>
                <div className="erp-input-group" style={{ marginBottom: 0 }}>
                  <label className="erp-label">Periodo Fiscal</label>
                  <input type="month" className="erp-input" style={{ maxWidth: '250px', marginBottom: 0 }} value={mesDashboard} onChange={e => { setMesDashboard(e.target.value); cargarDashboard(e.target.value); }} />
                </div>

                {dashboardData && (
                  <button 
                    className="erp-btn" 
                    style={{ background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)', color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800, boxShadow: '0 4px 15px rgba(118, 75, 162, 0.3)' }} 
                    onClick={pedirConsejoIAMensual} 
                    disabled={cargandoIA}
                  >
                    {cargandoIA ? <div className="spinner-border spinner-border-sm" role="status"></div> : <i className="fas fa-magic"></i>}
                    {cargandoIA ? 'Analizando Mes...' : 'Consultar Estrategia IA'}
                  </button>
                )}
              </div>

              {consejoIA && consejoIA.decision && (
                <div className="animate__animated animate__fadeInDown mb-4" style={{ background: '#FFF', borderLeft: `5px solid ${consejoIA.nivelFinanciero === 'critico' ? '#D7263D' : (consejoIA.nivelFinanciero === 'riesgo' ? '#D4A843' : '#10B981')}`, padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                   <div style={{ background: 'rgba(118, 75, 162, 0.1)', padding: '12px', borderRadius: '50%' }}>
                      <i className="fas fa-chart-line" style={{ color: '#764BA2', fontSize: '1.5rem' }}></i>
                   </div>
                   <div style={{ flex: 1 }}>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 style={{ color: '#764BA2', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>Estrategia Gerencial</h6>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '4px 8px', borderRadius: '4px', background: consejoIA.nivelFinanciero === 'critico' ? '#FDE8E8' : (consejoIA.nivelFinanciero === 'riesgo' ? '#FEF3C7' : '#D1FAE5'), color: consejoIA.nivelFinanciero === 'critico' ? '#D7263D' : (consejoIA.nivelFinanciero === 'riesgo' ? '#B45309' : '#065F46'), textTransform: 'uppercase' }}>Finanzas: {consejoIA.nivelFinanciero}</span>
                      </div>
                      <p style={{ margin: '0 0 8px 0', color: '#2D241E', fontWeight: 600, fontSize: '0.95rem' }}><strong style={{color: '#8A7060'}}>Diagnóstico:</strong> {consejoIA.diagnostico}</p>
                      <p style={{ margin: 0, color: '#10B981', fontWeight: 800, fontSize: '1.05rem', lineHeight: '1.4' }}>💡 Decisión: {consejoIA.decision}</p>
                   </div>
                </div>
              )}

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
                          data={{ labels: dashboardData.evolucion.labels, datasets: [{ label: 'Ingresos', data: dashboardData.evolucion.ingresos, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,.1)', tension: 0.4, fill: true }, { label: 'Egresos', data: dashboardData.evolucion.gastos, borderColor: '#D7263D', backgroundColor: 'rgba(215,38,61,.05)', tension: 0.4, fill: true }] }} 
                          options={{ maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { font: { family: 'Plus Jakarta Sans' } } } } }} 
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
    );
}