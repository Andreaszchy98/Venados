import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { updateRunnerStatus } from '../../lib/auth';
import { RunnerOrdersQueue } from './RunnerOrdersQueue';
import {
  Bike,
  Store,
  Clock,
  Utensils,
  MapPin,
} from 'lucide-react';

interface RunnerViewProps {
  user: UserProfile;
}

export const RunnerView: React.FC<RunnerViewProps> = ({ user }) => {
  const [currentStatus, setCurrentStatus] = useState<'disponible' | 'en_entrega' | 'inactivo'>(
    user.runnerStatus || 'disponible'
  );
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleStatusChange = async (newStatus: 'disponible' | 'en_entrega' | 'inactivo') => {
    setUpdatingStatus(true);
    try {
      await updateRunnerStatus(user.uid, newStatus);
      setCurrentStatus(newStatus);
    } catch (err) {
      console.error('Error actualizando estado de runner:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Estado del Runner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-600/30 text-blue-300 border border-blue-500/40 font-sports">
              <Bike className="w-3.5 h-3.5" />
              Despacho de Comandas a Butaca • Estadio Teodoro Mariscal
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {user.displayName || 'Runner Venados'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-amber-500/30 text-amber-300 font-bold">
                <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Negocio Asignado: <strong>{user.standName || 'Todos los Negocios'}</strong>
              </span>
              {user.assignedZone && (
                <span className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  Zona: <strong>{user.assignedZone}</strong>
                </span>
              )}
              <span className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Turno en Curso
              </span>
            </div>
          </div>

          {/* Selector de Estado Operativo */}
          <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sports">
              Tu Estado en Vivo:
            </div>
            <div className="flex items-center gap-2">
              {[
                { id: 'disponible', label: '🟢 Disponible', bg: 'bg-emerald-600 text-white' },
                { id: 'en_entrega', label: '🟡 En Entrega', bg: 'bg-amber-600 text-white' },
                { id: 'inactivo', label: '⚪ Fuera de Turno', bg: 'bg-slate-600 text-white' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => handleStatusChange(st.id as any)}
                  disabled={updatingStatus}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentStatus === st.id
                      ? `${st.bg} shadow-md scale-105`
                      : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Indicador de Tipo de Servicio: Solo Comandas de Comida en Butaca */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-700 text-white rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide font-sports border border-red-500/50 shadow-md">
          <Utensils className="w-4 h-4 text-amber-400" />
          Comandas de Alimentos y Bebidas a Butaca (In-Seat Delivery)
        </div>
        <span className="text-xs text-slate-400 hidden sm:inline-block">
          Entregas exclusivas de alimentos asignadas a tu negocio
        </span>
      </div>

      {/* Cola de Comandas en Tiempo Real */}
      <RunnerOrdersQueue user={user} />
    </div>
  );
};
