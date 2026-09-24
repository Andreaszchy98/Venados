import React, { useState, useEffect } from 'react';
import { Advertisement, UserProfile } from '../../types';
import {
  subscribeAdvertisements,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
  seedAdvertisementsToFirestore,
  DEFAULT_FALLBACK_ADVERTISEMENTS
} from '../../lib/advertisements';
import {
  Megaphone,
  Plus,
  Trash2,
  Edit,
  Eye,
  MousePointer,
  CheckCircle,
  XCircle,
  Calendar,
  Image as ImageIcon,
  Link as LinkIcon,
  Sparkles,
  X,
  AlertCircle
} from 'lucide-react';

interface AdsManagerProps {
  user: UserProfile;
}

export const AdsManager: React.FC<AdsManagerProps> = ({ user }) => {
  const [ads, setAds] = useState<Advertisement[]>(DEFAULT_FALLBACK_ADVERTISEMENTS);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);

  // Form state
  const [sponsorName, setSponsorName] = useState('');
  const [type, setType] = useState<'hero' | 'inline_grid' | 'popup'>('hero');
  const [imageUrl, setImageUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [active, setActive] = useState(true);
  const [priority, setPriority] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('2026-12-31');

  useEffect(() => {
    seedAdvertisementsToFirestore();
    const unsubscribe = subscribeAdvertisements((data) => {
      setAds(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenCreate = () => {
    setEditingAd(null);
    setSponsorName('');
    setType('hero');
    setImageUrl('https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=1200&q=80');
    setTargetUrl('');
    setActive(true);
    setPriority(1);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('2026-12-31');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setSponsorName(ad.sponsorName);
    setType(ad.type);
    setImageUrl(ad.imageUrl);
    setTargetUrl(ad.targetUrl || '');
    setActive(ad.active);
    setPriority(ad.priority);
    setStartDate(ad.startDate);
    setEndDate(ad.endDate);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorName.trim() || !imageUrl.trim()) {
      alert('Por favor completa el nombre del patrocinador y la URL de imagen.');
      return;
    }

    try {
      if (editingAd) {
        await updateAdvertisement(editingAd.id, {
          sponsorName,
          type,
          imageUrl,
          targetUrl,
          active,
          priority: Number(priority),
          startDate,
          endDate,
        });
      } else {
        await createAdvertisement({
          sponsorName,
          type,
          imageUrl,
          targetUrl,
          active,
          priority: Number(priority),
          startDate,
          endDate,
          createdBy: user.email || user.uid,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving advertisement:', err);
      alert('Error al guardar el anuncio.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este anuncio publicitario?')) {
      try {
        await deleteAdvertisement(id);
      } catch (err) {
        console.error('Error deleting ad:', err);
      }
    }
  };

  const handleToggleActive = async (ad: Advertisement) => {
    try {
      await updateAdvertisement(ad.id, { active: !ad.active });
    } catch (err) {
      console.error('Error toggling ad status:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-red-600" />
            Módulo de Monetización y Anuncios
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestiona banners superiores (Hero), tarjetas patrocinadas en cartelera (Inline) y modales emergentes (Popup) con métricas en tiempo real.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium shadow-md transition-colors"
        >
          <Plus className="w-5 h-5" />
          Crear Anuncio
        </button>
      </div>

      {/* Grid de Anuncios existentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ads.map((ad) => (
          <div
            key={ad.id}
            className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all shadow-sm overflow-hidden flex flex-col justify-between ${
              ad.active ? 'border-slate-200 dark:border-slate-800' : 'border-dashed border-slate-300 dark:border-slate-700 opacity-75'
            }`}
          >
            <div>
              <div className="relative h-40 bg-slate-100 dark:bg-slate-800">
                <img
                  src={ad.imageUrl}
                  alt={ad.sponsorName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=1200&q=80';
                  }}
                />
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-md ${
                    ad.type === 'hero' ? 'bg-indigo-600 text-white' :
                    ad.type === 'inline_grid' ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                  }`}>
                    {ad.type === 'hero' ? 'Hero Banner' : ad.type === 'inline_grid' ? 'Inline Grid' : 'Popup Modal'}
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  <button
                    onClick={() => handleToggleActive(ad)}
                    className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-md transition-colors ${
                      ad.active ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {ad.active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {ad.active ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">
                    {ad.sponsorName}
                  </h3>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    Prioridad: {ad.priority}
                  </span>
                </div>

                {ad.targetUrl && (
                  <a
                    href={ad.targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 truncate"
                  >
                    <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                    {ad.targetUrl}
                  </a>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400 text-xs mb-1">
                      <Eye className="w-3.5 h-3.5" />
                      Impresiones
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white text-base">
                      {ad.impressionsCount || 0}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400 text-xs mb-1">
                      <MousePointer className="w-3.5 h-3.5" />
                      Clics
                    </div>
                    <span className="font-bold text-red-600 dark:text-red-400 text-base">
                      {ad.clicksCount || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => handleOpenEdit(ad)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                Editar
              </button>
              <button
                onClick={() => handleDelete(ad.id)}
                className="px-3 py-1.5 bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-red-600" />
                {editingAd ? 'Editar Anuncio Publicitario' : 'Nuevo Anuncio Publicitario'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Nombre del Patrocinador
                </label>
                <input
                  type="text"
                  value={sponsorName}
                  onChange={(e) => setSponsorName(e.target.value)}
                  placeholder="Ej. Tecate, Bimbo, Chevron..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Tipo de Anuncio
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="hero">Hero Banner (Carrusel)</option>
                    <option value="inline_grid">Inline Grid (Tarjeta en Cartelera)</option>
                    <option value="popup">Popup Modal (Emergente)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Prioridad (Orden)
                  </label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    min={1}
                    max={100}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  URL de la Imagen (Banner / Poster)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  URL de Destino / Sitio Web (Opcional)
                </label>
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://sponsor.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Fecha de Fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="active-switch"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="active-switch" className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                  Anuncio activo y visible en la plataforma
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium shadow-md transition-colors"
                >
                  Guardar Anuncio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
