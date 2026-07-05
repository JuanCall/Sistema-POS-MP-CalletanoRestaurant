import React from 'react';
import { X, Trash2, PencilLine, ChefHat } from 'lucide-react';
import { obtenerFechaActualLocal } from '../utils/helpers';

export default function ModalAdmin({
    modalRef, modalInstance, modalCloseStyle,
    adminTab, setAdminTab, adminData, setAdminData,
    guardarAdminMenu, updateMenuField, toggleDomingoAdmin,
    addMenuRow, updateMenuArr, toggleTaperMenu, delMenuRow,
    addCartaCat, guardarAdminCarta, updateCartaCat, delCartaCat,
    updateCartaItem, delCartaItem, addCartaItem,
    setPlatoSeleccionado, cargarRecetaPlato, setModalReceta,
    guardarAdminEstado,
    insumoEditando, setInsumoEditando, nuevoInsumoForm, setNuevoInsumoForm, guardarNuevoInsumo,
    deshabilitarInsumo, habilitarInsumo, inventario,
    busquedaKardex, setBusquedaKardex, movimientoData, setMovimientoData, guardarMovimientoInv
}) {
    return (
      <div className="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-focus="false">
        <div className="modal-dialog modal-dialog-scrollable" style={{ maxWidth: '95vw' }}>
          <div className="modal-content">
            <div className="erp-modal-header" style={{background: '#120B06', borderBottom: '3px solid #D4A843', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem'}}>
              <h4 className="erp-modal-title" style={{margin: 0}}><i className="fas fa-cogs" style={{color: '#D4A843', marginRight: '8px'}}></i> Panel de Control GERENCIAL</h4>
              <button style={modalCloseStyle} onClick={() => modalInstance?.hide()}><X size={28} color="#FFF" /></button>
            </div>
            
            <div className="erp-modal-body" style={{padding: 0, background: '#F4F1ED'}}>
               <div style={{display: 'flex', borderBottom: '1px solid #E5E0D8', background: '#FFFFFF', padding: '0 1rem'}}>
                  <button className={`erp-nav-item ${adminTab === 'menu' ? 'active' : ''}`} onClick={()=>setAdminTab('menu')} style={{borderRadius:0, marginBottom:0, color: '#120B06', padding: '1.2rem', width: 'auto'}}>Menú del Día </button>
                  <button className={`erp-nav-item ${adminTab === 'carta' ? 'active' : ''}`} onClick={()=>setAdminTab('carta')} style={{borderRadius:0, marginBottom:0, color: '#120B06', padding: '1.2rem', width: 'auto'}}>La Carta</button>
                  <button className={`erp-nav-item ${adminTab === 'horario' ? 'active' : ''}`} onClick={()=>setAdminTab('horario')} style={{borderRadius:0, marginBottom:0, color: '#120B06', padding: '1.2rem', width: 'auto'}}>Estado Operativo</button>
                  <button className={`erp-nav-item ${adminTab === 'inventario' ? 'active' : ''}`} onClick={()=>setAdminTab('inventario')} style={{borderRadius:0, marginBottom:0, color: '#120B06', padding: '1.2rem', width: 'auto'}}>Almacén</button>
               </div>

               <div style={{padding: '2rem'}}>
                  
                  {/* TAB 1: MENÚ DIARIO */}
                  {adminTab === 'menu' && (
                    <div className="animate__animated animate__fadeIn">
                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <h4 style={{fontWeight: 800, color: '#120B06'}}>Configurar Menú</h4>
                        <button className="erp-btn erp-btn-success" onClick={guardarAdminMenu}><i className="fas fa-cloud-upload-alt"></i> PUBLICAR MENÚ</button>
                      </div>

                      <div className="row mb-4">
                        <div className="col-md-8">
                          <label className="erp-label">Título a mostrar</label>
                          <input type="text" className="erp-input" value={adminData.menuDiario.titulo} onChange={e => updateMenuField('titulo', e.target.value)} />
                        </div>
                        <div className="col-md-4">
                          <label className="erp-label" style={{color: '#D7263D'}}><i className="fas fa-calendar-star"></i> Modo Domingo</label>
                          <button className={`erp-btn ${adminData.menuDiario.modoDomingo ? 'erp-btn-success' : 'erp-btn-outline'}`} style={{width: '100%'}} onClick={toggleDomingoAdmin}>
                            {adminData.menuDiario.modoDomingo ? 'ACTIVADO (Oculta Entradas)' : 'DESACTIVADO (Normal)'}
                          </button>
                        </div>
                      </div>

                      <div className="row g-4">
                        {/* ENTRADAS */}
                        {!adminData.menuDiario.modoDomingo && (
                          <div className="col-md-5">
                            <div style={{background: '#FFF', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E0D8'}}>
                              <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 style={{fontWeight: 800, color: '#D4A843', margin:0}}><i className="fas fa-bowl-food"></i> ENTRADAS</h5>
                                <button className="erp-btn erp-btn-outline" style={{padding: '8px 16px', fontSize: '0.9rem'}} onClick={()=>addMenuRow('entradas')}><i className="fas fa-plus"></i> Añadir Entrada</button>
                              </div>
                              {(adminData.menuDiario.entradas || []).map((e, idx) => (
                                <div key={idx} className="d-flex gap-2 mb-2 p-2 bg-light rounded border align-items-center">
                                  <div style={{flex: 1}}>
                                    <label style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#8A7060'}}>NOMBRE DE ENTRADA</label>
                                    <input type="text" className="erp-input mb-0" placeholder="Ej: Ceviche" value={e.nombre} onChange={ev => updateMenuArr('entradas', idx, 'nombre', ev.target.value)} />
                                  </div>
                                  <div style={{width: '200px'}}>
                                    <label style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#D4A843'}}>ENVASES (LLEVAR/DELV)</label>
                                    <div className="d-flex gap-1 mt-1">
                                      {['chico', 'sopa', 'mediano', 'grande'].map(t => {
                                         const tapersAct = Array.isArray(e.taper) ? e.taper : (e.taper ? [e.taper] : []);
                                         const activo = tapersAct.includes(t);
                                         return (
                                           <button type="button" key={t} onClick={() => toggleTaperMenu('entradas', idx, t)} className="erp-btn" style={{padding: '4px 6px', fontSize: '0.65rem', background: activo ? '#D4A843' : '#E5E0D8', color: activo ? '#120B06' : '#8A7060', border: 'none', borderRadius: '4px'}}>{t.toUpperCase()}</button>
                                         );
                                      })}
                                    </div>
                                  </div>
                                  <div style={{width: '80px'}}>
                                    <label style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#10B981'}}>PRECIO (S/)</label>
                                    <input type="number" className="erp-input mb-0" style={{textAlign: 'center', borderColor: '#10B981'}} value={e.precio} onChange={ev => updateMenuArr('entradas', idx, 'precio', ev.target.value)} />
                                  </div>
                                  <div style={{width: '80px'}}>
                                    <label style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#006989'}}>📦 STOCK</label>
                                    <input type="number" className="erp-input mb-0" style={{textAlign: 'center', borderColor: '#006989', background: '#E0F2FE'}} title="Raciones preparadas" value={e.stock || ''} onChange={ev => updateMenuArr('entradas', idx, 'stock', ev.target.value)} />
                                  </div>
                                  <button className="erp-delete-btn" style={{width: '40px', height: '40px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center'}} onClick={()=>delMenuRow('entradas', idx)}>
                                     <Trash2 size={18} color="#120B06" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* SEGUNDOS */}
                        <div className={adminData.menuDiario.modoDomingo ? "col-md-8" : "col-md-7"}>
                           <div style={{background: '#FFF', padding: '1.5rem', borderRadius: '12px', border: '1px solid #D7263D'}}>
                              <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 style={{fontWeight: 800, color: '#D7263D', margin:0}}><i className="fas fa-drumstick-bite"></i> SEGUNDOS</h5>
                                <button className="erp-btn erp-btn-outline" style={{padding: '8px 16px', fontSize: '0.9rem'}} onClick={()=>addMenuRow('segundos')}><i className="fas fa-plus"></i> Añadir Segundo</button>
                              </div>
                              {(adminData.menuDiario.segundos || []).map((sItem, idx) => (
                                <div key={idx} className="d-flex gap-2 mb-2 p-2 bg-light rounded border align-items-center">
                                  <div style={{flex: 1}}>
                                    <label style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#8A7060'}}>PLATO DE FONDO / ACOMPAÑAMIENTO</label>
                                    <input type="text" className="erp-input mb-1" placeholder="Nombre de Fondo" value={sItem.nombre} onChange={ev => updateMenuArr('segundos', idx, 'nombre', ev.target.value)} />
                                    <input type="text" className="erp-input mb-0" style={{fontSize: '0.8rem'}} placeholder="Acompañamiento (Opcional)" value={sItem.acomp||''} onChange={ev => updateMenuArr('segundos', idx, 'acomp', ev.target.value)} />
                                  </div>
                                  <div style={{width: '200px'}}>
                                    <label style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#D7263D'}}>ENVASES (LLEVAR/DELV)</label>
                                    <div className="d-flex flex-wrap gap-1 mt-1">
                                      {['chico', 'sopa', 'mediano', 'grande'].map(t => {
                                         const tapersAct = Array.isArray(sItem.taper) ? sItem.taper : (sItem.taper ? [sItem.taper] : []);
                                         const activo = tapersAct.includes(t);
                                         return (
                                           <button type="button" key={t} onClick={() => toggleTaperMenu('segundos', idx, t)} className="erp-btn" style={{padding: '4px 6px', fontSize: '0.65rem', background: activo ? '#D7263D' : '#E5E0D8', color: activo ? '#FFF' : '#8A7060', border: 'none', borderRadius: '4px'}}>{t.toUpperCase()}</button>
                                         );
                                      })}
                                    </div>
                                  </div>
                                  <div style={{width: '85px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                    <div>
                                      <label style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#10B981'}}>PRECIO (S/)</label>
                                      <input type="number" className="erp-input mb-0" style={{textAlign: 'center', borderColor: '#10B981', fontWeight: 800}} value={sItem.precio} onChange={ev => updateMenuArr('segundos', idx, 'precio', ev.target.value)} />
                                    </div>
                                    <div>
                                      <label style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#006989'}}>📦 STOCK</label>
                                      <input type="number" className="erp-input mb-0" style={{textAlign: 'center', borderColor: '#006989', background: '#E0F2FE', fontWeight: 800}} value={sItem.stock || ''} onChange={ev => updateMenuArr('segundos', idx, 'stock', ev.target.value)} />
                                    </div>
                                  </div>
                                  <div style={{display: 'flex', alignItems: 'center', height: '100%'}}>
                                    <button className="erp-delete-btn" style={{width: '45px', height: '100%'}} onClick={()=>delMenuRow('segundos', idx)}>
                                      <Trash2 size={20} color="#120B06" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                           </div>
                        </div>

                        {/* REFRESCO */}
                        <div className={adminData.menuDiario.modoDomingo ? "col-md-4" : "col-12"}>
                          <div style={{background: '#FFF', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E0D8', height: '100%'}}>
                             <label className="erp-label" style={{color: '#006989'}}><i className="fas fa-wine-glass"></i> Refresco del día</label>
                             <textarea className="erp-input" style={{ resize: 'none', height: '80px' }} value={adminData.menuDiario.refresco} onChange={e => updateMenuField('refresco', e.target.value)} placeholder="Ej: Chicha Morada"></textarea>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: LA CARTA */}
                  {adminTab === 'carta' && (
                    <div className="animate__animated animate__fadeIn">
                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <h4 style={{fontWeight: 800, color: '#120B06'}}>Editor de Carta</h4>
                        <div className="d-flex gap-2">
                           <button className="erp-btn erp-btn-outline" onClick={addCartaCat}><i className="fas fa-folder-plus"></i> Nueva Categoría</button>
                           <button className="erp-btn erp-btn-success" onClick={guardarAdminCarta}><i className="fas fa-cloud-upload-alt"></i> PUBLICAR CARTA</button>
                        </div>
                      </div>

                      {(adminData.cartaCompleta.categorias || []).map((cat, cIdx) => (
                        <div key={cIdx} style={{background: '#FFF', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E0D8', marginBottom: '1.5rem'}}>
                          
                          {/* ENCABEZADO DE CATEGORÍA ALINEADO */}
                          <div className="d-flex gap-2 mb-3 pb-3 border-bottom">
                             <div style={{flex: 1.2, paddingRight: '5px', display: 'flex'}}>
                               <input type="text" className="erp-input" style={{flex: 1, fontSize: '1.2rem', fontWeight: 800, color: '#006989', border: 'none', background: '#F4F1ED'}} value={cat.nombre} onChange={e => updateCartaCat(cIdx, 'nombre', e.target.value)} placeholder="Nombre Categoría" />
                             </div>
                             <input type="text" className="erp-input" style={{width: '120px'}} value={cat.col1 || ''} onChange={e => updateCartaCat(cIdx, 'col1', e.target.value)} placeholder="Ej: Vaso" />
                             <input type="text" className="erp-input" style={{width: '120px'}} value={cat.col2 || ''} onChange={e => updateCartaCat(cIdx, 'col2', e.target.value)} placeholder="Ej: Jarra" />
                             <button className="erp-delete-btn" style={{width: '45px', display: 'flex', justifyContent:'center', alignItems: 'center'}} onClick={()=>delCartaCat(cIdx)}>
                               <Trash2 size={18} color="#120B06" />
                             </button>
                          </div>
                          
                          {/* LISTA DE PLATOS ALINEADA */}
                          {cat.items.map((it, iIdx) => (
                            <div key={iIdx} className="d-flex gap-2 mb-2">
                              <div style={{flex: 1, display: 'flex', gap: '8px'}}>
                                <input type="text" className="erp-input" style={{flex: 0.7}} value={it.nombre} onChange={e => updateCartaItem(cIdx, iIdx, 'nombre', e.target.value)} placeholder="Nombre del Plato" />
                                <input type="text" className="erp-input" style={{flex: 1.4, fontSize: '0.8rem'}} value={it.desc || ''} onChange={e => updateCartaItem(cIdx, iIdx, 'desc', e.target.value)} placeholder="Descripción" />
                              </div>
                              <input type="number" className="erp-input" style={{width: '120px'}} value={it.precio} onChange={e => updateCartaItem(cIdx, iIdx, 'precio', e.target.value)} placeholder="Precio 1" />
                              <input type="number" className="erp-input" style={{width: '120px'}} value={it.precio2 || ''} onChange={e => updateCartaItem(cIdx, iIdx, 'precio2', e.target.value)} placeholder="Precio 2" />
                              
                              {/* 🟢 Botón de Receta (Gorro de Chef) */}
                              {it.id && (
                                <button 
                                  type="button"
                                  className="erp-btn" 
                                  style={{width: '45px', height: '45px', padding: 0, background: '#006989', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center'}} 
                                  title="Armar Receta / Costos" 
                                  onClick={() => { setPlatoSeleccionado(it); cargarRecetaPlato(it.id); setModalReceta(true); }}
                                >
                                  <ChefHat size={24} color="#FFFFFF" />
                                </button>
                              )}

                              <button className="erp-delete-btn" style={{width: '45px', display: 'flex', justifyContent:'center', alignItems: 'center'}} onClick={()=>delCartaItem(cIdx, iIdx)}>
                                <Trash2 size={18} color="#120B06" />
                              </button>
                            </div>
                          ))}
                          <button className="erp-btn erp-btn-outline" style={{width: '100%', marginTop: '10px'}} onClick={()=>addCartaItem(cIdx)}><i className="fas fa-plus"></i> Agregar Plato a {cat.nombre}</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 3: ESTADO OPERATIVO */}
                  {adminTab === 'horario' && (
                    <div className="animate__animated animate__fadeIn" style={{maxWidth: '600px', margin: '0 auto'}}>
                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <h4 style={{fontWeight: 800, color: '#120B06'}}>Apertura y Cierre</h4>
                        <button className="erp-btn erp-btn-success" onClick={guardarAdminEstado}><i className="fas fa-save"></i> GUARDAR ESTADO</button>
                      </div>

                      <div style={{background: '#FFF', padding: '2rem', borderRadius: '12px', border: '1px solid #E5E0D8', textAlign: 'center'}}>
                         <h5 style={{fontWeight: 800, color: '#2D241E', marginBottom: '1.5rem'}}>¿Atendemos Hoy?</h5>
                         <div className="d-flex gap-3 justify-content-center mb-4">
                            <button 
                               className={`erp-btn ${adminData.estado.cierreForzado !== obtenerFechaActualLocal() ? 'erp-btn-success' : 'erp-btn-outline'}`}
                               style={{flex: 1, padding: '1.5rem'}}
                               onClick={() => setAdminData(p => ({...p, estado: {...p.estado, cierreForzado: ''}}))}
                            >
                               <i className="fas fa-door-open fa-2x mb-2 d-block"></i> ABIERTO
                            </button>
                            <button 
                               className={`erp-btn ${adminData.estado.cierreForzado === obtenerFechaActualLocal() ? 'erp-btn-primary' : 'erp-btn-outline'}`}
                               style={{flex: 1, padding: '1.5rem', background: adminData.estado.cierreForzado === obtenerFechaActualLocal() ? '#D7263D' : '#FFF', color: adminData.estado.cierreForzado === obtenerFechaActualLocal() ? '#FFF' : '#120B06'}}
                               onClick={() => setAdminData(p => ({...p, estado: {...p.estado, cierreForzado: obtenerFechaActualLocal()}}))}
                            >
                               <i className="fas fa-door-closed fa-2x mb-2 d-block"></i> CERRADO HOY
                            </button>
                         </div>
                         <p style={{fontSize: '0.8rem', color: '#8A7060'}}>* Si marcas "Cerrado", el sistema se reiniciará automáticamente a "Abierto" mañana.</p>
                         
                         <div className="row mt-4 pt-4 border-top text-start">
                           <div className="col-6">
                              <label className="erp-label">Hora Apertura (24h)</label>
                              <input type="number" className="erp-input" min="0" max="23" value={adminData.estado.apertura} onChange={e => setAdminData(p => ({...p, estado: {...p.estado, apertura: parseInt(e.target.value) || 0}}))} />
                           </div>
                           <div className="col-6">
                              <label className="erp-label">Hora Cierre (24h)</label>
                              <input type="number" className="erp-input" min="0" max="23" value={adminData.estado.cierre} onChange={e => setAdminData(p => ({...p, estado: {...p.estado, cierre: parseInt(e.target.value) || 0}}))} />
                           </div>
                         </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: KARDEX / ALMACÉN V2 CRUD */}
                  {adminTab === 'inventario' && (
                    <div className="animate__animated animate__fadeIn">
                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <h4 style={{fontWeight: 800, color: '#120B06'}}>Gestión de Almacén</h4>
                      </div>

                      <div className="row g-4">
                        <div className="col-md-4">
                          {/* PANEL CRUD INSUMOS */}
                          <div style={{background: '#FFF', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E0D8', marginBottom: '1.5rem'}}>
                             <h5 style={{fontWeight: 800, color: '#D4A843', marginBottom: '1rem'}}><i className="fas fa-tags"></i> {insumoEditando ? 'Editar Insumo' : 'Crear Insumo'}</h5>
                             <form onSubmit={guardarNuevoInsumo}>
                               <div className="mb-3">
                                 <label className="erp-label">Nombre del Insumo</label>
                                 <input type="text" className="erp-input" value={nuevoInsumoForm.nombre} onChange={e => setNuevoInsumoForm({...nuevoInsumoForm, nombre: e.target.value})} placeholder="Ej. Filete de Caballa" required />
                               </div>
                                <div className="mb-3">
                                 <label className="erp-label">Unidad de Medida</label>
                                 <select className="erp-input" value={nuevoInsumoForm.unidad_medida} onChange={e => setNuevoInsumoForm({...nuevoInsumoForm, unidad_medida: e.target.value})}>
                                    <option value="g">Gramos (g)</option>
                                    <option value="und">Unidades (und)</option>
                                    <option value="kg">Kilos (Kg)</option>
                                 </select>
                               </div>
                               <div className="d-flex gap-2">
                                  <button type="submit" className="erp-btn" style={{flex: 1, background: '#D4A843', color: '#120B06'}}>{insumoEditando ? 'Guardar Cambios' : 'Registrar Insumo'}</button>
                                  {insumoEditando && <button type="button" className="erp-btn erp-btn-outline" onClick={() => {setInsumoEditando(null); setNuevoInsumoForm({nombre:'', unidad_medida:'g'});}}>Cancelar</button>}
                               </div>
                             </form>
                          </div>

                          {/* PANEL AGREGAR STOCK */}
                          <div style={{background: '#FFF', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E0D8'}}>
                             <h5 style={{fontWeight: 800, color: '#006989', marginBottom: '1rem'}}><i className="fas fa-boxes"></i> Ingresar / Retirar Stock</h5>
                             <form onSubmit={guardarMovimientoInv}>
                               <div className="mb-3">
                                 <label className="erp-label">Producto / Insumo</label>
                                 <input 
                                   type="text" 
                                   list="lista-insumos-kardex" 
                                   className="erp-input" 
                                   placeholder="Escribe para buscar..." 
                                   value={busquedaKardex}
                                   onChange={e => {
                                      setBusquedaKardex(e.target.value);
                                      const encontrado = inventario.find(i => i.nombre === e.target.value);
                                      setMovimientoData({...movimientoData, insumo_id: encontrado ? encontrado.id : ''});
                                   }}
                                   required 
                                 />
                                 <datalist id="lista-insumos-kardex">
                                    {inventario.map(inv => <option key={inv.id} value={inv.nombre}>{inv.nombre} ({inv.unidad_medida})</option>)}
                                 </datalist>
                               </div>
                               <div className="row mb-3">
                                 <div className="col-6">
                                   <select className="erp-input" style={{fontWeight: 800, color: movimientoData.tipo === 'INGRESO' ? '#10B981' : '#D7263D'}} value={movimientoData.tipo} onChange={e => setMovimientoData({...movimientoData, tipo: e.target.value})}>
                                      <option value="INGRESO">INGRESO (+)</option>
                                      <option value="MERMA">MERMA (-)</option>
                                   </select>
                                 </div>
                                 <div className="col-6">
                                   <input type="number" step="0.1" className="erp-input" placeholder="Cantidad" value={movimientoData.cantidad} onChange={e => setMovimientoData({...movimientoData, cantidad: e.target.value})} required />
                                 </div>
                               </div>
                               <div className="mb-3">
                                 <input type="text" className="erp-input" placeholder="Referencia / Motivo" value={movimientoData.referencia} onChange={e => setMovimientoData({...movimientoData, referencia: e.target.value})} />
                               </div>
                               <button type="submit" className="erp-btn" style={{width: '100%', background: '#006989', color: '#FFF'}}>Afectar Kardex</button>
                             </form>
                          </div>
                        </div>

                        <div className="col-md-8">
                          <div style={{background: '#FFF', borderRadius: '12px', border: '1px solid #E5E0D8', overflow: 'hidden'}}>
                             <table className="pos-table" style={{marginBottom: 0}}>
                               <thead>
                                 <tr>
                                   <th>Insumo Mapeado</th>
                                   <th style={{textAlign: 'right'}}>Stock Físico (Kardex)</th>
                                   <th style={{textAlign: 'center'}}>Acciones</th>
                                 </tr>
                               </thead>
                               <tbody>
                                 {inventario.map(inv => (
                                   <tr key={inv.id} style={{ opacity: inv.estado === 1 ? 1 : 0.5, background: inv.estado === 1 ? 'transparent' : '#F8F9FA' }}>
                                     <td style={{fontWeight: 700, color: '#120B06'}}>
                                        {inv.nombre} {inv.estado === 0 && <span className="badge bg-secondary ms-2">INACTIVO</span>}
                                     </td>
                                     <td style={{textAlign: 'right', fontWeight: 800, color: inv.stock_actual <= 3 ? '#D7263D' : '#10B981', fontSize: '1.2rem'}}>
                                       {inv.stock_actual} <span style={{fontSize: '0.8rem', color: '#8A7060'}}>{inv.unidad_medida}</span>
                                     </td>
                                     <td style={{textAlign: 'center'}}>
                                        {inv.estado === 1 ? (
                                            <div className="d-flex gap-2 justify-content-center">
                                                <button type="button" className="erp-btn" style={{width: '40px', height: '40px', padding: 0, background: '#D4A843', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center'}} onClick={() => { setInsumoEditando(inv); setNuevoInsumoForm({nombre: inv.nombre, unidad_medida: inv.unidad_medida}); }}>
                                                    <PencilLine size={18} color="#120B06"/>
                                                </button>
                                                <button type="button" className="erp-delete-btn" style={{width: '40px', height: '40px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center'}} onClick={() => deshabilitarInsumo(inv.id)}>
                                                    <Trash2 size={18} color="#120B06"/>
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" className="erp-btn erp-btn-success" style={{padding: '6px 12px', fontSize: '0.75rem'}} onClick={() => habilitarInsumo(inv.id)}>
                                                Reactivar
                                            </button>
                                        )}
                                     </td>
                                   </tr>
                                 ))}
                                 {inventario.length === 0 && <tr><td colSpan="3" style={{textAlign: 'center', padding: '2rem'}}>No hay insumos registrados.</td></tr>}
                               </tbody>
                             </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

               </div>
            </div>
          </div>
        </div>
      </div>
    );
}