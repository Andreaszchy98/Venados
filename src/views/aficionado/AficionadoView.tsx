import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Venue } from '../../types';
import { MisBoletos } from './MisBoletos';
import { MiMembresia } from './MiMembresia';
import { TiendaMerch } from './TiendaMerch';
import { MenuStand } from './MenuStand';
import { MisPedidos } from './MisPedidos';
import { useLanguage } from '../../context/LanguageContext';
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
} from 'lucide-react';

interface AficionadoViewProps {
  user: UserProfile;
  pendingEventId?: string | null;
  onClearPendingEvent?: () => void;
  initialTab?: 'boletos' | 'membresia' | 'tienda' | 'comida' | 'pedidos';
}

export const AficionadoView: React.FC<AficionadoViewProps> = ({
  user,
  pendingEventId,
  onClearPendingEvent,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<'boletos' | 'membresia' | 'tienda' | 'comida' | 'pedidos'>(() => {
    if (pendingEventId) return 'boletos';
    if (initialTab) return initialTab;
    return 'boletos';
  });
  const { t } = useLanguage();

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
      setActiveTab('boletos');
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [pendingEventId, initialTab]);

  return (
    <div className="space-y-6 pb-24">
      {/* Saludo con selector de sede integrado al lado del nombre */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>{t('aficionado.hello', 'Hola,')}</span>
              <span>{user.displayName || 'Aficionado'}</span>
            </h1>

            {/* Selector de Estadio integrado al lado del nombre del aficionado */}
            <div className="relative inline-flex items-center">
              <label htmlFor="client-venue-selector-header" className="sr-only">
                Seleccionar estadio o recinto
              </label>
              <div className="flex items-center gap-1.5 pl-2.5 pr-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all shadow-xs group cursor-pointer">
                <MapPin className="w-3.5 h-3.5 text-red-700 shrink-0" />
                <select
                  id="client-venue-selector-header"
                  value={selectedVenueId}
                  onChange={(e) => handleSelectVenue(e.target.value)}
                  disabled={loadingVenues || venues.length === 0}
                  className="bg-transparent text-xs font-bold text-slate-800 pr-5 focus:outline-none cursor-pointer appearance-none"
                  title="Cambiar estadio visualizado"
                >
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id} className="text-slate-900 font-medium">
                      {venue.name} ({venue.city})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none group-hover:text-slate-700 transition-colors" />
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('aficionado.tagline', 'Portal de Experiencia del Aficionado • Boletos, eventos, consumos y tienda en tu sede')}
          </p>
        </div>
      </div>

      {/* Contenido de la vista según pestaña activa */}
      {activeTab === 'boletos' && (
        <MisBoletos
          user={effectiveUser}
          initialEventId={pendingEventId}
          onClearInitialEvent={onClearPendingEvent}
          selectedVenueId={selectedVenueId}
          onSelectVenue={handleSelectVenue}
        />
      )}
      {activeTab === 'membresia' && <MiMembresia user={effectiveUser} />}
      {activeTab === 'tienda' && (
        <TiendaMerch user={effectiveUser} onOrderCompleted={() => setActiveTab('pedidos')} />
      )}
      {activeTab === 'comida' && (
        <MenuStand
          user={effectiveUser}
          onOrderSuccess={() => setActiveTab('pedidos')}
          onGoToTickets={() => setActiveTab('boletos')}
        />
      )}
      {activeTab === 'pedidos' && <MisPedidos user={effectiveUser} />}

      {/* Menú de Navegación Inferior Fijo (Estilo Cine/Retail - 4 opciones sin scroll) */}
      <nav
        id="aficionado-bottom-nav"
        aria-label="Navegación principal del aficionado"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.07)]"
      >
        <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-1.5 sm:py-2 text-center">
          {/* 1. Boletos */}
          <button
            id="bottom-nav-boletos"
            type="button"
            onClick={() => setActiveTab('boletos')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'boletos'
                ? 'text-red-700 font-black'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === 'boletos' ? 'bg-red-50 text-red-700 shadow-2xs' : 'text-slate-400'
              }`}
            >
              <Ticket className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight tracking-tight mt-0.5">
              {t('nav.tickets', 'Boletos')}
            </span>
          </button>

          {/* 2. Tienda */}
          <button
            id="bottom-nav-tienda"
            type="button"
            onClick={() => setActiveTab('tienda')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'tienda'
                ? 'text-red-700 font-black'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === 'tienda' ? 'bg-red-50 text-red-700 shadow-2xs' : 'text-slate-400'
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight tracking-tight mt-0.5">
              {t('nav.store', 'Tienda')}
            </span>
          </button>

          {/* 3. Comida */}
          <button
            id="bottom-nav-comida"
            type="button"
            onClick={() => setActiveTab('comida')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'comida'
                ? 'text-red-700 font-black'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === 'comida' ? 'bg-red-50 text-red-700 shadow-2xs' : 'text-slate-400'
              }`}
            >
              <Utensils className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight tracking-tight mt-0.5">
              {t('nav.food', 'Comida')}
            </span>
          </button>

          {/* 4. Pedidos */}
          <button
            id="bottom-nav-pedidos"
            type="button"
            onClick={() => setActiveTab('pedidos')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'pedidos'
                ? 'text-red-700 font-black'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === 'pedidos' ? 'bg-red-50 text-red-700 shadow-2xs' : 'text-slate-400'
              }`}
            >
              <Package className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight tracking-tight mt-0.5">
              {t('nav.orders', 'Pedidos')}
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};
