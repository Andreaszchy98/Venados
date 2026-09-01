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
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import {
  Ticket,
  Shield,
  Layers,
  Sparkles,
  Users,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser) {
        try {
          // Obtener o sincronizar perfil
          const profile = await syncUserProfile(currentUser);
          setUserProfile(profile);

          // Escuchar cambios en el documento de usuario en tiempo real (por ejemplo si cambia de rol)
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
          <div className="max-w-4xl mx-auto space-y-8 py-6">
            {/* Banner Principal */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-900 via-red-800 to-slate-950 text-white p-8 sm:p-12 shadow-xl border border-red-800/40 text-center sm:text-left">
              <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10 max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 backdrop-blur-xs border border-white/20 text-red-100">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Temporada 2026-2027 • LMP
                </div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                  Venados de Mazatlán
                </h1>
                <p className="text-sm sm:text-base text-red-100/90 leading-relaxed font-normal">
                  Bienvenido a la plataforma digital del Estadio Teodoro Mariscal.
                  Gestiona tus boletos para los partidos, consulta tu abono de Socio Venados
                  y accede a los servicios del estadio.
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

            {/* Tarjetas de arquitectura del MVP Fase 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
                  <Ticket className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Boletos Digitales
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Consulta de entradas con código QR único para acceso rápido por torniquetes en las puertas del estadio.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Socio Venados
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Credencial digital de abonado, butaca asignada para toda la temporada y fecha de renovación.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Control de Accesos & Roles
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Seguridad basada en roles (Aficionado, Admin, Taquilla) con reglas de Firestore y autenticación Firebase.
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
        <p>Venados App • MVP Fase 1 • Club Venados de Mazatlán &copy; 2026</p>
      </footer>
    </div>
  );
}
