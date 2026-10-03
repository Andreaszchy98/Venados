import React, { useState, useEffect } from 'react';
import { AppMediaItem, MediaCategory } from '../../types';
import {
  getAllRegisteredMedia,
  registerUploadedMedia,
  setDefaultCategoryImage,
  deleteRegisteredMedia,
  subscribeAppMediaRegistry,
} from '../../lib/mediaRegistry';
import { uploadAdImage } from '../../lib/imageUpload';
import {
  normalizeGoogleDriveImageUrl,
  isGoogleDriveUrl,
  getDefaultProductPlaceholder,
} from '../../lib/imageUtils';
import {
  ImageIcon,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  ExternalLink,
  Upload,
  Link,
  X,
  Star,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface MediaRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage?: (url: string, mediaItem?: AppMediaItem) => void;
  currentCategory?: string;
  venueId?: string;
}

const CATEGORIES: { id: MediaCategory | string; label: string }[] = [
  { id: 'Todos', label: 'Todas las Imágenes' },
  { id: 'Jerseys', label: 'Jerseys' },
  { id: 'Gorras', label: 'Gorras' },
  { id: 'Sudaderas', label: 'Sudaderas' },
  { id: 'Souvenirs', label: 'Souvenirs' },
  { id: 'Coleccionables', label: 'Coleccionables' },
  { id: 'Accesorios', label: 'Accesorios' },
  { id: 'concesiones', label: 'Puestos & Alimentos' },
  { id: 'banners', label: 'Banners & Patrocinadores' },
  { id: 'eventos', label: 'Pósters de Eventos' },
  { id: 'general', label: 'General' },
];

export const MediaRegistryModal: React.FC<MediaRegistryModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  currentCategory,
  venueId,
}) => {
  const [mediaList, setMediaList] = useState<AppMediaItem[]>([]);
  const [categoryDefaults, setCategoryDefaults] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>(currentCategory || 'Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gallery' | 'upload'>('gallery');

  // Formulario para registrar nueva imagen
  const [inputUrl, setInputUrl] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputCategory, setInputCategory] = useState<string>(currentCategory || 'Jerseys');
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const unsubscribe = subscribeAppMediaRegistry(
      (items, defaults) => {
        setMediaList(items);
        setCategoryDefaults(defaults);
        setLoading(false);
      },
      (err) => {
        console.warn('Error en suscripción de medios:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setFeedback(null);
    try {
      const downloadUrl = await uploadAdImage(file, 'app-media-registry');
      setInputUrl(downloadUrl);
      if (!inputTitle) {
        setInputTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
      setFeedback('Imagen optimizada y subida correctamente. Pulsa "Guardar en Base de Datos".');
    } catch (err: any) {
      console.error('Error al subir imagen:', err);
      setFeedback('No se pudo procesar el archivo. Puedes pegar un enlace directo.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = normalizeGoogleDriveImageUrl(inputUrl);
    if (!cleanUrl) {
      setFeedback('Por favor proporciona una URL o archivo válido.');
      return;
    }

    setSavingMedia(true);
    setFeedback(null);
    try {
      await registerUploadedMedia({
        url: cleanUrl,
        title: inputTitle.trim() || `Imagen ${inputCategory}`,
        category: inputCategory,
        targetVenueId: venueId,
        isCategoryDefault: setAsDefault,
      });

      setFeedback(`Imagen registrada en Firestore ${setAsDefault ? 'y guardada como predeterminada' : ''}.`);
      setInputUrl('');
      setInputTitle('');
      setActiveTab('gallery');
    } catch (err: any) {
      console.error('Error al guardar medio:', err);
      setFeedback(`Error: ${err?.message || 'No se pudo guardar la imagen en Firestore'}`);
    } finally {
      setSavingMedia(false);
    }
  };

  const handleSetDefaultCategory = async (media: AppMediaItem) => {
    try {
      await setDefaultCategoryImage(media.category, media.url, venueId);
      setCategoryDefaults((prev) => ({ ...prev, [media.category]: media.url }));
      setFeedback(`URL establecida como predeterminada para ${media.category}.`);
    } catch (err) {
      console.error('Error al asignar predeterminada:', err);
    }
  };

  const handleDelete = async (mediaId: string) => {
    try {
      await deleteRegisteredMedia(mediaId);
      setMediaList((prev) => prev.filter((m) => m.id !== mediaId));
      setFeedback('Imagen eliminada de Firestore.');
    } catch (err) {
      console.error('Error al eliminar:', err);
    }
  };

  const filteredMedia = mediaList.filter((m) => {
    const matchesCategory =
      selectedCategory === 'Todos' || m.category?.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150 font-body">
      <div className="bg-[#0F1626] w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto">
        {/* Header */}
        <div className="bg-[#0A0E17] text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-950/60 text-red-400 border border-red-500/30">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sports font-bold text-sm sm:text-base uppercase tracking-wider text-white">
                Galería de Imágenes & URLs Predeterminadas de Firestore
              </h3>
              <p className="text-[11px] text-slate-400">
                Las imágenes subidas se guardan en la base de datos de Firestore y se usan como predeterminadas en lugar de los placeholders del seed.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificación de retroalimentación */}
        {feedback && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {feedback}
            </span>
            <button onClick={() => setFeedback(null)} className="text-emerald-400 hover:underline cursor-pointer">
              Cerrar
            </button>
          </div>
        )}

        {/* Pestañas & Filtros */}
        <div className="p-3 sm:p-4 bg-[#0A0E17]/60 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-3 py-1.5 rounded-xl text-xs font-sports uppercase tracking-wider font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'gallery'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Imágenes en Base de Datos ({mediaList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-xl text-xs font-sports uppercase tracking-wider font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Guardar Nueva Imagen / URL</span>
            </button>
          </div>

          {activeTab === 'gallery' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-8 pr-2.5 py-1 bg-[#0F1626] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1 bg-[#0F1626] border border-slate-700/80 rounded-xl text-xs font-sports uppercase tracking-wider text-slate-200 focus:outline-hidden focus:border-red-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0A0E17] text-white">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Contenido Principal */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {activeTab === 'upload' ? (
            <form onSubmit={handleSaveMedia} className="max-w-xl mx-auto space-y-4">
              <div className="p-4 bg-[#0A0E17] rounded-2xl border border-slate-700/80 space-y-3">
                <h4 className="font-sports font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-red-500" />
                  <span>Opción A: Subir archivo desde tu dispositivo</span>
                </h4>
                <div className="flex items-center gap-3">
                  <label className="flex-1 px-4 py-3 bg-[#0F1626] hover:bg-slate-800/80 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-200">
                      {uploadingFile ? 'Optimizando y subiendo...' : 'Seleccionar imagen JPG / PNG / WebP'}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Se optimiza automáticamente para web</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="p-4 bg-[#0A0E17] rounded-2xl border border-slate-700/80 space-y-3">
                <h4 className="font-sports font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                  <Link className="w-4 h-4 text-red-500" />
                  <span>Opción B: Pegar enlace de Google Drive o URL web directa</span>
                </h4>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    URL de la Imagen (detecta Google Drive automáticamente):
                  </label>
                  <input
                    type="url"
                    required
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/... o https://..."
                    className="w-full p-2.5 bg-[#0F1626] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500"
                  />
                  {isGoogleDriveUrl(inputUrl) && (
                    <p className="text-[10px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Enlace de Google Drive detectado y transformado a CDN stream directo.
                    </p>
                  )}
                </div>
              </div>

              {/* Vista previa en vivo */}
              {inputUrl && (
                <div className="p-3 bg-[#0A0E17] rounded-2xl border border-slate-700/80 flex items-center gap-3">
                  <img
                    src={normalizeGoogleDriveImageUrl(inputUrl)}
                    alt="Vista previa"
                    className="w-16 h-16 rounded-xl object-contain bg-slate-950 border border-slate-700 p-0.5"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = getDefaultProductPlaceholder('Jerseys');
                    }}
                  />
                  <div>
                    <p className="text-xs font-bold text-white">Vista previa de imagen</p>
                    <p className="text-[10px] text-slate-400 break-all">{normalizeGoogleDriveImageUrl(inputUrl)}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-sports uppercase tracking-wider font-bold text-slate-300 mb-1 text-xs">
                    Título o Nombre Descriptivo:
                  </label>
                  <input
                    type="text"
                    required
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    placeholder="Ej. Jersey Oficial Rojo 2026"
                    className="w-full p-2.5 bg-[#0A0E17] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-sports uppercase tracking-wider font-bold text-slate-300 mb-1 text-xs">
                    Categoría Destino:
                  </label>
                  <select
                    value={inputCategory}
                    onChange={(e) => setInputCategory(e.target.value)}
                    className="w-full p-2.5 bg-[#0A0E17] border border-slate-700/80 rounded-xl font-sports uppercase tracking-wider text-xs text-white focus:outline-hidden focus:border-red-500"
                  >
                    {CATEGORIES.filter((c) => c.id !== 'Todos').map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#0A0E17] text-white">
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-red-950/30 rounded-xl border border-red-900/40 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chk-set-default"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-slate-900 border-slate-700 cursor-pointer"
                />
                <label htmlFor="chk-set-default" className="text-xs text-slate-200 cursor-pointer font-medium">
                  Establecer esta URL como la <strong className="text-red-400">imagen predeterminada por defecto</strong> para la categoría <strong className="text-white">{inputCategory}</strong> en toda la app.
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('gallery')}
                  className="px-4 py-2 border border-slate-700 rounded-xl font-bold font-sports uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMedia || !inputUrl}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold font-sports uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer text-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  {savingMedia ? 'Guardando en Firestore...' : 'Guardar en Base de Datos'}
                </button>
              </div>
            </form>
          ) : loading ? (
            <LoadingSpinner message="Consultando imágenes almacenadas en Firestore..." />
          ) : filteredMedia.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-slate-700/80 rounded-2xl bg-[#0A0E17]">
              <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-sports font-bold text-sm uppercase tracking-wider text-slate-300">
                Aún no hay imágenes guardadas en Firestore para este filtro
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Haz clic en "Guardar Nueva Imagen / URL" para registrar tus fotografías o enlaces de Google Drive.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs font-sports uppercase tracking-wider rounded-xl shadow-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Imagen Ahora</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredMedia.map((item) => {
                const isCurrentDefault =
                  categoryDefaults[item.category] === item.url || item.isCategoryDefault;

                return (
                  <div
                    key={item.id}
                    className={`bg-[#0A0E17] rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                      isCurrentDefault
                        ? 'border-amber-500/70 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/40'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Visualizador de Imagen */}
                    <div className="h-40 relative bg-slate-950 overflow-hidden flex items-center justify-center p-2">
                      <img
                        src={item.url}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-md opacity-25 scale-110 pointer-events-none"
                      />
                      <img
                        src={item.url}
                        alt={item.title}
                        className="relative z-10 max-h-full max-w-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = getDefaultProductPlaceholder(item.category);
                        }}
                      />

                      {isCurrentDefault && (
                        <span className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-slate-950 font-sports uppercase tracking-wider shadow-md">
                          <Star className="w-3 h-3 fill-slate-950" /> Predeterminada
                        </span>
                      )}

                      <span className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-slate-900/90 text-slate-300 border border-slate-700 font-sports uppercase tracking-wider">
                        {item.category}
                      </span>
                    </div>

                    {/* Información */}
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="font-bold text-white text-xs leading-snug line-clamp-1">{item.title}</p>
                        <p className="text-[10px] text-slate-400 font-mono line-clamp-1 mt-0.5 break-all">
                          {item.url}
                        </p>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800/80">
                        {onSelectImage && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectImage(item.url, item);
                              onClose();
                            }}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] font-sports uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Seleccionar</span>
                          </button>
                        )}

                        {!isCurrentDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultCategory(item)}
                            className="px-2 py-1 bg-slate-800 hover:bg-amber-600 hover:text-slate-950 text-slate-300 font-bold text-[10px] font-sports uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            title="Hacer que esta sea la imagen por defecto para su categoría"
                          >
                            <Star className="w-3 h-3" />
                            <span>Hacer Default</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer ml-auto"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
