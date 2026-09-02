import React from 'react';
import { UserProfile } from '../../types';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  TrendingUp,
  Ticket,
  Users,
  Building2,
  Clock,
  Sparkles,
} from 'lucide-react';

interface AdminDashboardProps {
  user: UserProfile;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const upcomingModules = [
    {
      title: 'Administración de Ventas y Boletos',
      desc: 'Control de boletaje en tiempo real, ingresos por taquilla y abonos.',
      icon: TrendingUp,
      status: 'Fase Siguiente',
    },
    {
      title: 'Gestión de Inventario (Tienda & Alimentos)',
      desc: 'Control de stock de mercancía oficial, uniformes y souvenirs del club.',
      icon: Boxes,
      status: 'Planificado',
    },
    {
      title: 'Logística de Envíos & Pedidos',
      desc: 'Rastreo y despacho de pedidos de la tienda en línea y entregas en estadio.',
      icon: Truck,
      status: 'Planificado',
    },
    {
      title: 'Validación de Accesos & Molinetes',
      desc: 'Monitoreo de aforo en vivo y control de entradas en puertas.',
      icon: Ticket,
      status: 'Planificado',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado del Dashboard Admin */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-red-700/10 rounded-full blur-2xl"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-600/20 text-red-300 border border-red-500/30 mb-2">
              <Building2 className="w-3.5 h-3.5" /> Panel Operativo del Club
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Centro de Mando - VXP
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Administrador conectado: <strong className="text-slate-200">{user.displayName || user.email}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 border border-slate-700 font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              MVP Fase 1: Base Activa
            </span>
          </div>
        </div>
      </div>

      {/* Tarjeta de Base Lista para Expansión */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-red-50 rounded-lg text-red-700">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Andamiaje de Administración Preparado
            </h2>
            <p className="text-xs text-slate-500">
              La infraestructura de base de datos en Firestore, autenticación y reglas de seguridad por rol ya están configuradas.
            </p>
          </div>
        </div>

        {/* Grilla de módulos previstos para fases futuras */}
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Módulos del Negocio (Estructura lista para conectar en fases siguientes)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {upcomingModules.map((mod, idx) => {
              const Icon = mod.icon;
              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-start gap-3.5"
                >
                  <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 shrink-0">
                    <Icon className="w-5 h-5 text-red-700" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800">
                        {mod.title}
                      </h4>
                      <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 bg-white rounded border border-slate-200">
                        {mod.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {mod.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
