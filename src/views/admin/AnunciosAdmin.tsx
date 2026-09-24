import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, SponsorAd, AdType, Venue } from '../../types';
import {
  subscribeSponsorAds,
  createSponsorAd,
  updateSponsorAd,
  deleteSponsorAd,
} from '../../lib/sponsorAds';
import { uploadAdImage } from '../../lib/imageUpload';
import { subscribeVenues } from '../../lib/venues';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { normalizeGoogleDriveImageUrl, isGoogleDriveUrl } from '../../lib/imageUtils';
import { useTheme } from '../../context/ThemeContext';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  Megaphone,
  Plus,
  Search,
  Eye,
  MousePointerClick,
  TrendingUp,
  Calendar,
  ExternalLink,
  Edit2,
  Trash2,
  Upload,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Tv,
  HelpCircle,
  Wand2,
} from 'lucide-react';

interface AnunciosAdminProps {
  user: UserProfile;
}

// Plantillas predeterminadas de patrocinadores para carga rápida con 1 clic
const PRESET_SPONSORS = [
  {
    name: 'Cerveza Pacífico Oficial',
    type: 'hero' as AdType,
    imageUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1200&auto=format&fit=crop&q=80',
    targetUrl: 'https://www.cervezapacifico.com',
  },
  {
    name: 'Caliente.mx Casa de Apuestas',
    type: 'inline' as AdType,
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80',
    targetUrl: 'https://www.caliente.mx',
  },
  {
    name: 'Telcel 5G Velocidad Oficial',
    type: 'popup' as AdType,
    imageUrl: 'https://images.unsplash.com/photo-1516245834210-c4c142787335?w=1200&auto=format&fit=crop&q=80',
    targetUrl: 'https://www.telcel.com',
  },
  {
    name: 'Mariscos & Botanero El Teodoro',
    type: 'inline' as AdType,
    imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200&auto=format&fit=crop&q=80',
    targetUrl: 'https://venados.com/estadio',
  },
];

const SAMPLE_IMAGE_PRESETS = [
  { label: '⚾ Estadio', url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1200&auto=format&fit=crop&q=80' },
  { label: '🍺 Bebidas', url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=1200&auto=format&fit=crop&q=80' },
  { label: '🍔 Comida', url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200&auto=format&fit=crop&q=80' },
  { label: '🎯 Deportes', url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80' },
  { label: '📱 Tech & 5G', url: 'https://images.unsplash.com/photo-1516245834210-c4c142787335?w=1200&auto=format&fit=crop&q=80' },
];

const DEFAULT_TYPE_IMAGES: Record<AdType, string> = {
  hero: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1200&auto=format&fit=crop&q=80',
  inline: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80',
  popup: 'https://images.unsplash.com/photo-1516245834210-c4c142787335?w=1200&auto=format&fit=crop&q=80',
};

export const AnunciosAdmin: React.FC<AnunciosAdminProps> = ({ user }) => {
  const { theme } = useTheme();
  const [ads, setAds] = useState<SponsorAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | AdType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Sedes disponibles
  const [venues, setVenues] = useState<Venue[]>([]);
  const currentVenueId = user.venueId || DEFAULT_VENUE_ID;

  // Modal de Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<SponsorAd | null>(null);

  // Formulario
  const [formSponsorName, setFormSponsorName] = useState('');
  const [formType, setFormType] = useState<AdType>('hero');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formTargetUrl, setFormTargetUrl] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 3);
    return nextMonth.toISOString().split('T')[0];
  });
  const [formActive, setFormActive] = useState(true);
  const [formVenueId, setFormVenueId] = useState(currentVenueId);

  // Errores y estado de carga
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formValidationErrors, setFormValidationErrors] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [modalFeedbackMsg, setModalFeedbackMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal de confirmación de eliminación
  const [adToDelete, setAdToDelete] = useState<SponsorAd | null>(null);

  // Escuchar sedes
  useEffect(() => {
    const unsubVenues = subscribeVenues((vList) => {
      setVenues(vList || []);
    });
    return () => unsubVenues();
  }, []);

  // Escuchar anuncios en tiempo real
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeSponsorAds(
      currentVenueId,
      (updatedAds) => {
        setAds(updatedAds);
        setLoading(false);
      },
      (err) => {
        console.error('Error en listener de anuncios:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentVenueId]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedbackMsg({ type, message });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const showModalFeedback = (type: 'success' | 'error', message: string) => {
    setModalFeedbackMsg({ type, message });
  };

  const handleOpenCreateModal = () => {
    setEditingAd(null);
    setFormSponsorName('');
    setFormType('hero');
    setFormImageUrl(DEFAULT_TYPE_IMAGES.hero);
    setFormTargetUrl('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 3);
    setFormEndDate(nextMonth.toISOString().split('T')[0]);
    setFormActive(true);
    setFormVenueId(currentVenueId);
    setImageError(null);
    setModalFeedbackMsg(null);
    setFormValidationErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ad: SponsorAd) => {
    setEditingAd(ad);
    setFormSponsorName(ad.sponsorName);
    setFormType(ad.type);
    setFormImageUrl(ad.imageUrl);
    setFormTargetUrl(ad.targetUrl || '');
    setFormStartDate(ad.startDate || new Date().toISOString().split('T')[0]);
    setFormEndDate(ad.endDate || new Date().toISOString().split('T')[0]);
    setFormActive(typeof ad.active === 'boolean' ? ad.active : true);
    setFormVenueId(ad.venueId || currentVenueId);
    setImageError(null);
    setModalFeedbackMsg(null);
    setFormValidationErrors({});
    setIsModalOpen(true);
  };

  const handleApplyPreset = (preset: typeof PRESET_SPONSORS[0]) => {
    setFormSponsorName(preset.name);
    setFormType(preset.type);
    setFormImageUrl(preset.imageUrl);
    setFormTargetUrl(preset.targetUrl);
    setFormValidationErrors({});
    setImageError(null);
    setModalFeedbackMsg(null);
  };

  const handleSelectType = (type: AdType) => {
    setFormType(type);
    // Si la imagen actual es la predeterminada de otro tipo o está vacía, sincronizar
    if (!formImageUrl || Object.values(DEFAULT_TYPE_IMAGES).includes(formImageUrl)) {
      setFormImageUrl(DEFAULT_TYPE_IMAGES[type]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP).');
      return;
    }

    setUploadingImage(true);
    setImageError(null);
    try {
      const url = await uploadAdImage(file, 'sponsor-banners');
      setFormImageUrl(url);
      setFormValidationErrors((prev) => {
        const copy = { ...prev };
        delete copy.imageUrl;
        return copy;
      });
    } catch (err: any) {
      console.error('Error al subir imagen:', err);
      setImageError('No se pudo subir la imagen directamente. Puedes seleccionar una imagen predeterminada o pegar una URL.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalFeedbackMsg(null);
    const errors: { [key: string]: string } = {};

    if (!formSponsorName.trim()) {
      errors.sponsorName = 'Ingresa el nombre del patrocinador o marca.';
    }

    const finalImage = formImageUrl.trim() || DEFAULT_TYPE_IMAGES[formType];

    if (!formStartDate) {
      errors.startDate = 'Selecciona la fecha de inicio de vigencia.';
    }

    if (!formEndDate) {
      errors.endDate = 'Selecciona la fecha de término de vigencia.';
    } else if (formStartDate && formStartDate > formEndDate) {
      errors.endDate = 'La fecha de término no puede ser anterior a la fecha de inicio.';
    }

    if (Object.keys(errors).length > 0) {
      setFormValidationErrors(errors);
      showModalFeedback('error', 'Por favor completa los campos obligatorios indicados en rojo.');
      return;
    }

    // Sanitizar URL de destino si se ingresó sin protocolo
    let cleanTargetUrl = formTargetUrl.trim();
    if (cleanTargetUrl && !cleanTargetUrl.startsWith('http://') && !cleanTargetUrl.startsWith('https://')) {
      cleanTargetUrl = `https://${cleanTargetUrl}`;
    }

    setSaving(true);
    try {
      if (editingAd) {
        await updateSponsorAd(editingAd.id, {
          sponsorName: formSponsorName.trim(),
          type: formType,
          imageUrl: finalImage,
          targetUrl: cleanTargetUrl || undefined,
          startDate: formStartDate,
          endDate: formEndDate,
          active: formActive,
          venueId: formVenueId,
        });
        showFeedback('success', `¡Banner de "${formSponsorName}" actualizado exitosamente!`);
      } else {
        await createSponsorAd({
          sponsorName: formSponsorName.trim(),
          type: formType,
          imageUrl: finalImage,
          targetUrl: cleanTargetUrl || undefined,
          startDate: formStartDate,
          endDate: formEndDate,
          active: formActive,
          venueId: formVenueId,
        });
        showFeedback('success', `¡Nuevo banner de "${formSponsorName}" creado y activado!`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error al guardar anuncio en Firestore:', err);
      showModalFeedback('error', `Error al guardar en la base de datos: ${err.message || 'Error de conexión'}`);
    } finally {
      setSaving(false);
    }
  };

  // Carga rápida de 4 anuncios demo oficiales de Venados
  const handleSeedDemoAds = async () => {
    setLoading(true);
    try {
      for (const preset of PRESET_SPONSORS) {
        await createSponsorAd({
          sponsorName: preset.name,
          type: preset.type,
          imageUrl: preset.imageUrl,
          targetUrl: preset.targetUrl,
          startDate: new Date().toISOString().split('T')[0],
          endDate: (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + 4);
            return d.toISOString().split('T')[0];
          })(),
          active: true,
          venueId: currentVenueId,
        });
      }
      showFeedback('success', '¡4 banners demo de patrocinio creados exitosamente!');
    } catch (err: any) {
      showFeedback('error', `Error al generar demos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (ad: SponsorAd) => {
    try {
      await updateSponsorAd(ad.id, { active: !ad.active });
      showFeedback('success', `Anuncio ${!ad.active ? 'activado' : 'pausado'}.`);
    } catch (err: any) {
      showFeedback('error', `Error al cambiar estado: ${err.message}`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!adToDelete) return;
    try {
      await deleteSponsorAd(adToDelete.id);
      showFeedback('success', 'Banner publicitario eliminado del sistema.');
      setAdToDelete(null);
    } catch (err: any) {
      showFeedback('error', `Error al eliminar anuncio: ${err.message}`);
    }
  };

  // Filtrado de anuncios
  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (ad.sponsorName || '').toLowerCase().includes(q);
        const matchesUrl = (ad.targetUrl || '').toLowerCase().includes(q);
        if (!matchesName && !matchesUrl) return false;
      }
      if (filterType !== 'all' && ad.type !== filterType) return false;
      if (filterStatus === 'active' && !ad.active) return false;
      if (filterStatus === 'inactive' && ad.active) return false;
      return true;
    });
  }, [ads, searchQuery, filterType, filterStatus]);

  // Métricas globales acumuladas
  const totalImpressions = useMemo(() => ads.reduce((sum, a) => sum + (Number(a.impressions) || 0), 0), [ads]);
  const totalClicks = useMemo(() => ads.reduce((sum, a) => sum + (Number(a.clicks) || 0), 0), [ads]);
  const avgCtr = useMemo(() => {
    if (totalImpressions === 0) return 0;
    return ((totalClicks / totalImpressions) * 100).toFixed(1);
  }, [totalImpressions, totalClicks]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header con métricas visuales en tiempo real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Banners */}
        <div
          className={`p-4 rounded-2xl border shadow-xs transition-colors ${
            theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0F1626] border-slate-700/80 text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sports font-bold uppercase tracking-wider text-slate-400">
              Total Banners
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-sports">{ads.length}</span>
            <span className="text-xs text-emerald-500 font-bold">
              {ads.filter((a) => a.active).length} activos
            </span>
          </div>
        </div>

        {/* Impresiones Totales */}
        <div
          className={`p-4 rounded-2xl border shadow-xs transition-colors ${
            theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0F1626] border-slate-700/80 text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sports font-bold uppercase tracking-wider text-slate-400">
              Impresiones en Vivo
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-blue-400">
              {totalImpressions.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">vistas</span>
          </div>
        </div>

        {/* Clics Totales */}
        <div
          className={`p-4 rounded-2xl border shadow-xs transition-colors ${
            theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0F1626] border-slate-700/80 text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sports font-bold uppercase tracking-wider text-slate-400">
              Clics Registrados
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-400">
              {totalClicks.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">interacciones</span>
          </div>
        </div>

        {/* CTR Promedio */}
        <div
          className={`p-4 rounded-2xl border shadow-xs transition-colors ${
            theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0F1626] border-slate-700/80 text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sports font-bold uppercase tracking-wider text-slate-400">
              CTR Promedio
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-400">{avgCtr}%</span>
            <span className="text-[11px] text-slate-400">conversión</span>
          </div>
        </div>
      </div>

      {/* Notificación de retroalimentación flotante */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in duration-150 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200 shadow-lg'
              : 'bg-red-950/70 border-red-500/50 text-red-200 shadow-lg'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{feedbackMsg.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="p-1 hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Barra de Control: Buscador, Filtros y Botón Nuevo Banner */}
      <div
        className={`p-4 rounded-2xl border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 transition-colors ${
          theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar patrocinador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-red-600 transition-colors ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-[#141C2E] border-slate-700 text-white'
              }`}
            />
          </div>

          {/* Filtro por Tipo */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className={`px-3 py-2 rounded-xl text-xs font-sports font-bold border focus:outline-none cursor-pointer ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-300 text-slate-900'
                : 'bg-[#141C2E] border-slate-700 text-white'
            }`}
          >
            <option value="all">Todos los Formatos</option>
            <option value="hero">Hero (Principal Superior)</option>
            <option value="inline">Inline Grid (Cuadrícula)</option>
            <option value="popup">Popup (Emergente)</option>
          </select>

          {/* Filtro por Estado */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className={`px-3 py-2 rounded-xl text-xs font-sports font-bold border focus:outline-none cursor-pointer ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-300 text-slate-900'
                : 'bg-[#141C2E] border-slate-700 text-white'
            }`}
          >
            <option value="all">Todos los Estados</option>
            <option value="active">Solo Activos</option>
            <option value="inactive">Solo Pausados</option>
          </select>
        </div>

        {/* Botón Nuevo Anuncio */}
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-sports font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-950/40 transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Banner / Patrocinio</span>
        </button>
      </div>

      {/* 3. Listado de Anuncios */}
      {loading ? (
        <div className="py-12">
          <LoadingSpinner message="Cargando banners y métricas de patrocinios..." />
        </div>
      ) : filteredAds.length === 0 ? (
        <div
          className={`p-12 border border-dashed rounded-3xl text-center space-y-3.5 ${
            theme === 'light' ? 'bg-white border-slate-300' : 'bg-[#0F1626] border-slate-700'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <Megaphone className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black font-sports uppercase tracking-wider">
              {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                ? 'No se encontraron banners con los filtros seleccionados'
                : 'Aún no hay banners de patrocinio registrados'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Crea espacios publicitarios para marcas patrocinadoras en formato Hero superior, cuadrícula
              intermedia o modal emergente con métricas de clics en tiempo real.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-sports font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Banner Directo</span>
            </button>
            <button
              type="button"
              onClick={handleSeedDemoAds}
              className="px-4 py-2.5 bg-[#141C2E] hover:bg-[#1E293B] border border-amber-500/40 text-amber-300 font-sports font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-sm"
            >
              <Wand2 className="w-4 h-4 text-amber-400" />
              <span>Cargar 4 Anuncios Oficiales Demo</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAds.map((ad) => {
            const today = new Date().toISOString().split('T')[0];
            const isExpired = ad.endDate && ad.endDate < today;
            const isScheduled = ad.startDate && ad.startDate > today;
            const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0';

            return (
              <div
                key={ad.id}
                className={`rounded-2xl border overflow-hidden flex flex-col justify-between shadow-md transition-all group ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 hover:border-red-500/50'
                    : 'bg-[#0F1626] border-slate-700/80 hover:border-red-500/50'
                }`}
              >
                {/* Imagen del Banner con Badges superpuestos */}
                <div className="relative h-44 bg-black/40 overflow-hidden">
                  <img
                    src={normalizeGoogleDriveImageUrl(ad.imageUrl)}
                    alt={ad.sponsorName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                  {/* Badge de Tipo */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase font-sports tracking-wider shadow-sm ${
                        ad.type === 'hero'
                          ? 'bg-red-600 text-white'
                          : ad.type === 'inline'
                          ? 'bg-blue-600 text-white'
                          : 'bg-amber-500 text-slate-950 font-black'
                      }`}
                    >
                      {ad.type === 'hero' ? 'Hero' : ad.type === 'inline' ? 'Inline Grid' : 'Popup'}
                    </span>

                    {/* Badge de Estado */}
                    {isExpired ? (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">
                        Vencido
                      </span>
                    ) : isScheduled ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 text-[10px] font-bold border border-amber-800">
                        Programado
                      </span>
                    ) : ad.active ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Activo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-bold border border-slate-700">
                        Pausado
                      </span>
                    )}
                  </div>

                  {/* Nombre del Patrocinador */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <h4 className="text-sm font-black font-sports uppercase tracking-wide text-white drop-shadow-md truncate">
                      {ad.sponsorName}
                    </h4>
                    {ad.targetUrl && (
                      <a
                        href={ad.targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 text-white transition-colors"
                        title="Abrir enlace de destino"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Contenido: Métricas de Rendimiento y Vigencia */}
                <div className="p-4 space-y-3.5">
                  {/* Métricas en tiempo real */}
                  <div
                    className={`grid grid-cols-3 gap-2 p-2.5 rounded-xl border text-center ${
                      theme === 'light'
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-[#141C2E] border-slate-700/70'
                    }`}
                  >
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">
                        Impresiones
                      </span>
                      <span className="text-xs font-black font-mono text-blue-400">
                        {(ad.impressions || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="border-x border-slate-700/40">
                      <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">
                        Clics
                      </span>
                      <span className="text-xs font-black font-mono text-emerald-400">
                        {(ad.clicks || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">
                        CTR
                      </span>
                      <span className="text-xs font-black font-mono text-amber-400">
                        {ctr}%
                      </span>
                    </div>
                  </div>

                  {/* Rango de vigencia */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span>
                        {ad.startDate} al {ad.endDate}
                      </span>
                    </span>
                  </div>

                  {/* Acciones CRUD */}
                  <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between gap-2">
                    {/* Switch Rápido Activo/Inactivo */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(ad)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-sports font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                        ad.active
                          ? 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          ad.active ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                      <span>{ad.active ? 'Activo' : 'Pausado'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(ad)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Editar anuncio"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdToDelete(ad)}
                        className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 transition-colors cursor-pointer border border-red-900/60"
                        title="Eliminar anuncio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==========================================
          MODAL DE CREAR / EDITAR ANUNCIO
         ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden transition-all duration-200 max-h-[92vh] flex flex-col ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#0F1626] border-slate-700/80 text-white'
            }`}
          >
            {/* Header Modal */}
            <div className="p-5 border-b flex items-center justify-between relative bg-gradient-to-r from-red-600/15 via-transparent to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 text-red-500 flex items-center justify-center">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black font-sports uppercase tracking-wide">
                    {editingAd ? 'Editar Banner Publicitario' : 'Nuevo Banner Publicitario'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Carga directa y configuración de patrocinios para el recinto
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-500/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario (noValidate para evitar bloqueos silenciosos del navegador) */}
            <form onSubmit={handleSubmitForm} noValidate className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Notificación de Error o Éxito en el Modal */}
              {modalFeedbackMsg && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold animate-in fade-in duration-150 ${
                    modalFeedbackMsg.type === 'success'
                      ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                      : 'bg-red-950/90 border-red-500 text-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {modalFeedbackMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span>{modalFeedbackMsg.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalFeedbackMsg(null)}
                    className="p-1 hover:bg-white/10 rounded-lg cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Plantillas Rápidas de Prueba */}
              {!editingAd && (
                <div className="p-3 rounded-2xl bg-[#141C2E] border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sports font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Plantillas Rápidas de Patrocinio (1 Clic)</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_SPONSORS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="px-2.5 py-1 bg-[#1A253D] hover:bg-red-600/30 text-slate-200 hover:text-white border border-slate-600/60 hover:border-red-500/60 rounded-lg text-[10px] font-bold font-sports uppercase transition-all cursor-pointer"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nombre del Patrocinador */}
              <div className="space-y-1">
                <label className="block text-[11px] font-sports font-bold uppercase tracking-wider text-slate-300">
                  Nombre del Patrocinador / Marca *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cerveza Pacífico, Caliente.mx, Telcel..."
                  value={formSponsorName}
                  onChange={(e) => {
                    setFormSponsorName(e.target.value);
                    if (formValidationErrors.sponsorName) {
                      setFormValidationErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.sponsorName;
                        return copy;
                      });
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-red-600 ${
                    formValidationErrors.sponsorName
                      ? 'border-red-500 bg-red-950/20'
                      : theme === 'light'
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-[#141C2E] border-slate-700 text-white'
                  }`}
                />
                {formValidationErrors.sponsorName && (
                  <p className="text-[10px] text-red-400 font-bold">{formValidationErrors.sponsorName}</p>
                )}
              </div>

              {/* Selector de Formato del Anuncio */}
              <div className="space-y-1">
                <label className="block text-[11px] font-sports font-bold uppercase tracking-wider text-slate-300">
                  Formato / Ubicación del Banner *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectType('hero')}
                    className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      formType === 'hero'
                        ? 'bg-red-600 text-white border-red-500 shadow-md font-bold'
                        : theme === 'light'
                        ? 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                        : 'bg-[#141C2E] border-slate-700 text-slate-300 hover:bg-[#1A253D]'
                    }`}
                  >
                    <Tv className="w-4 h-4 mx-auto mb-1" />
                    <span className="block text-xs font-black font-sports uppercase">Hero</span>
                    <span className="block text-[9px] opacity-80 truncate">Banner Superior</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType('inline')}
                    className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      formType === 'inline'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md font-bold'
                        : theme === 'light'
                        ? 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                        : 'bg-[#141C2E] border-slate-700 text-slate-300 hover:bg-[#1A253D]'
                    }`}
                  >
                    <Layers className="w-4 h-4 mx-auto mb-1" />
                    <span className="block text-xs font-black font-sports uppercase">Inline Grid</span>
                    <span className="block text-[9px] opacity-80 truncate">En Catálogo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType('popup')}
                    className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      formType === 'popup'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md font-bold'
                        : theme === 'light'
                        ? 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                        : 'bg-[#141C2E] border-slate-700 text-slate-300 hover:bg-[#1A253D]'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 mx-auto mb-1" />
                    <span className="block text-xs font-black font-sports uppercase">Popup</span>
                    <span className="block text-[9px] opacity-80 truncate">Emergente</span>
                  </button>
                </div>
              </div>

              {/* Carga de Imagen */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-sports font-bold uppercase tracking-wider text-slate-300">
                  Carga de Imagen (Firebase Storage o URL)
                </label>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <label className="px-4 py-2.5 bg-[#141C2E] hover:bg-[#1C273E] border border-slate-700 text-slate-200 rounded-xl text-xs font-bold font-sports uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0">
                    <Upload className="w-4 h-4 text-red-500" />
                    <span>{uploadingImage ? 'Subiendo...' : 'Subir Archivo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>

                  <input
                    type="text"
                    placeholder="Pega URL directa o enlace de Google Drive / Dropbox..."
                    value={formImageUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      const normalized = normalizeGoogleDriveImageUrl(val);
                      setFormImageUrl(normalized);
                      if (formValidationErrors.imageUrl) {
                        setFormValidationErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.imageUrl;
                          return copy;
                        });
                      }
                    }}
                    onBlur={() => {
                      if (formImageUrl) {
                        setFormImageUrl(normalizeGoogleDriveImageUrl(formImageUrl));
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-red-600 ${
                      formValidationErrors.imageUrl
                        ? 'border-red-500 bg-red-950/20'
                        : theme === 'light'
                        ? 'bg-slate-50 border-slate-300 text-slate-900'
                        : 'bg-[#141C2E] border-slate-700 text-white'
                    }`}
                  />
                </div>

                {/* Badge de Google Drive normalizado */}
                {formImageUrl && (isGoogleDriveUrl(formImageUrl) || formImageUrl.includes('googleusercontent.com/d/')) && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/60 border border-blue-500/40 text-[10px] text-blue-300 font-bold">
                    <Sparkles className="w-3 h-3 text-blue-400 shrink-0" />
                    <span>Enlace de Google Drive normalizado a imagen directa CDN</span>
                  </div>
                )}

                {/* Chips de imágenes predefinidas */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 font-sports font-bold uppercase">Imágenes sugeridas:</span>
                  {SAMPLE_IMAGE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormImageUrl(preset.url);
                        setImageError(null);
                      }}
                      className="px-2 py-0.5 rounded-md bg-[#141C2E] hover:bg-red-600/20 border border-slate-700 hover:border-red-500 text-[10px] text-slate-300 font-bold transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {imageError && (
                  <p className="text-[10px] text-red-400 font-bold">{imageError}</p>
                )}
                {formValidationErrors.imageUrl && (
                  <p className="text-[10px] text-red-400 font-bold">{formValidationErrors.imageUrl}</p>
                )}

                {/* Previsualización de Imagen */}
                {formImageUrl && (
                  <div className="mt-2 relative h-32 rounded-xl overflow-hidden border border-slate-700 bg-black/50">
                    <img
                      src={normalizeGoogleDriveImageUrl(formImageUrl)}
                      alt="Previsualización"
                      className="w-full h-full object-cover"
                      onError={() => setImageError('La imagen no pudo cargarse desde la URL especificada. Verifica que el archivo en Drive tenga permisos "Cualquier persona con el enlace".')}
                    />
                    <button
                      type="button"
                      onClick={() => setFormImageUrl('')}
                      className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-black text-white rounded-lg cursor-pointer"
                      title="Quitar imagen"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* URL Opcional de Redirección */}
              <div className="space-y-1">
                <label className="block text-[11px] font-sports font-bold uppercase tracking-wider text-slate-300">
                  URL de Destino / Redirección (Opcional)
                </label>
                <div className="relative">
                  <ExternalLink className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="https://patrocinador.com/promocion"
                    value={formTargetUrl}
                    onChange={(e) => setFormTargetUrl(e.target.value)}
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-red-600 ${
                      theme === 'light'
                        ? 'bg-slate-50 border-slate-300 text-slate-900'
                        : 'bg-[#141C2E] border-slate-700 text-white'
                    }`}
                  />
                </div>
              </div>

              {/* Rango de Fechas de Vigencia */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-sports font-bold uppercase tracking-wider text-slate-300">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => {
                      setFormStartDate(e.target.value);
                      if (formValidationErrors.startDate) {
                        setFormValidationErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.startDate;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                      formValidationErrors.startDate
                        ? 'border-red-500 bg-red-950/20'
                        : theme === 'light'
                        ? 'bg-slate-50 border-slate-300 text-slate-900'
                        : 'bg-[#141C2E] border-slate-700 text-white'
                    }`}
                  />
                  {formValidationErrors.startDate && (
                    <p className="text-[10px] text-red-400 font-bold">{formValidationErrors.startDate}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-sports font-bold uppercase tracking-wider text-slate-300">
                    Fecha de Término *
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => {
                      setFormEndDate(e.target.value);
                      if (formValidationErrors.endDate) {
                        setFormValidationErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.endDate;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                      formValidationErrors.endDate
                        ? 'border-red-500 bg-red-950/20'
                        : theme === 'light'
                        ? 'bg-slate-50 border-slate-300 text-slate-900'
                        : 'bg-[#141C2E] border-slate-700 text-white'
                    }`}
                  />
                  {formValidationErrors.endDate && (
                    <p className="text-[10px] text-red-400 font-bold">{formValidationErrors.endDate}</p>
                  )}
                </div>
              </div>

              {/* Switch de Activo / Inactivo */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#141C2E] border border-slate-700">
                <div>
                  <span className="block text-xs font-black font-sports uppercase text-white">
                    Estado del Banner
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    {formActive ? 'Visible en cartelera y catálogo para los aficionados' : 'Pausado temporalmente'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormActive(!formActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formActive ? 'bg-red-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      formActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-slate-700/60 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-sports font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-sports font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Guardando en Base de Datos...' : editingAd ? 'Guardar Cambios' : 'Crear y Publicar Banner'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {adToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`w-full max-w-sm rounded-3xl border shadow-2xl p-6 space-y-4 ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black font-sports uppercase tracking-wider">
                ¿Eliminar Banner?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Se eliminará el anuncio de <strong>{adToDelete.sponsorName}</strong> y su conteo de métricas acumuladas ({adToDelete.impressions} vistas, {adToDelete.clicks} clics).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdToDelete(null)}
                className="py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-sports font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-sports font-black uppercase rounded-xl transition-all cursor-pointer shadow-md"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
