import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { MisBoletos } from './MisBoletos';
import { MiMembresia } from './MiMembresia';
import { Ticket, Award } from 'lucide-react';

interface AficionadoViewProps {
  user: UserProfile;
}

export const AficionadoView: React.FC<AficionadoViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'boletos' | 'membresia'>('boletos');

  return (
    <div className="space-y-6">
      {/* Saludo y selector de sección */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Hola, {user.displayName || 'Aficionado Venados'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Bienvenido al portal del aficionado de los Venados de Mazatlán
          </p>
        </div>

        {/* Pestañas Aficionado */}
        <div className="inline-flex rounded-xl bg-slate-200/80 p-1 border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('boletos')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'boletos'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ticket className="w-4 h-4" />
            Mis Boletos
          </button>
          <button
            onClick={() => setActiveTab('membresia')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'membresia'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4" />
            Socio Venados
          </button>
        </div>
      </div>

      {/* Contenido de la vista */}
      {activeTab === 'boletos' ? (
        <MisBoletos user={user} />
      ) : (
        <MiMembresia user={user} />
      )}
    </div>
  );
};
