import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  increment,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { SponsorAd, AdType } from '../types';
import { DEFAULT_VENUE_ID } from './defaultVenue';
import { normalizeGoogleDriveImageUrl } from './imageUtils';

/**
 * Escuchar en tiempo real los anuncios de una sede específica o de todas las sedes
 */
export function subscribeSponsorAds(
  venueId: string | undefined,
  onUpdate: (ads: SponsorAd[]) => void,
  onError?: (err: Error) => void
) {
  const adsCol = collection(db, 'sponsorAds');

  return onSnapshot(
    adsCol,
    (snapshot) => {
      const allAds: SponsorAd[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SponsorAd, 'id'>),
      }));

      const targetVenueId = venueId || DEFAULT_VENUE_ID;
      const filtered = (venueId && venueId !== 'all')
        ? allAds.filter((ad) => !ad.venueId || ad.venueId === targetVenueId || ad.venueId === 'all')
        : allAds;

      // Ordenar por fecha de creación descendente
      filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      onUpdate(filtered);
    },
    (error) => {
      console.error('Error al escuchar anuncios de patrocinadores:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Obtener todos los anuncios de una sede
 */
export async function getAllSponsorAds(venueId?: string): Promise<SponsorAd[]> {
  try {
    const adsCol = collection(db, 'sponsorAds');
    const snap = await getDocs(adsCol);
    const allAds: SponsorAd[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<SponsorAd, 'id'>),
    }));

    const targetVenueId = venueId || DEFAULT_VENUE_ID;
    const filtered = (venueId && venueId !== 'all')
      ? allAds.filter((ad) => !ad.venueId || ad.venueId === targetVenueId || ad.venueId === 'all')
      : allAds;

    filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return filtered;
  } catch (error) {
    console.error('Error obteniendo anuncios de patrocinadores:', error);
    return [];
  }
}

/**
 * Obtener anuncios activos y vigentes para mostrar a aficionados
 */
export async function getActiveSponsorAds(venueId: string, type?: AdType): Promise<SponsorAd[]> {
  try {
    const all = await getAllSponsorAds(venueId);
    const today = new Date().toISOString().split('T')[0];

    return all.filter((ad) => {
      if (!ad.active) return false;
      if (type && ad.type !== type) return false;
      if (ad.startDate && ad.startDate > today) return false;
      if (ad.endDate && ad.endDate < today) return false;
      return true;
    });
  } catch (error) {
    console.error('Error al obtener anuncios activos:', error);
    return [];
  }
}

const DEFAULT_AD_IMAGES: Record<AdType, string> = {
  hero: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1200&auto=format&fit=crop&q=80',
  inline: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80',
  popup: 'https://images.unsplash.com/photo-1516245834210-c4c142787335?w=1200&auto=format&fit=crop&q=80',
};

/**
 * Crear un nuevo anuncio publicitario
 */
export async function createSponsorAd(
  adData: Omit<SponsorAd, 'id' | 'createdAt' | 'updatedAt' | 'impressions' | 'clicks'>
): Promise<string> {
  const now = new Date().toISOString();
  const adType: AdType = adData.type || 'hero';
  const rawImageUrl = (adData.imageUrl && adData.imageUrl.trim()) || DEFAULT_AD_IMAGES[adType];
  const finalImageUrl = normalizeGoogleDriveImageUrl(rawImageUrl);

  const newAd = {
    venueId: adData.venueId || DEFAULT_VENUE_ID,
    sponsorName: (adData.sponsorName || 'Patrocinador Oficial').trim(),
    type: adType,
    imageUrl: finalImageUrl,
    targetUrl: (adData.targetUrl || '').trim(),
    startDate: adData.startDate || now.split('T')[0],
    endDate: adData.endDate || now.split('T')[0],
    active: typeof adData.active === 'boolean' ? adData.active : true,
    impressions: 0,
    clicks: 0,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, 'sponsorAds'), newAd);
  return docRef.id;
}

/**
 * Actualizar anuncio existente
 */
export async function updateSponsorAd(id: string, updates: Partial<SponsorAd>): Promise<void> {
  const adRef = doc(db, 'sponsorAds', id);
  const cleanUpdates: any = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.sponsorName !== undefined) cleanUpdates.sponsorName = updates.sponsorName.trim();
  if (updates.type !== undefined) cleanUpdates.type = updates.type;
  if (updates.imageUrl !== undefined) cleanUpdates.imageUrl = normalizeGoogleDriveImageUrl(updates.imageUrl.trim());
  if (updates.targetUrl !== undefined) cleanUpdates.targetUrl = updates.targetUrl.trim();
  if (updates.startDate !== undefined) cleanUpdates.startDate = updates.startDate;
  if (updates.endDate !== undefined) cleanUpdates.endDate = updates.endDate;
  if (updates.active !== undefined) cleanUpdates.active = updates.active;
  if (updates.venueId !== undefined) cleanUpdates.venueId = updates.venueId;

  await updateDoc(adRef, cleanUpdates);
}

/**
 * Eliminar anuncio
 */
export async function deleteSponsorAd(id: string): Promise<void> {
  const adRef = doc(db, 'sponsorAds', id);
  await deleteDoc(adRef);
}

/**
 * Incrementar conteo de impresiones en tiempo real
 */
export async function trackAdImpression(adId: string): Promise<void> {
  try {
    const adRef = doc(db, 'sponsorAds', adId);
    await updateDoc(adRef, {
      impressions: increment(1),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Error registrando impresión de anuncio:', err);
  }
}

/**
 * Incrementar conteo de clics en tiempo real
 */
export async function trackAdClick(adId: string): Promise<void> {
  try {
    const adRef = doc(db, 'sponsorAds', adId);
    await updateDoc(adRef, {
      clicks: increment(1),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Error registrando clic de anuncio:', err);
  }
}
