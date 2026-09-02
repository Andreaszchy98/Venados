import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { syncUserProfile } from './lib/auth';
import { UserProfile, UserRole } from './types';
import { Header } from './components/shared/Header';
import { AuthModal } from './components/shared/AuthModal';
import { AficionadoView } from './views/aficionado/AficionadoView';
import { AdminView } from './views/admin/AdminView';
import { TaquillaView } from './views/taquilla/TaquillaView';
import { ConcesionarioView } from './views/concesionario/ConcesionarioView';
import { RunnerView } from './views/runner/RunnerView';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import {
  Ticket,
  Shield,
  Layers,
  Sparkles,
  Users,
  CheckCircle2,
  Calendar,
  Boxes,
  Truck,
  Utensils,
  ShoppingBag,
  TrendingUp,
  ChefHat,
  Receipt,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { ensureDefaultVenueExists } from './lib/defaultVenue';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Inicializar recinto y evento por defecto una sola vez al arrancar la app
  useEffect(() => {
    ensureDefaultVenueExists();
  }, []);

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

          const userDocRef = doc(db, 'users', currentUser.uid);
          unsubscribeUserDoc = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              setUserProfile({
                uid: currentUser.uid,
                email: data.email || currentUser.email,
                displayName: data.displayName || currentUser.displayName,
                role: data.role || 'aficionado',
                photoURL: data.photoURL || currentUser.photoURL,
                phoneNumber: data.phoneNumber || currentUser.phoneNumber,
                standId: data.standId,
                standName: data.standName,
                assignedZone: data.assignedZone,
                runnerStatus: data.runnerStatus,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt,
              });
            }
          });
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
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Barra de navegación superior */}
      <Header
        user={userProfile}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {loadingAuth ? (
          <div className="min-h-[50vh] flex items-center justify-center">
            <LoadingSpinner message="Verificando sesión en Firebase..." />
          </div>
        ) : !userProfile ? (
          /* Pantalla de Bienvenida cuando no hay sesión iniciada */
          <div className="max-w-5xl mx-auto space-y-8 py-6">
            {/* Banner Principal */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-950 via-red-900 to-slate-950 text-white p-8 sm:p-12 shadow-xl border border-red-800/40 text-center sm:text-left">
              <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10 max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 backdrop-blur-xs border border-white/20 text-red-100">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Temporada 2026-2027 • LMP • Mazatlán
                </div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                  Venados de Mazatlán
                </h1>
                <p className="text-sm sm:text-base text-red-100/90 leading-relaxed font-normal">
                  Plataforma integral para aficionados y la gestión completa del negocio:
                  boletos digitales, tienda oficial, pickup express de alimentos, administración de
                  inventario en almacén y logística de despacho.
                </p>
                <div className="pt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <button
                    id="hero-login-btn"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-6 py-3 bg-white hover:bg-slate-100 text-red-900 font-extrabold text-sm rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5"
                  >
                    Ingresar con Google o Correo
                  </button>
                </div>
              </div>
            </div>

            {/* Tarjetas de arquitectura de Negocio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Tienda & Alimentos
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Venta de uniformes oficiales, souvenirs y comanda Pickup Express sin filas en butaca.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Boxes className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Gestión de Inventario
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Control de stock de tienda y almacén, ajuste de piezas, costos y alertas de stock mínimo.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Logística de Envíos
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Despacho de pedidos, asignación de guías de transportistas (DHL, Estafeta) y tracking.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Auditoría de Ventas
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Consolidación financiera y métricas de ingresos multicanal en tiempo real.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Vistas según el rol del usuario */
          <div>
            {userProfile.role === 'aficionado' && (
              <AficionadoView user={userProfile} />
            )}
            {userProfile.role === 'admin' && (
              <AdminView user={userProfile} />
            )}
            {userProfile.role === 'concesionario' && (
              <ConcesionarioView user={userProfile} />
            )}
            {userProfile.role === 'runner' && (
              <RunnerView user={userProfile} />
            )}
            {userProfile.role === 'taquilla' && (
              <TaquillaView user={userProfile} />
            )}
          </div>
        )}
      </main>

      {/* Modal de Autenticación */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Pie de página discreto */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <p>VXP • Plataforma Integral del Negocio y Estadio • Club Venados de Mazatlán &copy; 2026</p>
      </footer>
    </div>
  );
}
