import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { AppMediaItem, MediaCategory } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';
import { normalizeGoogleDriveImageUrl } from './imageUtils';
import { DEFAULT_VENUE_ID } from './defaultVenue';

const MEDIA_COLLECTION = 'appMediaRegistry';
const LOCAL_STORAGE_MEDIA_KEY = 'vxp_app_media_defaults';

// Mapa en memoria para resolución sincrónica instantánea de imágenes por defecto
let inMemoryCategoryDefaults: Record<string, string> = {};

// Cargar del almacenamiento local en inicialización rápida para evitar parpadeos
try {
  const cached = localStorage.getItem(LOCAL_STORAGE_MEDIA_KEY);
  if (cached) {
    inMemoryCategoryDefaults = JSON.parse(cached);
  }
} catch {
  // Ignorar en entornos sin localStorage
}

function updateInMemoryDefaults(category: string, url: string) {
  if (!category || !url) return;
  inMemoryCategoryDefaults[category] = url;
  try {
    localStorage.setItem(LOCAL_STORAGE_MEDIA_KEY, JSON.stringify(inMemoryCategoryDefaults));
  } catch {
    // Ignorar
  }
}

/**
  * Obtiene de forma sincrónica la URL de imagen personalizada registrada por el usuario en Firestore.
  * Si el usuario subió una imagen para esta categoría o producto, retorna su URL directa.
  * De lo contrario, retorna el fallback por defecto.
  */
export function getRegisteredDefaultImage(category?: string | null, fallback?: string): string {
  if (!category) return fallback || '';
  const registered = inMemoryCategoryDefaults[category];
  if (registered && typeof registered === 'string' && registered.trim()) {
    return normalizeGoogleDriveImageUrl(registered);
  }
  return fallback || '';
}

/**
  * Obtiene todas las URLs por defecto registradas actualmente en memoria
  */
export function getAllRegisteredDefaults(): Record<string, string> {
  return { ...inMemoryCategoryDefaults };
}

/**
  * Registra o actualiza una imagen/URL en la base de datos de Firestore.
  * Si se marca como isCategoryDefault (o si es la primera de su categoría),
  * se establece automáticamente como la imagen por defecto para esa categoría.
  */
export async function registerUploadedMedia(data: {
  url: string;
  title?: string;
  category?: MediaCategory | string;
  targetVenueId?: string;
  isCategoryDefault?: boolean;
  uploadedBy?: string;
}): Promise<AppMediaItem> {
  const cleanUrl = normalizeGoogleDriveImageUrl(data.url);
  if (!cleanUrl) {
    throw new Error('La URL de la imagen no es válida.');
  }

  const category = (data.category || 'general').trim();
  const title = (data.title || `Imagen ${category}`).trim();
  const venueId = data.targetVenueId || DEFAULT_VENUE_ID;
  const now = new Date().toISOString();
  const user = auth.currentUser;
  const uploadedBy = data.uploadedBy || user?.displayName || user?.email || 'Administrador';

  try {
    // Generar un ID determinista o único
    const docId = `media_${category.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const docRef = doc(db, MEDIA_COLLECTION, docId);

    const mediaItem: AppMediaItem = {
      id: docId,
      url: cleanUrl,
      title,
      category,
      isCategoryDefault: data.isCategoryDefault ?? true,
      targetVenueId: venueId,
      uploadedBy,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(docRef, sanitizeFirestoreData(mediaItem));

    // Si es por defecto de categoría, registrar en el documento canónico de defaults
    if (mediaItem.isCategoryDefault) {
      updateInMemoryDefaults(category, cleanUrl);
      const defaultDocRef = doc(db, MEDIA_COLLECTION, `default_${category.toLowerCase()}`);
      await setDoc(
        defaultDocRef,
        sanitizeFirestoreData({
          id: `default_${category.toLowerCase()}`,
          url: cleanUrl,
          title: `Por defecto - ${category}`,
          category,
          isCategoryDefault: true,
          targetVenueId: venueId,
          uploadedBy,
          updatedAt: now,
          createdAt: now,
        }),
        { merge: true }
      );
    }

    return mediaItem;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, MEDIA_COLLECTION);
    throw err;
  }
}

/**
  * Establece de forma explícita una URL como la predeterminada para una categoría en Firestore.
  */
export async function setDefaultCategoryImage(
  category: string,
  url: string,
  targetVenueId?: string
): Promise<void> {
  const cleanUrl = normalizeGoogleDriveImageUrl(url);
  if (!cleanUrl || !category) return;

  const now = new Date().toISOString();
  const user = auth.currentUser;
  const uploadedBy = user?.displayName || user?.email || 'Administrador';

  updateInMemoryDefaults(category, cleanUrl);

  try {
    const defaultDocRef = doc(db, MEDIA_COLLECTION, `default_${category.toLowerCase().trim()}`);
    await setDoc(
      defaultDocRef,
      sanitizeFirestoreData({
        id: `default_${category.toLowerCase().trim()}`,
        url: cleanUrl,
        title: `Predeterminada para ${category}`,
        category: category.trim(),
        isCategoryDefault: true,
        targetVenueId: targetVenueId || DEFAULT_VENUE_ID,
        uploadedBy,
        updatedAt: now,
        createdAt: now,
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn(`Error al guardar default de categoría ${category} en Firestore:`, err);
  }
}

/**
  * Obtiene todos los medios e imágenes guardados en Firestore
  */
export async function getAllRegisteredMedia(categoryFilter?: string): Promise<AppMediaItem[]> {
  try {
    const q = categoryFilter && categoryFilter !== 'Todos'
      ? query(collection(db, MEDIA_COLLECTION), where('category', '==', categoryFilter), limit(100))
      : query(collection(db, MEDIA_COLLECTION), limit(100));

    const snap = await getDocs(q);
    const items: AppMediaItem[] = [];

    snap.forEach((d) => {
      const data = d.data() as AppMediaItem;
      const normalizedUrl = normalizeGoogleDriveImageUrl(data.url);
      if (normalizedUrl) {
        items.push({
          ...data,
          id: d.id,
          url: normalizedUrl,
        });
        if (data.isCategoryDefault && data.category) {
          updateInMemoryDefaults(data.category, normalizedUrl);
        }
      }
    });

    // Ordenar por fecha descendente
    items.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    return items;
  } catch (err) {
    console.warn('Error al obtener medios registrados de Firestore:', err);
    return [];
  }
}

/**
  * Escucha en tiempo real todos los medios y las imágenes por defecto registradas en Firestore
  */
export function subscribeAppMediaRegistry(
  onUpdate: (media: AppMediaItem[], defaults: Record<string, string>) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, MEDIA_COLLECTION), limit(150));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AppMediaItem[] = [];
      const defaults: Record<string, string> = { ...inMemoryCategoryDefaults };

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as AppMediaItem;
        const normalizedUrl = normalizeGoogleDriveImageUrl(data.url);
        if (normalizedUrl) {
          items.push({
            ...data,
            id: docSnap.id,
            url: normalizedUrl,
          });

          if (data.isCategoryDefault && data.category) {
            defaults[data.category] = normalizedUrl;
            updateInMemoryDefaults(data.category, normalizedUrl);
          }
        }
      });

      items.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
      onUpdate(items, defaults);
    },
    (err) => {
      console.warn('Error escuchando appMediaRegistry en Firestore:', err);
      if (onError) onError(err);
    }
  );
}

/**
  * Elimina una imagen registrada de Firestore
  */
export async function deleteRegisteredMedia(mediaId: string): Promise<void> {
  try {
    const docRef = doc(db, MEDIA_COLLECTION, mediaId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as AppMediaItem;
      if (data.category && inMemoryCategoryDefaults[data.category] === data.url) {
        delete inMemoryCategoryDefaults[data.category];
        try {
          localStorage.setItem(LOCAL_STORAGE_MEDIA_KEY, JSON.stringify(inMemoryCategoryDefaults));
        } catch {
          // Ignorar
        }
      }
    }
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${MEDIA_COLLECTION}/${mediaId}`);
  }
}
