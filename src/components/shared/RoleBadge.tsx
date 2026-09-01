import React from 'react';
import { UserRole } from '../../types';
import { Shield, Ticket, User, Utensils } from 'lucide-react';

interface RoleBadgeProps {
  role: UserRole;
  showIcon?: boolean;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, showIcon = true }) => {
  switch (role) {
    case 'admin':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
          {showIcon && <Shield className="w-3.5 h-3.5 text-red-600" />}
          Administrador
        </span>
      );
    case 'taquilla':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          {showIcon && <Ticket className="w-3.5 h-3.5 text-blue-600" />}
          Taquilla / Operador
        </span>
      );
    case 'concesionario':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          {showIcon && <Utensils className="w-3.5 h-3.5 text-amber-600" />}
          Concesionario / Cocina
        </span>
      );
    case 'aficionado':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {showIcon && <User className="w-3.5 h-3.5 text-slate-500" />}
          Aficionado
        </span>
      );
  }
};
