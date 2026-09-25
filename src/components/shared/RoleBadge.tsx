import React from 'react';
import { UserRole } from '../../types';
import { Shield, Ticket, User, Utensils, Bike, Crown, Printer } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

interface RoleBadgeProps {
  role: UserRole;
  showIcon?: boolean;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, showIcon = true }) => {
  const { t } = useLanguage();
  const { theme } = useTheme();

  switch (role) {
    case 'superadmin':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-xs font-sports border ${
          theme === 'light'
            ? 'bg-amber-100 text-amber-900 border-amber-300'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        }`}>
          {showIcon && <Crown className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-700' : 'text-amber-400'}`} />}
          {t('role.superadmin', 'Superadmin')}
        </span>
      );
    case 'admin':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-xs font-sports border ${
          theme === 'light'
            ? 'bg-red-100 text-red-800 border-red-300'
            : 'bg-red-500/20 text-red-300 border-red-500/40'
        }`}>
          {showIcon && <Shield className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`} />}
          {t('role.admin', 'Administrador')}
        </span>
      );
    case 'taquillera':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-xs font-sports border ${
          theme === 'light'
            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        }`}>
          {showIcon && <Printer className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'}`} />}
          {t('role.taquillera', 'Taquillera (POS Boletos)')}
        </span>
      );
    case 'taquilla':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-xs font-sports border ${
          theme === 'light'
            ? 'bg-purple-100 text-purple-800 border-purple-300'
            : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
        }`}>
          {showIcon && <Ticket className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-purple-700' : 'text-purple-400'}`} />}
          {t('role.taquilla', 'Control de Accesos (Puertas)')}
        </span>
      );
    case 'concesionario':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-xs font-sports border ${
          theme === 'light'
            ? 'bg-amber-100 text-amber-900 border-amber-300'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        }`}>
          {showIcon && <Utensils className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-700' : 'text-amber-400'}`} />}
          {t('role.concesionario', 'Concesionario')}
        </span>
      );
    case 'runner':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-xs font-sports border ${
          theme === 'light'
            ? 'bg-blue-100 text-blue-800 border-blue-300'
            : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
        }`}>
          {showIcon && <Bike className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />}
          {t('role.runner', 'Repartidor / Runner')}
        </span>
      );
    case 'aficionado':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-xs font-sports border ${
          theme === 'light'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-slate-800 text-slate-200 border-slate-700'
        }`}>
          {showIcon && <User className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-red-500' : 'text-slate-400'}`} />}
          {t('role.aficionado', 'Aficionado')}
        </span>
      );
  }
};
