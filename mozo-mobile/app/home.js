import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router'; // El "volante" para cambiar de pantalla

export default function HomeScreen() {
  const router = useRouter();

  // Datos simulados (En el Sprint 3 esto vendrá de tu base de datos PostgreSQL)
  const mesas = [
    { id: 1, numero: 1, estado: 'LIBRE' },
    { id: 2, numero: 2, estado: 'OCUPADA' },
    { id: 3, numero: 3, estado: 'LIBRE' },
    { id: 4, numero: 4, estado: 'LIBRE' },
    { id: 5, numero: 5, estado: 'OCUPADA' },
    { id: 6, numero: 6, estado: 'LIBRE' },
  ];

  const renderMesa = ({ item }) => {
    const isOcupada = item.estado === 'OCUPADA';
    
    return (
      <TouchableOpacity 
        style={[styles.mesaCard, isOcupada ? styles.mesaOcupada : styles.mesaLibre]}
        onPress={() => {
          // Navegamos a la pantalla 'menu' y le pasamos el número de mesa como parámetro
          router.push({ pathname: '/menu', params: { mesa: item.numero } });
        }}
      >
        <Text style={[styles.mesaTexto, isOcupada && styles.textoBlanco]}>
          Mesa {item.numero}
        </Text>
        <Text style={[styles.mesaEstado, isOcupada && styles.textoBlanco]}>
          {item.estado}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Añadimos esta cabecera */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 }}>
        <Text style={styles.title}>Salón Principal</Text>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Text style={{ fontSize: 24 }}>⚙️</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={mesas}
        renderItem={renderMesa}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2} // Muestra 2 mesas por fila
        contentContainerStyle={styles.grid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    paddingTop: 50, // Espacio para la barra de estado del celular
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  grid: {
    paddingHorizontal: 15,
  },
  mesaCard: {
    flex: 1,
    margin: 8,
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3, // Sombra en Android
    shadowColor: '#000', // Sombra en iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mesaLibre: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#2ecc71', // Verde
  },
  mesaOcupada: {
    backgroundColor: '#e74c3c', // Rojo
  },
  mesaTexto: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  mesaEstado: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 5,
  },
  textoBlanco: {
    color: 'white',
  }
});