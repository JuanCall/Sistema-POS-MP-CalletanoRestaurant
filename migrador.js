const admin = require('firebase-admin');
const serviceAccount = require("./serviceAccountKey.json");

// Inicializamos Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

// Funciones de formateo (Paddings)
const pad4 = (num) => String(num).padStart(4, '0');
const pad5 = (num) => String(num).padStart(5, '0');
const pad6 = (num) => String(num).padStart(6, '0');

// Función auxiliar para extraer el número de ID viejo de forma segura
const extraerIdNumero = (oldId, fallbackContador) => {
    let num = NaN;
    if (oldId.includes('-')) {
        num = parseInt(oldId.split('-')[1], 10); // Ej: Extrae '15' de 'TKT-15-20260515'
    } else {
        num = parseInt(oldId, 10); // Ej: Extrae '15' de '15'
    }
    return isNaN(num) ? fallbackContador : num;
};

async function migrarInsumos() {
    console.log("\n📦 1. Migrando Insumos...");
    const snapshot = await firestore.collection('insumos').get();
    let modificados = 0;
    let contadorFallback = 1;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const oldId = doc.id;
        
        const idNum = extraerIdNumero(oldId, contadorFallback);
        const nuevoId = `INS-${pad4(idNum)}`; 

        if (oldId !== nuevoId) {
            console.log(`   🔄 Cambiando: ${oldId} ➔ ${nuevoId}`);
            await firestore.collection('insumos').doc(nuevoId).set(data);
            await firestore.collection('insumos').doc(oldId).delete();
            modificados++;
        }
        contadorFallback++;
    }
    console.log(`✅ Insumos actualizados: ${modificados}`);
}

async function migrarVentas() {
    console.log("\n🧾 2. Migrando Ventas Históricas...");
    const snapshot = await firestore.collection('ventas_historicas').orderBy('fecha', 'asc').get();
    let modificados = 0;
    let contadorFallback = 1;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const oldId = doc.id;
        
        // Formateo estricto de fecha AAAAMMDD
        let fechaStr = "00000000";
        if (data.fecha) {
            const jsDate = typeof data.fecha.toDate === 'function' ? data.fecha.toDate() : new Date(data.fecha);
            const year = jsDate.getFullYear();
            const month = String(jsDate.getMonth() + 1).padStart(2, '0');
            const day = String(jsDate.getDate()).padStart(2, '0');
            fechaStr = `${year}${month}${day}`;
        }

        const idNum = extraerIdNumero(oldId, contadorFallback);
        const nuevoId = `TKT-${pad6(idNum)}-${fechaStr}`; 

        if (oldId !== nuevoId) {
            console.log(`   🔄 Cambiando: ${oldId} ➔ ${nuevoId}`);
            await firestore.collection('ventas_historicas').doc(nuevoId).set(data);
            await firestore.collection('ventas_historicas').doc(oldId).delete();
            modificados++;
        }
        contadorFallback++;
    }
    console.log(`✅ Ventas actualizadas: ${modificados}`);
}

async function migrarGastos() {
    console.log("\n💸 3. Migrando Gastos...");
    const snapshot = await firestore.collection('gastos').orderBy('fecha', 'asc').get();
    let modificados = 0;
    let contadorFallback = 1;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const oldId = doc.id;
        
        let fechaStr = "00000000";
        if (data.fecha) {
            const jsDate = typeof data.fecha.toDate === 'function' ? data.fecha.toDate() : new Date(data.fecha);
            const year = jsDate.getFullYear();
            const month = String(jsDate.getMonth() + 1).padStart(2, '0');
            const day = String(jsDate.getDate()).padStart(2, '0');
            fechaStr = `${year}${month}${day}`;
        }

        const idNum = extraerIdNumero(oldId, contadorFallback);
        const nuevoId = `GAS-${pad5(idNum)}-${fechaStr}`; 

        if (oldId !== nuevoId) {
            console.log(`   🔄 Cambiando: ${oldId} ➔ ${nuevoId}`);
            await firestore.collection('gastos').doc(nuevoId).set(data);
            await firestore.collection('gastos').doc(oldId).delete();
            modificados++;
        }
        contadorFallback++;
    }
    console.log(`✅ Gastos actualizados: ${modificados}`);
}

async function ejecutarMigracionGlobal() {
    try {
        await migrarInsumos();
        await migrarVentas();
        await migrarGastos();
        console.log("\n🎉 ¡Mantenimiento Global de Base de Datos completado exitosamente!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Ocurrió un error crítico durante la migración:", error);
        process.exit(1);
    }
}

ejecutarMigracionGlobal();