import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import { UserProfile, UserRole } from '../types';

/**
 * Mapeo de errores de Firebase Auth a mensajes amigables en español
 */
export function getFriendlyAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de autenticación antes de completar el inicio de sesión.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana emergente de inicio de sesión. Por favor permite las ventanas emergentes.';
    case 'auth/network-request-failed':
      return 'Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo.';
    case 'auth/invalid-email':
      return 'El correo electrónico ingresado no tiene un formato válido.';
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido inhabilitada por un administrador.';
    case 'auth/user-not-found':
      return 'No existe una cuenta registrada con este correo.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Correo o contraseña incorrectos. Verifica tus credenciales.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con este correo electrónico.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Inténtalo más tarde.';
    case 'auth/operation-not-allowed':
      return 'Este método de autenticación no está habilitado actualmente.';
    default:
      return 'Ocurrió un error inesperado al autenticar. Inténtalo de nuevo.';
  }
}

/**
 * Obtiene o crea el perfil de usuario en Firestore
 */
export async function syncUserProfile(
  fbUser: FirebaseUser,
  initialRole: UserRole = 'aficionado'
): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', fbUser.uid);
  const userSnapshot = await getDoc(userDocRef);

  if (userSnapshot.exists()) {
    const data = userSnapshot.data();
    return {
      uid: fbUser.uid,
      email: data.email || fbUser.email,
      displayName: data.displayName || fbUser.displayName || 'Aficionado Venados',
      role: data.role || 'aficionado',
      photoURL: data.photoURL || fbUser.photoURL,
      phoneNumber: data.phoneNumber || fbUser.phoneNumber,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt,
    };
  } else {
    // Si no existe, crear documento inicial en Firestore
    const newProfile: UserProfile = {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Aficionado Venados'),
      role: initialRole,
      photoURL: fbUser.photoURL || null,
      phoneNumber: fbUser.phoneNumber || null,
      createdAt: new Date().toISOString(),
    };

    await setDoc(userDocRef, newProfile);
    return newProfile;
  }
}

/**
 * Iniciar sesión con Google
 */
export async function signInWithGoogle(): Promise<UserProfile> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return await syncUserProfile(result.user);
  } catch (error: any) {
    const message = getFriendlyAuthErrorMessage(error?.code || '');
    throw new Error(message);
  }
}

/**
 * Iniciar sesión con Correo y Contraseña
 */
export async function signInWithEmail(email: string, pass: string): Promise<UserProfile> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return await syncUserProfile(result.user);
  } catch (error: any) {
    const message = getFriendlyAuthErrorMessage(error?.code || '');
    throw new Error(message);
  }
}

/**
 * Registro de nueva cuenta con Correo y Contraseña
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  displayName: string,
  role: UserRole = 'aficionado'
): Promise<UserProfile> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return await syncUserProfile(result.user, role);
  } catch (error: any) {
    const message = getFriendlyAuthErrorMessage(error?.code || '');
    throw new Error(message);
  }
}

/**
 * Actualizar rol de usuario (útil para pruebas y administración)
 */
export async function updateUserRole(uid: string, newRole: UserRole): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    role: newRole,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Cerrar sesión
 */
export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}
