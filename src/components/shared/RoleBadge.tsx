import React from 'react';
import { UserRole } from '../../types';
import { Shield, Ticket, User, Utensils, Bike, Crown, Printer } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface RoleBadgeProps {
  role: UserRole;
  showIcon?: boolean;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, showIcon = true }) => {
  const { t } = useLanguage();

  switch (role) {
    case 'superadmin':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs font-sports">
          {showIcon && <Crown className="w-3.5 h-3.5 text-amber-400" />}
          {t('role.superadmin', 'Superadmin')}
        </span>
      );
    case 'admin':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40 shadow-xs font-sports">
          {showIcon && <Shield className="w-3.5 h-3.5 text-red-400" />}
          {t('role.admin', 'Administrador')}
        </span>
      );
    case 'taquillera':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs font-sports">
          {showIcon && <Printer className="w-3.5 h-3.5 text-emerald-400" />}
          {t('role.taquillera', 'Taquillera (POS Boletos)')}
        </span>
      );
    case 'taquilla':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs font-sports">
          {showIcon && <Ticket className="w-3.5 h-3.5 text-purple-400" />}
          {t('role.taquilla', 'Control de Accesos (Puertas)')}
        </span>
      );
    case 'concesionario':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs font-sports">
          {showIcon && <Utensils className="w-3.5 h-3.5 text-amber-400" />}
          {t('role.concesionario', 'Concesionario')}
        </span>
      );
    case 'aficionado':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-800 text-slate-200 border border-slate-700 shadow-xs font-sports">
          {showIcon && <User className="w-3.5 h-3.5 text-slate-400" />}
          {t('role.aficionado', 'Aficionado')}
        </span>
      );
  }
};
