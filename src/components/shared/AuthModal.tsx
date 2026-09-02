import React, { useState } from 'react';
import {
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
} from '../../lib/auth';
import { ErrorMessage } from './ErrorMessage';
import { LogIn, UserPlus, Mail, Lock, User, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (isRegister) {
        if (!email.trim() || !password.trim()) {
          throw new Error('Por favor completa todos los campos.');
        }
        await registerWithEmail(email, password, displayName, 'aficionado');
      } else {
        if (!email.trim() || !password.trim()) {
          throw new Error('Ingresa tu correo y contraseña.');
        }
        await signInWithEmail(email, password);
      }
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de autenticación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div
        id="auth-modal-container"
        className="relative w-full max-w-sm sm:max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Encabezado con imagen/identidad Venados */}
        <div className="bg-gradient-to-r from-red-800 to-red-900 text-white p-5 sm:p-6 text-center relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 border border-white/20 mb-2 sm:mb-3">
            <span className="text-lg sm:text-xl font-black tracking-tighter">V</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">
            {isRegister ? 'Crear Cuenta en VXP' : 'Bienvenido a VXP'}
          </h2>
          <p className="text-[11px] sm:text-xs text-red-100/90 mt-1">
            Plataforma oficial del Club Venados de Mazatlán
          </p>
        </div>

        {/* Cuerpo del Formulario */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
          {errorMessage && (
            <ErrorMessage
              message={errorMessage}
              onDismiss={() => setErrorMessage(null)}
            />
          )}

          {/* Botón de Google */}
          <button
            id="google-signin-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            Continuar con Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-200"></div>
            <span className="text-xs text-slate-400 font-medium">o con correo</span>
            <div className="flex-1 border-t border-slate-200"></div>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ej. Carlos Mendoza"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-red-600 focus:border-red-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-red-600 focus:border-red-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-red-600 focus:border-red-600"
                />
              </div>
            </div>

            <button
              id="submit-auth-btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-red-700 hover:bg-red-800 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : isRegister ? (
                <>
                  <UserPlus className="w-4 h-4" /> Registrarme
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Iniciar Sesión
                </>
              )}
            </button>
          </form>

          {/* Selector de Alternancia Login/Registro */}
          <div className="pt-2 text-center text-xs text-slate-600">
            {isRegister ? (
              <span>
                ¿Ya tienes una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setErrorMessage(null);
                  }}
                  className="text-red-700 font-bold hover:underline"
                >
                  Iniciar sesión
                </button>
              </span>
            ) : (
              <span>
                ¿No tienes cuenta todavía?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setErrorMessage(null);
                  }}
                  className="text-red-700 font-bold hover:underline"
                >
                  Regístrate aquí
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
