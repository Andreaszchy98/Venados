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
  collection,
  getDocs,
} from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import { UserProfile, UserRole } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';

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
    const currentRole: UserRole = data.role || 'aficionado';
    const venueId = data.venueId || undefined;
    const venueName = data.venueName || undefined;

    return {
      uid: fbUser.uid,
      email: data.email || fbUser.email,
      displayName: data.displayName || fbUser.displayName || 'Aficionado Venados',
      role: currentRole,
      photoURL: data.photoURL || fbUser.photoURL,
      phoneNumber: data.phoneNumber || fbUser.phoneNumber,
      venueId,
      venueName,
      standId: data.standId,
      standName: data.standName,
      assignedZone: data.assignedZone,
      runnerStatus: data.runnerStatus,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt,
    };
  } else {
    // Crear nuevo perfil en Firestore
    const newProfile: UserProfile = {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Aficionado Venados'),
      role: initialRole,
      photoURL: fbUser.photoURL || null,
      phoneNumber: fbUser.phoneNumber || null,
      createdAt: new Date().toISOString(),
    };

    await setDoc(userDocRef, sanitizeFirestoreData(newProfile));
    return newProfile;
  }
}

/**
 * Obtener lista de todos los usuarios registrados (Para Administración de Personal)
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => ({
      uid: d.id,
      ...d.data(),
    })) as UserProfile[];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
    return [];
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
 * Actualizar rol y asignaciones de un usuario (Admin declara roles, puestos o runners)
 */
export async function updateUserRoleAndDetails(
  uid: string,
  updates: {
    role: UserRole;
    standId?: string;
    standName?: string;
    assignedZone?: string;
    runnerStatus?: 'disponible' | 'en_entrega' | 'inactivo';
  }
): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const payload: any = {
      role: updates.role,
      updatedAt: new Date().toISOString(),
    };

    if (updates.role === 'concesionario') {
      payload.standId = updates.standId || null;
      payload.standName = updates.standName || null;
      payload.assignedZone = null;
      payload.runnerStatus = null;
    } else if (updates.role === 'runner') {
      payload.assignedZone = updates.assignedZone || 'Zona Central & Palcos';
      payload.runnerStatus = updates.runnerStatus || 'disponible';
      payload.standId = null;
      payload.standName = null;
    } else {
      payload.standId = null;
      payload.standName = null;
      payload.assignedZone = null;
      payload.runnerStatus = null;
    }

    await updateDoc(userDocRef, sanitizeFirestoreData(payload));

    // Si es concesionario y tiene standId, vincular también en el puesto
    if (updates.role === 'concesionario' && updates.standId) {
      try {
        const standRef = doc(db, 'stands', updates.standId);
        const userDoc = await getDoc(userDocRef);
        const userName = userDoc.data()?.displayName || userDoc.data()?.email || 'Concesionario';
        await updateDoc(standRef, {
          ownerId: uid,
          ownerName: userName,
        });
      } catch (standErr) {
        console.warn('No se pudo vincular ownerId en stands:', standErr);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

/**
 * Actualizar rol simple de usuario
 */
export async function updateUserRole(
  uid: string,
  newRole: UserRole,
  venueId?: string,
  venueName?: string
): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  const updates: any = {
    role: newRole,
    roleSelectedByUser: true,
    updatedAt: new Date().toISOString(),
  };

  if ((newRole === 'admin' || newRole === 'superadmin') && !venueId) {
    updates.venueId = 'venue-teodoro-mariscal';
    updates.venueName = 'Estadio Teodoro Mariscal';
  } else if (venueId) {
    updates.venueId = venueId;
    updates.venueName = venueName || 'Estadio Teodoro Mariscal';
  }

  await updateDoc(userDocRef, updates);
}

/**
 * Asignar rol de Administrador a un usuario junto con su sede (Exclusivo Superadmin)
 */
export async function assignAdminRole(
  uid: string,
  venueId: string,
  venueName: string
): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      role: 'admin',
      venueId,
      venueName,
      standId: null,
      standName: null,
      assignedZone: null,
      runnerStatus: null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    throw err;
  }
}

/**
 * Revocar rol de Administrador (Exclusivo Superadmin)
 */
export async function revokeAdminRole(uid: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      role: 'aficionado',
      venueId: null,
      venueName: null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    throw err;
  }
}

/**
 * Actualizar estado en vivo de runner (disponible / en_entrega / inactivo)
 */
export async function updateRunnerStatus(
  uid: string,
  runnerStatus: 'disponible' | 'en_entrega' | 'inactivo'
): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      runnerStatus,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

/**
 * Cerrar sesión
 */
export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}
