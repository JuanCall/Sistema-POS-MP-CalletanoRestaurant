import { useState } from 'react';
import { InventarioService } from '../services/api';

export default function useInventario(mostrarAlert) {
  const [inventario, setInventario] = useState([]);
  const [movimientoData, setMovimientoData] = useState({ insumo_id: '', tipo: 'INGRESO', cantidad: '', referencia: '' });
  const [insumoEditando, setInsumoEditando] = useState(null);
  const [nuevoInsumoForm, setNuevoInsumoForm] = useState({ nombre: '', unidad_medida: 'g' });
  const [busquedaKardex, setBusquedaKardex] = useState('');

  const cargarInventario = async () => {
    try {
      const res = await InventarioService.getInsumos();
      setInventario(res.data);
    } catch(e) { console.error("Error al cargar inventario"); }
  };

  const guardarMovimientoInv = async (e) => {
    e.preventDefault();
    if (!movimientoData.insumo_id || !movimientoData.cantidad) return mostrarAlert('Aviso', 'Selecciona un insumo y digita la cantidad.', 'danger');
    try {
      await InventarioService.registrarMovimiento(movimientoData);
      mostrarAlert('Éxito', 'Movimiento registrado en Kardex.', 'success');
      setMovimientoData({ insumo_id: '', tipo: 'INGRESO', cantidad: '', referencia: '' });
      setBusquedaKardex('');
      cargarInventario();
    } catch(e) { mostrarAlert('Error', 'Fallo al guardar movimiento', 'danger'); }
  };

  const guardarNuevoInsumo = async (e) => {
    e.preventDefault();
    try {
      if (insumoEditando) await InventarioService.editarInsumo(insumoEditando.id, nuevoInsumoForm);
      else await InventarioService.crearInsumo(nuevoInsumoForm);
      setNuevoInsumoForm({ nombre: '', unidad_medida: 'g' });
      setInsumoEditando(null);
      cargarInventario();
    } catch(e) { mostrarAlert('Error', 'No se pudo guardar el insumo', 'danger'); }
  };

  const deshabilitarInsumo = async (id) => {
      try { await InventarioService.deshabilitarInsumo(id); cargarInventario(); }
      catch(e) { mostrarAlert('Error', 'No se pudo deshabilitar', 'danger'); }
  };

  const habilitarInsumo = async (id) => {
      try { await InventarioService.habilitarInsumo(id); cargarInventario(); }
      catch(e) { mostrarAlert('Error', 'No se pudo habilitar', 'danger'); }
  };

  return {
    inventario, movimientoData, setMovimientoData,
    insumoEditando, setInsumoEditando, nuevoInsumoForm, setNuevoInsumoForm,
    busquedaKardex, setBusquedaKardex,
    cargarInventario, guardarMovimientoInv, guardarNuevoInsumo,
    deshabilitarInsumo, habilitarInsumo
  };
}