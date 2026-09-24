import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  increment
} from 'firebase/firestore';
import { db } from './firebase';
import { Advertisement } from '../types';

const COLLECTION_NAME = 'advertisements';

export const DEFAULT_FALLBACK_ADVERTISEMENTS: Advertisement[] = [
  {
    id: 'ad-hero-1',
    sponsorName: 'Tecate Oficial',
    type: 'hero',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    targetUrl: 'https://tecate.com',
    active: true,
    priority: 1,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    impressionsCount: 1450,
    clicksCount: 320,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-hero-2',
    sponsorName: 'Chevron Gasolineras',
    type: 'hero',
    imageUrl: 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=1200&q=80',
    targetUrl: 'https://chevronmexico.mx',
    active: true,
    priority: 2,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    impressionsCount: 980,
    clicksCount: 195,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-grid-1',
    sponsorName: 'Mega Soriana',
    type: 'inline_grid',
    imageUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
    targetUrl: 'https://soriana.com',
    active: true,
    priority: 1,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    impressionsCount: 650,
    clicksCount: 88,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-popup-1',
    sponsorName: 'Bimbo México',
    type: 'popup',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    targetUrl: 'https://bimbo.com.mx',
    active: true,
    priority: 1,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    impressionsCount: 420,
    clicksCount: 112,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
  }
];

export async function seedAdvertisementsToFirestore() {
  try {
    for (const ad of DEFAULT_FALLBACK_ADVERTISEMENTS) {
      const docRef = doc(db, COLLECTION_NAME, ad.id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, ad);
      }
    }
  } catch (err) {
    console.error('Error seeding advertisements:', err);
  }
}

export function subscribeAdvertisements(callback: (ads: Advertisement[]) => void): () => void {
  const q = query(collection(db, COLLECTION_NAME), orderBy('priority', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const ads: Advertisement[] = [];
      snapshot.forEach((docSnap) => {
        ads.push({ id: docSnap.id, ...docSnap.data() } as Advertisement);
      });
      if (ads.length === 0) {
        callback(DEFAULT_FALLBACK_ADVERTISEMENTS);
      } else {
        callback(ads);
      }
    },
    (error) => {
      console.warn('Firestore ads subscription error, using fallbacks:', error);
      callback(DEFAULT_FALLBACK_ADVERTISEMENTS);
    }
  );
}

export async function createAdvertisement(adData: Omit<Advertisement, 'id' | 'createdAt' | 'impressionsCount' | 'clicksCount'>): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...adData,
    impressionsCount: 0,
    clicksCount: 0,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

export async function updateAdvertisement(id: string, updates: Partial<Advertisement>): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, updates);
}

export async function deleteAdvertisement(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}

export async function trackAdImpression(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      impressionsCount: increment(1)
    });
  } catch (err) {
    console.warn('Error tracking impression:', err);
  }
}

export async function trackAdClick(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      clicksCount: increment(1)
    });
  } catch (err) {
    console.warn('Error tracking click:', err);
  }
}
