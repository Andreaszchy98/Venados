import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Venue } from '../../types';
import { MisBoletos } from './MisBoletos';
import { MiMembresia } from './MiMembresia';
import { TiendaMerch } from './TiendaMerch';
import { MenuStand } from './MenuStand';
import { MisCompras } from './MisCompras';
import { CarteleraLanding } from '../../components/cartelera/CarteleraLanding';
import { HistorialJuegos } from './HistorialJuegos';
import { MarcadorEnVivo } from './MarcadorEnVivo';
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
  Trophy,
} from 'lucide-react';

interface AficionadoViewProps {
  user: UserProfile;
  pendingEventId?: string | null;
  onClearPendingEvent?: () => void;
  initialTab?: 'cartelera' | 'boletos' | 'membresia' | 'tienda' | 'comida' | 'pedidos' | 'historial';
  onRequireAuth?: () => void;
}

export const AficionadoView: React.FC<AficionadoViewProps> = ({
  user,
  pendingEventId,
  onClearPendingEvent,
  initialTab,
  onRequireAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'cartelera' | 'boletos' | 'membresia' | 'tienda' | 'comida' | 'pedidos' | 'historial'>(() => {
    if (pendingEventId) return 'boletos';
    if (initialTab) return initialTab;
    return 'cartelera';
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(pendingEventId || null);
  const [scoreboardEventId, setScoreboardEventId] = useState<string | null>(null);
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
        const safeList = venuesList || [];
        setVenues(safeList);
        if (safeList.length > 0) {
          setSelectedVenueId((prev) => {
            if (prev && safeList.some((v) => v.id === prev)) {
              return prev;
            }
            const savedLocal = localStorage.getItem('vxp_selected_venue_id');
            if (savedLocal && safeList.some((v) => v.id === savedLocal)) {
              return savedLocal;
            }
            const preferred = user.browsingVenueId || user.venueId;
            return preferred && safeList.some((v) => v.id === preferred)
              ? preferred
              : safeList[0].id;
          });
        }
        setLoadingVenues(false);
      },
      () => {
        setLoadingVenues(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Sincronizar cuando la sede cambie desde el panel de "Mi Cuenta y Ajustes" del Header
  useEffect(() => {
    const onVenueChanged = (e: any) => {
      const newVId = e.detail;
      if (newVId && newVId !== selectedVenueId) {
        setSelectedVenueId(newVId);
      }
    };
    window.addEventListener('vxp_venue_changed', onVenueChanged);
    return () => {
      window.removeEventListener('vxp_venue_changed', onVenueChanged);
    };
  }, [selectedVenueId]);

  // Manejar cambio de sede desde cualquier selector
  const handleSelectVenue = (newVenueId: string) => {
    setSelectedVenueId(newVenueId);
    try {
      localStorage.setItem('vxp_selected_venue_id', newVenueId);
    } catch {}

    const chosen = venues.find((v) => v.id === newVenueId);
    if (chosen?.city) {
      try {
        localStorage.setItem('vxp_selected_city', chosen.city);
      } catch {}
    }

    try {
      window.dispatchEvent(new CustomEvent('vxp_venue_changed', { detail: newVenueId }));
    } catch {}

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
    <div className={`space-y-4 pb-20 transition-colors ${
      theme === 'light' ? 'text-slate-900' : 'text-slate-100'
    }`}>
      {/* Visor de Marcador en Vivo / Resumen si hay un evento seleccionado */}
      {scoreboardEventId ? (
        <MarcadorEnVivo
          eventId={scoreboardEventId}
          venueId={selectedVenueId}
          onBack={() => setScoreboardEventId(null)}
          onBuyTickets={() => {
            setScoreboardEventId(null);
            setActiveTab('boletos');
          }}
        />
      ) : (
        <>
          {/* Contenido de la vista según pestaña activa */}
          {activeTab === 'cartelera' && (
            <CarteleraLanding
              user={effectiveUser}
              selectedVenueId={selectedVenueId}
              onSelectVenue={handleSelectVenue}
              initialEventId={selectedEventId}
              onClearInitialEvent={() => {
                setSelectedEventId(null);
                onClearPendingEvent?.();
              }}
              onSelectEvent={(eventId) => {
                setSelectedEventId(eventId);
              }}
              onTicketPurchased={() => {
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
              onNavigateToCartelera={() => setActiveTab('cartelera')}
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
            <MisCompras
              user={effectiveUser}
              onOpenAuth={onRequireAuth}
              onNavigateToBuyTickets={() => setActiveTab('boletos')}
              onNavigateToFood={() => setActiveTab('comida')}
              onNavigateToStore={() => setActiveTab('tienda')}
            />
          )}
          {activeTab === 'historial' && (
            <HistorialJuegos
              initialVenueId={selectedVenueId}
              venues={venues}
              onSelectGame={(eventId) => setScoreboardEventId(eventId)}
            />
          )}
        </>
      )}

      {/* Barra de Pestañas Superior para Tablet / Escritorio (>= md) */}
      <div className="hidden md:flex items-center justify-center gap-3 max-w-2xl mx-auto mb-6 px-4">
        <button
          type="button"
          onClick={() => setActiveTab('cartelera')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-sports uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs ${
            activeTab === 'cartelera'
              ? 'bg-red-600 text-white shadow-md shadow-red-950/30'
              : theme === 'light'
              ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              : 'bg-[#101625] hover:bg-[#182032] text-slate-300 border border-slate-800'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>{t('nav.billboard', 'Cartelera')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('comida')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-sports uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs ${
            activeTab === 'comida'
              ? 'bg-red-600 text-white shadow-md shadow-red-950/30'
              : theme === 'light'
              ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              : 'bg-[#101625] hover:bg-[#182032] text-slate-300 border border-slate-800'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>{t('nav.food', 'Comida')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tienda')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-sports uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs ${
            activeTab === 'tienda'
              ? 'bg-red-600 text-white shadow-md shadow-red-950/30'
              : theme === 'light'
              ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              : 'bg-[#101625] hover:bg-[#182032] text-slate-300 border border-slate-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>{t('nav.store', 'Tienda')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pedidos')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-sports uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs ${
            activeTab === 'pedidos'
              ? 'bg-red-600 text-white shadow-md shadow-red-950/30'
              : theme === 'light'
              ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              : 'bg-[#101625] hover:bg-[#182032] text-slate-300 border border-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{t('nav.purchases', 'Mis Compras')}</span>
        </button>
      </div>

      {/* Menú de Navegación Inferior Fijo para Móvil (< md) */}
      <nav
        id="aficionado-bottom-nav"
        aria-label="Navegación principal del aficionado"
        className={`block md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t-2 transition-colors ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]'
            : 'bg-[#0F172A]/98 border-red-600/80 shadow-[0_-10px_35px_rgba(0,0,0,0.85)]'
        }`}
      >
        <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-1.5 sm:py-2 text-center">
          {/* 1. Cartelera (Explorar partidos y compra de boletos en mapa) */}
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

          {/* 2. Comida */}
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

          {/* 4. Mis Compras (Historial consolidado con QR, pedidos y compras) */}
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
              {t('nav.purchases', 'Mis Compras')}
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};
