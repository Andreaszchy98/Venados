import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Comprime y redimensiona una imagen en el navegador para optimización web
 */
export async function compressImage(file: File, maxWidth = 1280, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const elem = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        elem.width = width;
        elem.height = height;
        const ctx = elem.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        elem.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Convierte un File/Blob a DataURL (Base64) como fallback infalible
 */
export async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Sube una imagen a Firebase Storage y retorna su URL de descarga.
 * Si Firebase Storage no está disponible o falla por reglas de red, realiza un fallback automático a Base64 comprimido.
 */
export async function uploadAdImage(file: File, folder = 'sponsor-banners'): Promise<string> {
  try {
    const compressedBlob = await compressImage(file, 1400, 0.85);
    const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storageRef = ref(storage, `${folder}/${cleanFileName}`);

    const snapshot = await uploadBytes(storageRef, compressedBlob, {
      contentType: 'image/webp',
      cacheControl: 'public,max-age=31536000',
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (storageError) {
    console.warn('Firebase Storage upload warning, using optimized base64 fallback:', storageError);
    // Fallback a Base64 comprimido
    const compressedBlob = await compressImage(file, 1024, 0.75);
    return await fileToDataUrl(compressedBlob);
  }
}
