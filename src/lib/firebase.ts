import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const databaseId = firebaseConfigData.firestoreDatabaseId || undefined;

// Inicializar Firestore con experimentalForceLongPolling para máxima estabilidad en contenedores y redes restringidas
let firestoreDb;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    databaseId
  );
} catch {
  firestoreDb = getFirestore(app, databaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Verificación silenciosa y no bloqueante de conexión para permitir fallback offline
async function checkFirestoreConnection() {
  try {
    const testDocRef = doc(db, 'test', 'connection');
    await getDocFromServer(testDocRef);
  } catch (err: any) {
    // Si falla temporalmente por latencia inicial, Firestore opera de forma transparente en modo offline/caché
    if (err?.code === 'unavailable' || err?.message?.includes('offline')) {
      // Manejado silenciosamente, la aplicación tiene fallbacks offline completos
    }
  }
}

if (typeof window !== 'undefined') {
  // Ejecutar verificación retardada para no saturar el inicio de la app
  setTimeout(() => {
    checkFirestoreConnection().catch(() => {});
  }, 2000);
}

export default app;

