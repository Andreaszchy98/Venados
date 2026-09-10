import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../../types';
import { AdminOverview } from './AdminOverview';
import { VentasAdmin } from './VentasAdmin';
import { InventarioAdmin } from './InventarioAdmin';
import { LogisticaAdmin } from './LogisticaAdmin';
import { PersonalAdmin } from './PersonalAdmin';
import { NegociosAdmin } from './NegociosAdmin';
import { EventsManager } from './EventsManager';
import { useLanguage } from '../../context/LanguageContext';
import {
  ShieldAlert,
  Boxes,
  Truck,
  LayoutDashboard,
  Receipt,
  Users,
  Store,
  Calendar,
  ChevronDown,
  Check,
  Layers,
} from 'lucide-react';

interface AdminViewProps {
  user: UserProfile;
}

export type AdminTab = 'resumen' | 'eventos' | 'ventas' | 'inventario' | 'logistica' | 'personal' | 'negocios';

interface SectionConfig {
  id: AdminTab;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  defaultLabel: string;
  descKey: string;
  defaultDesc: string;
  iconColor: string;
  badgeBg: string;
}

const ADMIN_SECTIONS: SectionConfig[] = [
  {
    id: 'resumen',
    icon: LayoutDashboard,
    labelKey: 'admin.tabs.overview',
    defaultLabel: 'Resumen General',
    descKey: 'admin.sections.overview_desc',
    defaultDesc: 'Métricas clave y accesos directos',
    iconColor: 'text-red-700',
    badgeBg: 'bg-red-50 text-red-700 border-red-200',
  },
  {
    id: 'eventos',
    icon: Calendar,
    labelKey: 'admin.tabs.events',
    defaultLabel: 'Eventos & Partidos',
    descKey: 'admin.sections.events_desc',
    defaultDesc: 'Partidos, conciertos y boletaje',
    iconColor: 'text-indigo-700',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    id: 'negocios',
    icon: Store,
    labelKey: 'admin.tabs.business',
    defaultLabel: 'Locales y Concesiones',
    descKey: 'admin.sections.business_desc',
    defaultDesc: 'Puestos de comida, barras y módulos',
    iconColor: 'text-amber-700',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'personal',
    icon: Users,
    labelKey: 'admin.tabs.staff',
    defaultLabel: 'Personal y Accesos',
    descKey: 'admin.sections.staff_desc',
    defaultDesc: 'Staff, concesionarios y permisos',
    iconColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'ventas',
    icon: Receipt,
    labelKey: 'admin.tabs.sales',
    defaultLabel: 'Auditoría de Ventas',
    descKey: 'admin.sections.sales_desc',
    defaultDesc: 'Boletos, consumos y facturación',
    iconColor: 'text-rose-700',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    id: 'inventario',
    icon: Boxes,
    labelKey: 'admin.tabs.inventory',
    defaultLabel: 'Inventario y Almacén',
    descKey: 'admin.sections.inventory_desc',
    defaultDesc: 'Stock, mercancía oficial y suministros',
    iconColor: 'text-blue-700',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'logistica',
    icon: Truck,
    labelKey: 'admin.tabs.logistics',
    defaultLabel: 'Logística y Envíos',
    descKey: 'admin.sections.logistics_desc',
    defaultDesc: 'Despachos, guías y entregas en estadio',
    iconColor: 'text-purple-700',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
  },
];

export const AdminView: React.FC<AdminViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('resumen');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  // Cerrar dropdown al presionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Sección activa configurada
  const activeSection = ADMIN_SECTIONS.find((s) => s.id === activeTab) || ADMIN_SECTIONS[0];
  const ActiveIcon = activeSection.icon;

  // El superadmin NO debe tener acceso a esta vista ni a la gestión de eventos
  if (user.role === 'superadmin') {
    return (
      <div className="p-8 bg-amber-50 border border-amber-200 rounded-3xl text-center space-y-3 max-w-xl mx-auto">
        <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
        <h3 className="text-base font-black text-amber-900">Vista de Operación de Sede</h3>
        <p className="text-xs text-amber-700">
          Esta vista y la administración de eventos y taquilla corresponden exclusivamente a administradores asignados a recintos deportivos. Como Superadmin de la plataforma, utiliza el panel global.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header y Selector de Sección de Administración */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Administración de Sede</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
              Gerencia
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>Sede asignada: <strong className="text-slate-800 font-semibold">{user.venueName || 'Estadio Teodoro Mariscal'}</strong></span>
            <span className="text-slate-300">•</span>
            <span>Control de negocio, inventario, logística, ventas y personal</span>
          </p>
        </div>

        {/* Selector Desplegable de Sección Administrativa */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 hidden md:inline-flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              {t('admin.section_label', 'Módulo:')}
            </span>

            <button
              id="admin-section-dropdown-btn"
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
              className="inline-flex items-center justify-between gap-2.5 px-3.5 py-2 sm:py-2.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl shadow-xs transition-all cursor-pointer text-slate-900 font-bold text-xs sm:text-sm min-h-[44px] min-w-[220px] sm:min-w-[250px]"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${activeSection.badgeBg}`}>
                  <ActiveIcon className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-slate-900 truncate">
                  {t(activeSection.labelKey, activeSection.defaultLabel)}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180 text-red-700' : ''
                }`}
              />
            </button>
          </div>

          {/* Menú Desplegable con las 7 Secciones */}
          {isDropdownOpen && (
            <div
              role="listbox"
              className="absolute right-0 top-full mt-2 w-full sm:w-80 md:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[80vh] overflow-y-auto"
            >
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-red-700" />
                  {t('admin.all_sections', 'Secciones de Administración')}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {t('admin.modules_count', '7 Módulos')}
                </span>
              </div>

              <div className="py-1 space-y-1">
                {ADMIN_SECTIONS.map((sec) => {
                  const isSelected = activeTab === sec.id;
                  const IconComp = sec.icon;
                  return (
                    <button
                      key={sec.id}
                      id={`admin-tab-${sec.id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setActiveTab(sec.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl transition-all text-left cursor-pointer min-h-[44px] ${
                        isSelected
                          ? 'bg-red-50/90 border border-red-200 text-red-950 font-bold shadow-2xs'
                          : 'hover:bg-slate-50 border border-transparent text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${sec.badgeBg}`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs sm:text-sm truncate ${isSelected ? 'font-black text-red-950' : 'font-semibold text-slate-800'}`}>
                            {t(sec.labelKey, sec.defaultLabel)}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {t(sec.descKey, sec.defaultDesc)}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0 text-xs shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Renderizado de Pestaña Activa */}
      {activeTab === 'resumen' && (
        <AdminOverview user={user} onNavigateTab={(tab) => setActiveTab(tab as any)} />
      )}
      {activeTab === 'eventos' && <EventsManager user={user} />}
      {activeTab === 'negocios' && <NegociosAdmin user={user} />}
      {activeTab === 'personal' && <PersonalAdmin user={user} />}
      {activeTab === 'ventas' && <VentasAdmin user={user} />}
      {activeTab === 'inventario' && <InventarioAdmin user={user} />}
      {activeTab === 'logistica' && <LogisticaAdmin user={user} />}
    </div>
  );
};


