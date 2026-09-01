import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { AdminOverview } from './AdminOverview';
import { VentasAdmin } from './VentasAdmin';
import { InventarioAdmin } from './InventarioAdmin';
import { LogisticaAdmin } from './LogisticaAdmin';
import {
  ShieldAlert,
  TrendingUp,
  Boxes,
  Truck,
  LayoutDashboard,
  Receipt,
} from 'lucide-react';

interface AdminViewProps {
  user: UserProfile;
}

export const AdminView: React.FC<AdminViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'resumen' | 'ventas' | 'inventario' | 'logistica'>('resumen');

  return (
    <div className="space-y-6">
      {/* Header y Selector de Pestañas de Administración */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Administración General Venados</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
              Gerencia
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Panel de control para inventario, logística de envíos y contabilidad de ventas
          </p>
        </div>

        {/* Pestañas de Navegación de Negocio */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-200/90 rounded-2xl border border-slate-300 text-xs font-semibold scrollbar-none">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === 'resumen'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-red-700" />
            Resumen General
          </button>

          <button
            onClick={() => setActiveTab('ventas')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === 'ventas'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4 text-red-700" />
            Administración de Ventas
          </button>

          <button
            onClick={() => setActiveTab('inventario')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === 'inventario'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-4 h-4 text-blue-700" />
            Gestión de Inventario
          </button>

          <button
            onClick={() => setActiveTab('logistica')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === 'logistica'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4 text-purple-700" />
            Logística de Envíos
          </button>
        </div>
      </div>

      {/* Renderizado de Pestaña */}
      {activeTab === 'resumen' && (
        <AdminOverview onNavigateTab={(tab) => setActiveTab(tab)} />
      )}
      {activeTab === 'ventas' && <VentasAdmin />}
      {activeTab === 'inventario' && <InventarioAdmin />}
      {activeTab === 'logistica' && <LogisticaAdmin />}
    </div>
  );
};
