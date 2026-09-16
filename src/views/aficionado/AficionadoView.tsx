import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Venue } from '../../types';
import { MisBoletos } from './MisBoletos';
import { MiMembresia } from './MiMembresia';
import { TiendaMerch } from './TiendaMerch';
import { MenuStand } from './MenuStand';
import { MisPedidos } from './MisPedidos';
import { CarteleraLanding } from '../../components/cartelera/CarteleraLanding';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { subscribeVenues } from '../../lib/venues';
import { DEFAULT_VENUES, DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  Ticket,
  Award,
  ShoppingBag,
  Utensils,
  Clock,
  Package,
  Building2,
  MapPin,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Film,
} from 'lucide-react';

interface AficionadoViewProps {
  user: UserProfile;
  pendingEventId?: string | null;
  onClearPendingEvent?: () => void;
  initialTab?: 'cartelera' | 'boletos' | 'membresia' | 'tienda' | 'comida' | 'pedidos';
  onRequireAuth?: () => void;
}

export const AficionadoView: React.FC<AficionadoViewProps> = ({
  user,
  pendingEventId,
  onClearPendingEvent,
  initialTab,
  onRequireAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'cartelera' | 'boletos' | 'membresia' | 'tienda' | 'comida' | 'pedidos'>(() => {
    if (pendingEventId) return 'boletos';
    if (initialTab) return initialTab;
    return 'cartelera';
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(pendingEventId || null);
  const { t } = useLanguage();
  const { theme } = useTheme();

  // Gestión de sedes (Venues) para el aficionado
  const [venues, setVenues] = useState<Venue[]>(DEFAULT_VENUES);
  const [loadingVenues, setLoadingVenues] = useState<boolean>(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(() => {
    try {
      return localStorage.getItem('vxp_selected_venue_id') || user.browsingVenueId || user.venueId || DEFAULT_VENUE_ID;
    } catch {
      return user.browsingVenueId || user.venueId || DEFAULT_VENUE_ID;
    }
  });

  // Escuchar lista de sedes disponibles
  useEffect(() => {
    setLoadingVenues(true);
    const unsubscribe = subscribeVenues(
      (venuesList) => {
        if (venuesList && venuesList.length > 0) {
          setVenues(venuesList);
          setSelectedVenueId((prev) => {
            if (prev && venuesList.some((v) => v.id === prev)) {
              return prev;
            }
            const preferred = user.browsingVenueId || user.venueId;
            return preferred && venuesList.some((v) => v.id === preferred)
              ? preferred
              : venuesList[0].id;
          });
        }
        setLoadingVenues(false);
      },
      () => {
        setLoadingVenues(false);
      }
    );

    return () => unsubscribe();
  }, [user.browsingVenueId, user.venueId]);

  // Manejar cambio de sede desde el selector principal (Guarda browsingVenueId seguro para aficionado)
  const handleSelectVenue = (newVenueId: string) => {
    setSelectedVenueId(newVenueId);
    try {
      localStorage.setItem('vxp_selected_venue_id', newVenueId);
    } catch {}

    const chosen = venues.find((v) => v.id === newVenueId);
    if (user.uid) {
      try {
        updateDoc(doc(db, 'users', user.uid), {
          browsingVenueId: newVenueId,
          browsingVenueName: chosen?.name || 'Recinto Deportivo',
        }).catch(() => {});
      } catch {}
    }
  };

  // Recinto deportivo actualmente activo
  const currentVenue = useMemo(() => {
    return venues.find((v) => v.id === selectedVenueId) || venues[0] || null;
  }, [venues, selectedVenueId]);

  // Perfil enriquecido con la sede elegida para sincronizar todos los módulos hijos
  const effectiveUser = useMemo(
    () => ({
      ...user,
      browsingVenueId: selectedVenueId,
      browsingVenueName: currentVenue?.name || user.browsingVenueName || 'Estadio Teodoro Mariscal',
      venueId: selectedVenueId,
      venueName: currentVenue?.name || user.venueName || 'Estadio Teodoro Mariscal',
    }),
    [user, selectedVenueId, currentVenue]
  );

  // Si hay un pendingEventId al montar o cambiar, asegurarse de mostrar la pestaña de boletos
  useEffect(() => {
    if (pendingEventId) {
      setSelectedEventId(pendingEventId);
      setActiveTab('boletos');
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [pendingEventId, initialTab]);

  return (
    <div className={`space-y-6 pb-24 transition-colors ${
      theme === 'light' ? 'text-slate-900' : 'text-slate-100'
    }`}>
      {/* Saludo con selector de sede integrado al lado del nombre (solo en vistas internas de sede) */}
      {activeTab !== 'cartelera' && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b ${
          theme === 'light' ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className={`text-xl sm:text-2xl font-black tracking-tight flex items-center gap-1.5 font-sports ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                <span>{t('aficionado.hello', 'Hola,')}</span>
                <span>{user.displayName || 'Aficionado'}</span>
              </h1>

              {/* Selector de Estadio integrado al lado del nombre del aficionado */}
              <div className="relative inline-flex items-center">
                <label htmlFor="client-venue-selector-header" className="sr-only">
                  Seleccionar estadio o recinto
                </label>
                <div className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1 border rounded-xl transition-all shadow-xs group cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-900 shadow-xs'
                    : 'bg-[#101625] hover:bg-[#182032] border-slate-700 text-slate-200'
                }`}>
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <select
                    id="client-venue-selector-header"
                    value={selectedVenueId}
                    onChange={(e) => handleSelectVenue(e.target.value)}
                    disabled={loadingVenues || venues.length === 0}
                    className={`bg-transparent text-xs font-bold pr-5 focus:outline-none cursor-pointer appearance-none ${
                      theme === 'light' ? 'text-slate-900' : 'text-slate-200'
                    }`}
                    title="Cambiar estadio visualizado"
                  >
                    {venues.map((venue) => (
                      <option
                        key={venue.id}
                        value={venue.id}
                        className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#101625] text-white font-medium'}
                      >
                        {venue.name} ({venue.city})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`w-3.5 h-3.5 absolute right-2 pointer-events-none transition-colors ${
                    theme === 'light' ? 'text-slate-500 group-hover:text-slate-800' : 'text-slate-400 group-hover:text-slate-200'
                  }`} />
                </div>
              </div>
            </div>

            <p className={`text-xs sm:text-sm mt-1 ${
              theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'
            }`}>
              {t('aficionado.tagline', 'Portal de Experiencia del Aficionado • Boletos, eventos, consumos y tienda en tu sede')}
            </p>
          </div>
        </div>
      )}

      {/* Contenido de la vista según pestaña activa */}
      {activeTab === 'cartelera' && (
        <CarteleraLanding
          onSelectEvent={(eventId) => {
            setSelectedEventId(eventId);
            setActiveTab('boletos');
          }}
          onSelectStore={(type) => setActiveTab(type)}
          onSelectTab={(tab) => setActiveTab(tab)}
          onOpenAuth={onRequireAuth}
          showBottomNav={false}
        />
      )}
      {activeTab === 'boletos' && (
        <MisBoletos
          user={effectiveUser}
          initialEventId={selectedEventId}
          onClearInitialEvent={() => {
            setSelectedEventId(null);
            onClearPendingEvent?.();
          }}
          selectedVenueId={selectedVenueId}
          onSelectVenue={handleSelectVenue}
          onRequireAuth={onRequireAuth}
        />
      )}
      {activeTab === 'membresia' && <MiMembresia user={effectiveUser} />}
      {activeTab === 'tienda' && (
        <TiendaMerch
          user={effectiveUser}
          onOrderCompleted={() => setActiveTab('pedidos')}
          onRequireAuth={onRequireAuth}
        />
      )}
      {activeTab === 'comida' && (
        <MenuStand
          user={effectiveUser}
          onOrderSuccess={() => setActiveTab('pedidos')}
          onGoToTickets={() => setActiveTab('boletos')}
          onRequireAuth={onRequireAuth}
        />
      )}
      {activeTab === 'pedidos' && (
        <MisPedidos
          user={effectiveUser}
          onOpenAuth={onRequireAuth}
        />
      )}

      {/* Menú de Navegación Inferior Fijo (5 Pestañas: Cartelera, Boletos, Tienda, Comida, Pedidos) */}
      <nav
        id="aficionado-bottom-nav"
        aria-label="Navegación principal del aficionado"
        className={`fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t-2 transition-colors ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]'
            : 'bg-[#0F172A]/98 border-red-600/80 shadow-[0_-10px_35px_rgba(0,0,0,0.85)]'
        }`}
      >
        <div className="max-w-md mx-auto grid grid-cols-5 px-1 py-1.5 sm:py-2 text-center">
          {/* 1. Cartelera */}
          <button
            id="bottom-nav-cartelera"
            type="button"
            onClick={() => setActiveTab('cartelera')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer font-sports tracking-wider ${
              activeTab === 'cartelera'
                ? theme === 'light' ? 'text-red-600 font-black' : 'text-red-400 font-bold'
                : theme === 'light' ? 'text-slate-500 hover:text-slate-900 font-semibold' : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'cartelera'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/20 ring-1 ring-red-500/50'
                  : theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-tight mt-1 uppercase">
              {t('nav.billboard', 'Cartelera')}
            </span>
          </button>

          {/* 2. Boletos */}
          <button
            id="bottom-nav-boletos"
            type="button"
            onClick={() => setActiveTab('boletos')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer font-sports tracking-wider ${
              activeTab === 'boletos'
                ? theme === 'light' ? 'text-red-600 font-black' : 'text-red-400 font-bold'
                : theme === 'light' ? 'text-slate-500 hover:text-slate-900 font-semibold' : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'boletos'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/20 ring-1 ring-red-500/50'
                  : theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Ticket className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-tight mt-1 uppercase">
              {t('nav.tickets', 'Boletos')}
            </span>
          </button>

          {/* 3. Tienda */}
          <button
            id="bottom-nav-tienda"
            type="button"
            onClick={() => setActiveTab('tienda')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer font-sports tracking-wider ${
              activeTab === 'tienda'
                ? theme === 'light' ? 'text-red-600 font-black' : 'text-red-400 font-bold'
                : theme === 'light' ? 'text-slate-500 hover:text-slate-900 font-semibold' : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'tienda'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/20 ring-1 ring-red-500/50'
                  : theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-tight mt-1 uppercase">
              {t('nav.store', 'Tienda')}
            </span>
          </button>

          {/* 4. Comida */}
          <button
            id="bottom-nav-comida"
            type="button"
            onClick={() => setActiveTab('comida')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer font-sports tracking-wider ${
              activeTab === 'comida'
                ? theme === 'light' ? 'text-red-600 font-black' : 'text-red-400 font-bold'
                : theme === 'light' ? 'text-slate-500 hover:text-slate-900 font-semibold' : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'comida'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/20 ring-1 ring-red-500/50'
                  : theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Utensils className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-tight mt-1 uppercase">
              {t('nav.food', 'Comida')}
            </span>
          </button>

          {/* 5. Pedidos */}
          <button
            id="bottom-nav-pedidos"
            type="button"
            onClick={() => setActiveTab('pedidos')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer font-sports tracking-wider ${
              activeTab === 'pedidos'
                ? theme === 'light' ? 'text-red-600 font-black' : 'text-red-400 font-bold'
                : theme === 'light' ? 'text-slate-500 hover:text-slate-900 font-semibold' : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'pedidos'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/20 ring-1 ring-red-500/50'
                  : theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-tight mt-1 uppercase">
              {t('nav.orders', 'Pedidos')}
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};
