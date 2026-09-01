import React, { useState, useEffect } from 'react';
import { Membership, UserProfile } from '../../types';
import {
  subscribeUserMembership,
  createSampleMembershipForUser,
} from '../../lib/memberships';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { Award, Calendar, CheckCircle, ShieldCheck, Sparkles } from 'lucide-react';

interface MiMembresiaProps {
  user: UserProfile;
}

export const MiMembresia: React.FC<MiMembresiaProps> = ({ user }) => {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeUserMembership(
      user.uid,
      (m) => {
        setMembership(m);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  const handleCreateSample = async (tier: 'Oro' | 'Platino' | 'Diamante') => {
    setGenerating(true);
    try {
      await createSampleMembershipForUser(user.uid, tier);
    } catch (err) {
      console.error('Error generating membership:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Consultando membresía Socio Venados..." />;
  }

  if (!membership) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-10 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <Award className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-bold text-slate-900">
            Aún no eres Socio Venados
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            El abono Socio Venados te da acceso a toda la temporada, butaca asegurada,
            preventas exclusivas de playoffs y beneficios en el estadio.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => handleCreateSample('Platino')}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors uppercase tracking-wider"
          >
            <Sparkles className="w-4 h-4" /> Activar Abono Platino (Prueba)
          </button>
          <button
            onClick={() => handleCreateSample('Oro')}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-sm transition-colors uppercase tracking-wider"
          >
            Activar Abono Oro (Prueba)
          </button>
        </div>
      </div>
    );
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Diamante':
        return 'from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/50 text-indigo-100';
      case 'Platino':
        return 'from-slate-800 via-slate-700 to-slate-900 border-slate-400/40 text-slate-100';
      case 'Oro':
      default:
        return 'from-amber-900 via-amber-800 to-amber-950 border-amber-500/40 text-amber-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Tarjeta de Membresía Digital tipo Credencial */}
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getTierColor(
          membership.tier
        )} p-6 sm:p-8 text-white shadow-xl border`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center font-black text-xl border border-white/20">
              V
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/70 block">
                Pase Oficial
              </span>
              <h3 className="text-xl font-black tracking-tight">
                SOCIO VENADOS
              </h3>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 backdrop-blur-xs border border-white/30">
            {membership.tier}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-white/60">
              Titular
            </span>
            <span className="text-sm font-bold truncate block">
              {user.displayName || user.email}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-white/60">
              No. de Socio
            </span>
            <span className="text-sm font-mono font-bold">
              {membership.memberNumber}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-white/60">
              Estado
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
              <CheckCircle className="w-3.5 h-3.5" />
              {membership.status.toUpperCase()}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-white/60">
              Renovación
            </span>
            <span className="text-xs font-semibold text-white/90">
              {membership.renewalDate}
            </span>
          </div>
        </div>

        {membership.seatAssigned && (
          <div className="mt-4 bg-white/10 rounded-lg p-3 text-xs flex items-center justify-between border border-white/10">
            <span className="text-white/80">Butaca Reservada para Toda la Temporada:</span>
            <span className="font-bold text-white">{membership.seatAssigned}</span>
          </div>
        )}
      </div>

      {/* Beneficios */}
      {membership.benefits && membership.benefits.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-red-700" />
            Beneficios de tu Abono {membership.tier}
          </h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
            {membership.benefits.map((benefit, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></div>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
