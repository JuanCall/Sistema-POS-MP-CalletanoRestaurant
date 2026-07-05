import axios from 'axios';

// Instancia base de Axios
// 🟢 FIX: En Electron empaquetado (file://), hostname es vacío → usar localhost
const hostname = window.location.hostname;
const baseURL = (!hostname || hostname === 'localhost')
    ? 'http://localhost:3001/api' 
    : `http://${hostname}:3001/api`;

const api = axios.create({
    baseURL,
    timeout: 5000,
});

// En el caso de tu app en red local, puedes cambiar la IP dinámicamente si es necesario
export const setApiBaseUrl = (ipServidor) => {
    api.defaults.baseURL = `http://${ipServidor}:3001/api`;
};

export const MenuService = {
    getMesas: () => api.get('/mesas'),
    getCarta: () => api.get('/carta'),
    getRecetaPlato: (id) => api.get(`/platos/${id}/receta`),
    agregarInsumoReceta: (id, data) => api.post(`/platos/${id}/receta`, data),
    eliminarInsumoReceta: (idReceta) => api.delete(`/recetas/${idReceta}`),
};

export const POSService = {
    crearPedido: (data) => api.post('/pedidos', data),
    actualizarPedidoMesa: (mesaId, data) => api.put(`/mesas/${mesaId}/pedido`, data),
    moverMesa: (data) => api.post('/mesas/mover', data),
    cobrarMesa: (data) => api.post('/cobrar', data),
};

export const InventarioService = {
    getInsumos: () => api.get('/inventario'),
    crearInsumo: (data) => api.post('/inventario/insumo', data),
    editarInsumo: (id, data) => api.put(`/inventario/insumo/${id}`, data),
    deshabilitarInsumo: (id) => api.delete(`/inventario/insumo/${id}`),
    habilitarInsumo: (id) => api.put(`/inventario/insumo/${id}/habilitar`),
    registrarMovimiento: (data) => api.post('/inventario/movimiento', data),
};

export const FinanzasService = {
    getVentas: (fecha) => api.get(`/ventas?fecha=${fecha}`),
    anularVenta: (id) => api.delete(`/ventas/${id}`),
    getGastos: (fecha) => api.get(`/gastos?fecha=${fecha}`),
    crearGasto: (data) => api.post('/gastos', data),
    eliminarGasto: (id) => api.delete(`/gastos/${id}`),
};

export const ReportesService = {
    getArqueo: (fecha) => api.get(`/reporte-diario?fecha=${fecha}`),
    getDashboard: (mes) => api.get(`/dashboard?mes=${mes}`),
    pedirConsejoIADiario: (data) => api.post('/ia/resumen', data),
    pedirConsejoIAMensual: (data) => api.post('/ia/mensual', data),
};

export const AdminService = {
    getDataCruda: () => api.get('/admin/data-cruda'),
    guardarMenu: (data) => api.post('/admin/menu', data),
    guardarCarta: (data) => api.post('/admin/carta', data),
    guardarEstado: (data) => api.post('/admin/estado', data),
};

export const SistemaService = {
    login: (data) => api.post('/login', data),
    getModoDomingo: () => api.get('/modo-domingo'),
    initSync: () => api.get('/init-sync'),
    abrirComprobantes: () => api.get('/abrir-comprobantes'),
    getImpresoras: () => api.get('/impresoras'),
    getConfig: () => api.get('/config'),
    setConfig: (data) => api.post('/config', data),
};

export default api;