import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { getSalesMetrics } from '../../lib/sales';
import { getInventoryProducts } from '../../lib/inventory';
import { getAllMerchOrders } from '../../lib/logistics';
import { getStadiumStands } from '../../lib/stands';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  TrendingUp,
  Boxes,
  Truck,
  Utensils,
  Ticket,
  ShoppingBag,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Store,
  Users,
  Calendar,
  Radio,
  Megaphone,
} from 'lucide-react';

interface AdminOverviewProps {
  user?: UserProfile;
  onNavigateTab: (tab: 'ventas' | 'inventario' | 'logistica' | 'personal' | 'negocios' | 'eventos' | 'marcador' | 'anuncios') => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ user, onNavigateTab }) => {
  const [loading, setLoading] = useState(true);
  const venueId = user?.venueId || DEFAULT_VENUE_ID;
  const [stats, setStats] = useState({
    totalGrossRevenue: 0,
    ticketsRevenue: 0,
    merchRevenue: 0,
    foodRevenue: 0,
    totalTransactions: 0,
    lowStockCount: 0,
    pendingShipmentsCount: 0,
    activeStandsCount: 0,
  });

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);
      try {
        const [salesStats, products, merchOrders, stands] = await Promise.all([
          getSalesMetrics(venueId).catch(() => ({
            totalGrossRevenue: 0,
            ticketsRevenue: 0,
            merchRevenue: 0,
            foodRevenue: 0,
            totalTransactions: 0,
          })),
          getInventoryProducts(venueId).catch(() => []),
          getAllMerchOrders(venueId).catch(() => []),
          getStadiumStands(venueId).catch(() => []),
        ]);

        const lowStock = (products || []).filter((p) => p.stock <= p.minStockAlert).length;
        const pendingShipments = (merchOrders || []).filter((o) => o.status === 'pendiente' || o.status === 'empacado').length;
        const activeStands = (stands || []).filter((s) => s.active).length;

        setStats({
          ...salesStats,
          lowStockCount: lowStock,
          pendingShipmentsCount: pendingShipments,
          activeStandsCount: activeStands,
        });
      } catch (err) {
        console.error('Error fetching admin overview:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Consolidando métricas ejecutivas de VXP..." />;
  }

  return (
    <div className="space-y-6">
      {/* Banner Principal del Negocio */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0F1626] text-white p-6 sm:p-8 border border-slate-700/80 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-red-950/20 via-slate-900/40 to-slate-950/80 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-950/80 text-red-300 border border-red-500/40 font-sports uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-red-400" /> Centro de Mando Empresarial Venados
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-wider font-sports uppercase text-white">
              Gestión Integral del Negocio y Operaciones
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-body">
              Monitoreo centralizado de ventas multicanal, despacho logístico de mercancía y control de inventario de almacén en tiempo real.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end bg-[#0A0E17]/80 p-4 rounded-xl border border-slate-700/80 shrink-0">
            <span className="text-xs text-slate-400 font-sports uppercase tracking-wider font-bold">Facturación Bruta Consolidada</span>
            <span className="text-3xl sm:text-4xl font-scoreboard font-bold text-white tracking-wider">
              ${stats.totalGrossRevenue.toLocaleString('es-MX')} <span className="text-sm font-sports uppercase tracking-normal text-red-400">MXN</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tarjetas de Control Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Módulo Ventas */}
        <div className="bg-[#0F1626] rounded-2xl border border-slate-700/80 p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-600 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-red-950/60 text-red-400 border border-red-500/30">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 font-sports uppercase tracking-wider">Canales Activos</span>
            </div>
            <h3 className="font-bold text-lg text-white font-sports uppercase tracking-wider">Administración de Ventas</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-body">
              Auditoría unificada de ingresos por boletaje, venta en línea de uniformes y alimentos del estadio.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-sports uppercase tracking-wider">Transacciones</span>
              <span className="text-lg font-scoreboard font-bold text-white tracking-wider">{stats.totalTransactions} registradas</span>
            </div>
            <button
              onClick={() => onNavigateTab('ventas')}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold font-sports uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
            >
              <span>Ver Auditoría</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Inventario */}
        <div className="bg-[#0F1626] rounded-2xl border border-slate-700/80 p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-600 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-blue-950/60 text-blue-400 border border-blue-500/30">
                <Boxes className="w-5 h-5" />
              </div>
              {stats.lowStockCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-500/40 rounded-full font-sports uppercase tracking-wider">
                  <AlertTriangle className="w-3 h-3 text-amber-400" /> {stats.lowStockCount} alertas
                </span>
              )}
            </div>
            <h3 className="font-bold text-lg text-white font-sports uppercase tracking-wider">Gestión de Inventario</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-body">
              Catálogo de mercancía oficial, conteo de stock, costos y alertas de reabastecimiento en almacén.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-sports uppercase tracking-wider">Almacén Tienda</span>
              <span className="text-lg font-scoreboard font-bold text-white tracking-wider">Stock en Línea</span>
            </div>
            <button
              onClick={() => onNavigateTab('inventario')}
              className="px-3.5 py-2 bg-[#1E293B] hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold font-sports uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
            >
              <span>Gestionar Stock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Logística */}
        <div className="bg-[#0F1626] rounded-2xl border border-slate-700/80 p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-600 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-500/30">
                <Truck className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 font-sports uppercase tracking-wider">Despacho</span>
            </div>
            <h3 className="font-bold text-lg text-white font-sports uppercase tracking-wider">Logística de Envíos</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-body">
              Preparación de paquetes, asignación de números de guía DHL/Estafeta y tracking de entregas.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-sports uppercase tracking-wider">Por Despachar</span>
              <span className="text-lg font-scoreboard font-bold text-purple-300 tracking-wider">{stats.pendingShipmentsCount} pedidos</span>
            </div>
            <button
              onClick={() => onNavigateTab('logistica')}
              className="px-3.5 py-2 bg-[#1E293B] hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold font-sports uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
            >
              <span>Ver Envíos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Negocios & Concesiones Estadio */}
        <div className="bg-[#0F1626] rounded-2xl border border-slate-700/80 p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-600 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-500/30">
                <Store className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded-full font-sports uppercase tracking-wider">
                {stats.activeStandsCount} activos
              </span>
            </div>
            <h3 className="font-bold text-lg text-white font-sports uppercase tracking-wider">Negocios del Estadio</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-body">
              Administración de puestos, concesiones comerciales, cartas de menú, comisiones y ubicación en estadio.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-sports uppercase tracking-wider">Concesiones</span>
              <span className="text-lg font-scoreboard font-bold text-amber-300 tracking-wider">Puestos y Menú</span>
            </div>
            <button
              id="overview-goto-negocios"
              onClick={() => onNavigateTab('negocios')}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold font-sports uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
            >
              <span>Administrar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Personal & Roles (Concesionarios y Runners) */}
        <div className="bg-[#0F1626] rounded-2xl border border-slate-700/80 p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-600 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-sports uppercase tracking-wider">
                Operaciones
              </span>
            </div>
            <h3 className="font-bold text-lg text-white font-sports uppercase tracking-wider">Personal & Roles</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-body">
              Declarar concesionarios de puestos, runners de estadio, taquilla y permisos de acceso.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-sports uppercase tracking-wider">Estadio & Ventas</span>
              <span className="text-lg font-scoreboard font-bold text-white tracking-wider">Asignar Roles</span>
            </div>
            <button
              onClick={() => onNavigateTab('personal')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-sports uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
            >
              <span>Gestionar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Eventos & Partidos de Sede */}
        <div className="bg-[#0F1626] rounded-2xl border border-slate-700/80 p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-600 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-red-950/60 text-red-400 border border-red-500/30">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-red-300 bg-red-950/80 border border-red-500/40 px-2.5 py-0.5 rounded-full font-sports uppercase tracking-wider">
                Sede
              </span>
            </div>
            <h3 className="font-bold text-lg text-white font-sports uppercase tracking-wider">Eventos & Partidos</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-body">
              Programar partidos y eventos, abrir/cerrar venta de boletos y configurar precios por sección.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-sports uppercase tracking-wider">Taquilla Sede</span>
              <span className="text-lg font-scoreboard font-bold text-white tracking-wider">Calendario</span>
            </div>
            <button
              id="overview-goto-eventos"
              onClick={() => onNavigateTab('eventos')}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold font-sports uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
            >
              <span>Gestionar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Marcador en Vivo (MVP Béisbol & Fútbol) */}
        <div className="bg-[#0F1626] rounded-2xl border border-amber-500/30 p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-amber-500/60 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-500/30">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <span className="text-xs font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-sports uppercase tracking-wider">
                En Vivo
              </span>
            </div>
            <h3 className="font-bold text-lg text-white font-sports uppercase tracking-wider">Marcador en Tiempo Real</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-body">
              Control táctil para operar carreras, outs, goles, tarjetas y entradas en vivo para la afición.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-sports uppercase tracking-wider">Operación Sede</span>
              <span className="text-lg font-scoreboard font-bold text-amber-400 tracking-wider">Marcador Digital</span>
            </div>
            <button
              id="overview-goto-marcador"
              onClick={() => onNavigateTab('marcador')}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white text-xs font-bold font-sports uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <span>Operar Marcador</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {/* Módulo Banners & Publicidad (isVenueAdmin) */}
        <div className="bg-[#0F1626] rounded-2xl border border-rose-500/30 p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-rose-500/60 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-rose-950/60 text-rose-400 border border-rose-500/30">
                <Megaphone className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-rose-300 bg-rose-950/80 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-sports uppercase tracking-wider">
                Patrocinios
              </span>
            </div>
            <h3 className="font-bold text-lg text-white font-sports uppercase tracking-wider">Banners & Patrocinios</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-body">
              Gestión centralizada de banners Hero, Inline Grid y Popups con conteo de impresiones y clics en vivo.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-sports uppercase tracking-wider">Publicidad Sede</span>
              <span className="text-lg font-scoreboard font-bold text-rose-400 tracking-wider">Métricas en Vivo</span>
            </div>
            <button
              id="overview-goto-anuncios"
              onClick={() => onNavigateTab('anuncios')}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-sports uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <span>Gestionar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
