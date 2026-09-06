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
    <div className="space-y-6">
      {/* Saludo con selector de sede integrado al lado del nombre y pestañas de navegación */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200">
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

        {/* Pestañas de Navegación del Aficionado */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-200/90 rounded-2xl border border-slate-300 text-xs font-semibold scrollbar-none">
          <button
            id="tab-aficionado-boletos"
            onClick={() => setActiveTab('boletos')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 cursor-pointer ${
              activeTab === 'boletos'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Ticket className="w-4 h-4 text-red-700" />
            {t('aficionado.tab.tickets', 'Mis Boletos')}
          </button>

          <button
            id="tab-aficionado-tienda"
            onClick={() => setActiveTab('tienda')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 cursor-pointer ${
              activeTab === 'tienda'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-red-700" />
            {t('aficionado.tab.store', 'Tienda Oficial')}
          </button>

          <button
            id="tab-aficionado-comida"
            onClick={() => setActiveTab('comida')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 cursor-pointer ${
              activeTab === 'comida'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Utensils className="w-4 h-4 text-amber-700" />
            {t('aficionado.tab.food', 'Comida & Bebidas')}
          </button>

          <button
            id="tab-aficionado-pedidos"
            onClick={() => setActiveTab('pedidos')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 cursor-pointer ${
              activeTab === 'pedidos'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 text-slate-800" />
            {t('aficionado.tab.orders', 'Mis Pedidos')}
          </button>

          <button
            id="tab-aficionado-membresia"
            onClick={() => setActiveTab('membresia')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
              activeTab === 'membresia'
                ? 'bg-white text-slate-800 shadow-xs font-bold'
                : 'text-slate-400 hover:text-slate-600'
            }`}
            title="Módulo de membresías y abonos deshabilitado temporalmente (enlace de sede activo)"
          >
            <Award className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('aficionado.tab.membership', 'Membresías')}</span>
            <span className="text-[9px] bg-slate-300 text-slate-600 font-bold px-1.5 py-0.2 rounded">Pausado</span>
          </button>
        </div>
      </div>

      {/* Contenido de la vista según pestaña */}
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
    </div>
  );
};
