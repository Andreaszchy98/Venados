import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { VenuesManager } from './VenuesManager';
import { AdminsManager } from './AdminsManager';
import { useTheme } from '../../context/ThemeContext';
import {
  Building2,
  ShieldCheck,
  Crown,
} from 'lucide-react';

interface SuperAdminViewProps {
  user: UserProfile;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ user }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'venues' | 'admins'>('venues');

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Header del Superadministrador - Limpio, compacto y adaptable */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          theme === 'light'
            ? 'bg-white border-slate-200 shadow-xs text-slate-900'
            : 'bg-[#0F1626] border-slate-800 shadow-md text-white'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight font-sports uppercase">
                  Panel de Superadministrador
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-sports">
                  Global
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                Gestión central de recintos deportivos y administradores por sede
              </p>
            </div>
          </div>

          <div
            className={`text-xs font-mono px-3 py-1.5 rounded-xl border flex items-center gap-2 self-start sm:self-auto ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-200 text-slate-600'
                : 'bg-[#0A0E17] border-slate-800 text-slate-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="truncate max-w-[200px] sm:max-w-none">{user.email}</span>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas Moderno y Limpio */}
      <div
        className={`p-1 rounded-2xl border flex gap-1 ${
          theme === 'light' ? 'bg-slate-200/60 border-slate-300' : 'bg-[#0A0E17] border-slate-800'
        }`}
      >
        <button
          id="tab-venues"
          onClick={() => setActiveTab('venues')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer font-sports ${
            activeTab === 'venues'
              ? 'bg-red-600 text-white shadow-md'
              : theme === 'light'
              ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Sedes & Recintos</span>
        </button>

        <button
          id="tab-admins"
          onClick={() => setActiveTab('admins')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer font-sports ${
            activeTab === 'admins'
              ? 'bg-red-600 text-white shadow-md'
              : theme === 'light'
              ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Administradores de Sede</span>
        </button>
      </div>

      {/* Renderizado de la pestaña activa */}
      {activeTab === 'venues' ? <VenuesManager /> : <AdminsManager />}
    </div>
  );
};
