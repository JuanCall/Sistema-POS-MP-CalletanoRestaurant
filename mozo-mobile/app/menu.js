import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import CartItem from '../src/components/CartItem';
import { socketService } from '../src/services/socket';

export default function MenuScreen() {
  const router = useRouter();
  // Recibimos el número de mesa que nos mandó la pantalla Home
  const { mesa } = useLocalSearchParams(); 

  useEffect(() => {
    // Iniciamos la conexión de Socket.io
    socketService.conectar();

    // Limpiamos la conexión cuando el mozo sale de la pantalla
    return () => {
      // Opcional: socketService.desconectar(); 
      // Dependiendo de si se quiere mantener la conexión viva en toda la app
    };
  }, []);

  const [categoriaActiva, setCategoriaActiva] = useState('Entradas');
  const [carrito, setCarrito] = useState([]);

  const [modalVisible, setModalVisible] = useState(false);

  // Datos simulados (Luego vendrán de PostgreSQL)
  const categorias = ['Entradas', 'Segundos', 'Bebidas', 'Postres'];
  
  const platosSimulados = {
    'Entradas': [
      { id: 1, nombre: 'Ceviche Clásico', precio: 25.00 },
      { id: 2, nombre: 'Papa a la Huancaína', precio: 15.00 },
    ],
    'Segundos': [
      { id: 3, nombre: 'Lomo Saltado', precio: 35.00 },
      { id: 4, nombre: 'Ají de Gallina', precio: 28.00 },
    ],
    'Bebidas': [
      { id: 5, nombre: 'Chicha Morada 1L', precio: 12.00 },
      { id: 6, nombre: 'Inca Kola 1.5L', precio: 10.00 },
    ]
  };

  const agregarAlCarrito = (plato) => {
    // Lógica simple para agregar al pedido
    setCarrito([...carrito, { ...plato, id_temporal: Math.random() }]);
    // Pequeña alerta visual, luego lo cambiaremos por un indicador en el botón inferior
    Alert.alert('Agregado', `${plato.nombre} añadido al pedido.`);
  };

  const eliminarDelCarrito = (id_temporal) => {
    setCarrito(carrito.filter(item => item.id_temporal !== id_temporal));
  };

  const actualizarNota = (id_temporal, nuevaNota) => {
    setCarrito(carrito.map(item => 
      item.id_temporal === id_temporal ? { ...item, notas: nuevaNota } : item
    ));
  };

  const enviarPedido = () => {
    const totalPedido = carrito.reduce((sum, item) => sum + item.precio, 0);
    
    // Intentamos enviar el pedido real por WebSockets
    const enviadoExitosamente = socketService.enviarPedido(mesa, carrito, totalPedido);

    if (enviadoExitosamente) {
      Alert.alert(
        'Pedido Enviado', 
        `La comanda de la Mesa ${mesa} ya está en cocina y caja.`,
        [{ text: 'OK', onPress: () => {
          setCarrito([]);
          setModalVisible(false);
          router.replace('/home'); // Regresamos al mapa de mesas
        }}]
      );
    } else {
      Alert.alert(
        'Error de Conexión', 
        'No se pudo conectar con la Caja. Verifica que la tablet tenga Wi-Fi y el servidor esté encendido.'
      );
    }
  };

  const renderCategoria = ({ item }) => (
    <TouchableOpacity 
      style={[styles.catBoton, categoriaActiva === item && styles.catBotonActivo]}
      onPress={() => setCategoriaActiva(item)}
    >
      <Text style={[styles.catTexto, categoriaActiva === item && styles.textoBlanco]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  const renderPlato = ({ item }) => (
    <TouchableOpacity style={styles.platoCard} onPress={() => agregarAlCarrito(item)}>
      <View style={styles.platoInfo}>
        <Text style={styles.platoNombre}>{item.nombre}</Text>
        <Text style={styles.platoPrecio}>S/ {item.precio.toFixed(2)}</Text>
      </View>
      <View style={styles.btnAgregar}>
        <Text style={styles.btnAgregarTexto}>+</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Cabecera */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => router.back()}>
          <Text style={styles.btnVolverTexto}>{"< Volver"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mesa {mesa}</Text>
      </View>

      {/* Lista de Categorías (Horizontal) */}
      <View style={styles.categoriasContenedor}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categorias}
          renderItem={renderCategoria}
          keyExtractor={(item) => item}
        />
      </View>

      {/* Lista de Platos de la categoría activa */}
      <FlatList
        data={platosSimulados[categoriaActiva] || []}
        renderItem={renderPlato}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.platosContenedor}
      />

      {/* Botón flotante para abrir el Modal */}
      {carrito.length > 0 && (
        <TouchableOpacity style={styles.btnConfirmar} onPress={() => setModalVisible(true)}>
          <Text style={styles.btnConfirmarTexto}>
            Ver Pedido ({carrito.length} items) - S/ {carrito.reduce((sum, item) => sum + item.precio, 0).toFixed(2)}
          </Text>
        </TouchableOpacity>
      )}

      {/* --- MODAL EMERGENTE --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Resumen de Mesa {mesa}</Text>
            
            <FlatList
              data={carrito}
              renderItem={({ item }) => (
                <CartItem 
                  item={item} 
                  onEliminar={eliminarDelCarrito}
                  onActualizarNota={actualizarNota} 
                />
              )}
              keyExtractor={(item) => item.id_temporal.toString()}
              style={styles.modalLista}
            />

            <View style={styles.modalBotones}>
              <TouchableOpacity style={styles.btnCerrarModal} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnCerrarModalTexto}>Seguir Agregando</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.btnEnviarCocina} onPress={enviarPedido}>
                <Text style={styles.btnEnviarCocinaTexto}>Enviar a Cocina</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
  },
  btnVolver: {
    padding: 10,
    marginRight: 15,
  },
  btnVolverTexto: {
    fontSize: 16,
    color: '#c0392b',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  categoriasContenedor: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingLeft: 10,
  },
  catBoton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#ecf0f1',
    marginHorizontal: 5,
  },
  catBotonActivo: {
    backgroundColor: '#2c3e50',
  },
  catTexto: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  textoBlanco: {
    color: 'white',
  },
  platosContenedor: {
    padding: 15,
  },
  platoCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  platoInfo: {
    flex: 1,
  },
  platoNombre: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34495e',
  },
  platoPrecio: {
    fontSize: 16,
    color: '#27ae60',
    marginTop: 5,
    fontWeight: '600',
  },
  btnAgregar: {
    backgroundColor: '#e74c3c',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAgregarTexto: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: -2,
  },
  btnConfirmar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#2ecc71',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 5,
  },
  btnConfirmarTexto: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '80%', // Ocupa el 80% de la pantalla para parecer un panel deslizable
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
    textAlign: 'center',
  },
  modalLista: {
    marginBottom: 20,
  },
  modalBotones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btnCerrarModal: {
    flex: 1,
    backgroundColor: '#95a5a6',
    padding: 15,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  btnCerrarModalTexto: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnEnviarCocina: {
    flex: 1,
    backgroundColor: '#c0392b',
    padding: 15,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  btnEnviarCocinaTexto: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
});