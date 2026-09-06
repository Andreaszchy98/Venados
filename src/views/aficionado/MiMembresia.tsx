import React, { useMemo } from 'react';
import { Membership, UserProfile } from '../../types';
import { getStadiumStoreProfile } from '../../lib/stadiumStoreProfiles';
import { Award, Building2, ShieldAlert, MapPin, CheckCircle2, Lock } from 'lucide-react';

interface MiMembresiaProps {
  user: UserProfile;
}

export const MiMembresia: React.FC<MiMembresiaProps> = ({ user }) => {
  // Obtenemos la identidad y branding del estadio que se está visualizando (browsingVenueId)
  const activeVenueId = user.browsingVenueId || user.venueId;
  const storeProfile = useMemo(() => {
    return getStadiumStoreProfile(activeVenueId);
  }, [activeVenueId]);

  return (
    <div className="space-y-6">
      {/* Banner de Sede Vinculada */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${storeProfile.headerGradient} p-6 text-white border shadow-md`}>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border ${storeProfile.accentBadgeClass}`}>
              <Building2 className="w-3.5 h-3.5" />
              Sede Vinculada: {storeProfile.stadiumName}
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Abonos y Membresías • {storeProfile.teamName}
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Gestión de credenciales digitales de temporada, butacas asignadas y beneficios exclusivos vinculados a {storeProfile.stadiumName}.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold self-start sm:self-auto">
            <MapPin className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{storeProfile.pickupLocation}</span>
          </div>
        </div>
      </div>

      {/* Tarjeta Informativa de Estado Deshabilitado Temporalmente */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-5 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
          <Lock className="w-8 h-8" />
        </div>

        <div className="max-w-lg mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
            Módulo Deshabilitado Temporalmente
          </div>

          <h3 className="text-lg sm:text-xl font-black text-slate-900">
            {storeProfile.membershipTitle}
          </h3>

          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            La emisión y administración de membresías y abonos para{' '}
            <strong className="text-slate-800">{storeProfile.stadiumName}</strong> ({storeProfile.teamName})
            ha sido temporalmente pausada por la administración del recinto.
          </p>
        </div>

        {/* Datos de Vinculación Confirmada con el Estadio */}
        <div className="max-w-md mx-auto p-4 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
            <span className="flex items-center gap-1.5 text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Enlace de Datos Activo
            </span>
            <span className="text-[11px] font-mono text-slate-500">{activeVenueId || 'venue-teodoro-mariscal'}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Recinto Actual</span>
              <span className="font-semibold text-slate-800">{storeProfile.stadiumName}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Franquicia</span>
              <span className="font-semibold text-slate-800">{storeProfile.teamName}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Cualquier cambio de estadio en la barra superior mantendrá enlazado automáticamente el registro de este recinto.
        </p>
      </div>
    </div>
  );
};
