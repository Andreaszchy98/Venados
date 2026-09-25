import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { syncUserProfile } from './lib/auth';
import { UserProfile, UserRole } from './types';
import { Header } from './components/shared/Header';
import { AuthModal } from './components/shared/AuthModal';
import { AficionadoView } from './views/aficionado/AficionadoView';
import { AdminView } from './views/admin/AdminView';
import { TaquillaView } from './views/taquilla/TaquillaView';
import { TaquilleraPOSView } from './views/taquillera/TaquilleraPOSView';
import { ConcesionarioView } from './views/concesionario/ConcesionarioView';
import { RunnerView } from './views/runner/RunnerView';
import { SuperAdminView } from './views/superadmin/SuperAdminView';
import { ReclamoBoletoView } from './views/aficionado/ReclamoBoletoView';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { CarteleraLanding } from './components/cartelera/CarteleraLanding';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ensureDefaultVenueExists } from './lib/defaultVenue';
import { AutoDOMTranslator } from './components/shared/AutoDOMTranslator';
import { StripeSuccessModal } from './components/stripe/StripeSuccessModal';
import { StripeDemoCheckoutModal } from './components/stripe/StripeDemoCheckoutModal';
import { extractClaimTokenFromUrl } from './lib/tickets';
import { AlertCircle, X } from 'lucide-react';

function MainLayout() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { t, language, setLanguage } = useLanguage();
  const { theme } = useTheme();

  // Detectar token de reclamo/boleto en URL (/reclamo/[token], ?reclamo=..., /boleto/..., hash, etc.)
  const [claimToken] = useState<string | null>(() => extractClaimTokenFromUrl());

  if (claimToken) {
    return (
      <ReclamoBoletoView
        claimToken={claimToken}
        onNavigateHome={() => {
          try {
            const cleanOrigin = window.location.origin;
            window.history.replaceState({}, '', cleanOrigin + '/');
          } catch {}
          window.location.href = '/';
        }}
      />
    );
  }

  // Evento o pestaña preseleccionada antes de iniciar sesión
  const [pendingEventId, setPendingEventId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('pendingEventId');
    } catch {
      return null;
    }
  });

  const [pendingView, setPendingView] = useState<'cartelera' | 'tienda' | 'comida' | 'boletos' | null>(() => {
    try {
      return (sessionStorage.getItem('pendingView') as any) || null;
    } catch {
      return null;
    }
  });

  // Vista simulada en cliente (para administradores que exploran otros módulos sin alterar su rol real en la BD)
  const [activeView, setActiveView] = useState<UserRole | null>(() => {
    try {
      const saved = sessionStorage.getItem('vxp_active_view');
      return (saved as UserRole) || null;
    } catch {
      return null;
    }
  });

  const handleActiveViewChange = (newView: UserRole | null) => {
    setActiveView(newView);
    try {
      if (newView) {
        sessionStorage.setItem('vxp_active_view', newView);
      } else {
        sessionStorage.removeItem('vxp_active_view');
      }
    } catch {}
  };

  // Calcular el rol efectivo a renderizar (mantiene intacto el rol real de Firestore)
  const effectiveRole = useMemo(() => {
    if (!userProfile) return null;
    if ((userProfile.role === 'admin' || userProfile.role === 'superadmin') && activeView) {
      return activeView;
    }
    return userProfile.role;
  }, [userProfile, activeView]);

  // Perfil simulado para entregar al componente renderizado
  const activeUserProfile = useMemo(() => {
    if (!userProfile) return null;
    if (effectiveRole && effectiveRole !== userProfile.role) {
      return { ...userProfile, role: effectiveRole };
    }
    return userProfile;
  }, [userProfile, effectiveRole]);

  // Estados para Stripe Checkout (Éxito, Cancelado y Simulación Demo)
  const [stripeSuccessSessionId, setStripeSuccessSessionId] = useState<string | null>(null);
  const [stripeDemoSessionId, setStripeDemoSessionId] = useState<string | null>(null);
  const [stripeCancelledNotice, setStripeCancelledNotice] = useState<boolean>(false);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const stripeStatus = searchParams.get('stripe_status');
      const sessionId = searchParams.get('session_id');
      const demoId = searchParams.get('stripe_checkout_demo');

      if (stripeStatus === 'success' && sessionId) {
        setStripeSuccessSessionId(sessionId);
      } else if (demoId) {
        setStripeDemoSessionId(demoId);
      } else if (stripeStatus === 'cancelled') {
        setStripeCancelledNotice(true);
      }
    } catch (e) {
      console.warn('Error leyendo parámetros de Stripe:', e);
    }
  }, []);

  // Perfil de invitado para navegación abierta sin login
  const guestUser: UserProfile = useMemo(() => {
    let localVenue = localStorage.getItem('vxp_selected_venue_id');
    if (localVenue === 'venue-chevron') {
      localVenue = 'venue-teodoro-mariscal';
      try {
        localStorage.setItem('vxp_selected_venue_id', 'venue-teodoro-mariscal');
      } catch {}
    }
    return {
      uid: '',
      email: '',
      displayName: '',
      role: 'aficionado',
      browsingVenueId: localVenue || 'venue-teodoro-mariscal',
      browsingVenueName: 'Estadio Teodoro Mariscal',
      venueId: 'venue-teodoro-mariscal',
      venueName: 'Estadio Teodoro Mariscal',
      createdAt: new Date().toISOString(),
    };
  }, []);

  // Si el usuario autenticado tiene un rol distinto a aficionado, descartar pendingEventId y pendingView
  useEffect(() => {
    if (userProfile && userProfile.role !== 'aficionado') {
      if (pendingEventId) {
        try {
          sessionStorage.removeItem('pendingEventId');
        } catch {}
        setPendingEventId(null);
      }
      if (pendingView) {
        try {
          sessionStorage.removeItem('pendingView');
        } catch {}
        setPendingView(null);
      }
    }
  }, [userProfile, pendingEventId, pendingView]);

  const handleSelectHeroEvent = (eventId: string) => {
    try {
      sessionStorage.setItem('pendingEventId', eventId);
      sessionStorage.removeItem('pendingView');
    } catch {}
    setPendingEventId(eventId);
    setPendingView('boletos');
  };

  const handleGenericLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleCloseAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser) {
        // Asegurar recinto con sesión activa
        ensureDefaultVenueExists();
        try {
          const profile = await syncUserProfile(currentUser);
          setUserProfile(profile);

          // Si el usuario ya tenía idioma preferido guardado en Firestore, sincronizarlo
          if (profile.language && profile.language !== language) {
            setLanguage(profile.language);
          }

          const userDocRef = doc(db, 'users', currentUser.uid);
          unsubscribeUserDoc = onSnapshot(
            userDocRef,
            (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                if (data.language && data.language !== language) {
                  setLanguage(data.language);
                }
                let safeVenueId = data.venueId;
                let safeVenueName = data.venueName;

                // Si Firestore aún tuviese la sede inexistente Estadio Chevron, auto-sanitizar inmediatamente
                if (data.venueId === 'venue-chevron' || data.venueName === 'Estadio Chevron' || data.browsingVenueId === 'venue-chevron') {
                  safeVenueId = 'venue-teodoro-mariscal';
                  safeVenueName = 'Estadio Teodoro Mariscal';
                  updateDoc(userDocRef, {
                    venueId: 'venue-teodoro-mariscal',
                    venueName: 'Estadio Teodoro Mariscal',
                    browsingVenueId: 'venue-teodoro-mariscal',
                    browsingVenueName: 'Estadio Teodoro Mariscal',
                    updatedAt: new Date().toISOString(),
                  }).catch(() => {});
                }

                setUserProfile({
                  uid: currentUser.uid,
                  email: data.email || currentUser.email,
                  displayName: data.displayName || currentUser.displayName,
                  role: data.role || 'aficionado',
                  language: data.language,
                  photoURL: data.photoURL || currentUser.photoURL,
                  phoneNumber: data.phoneNumber || currentUser.phoneNumber,
                  standId: data.standId,
                  standName: data.standName,
                  assignedZone: data.assignedZone,
                  runnerStatus: data.runnerStatus,
                  venueId: safeVenueId,
                  venueName: safeVenueName,
                  createdAt: data.createdAt || new Date().toISOString(),
                  updatedAt: data.updatedAt,
                });
              }
            },
            (error) => {
              console.warn('Error en listener de perfil de usuario:', error);
            }
          );
        } catch (err) {
          console.error('Error syncing profile:', err);
        }
      } else {
        setUserProfile(null);
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
          unsubscribeUserDoc = null;
        }
      }
      setLoadingAuth(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      theme === 'light' ? 'bg-[#F4F6F9] text-slate-900 theme-light' : 'bg-[#0A0E17] text-slate-100 theme-dark'
    }`}>
      {/* Traductor universal de DOM para traducir automáticamente cualquier contenido */}
      <AutoDOMTranslator />

      {/* Barra de navegación superior con botón de idioma y selector de estilo */}
      <Header
        user={userProfile}
        onOpenAuth={handleGenericLogin}
        activeView={activeView}
        onActiveViewChange={handleActiveViewChange}
      />

      {/* Banner Flotante Informativo de Modo Vista Simulada para Administradores */}
      {userProfile && (userProfile.role === 'admin' || userProfile.role === 'superadmin') && activeView && activeView !== userProfile.role && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-black px-4 py-2 text-xs font-bold shadow-xl flex flex-wrap items-center justify-between gap-2 z-30 sticky top-14 font-sports border-b border-amber-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-black animate-ping shrink-0" />
            <span>
              👁️ MODO VISTA SIMULADA: <strong className="uppercase bg-black/20 px-1.5 py-0.5 rounded text-black font-black">{activeView}</strong> • Tu rol real en base de datos es permanentemente <strong className="uppercase font-black">{userProfile.role}</strong>.
            </span>
          </div>
          <button
            onClick={() => handleActiveViewChange(null)}
            className="px-3 py-1 bg-black text-amber-300 hover:text-white rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border border-amber-400/50 flex items-center gap-1"
          >
            <span>Volver a Panel Administrador</span> ↩
          </button>
        </div>
      )}

      {/* Contenido Principal */}
      <main className={`flex-1 w-full ${!activeUserProfile || activeUserProfile?.role === 'aficionado' ? 'p-0 max-w-none' : 'max-w-7xl mx-auto p-3 sm:p-6 lg:p-8'}`}>
        {/* Banner de cancelación de Stripe si el usuario canceló el checkout */}
        {stripeCancelledNotice && (
          <div className="bg-amber-950/90 border-b border-amber-600/50 text-amber-200 px-4 py-3 flex items-center justify-between text-xs transition-all">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>El proceso de pago con tarjeta en Stripe fue cancelado. No se realizó ningún cargo a tu cuenta bancaria.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStripeCancelledNotice(false);
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('stripe_status');
                  window.history.replaceState({}, '', url.toString());
                } catch {}
              }}
              className="p-1 text-amber-400 hover:text-white rounded hover:bg-amber-900/50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loadingAuth ? (
          <div className="min-h-[50vh] flex items-center justify-center">
            <LoadingSpinner message={t('hero.loading_session', 'Cargando eventos y experiencia VXP...')} />
          </div>
        ) : !activeUserProfile ? (
          /* Navegación libre para invitados (Cartelera, Boletos, Tienda, Comida) */
          <AficionadoView
            user={guestUser}
            pendingEventId={pendingEventId}
            initialTab={
              pendingView === 'tienda'
                ? 'tienda'
                : pendingView === 'comida'
                ? 'comida'
                : pendingView === 'boletos'
                ? 'boletos'
                : pendingEventId
                ? 'boletos'
                : 'cartelera'
            }
            onClearPendingEvent={() => {
              try {
                sessionStorage.removeItem('pendingEventId');
                sessionStorage.removeItem('pendingView');
              } catch {}
              setPendingEventId(null);
              setPendingView(null);
            }}
            onRequireAuth={handleGenericLogin}
          />
        ) : (
          /* Vistas según el rol efectivo del usuario */
          <div>
            {effectiveRole === 'superadmin' && activeUserProfile && (
              <SuperAdminView user={activeUserProfile} />
            )}
            {effectiveRole === 'aficionado' && activeUserProfile && (
              <AficionadoView
                user={activeUserProfile}
                pendingEventId={pendingEventId}
                initialTab={
                  pendingView === 'tienda'
                    ? 'tienda'
                    : pendingView === 'comida'
                    ? 'comida'
                    : pendingView === 'boletos'
                    ? 'boletos'
                    : pendingEventId
                    ? 'boletos'
                    : undefined
                }
                onClearPendingEvent={() => {
                  try {
                    sessionStorage.removeItem('pendingEventId');
                    sessionStorage.removeItem('pendingView');
                  } catch {}
                  setPendingEventId(null);
                  setPendingView(null);
                }}
                onRequireAuth={handleGenericLogin}
              />
            )}
            {effectiveRole === 'admin' && activeUserProfile && (
              <AdminView user={activeUserProfile} />
            )}
            {effectiveRole === 'concesionario' && activeUserProfile && (
              <ConcesionarioView user={activeUserProfile} />
            )}
            {effectiveRole === 'runner' && activeUserProfile && (
              <RunnerView user={activeUserProfile} />
            )}
            {effectiveRole === 'taquillera' && activeUserProfile && (
              <TaquilleraPOSView user={activeUserProfile} />
            )}
            {effectiveRole === 'taquilla' && activeUserProfile && (
              <TaquillaView user={activeUserProfile} />
            )}
          </div>
        )}
      </main>

      {/* Modal de Autenticación */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleCloseAuthModal}
        customTitle={pendingEventId ? 'Continuar al Evento' : undefined}
        customSubtitle={
          pendingEventId
            ? 'Inicia sesión para elegir tus butacas y confirmar tus boletos'
            : pendingView === 'tienda'
            ? 'Inicia sesión para ver tu carrito y productos de la tienda'
            : pendingView === 'comida'
            ? 'Inicia sesión para ordenar alimentos y bebidas'
            : undefined
        }
      />

      {/* Modal de éxito de Stripe Checkout (Verificación y Emisión de Boleto) */}
      {stripeSuccessSessionId && (
        <StripeSuccessModal
          sessionId={stripeSuccessSessionId}
          onClose={() => setStripeSuccessSessionId(null)}
          onNavigateToTickets={() => {
            setPendingView('boletos');
            setStripeSuccessSessionId(null);
          }}
        />
      )}

      {/* Modal de simulación de pago Stripe para desarrollo/evaluación */}
      {stripeDemoSessionId && (
        <StripeDemoCheckoutModal
          sessionId={stripeDemoSessionId}
          onClose={() => {
            setStripeDemoSessionId(null);
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete('stripe_checkout_demo');
              window.history.replaceState({}, '', url.toString());
            } catch {}
          }}
        />
      )}

      {/* Pie de página discreto con soporte de traducción */}
      <footer className={`mt-auto border-t py-4 px-6 text-center text-xs transition-colors ${
        theme === 'light'
          ? 'border-slate-200 bg-white text-slate-500'
          : 'border-slate-800/80 bg-[#070A10] text-slate-400'
      }`}>
        <p>{t('footer.copyright', 'VXP — Venue Experience Platform © 2026')}</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <MainLayout />
      </LanguageProvider>
    </ThemeProvider>
  );
}

