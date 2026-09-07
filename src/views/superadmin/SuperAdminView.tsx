import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { VenuesManager } from './VenuesManager';
import { AdminsManager } from './AdminsManager';
import {
  Building2,
  Users,
  ShieldCheck,
  Crown,
  Sparkles,
  Info,
} from 'lucide-react';

interface SuperAdminViewProps {
  user: UserProfile;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'venues' | 'admins'>('venues');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header del Superadministrador */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5" />
                Superadmin Platform
              </span>
              <span className="text-xs text-slate-400">
                Gestión Central de la Plataforma
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Panel de Superadministrador
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Administración global de recintos deportivos, espectáculos y designación de administradores con alcance por sede.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-xs border border-white/10 p-3 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
              {(user.displayName || user.email || 'S')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                {user.displayName || 'Superadministrador'}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Decoración geométrica sutil */}
        <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -top-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Banner Informativo de Alcance de Seguridad */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-xl text-amber-800 shrink-0">
          <Info className="w-4 h-4" />
        </div>
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong className="font-bold">Principio de Mínimo Privilegio:</strong> Tu rol de Superadministrador tiene gobernanza exclusiva sobre la infraestructura (creación de sedes, eventos y asignación de administradores). Los datos transaccionales y operativos de cada sede (inventario, ventas, despachos) permanecen aislados para los administradores locales correspondientes.
        </div>
      </div>

      {/* Pestañas Principales */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          id="tab-venues"
          onClick={() => setActiveTab('venues')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'venues'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4 text-red-500" />
          Sedes & Eventos
        </button>

        <button
          id="tab-admins"
          onClick={() => setActiveTab('admins')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'admins'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          Administradores de Sede
        </button>
      </div>

      {/* Renderizado de la pestaña activa */}
      {activeTab === 'venues' ? <VenuesManager /> : <AdminsManager />}
    </div>
  );
};
