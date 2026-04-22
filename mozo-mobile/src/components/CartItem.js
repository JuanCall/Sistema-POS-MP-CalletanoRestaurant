import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';

export default function CartItem({ item, onEliminar }) {
  const [nota, setNota] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.filaPrincipal}>
        <Text style={styles.nombre}>{item.nombre}</Text>
        <Text style={styles.precio}>S/ {item.precio.toFixed(2)}</Text>
      </View>
      
      <View style={styles.filaSecundaria}>
        <TextInput 
          style={styles.inputNota}
          placeholder="Añadir nota (ej: sin ají)..."
          value={nota}
          onChangeText={setNota}
        />
        <TouchableOpacity style={styles.btnEliminar} onPress={() => onEliminar(item.id_temporal)}>
          <Text style={styles.btnEliminarTexto}>X</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  filaPrincipal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nombre: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  precio: {
    fontSize: 16,
    color: '#27ae60',
    fontWeight: 'bold',
  },
  filaSecundaria: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputNota: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    marginRight: 10,
  },
  btnEliminar: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
  },
  btnEliminarTexto: {
    color: 'white',
    fontWeight: 'bold',
  }
});