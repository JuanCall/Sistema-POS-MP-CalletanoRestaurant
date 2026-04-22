import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const router = useRouter();
  const [ipAddress, setIpAddress] = useState('');

  // Al cargar la pantalla, leemos si ya hay una IP guardada
  useEffect(() => {
    const cargarIP = async () => {
      try {
        const ipGuardada = await AsyncStorage.getItem('@server_ip');
        if (ipGuardada) {
          setIpAddress(ipGuardada);
        } else {
          setIpAddress('192.168.1.'); // Plantilla por defecto
        }
      } catch (error) {
        console.error('Error al cargar IP', error);
      }
    };
    cargarIP();
  }, []);

  const guardarIP = async () => {
    try {
      // Guardamos la IP en la memoria del dispositivo
      await AsyncStorage.setItem('@server_ip', ipAddress);
      Alert.alert('Guardado', 'La IP del servidor ha sido actualizada exitosamente.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la configuración.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => router.back()}>
          <Text style={styles.btnVolverTexto}>{"< Volver"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración de Red</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>IP del Servidor (PC de Caja):</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 192.168.1.15"
          keyboardType="numeric"
          value={ipAddress}
          onChangeText={setIpAddress}
        />
        <Text style={styles.hint}>
          Asegúrate de que la tablet y la PC estén en la misma red Wi-Fi.
        </Text>

        <TouchableOpacity style={styles.btnGuardar} onPress={guardarIP}>
          <Text style={styles.btnGuardarTexto}>Guardar IP</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 20,
  },
  btnVolver: { padding: 10, marginRight: 15 },
  btnVolverTexto: { fontSize: 16, color: '#c0392b', fontWeight: 'bold' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#2c3e50' },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
  },
  label: { fontSize: 16, fontWeight: 'bold', color: '#34495e', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 15,
    fontSize: 18,
    backgroundColor: '#f9f9f9',
  },
  hint: { fontSize: 12, color: '#7f8c8d', marginTop: 10, marginBottom: 20 },
  btnGuardar: {
    backgroundColor: '#2ecc71',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnGuardarTexto: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});