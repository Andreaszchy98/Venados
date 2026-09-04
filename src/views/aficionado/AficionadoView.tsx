import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { MisBoletos } from './MisBoletos';
import { MiMembresia } from './MiMembresia';
import { TiendaMerch } from './TiendaMerch';
import { MenuStand } from './MenuStand';
import { MisPedidos } from './MisPedidos';
import { useLanguage } from '../../context/LanguageContext';
import {
  Ticket,
  Award,
  ShoppingBag,
  Utensils,
  Clock,
  Package,
} from 'lucide-react';

interface AficionadoViewProps {
  user: UserProfile;
  pendingEventId?: string | null;
  onClearPendingEvent?: () => void;
}

export const AficionadoView: React.FC<AficionadoViewProps> = ({
  user,
  pendingEventId,
  onClearPendingEvent,
}) => {
  const [activeTab, setActiveTab] = useState<'boletos' | 'membresia' | 'tienda' | 'comida' | 'pedidos'>('boletos');
  const { t } = useLanguage();

  // Si hay un pendingEventId al montar o cambiar, asegurarse de mostrar la pestaña de boletos
  useEffect(() => {
    if (pendingEventId) {
      setActiveTab('boletos');
    }
  }, [pendingEventId]);

  return (
    <div className="space-y-6">
      {/* Saludo y selector de sección */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t('aficionado.hello', 'Hola,')} {user.displayName || 'Aficionado'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {t('aficionado.tagline', 'Portal de Experiencia del Aficionado • Boletos, eventos, consumos y tienda en tu sede')}
          </p>
        </div>

        {/* Pestañas de Navegación del Aficionado */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-200/90 rounded-2xl border border-slate-300 text-xs font-semibold scrollbar-none">
          <button
            onClick={() => setActiveTab('boletos')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === 'boletos'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Ticket className="w-4 h-4 text-red-700" />
            {t('aficionado.tab.tickets', 'Mis Boletos')}
          </button>

          <button
            onClick={() => setActiveTab('membresia')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === 'membresia'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4 text-amber-600" />
            {t('aficionado.tab.membership', 'Membresía & Abonos')}
          </button>

          <button
            onClick={() => setActiveTab('tienda')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === 'tienda'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-red-700" />
            {t('aficionado.tab.store', 'Tienda Oficial')}
          </button>

          <button
            onClick={() => setActiveTab('comida')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === 'comida'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Utensils className="w-4 h-4 text-amber-700" />
            {t('aficionado.tab.food', 'Comida & Bebidas')}
          </button>

          <button
            onClick={() => setActiveTab('pedidos')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === 'pedidos'
                ? 'bg-white text-red-800 shadow-xs font-bold'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 text-slate-800" />
            {t('aficionado.tab.orders', 'Mis Pedidos')}
          </button>
        </div>
      </div>

      {/* Contenido de la vista según pestaña */}
      {activeTab === 'boletos' && (
        <MisBoletos
          user={user}
          initialEventId={pendingEventId}
          onClearInitialEvent={onClearPendingEvent}
        />
      )}
      {activeTab === 'membresia' && <MiMembresia user={user} />}
      {activeTab === 'tienda' && <TiendaMerch user={user} onOrderCompleted={() => setActiveTab('pedidos')} />}
      {activeTab === 'comida' && (
        <MenuStand
          user={user}
          onOrderSuccess={() => setActiveTab('pedidos')}
          onGoToTickets={() => setActiveTab('boletos')}
        />
      )}
      {activeTab === 'pedidos' && <MisPedidos user={user} />}
    </div>
  );
};
