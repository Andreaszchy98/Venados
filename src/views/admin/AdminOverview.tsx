import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { getSalesMetrics } from '../../lib/sales';
import { getInventoryProducts } from '../../lib/inventory';
import { getAllMerchOrders } from '../../lib/logistics';
import { getStadiumStands } from '../../lib/stands';
import { DEFAULT_VENUE_ID, DEFAULT_EVENT_ID } from '../../lib/defaultVenue';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { useTheme } from '../../context/ThemeContext';
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
  const { theme } = useTheme();
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
  }, [venueId]);

  if (loading) {
    return <LoadingSpinner message="Consolidando métricas ejecutivas de VXP..." />;
  }

  return (
    <div className="space-y-6">
      {/* Banner Principal del Negocio */}
      <div className={`relative overflow-hidden rounded-2xl p-6 sm:p-8 border shadow-xl ${
        theme === 'light' ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-[#0F1626] border-slate-700/80 text-white'
      }`}>
        <div className={`absolute inset-0 pointer-events-none ${
          theme === 'light' ? 'bg-gradient-to-r from-red-50 via-slate-50 to-white opacity-80' : 'bg-gradient-to-r from-red-950/20 via-slate-900/40 to-slate-950/80'
        }`} />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border font-sports uppercase tracking-wider ${
              theme === 'light' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-950/80 text-red-300 border-red-500/40'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 text-red-500" /> Centro de Mando Empresarial Venados
            </div>
            <h2 className={`text-2xl sm:text-3xl font-bold tracking-wider font-sports uppercase ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>
              Gestión Integral del Negocio y Operaciones
            </h2>
            <p className={`text-xs sm:text-sm max-w-xl font-body ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-300'
            }`}>
              Monitoreo centralizado de ventas multicanal, despacho logístico de mercancía y control de inventario de almacén en tiempo real.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-end gap-3 shrink-0">
            <div className={`p-4 rounded-xl border shrink-0 ${
              theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#0A0E17]/80 border-slate-700/80'
            }`}>
              <span className={`text-xs font-sports uppercase tracking-wider font-bold ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Facturación Bruta Consolidada</span>
              <p className={`text-3xl sm:text-4xl font-scoreboard font-bold tracking-wider ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                ${stats.totalGrossRevenue.toLocaleString('es-MX')} <span className="text-sm font-sports uppercase tracking-normal text-red-600 dark:text-red-400">MXN</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas de Control Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Módulo Ventas */}
        <div className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-between space-y-4 transition-colors ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0F1626] border-slate-700/80 hover:border-slate-600'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-xl border ${
                theme === 'light' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-red-950/60 text-red-400 border-red-500/30'
              }`}>
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className={`text-xs font-bold font-sports uppercase tracking-wider ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Canales Activos</span>
            </div>
            <h3 className={`font-bold text-lg font-sports uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>Administración de Ventas</h3>
            <p className={`text-xs leading-relaxed font-body ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Auditoría unificada de ingresos por boletaje, venta en línea de uniformes y alimentos del estadio.
            </p>
          </div>

          <div className={`pt-3 border-t flex items-center justify-between ${
            theme === 'light' ? 'border-slate-100' : 'border-slate-800'
          }`}>
            <div>
              <span className={`text-[11px] block font-sports uppercase tracking-wider ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Transacciones</span>
              <span className={`text-lg font-scoreboard font-bold tracking-wider ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>{stats.totalTransactions} registradas</span>
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
        <div className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-between space-y-4 transition-colors ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0F1626] border-slate-700/80 hover:border-slate-600'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-xl border ${
                theme === 'light' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-950/60 text-blue-400 border-blue-500/30'
              }`}>
                <Boxes className="w-5 h-5" />
              </div>
              {stats.lowStockCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-sports uppercase tracking-wider">
                  <AlertTriangle className="w-3 h-3 text-amber-600" /> {stats.lowStockCount} alertas
                </span>
              )}
            </div>
            <h3 className={`font-bold text-lg font-sports uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>Gestión de Inventario</h3>
            <p className={`text-xs leading-relaxed font-body ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Catálogo de mercancía oficial, conteo de stock, costos y alertas de reabastecimiento en almacén.
            </p>
          </div>

          <div className={`pt-3 border-t flex items-center justify-between ${
            theme === 'light' ? 'border-slate-100' : 'border-slate-800'
          }`}>
            <div>
              <span className={`text-[11px] block font-sports uppercase tracking-wider ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Almacén Tienda</span>
              <span className={`text-lg font-scoreboard font-bold tracking-wider ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>Stock en Línea</span>
            </div>
            <button
              onClick={() => onNavigateTab('inventario')}
              className={`px-3.5 py-2 border text-xs font-bold font-sports uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
                theme === 'light' ? 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-800' : 'bg-[#1E293B] hover:bg-slate-700 border-slate-700 text-white'
              }`}
            >
              <span>Gestionar Stock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Logística */}
        <div className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-between space-y-4 transition-colors ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0F1626] border-slate-700/80 hover:border-slate-600'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-xl border ${
                theme === 'light' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-purple-950/60 text-purple-400 border-purple-500/30'
              }`}>
                <Truck className="w-5 h-5" />
              </div>
              <span className={`text-xs font-bold font-sports uppercase tracking-wider ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Despacho</span>
            </div>
            <h3 className={`font-bold text-lg font-sports uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>Logística de Envíos</h3>
            <p className={`text-xs leading-relaxed font-body ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Preparación de paquetes, asignación de números de guía DHL/Estafeta y tracking de entregas.
            </p>
          </div>

          <div className={`pt-3 border-t flex items-center justify-between ${
            theme === 'light' ? 'border-slate-100' : 'border-slate-800'
          }`}>
            <div>
              <span className={`text-[11px] block font-sports uppercase tracking-wider ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Por Despachar</span>
              <span className="text-lg font-scoreboard font-bold text-purple-700 dark:text-purple-300 tracking-wider">{stats.pendingShipmentsCount} pedidos</span>
            </div>
            <button
              onClick={() => onNavigateTab('logistica')}
              className={`px-3.5 py-2 border text-xs font-bold font-sports uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
                theme === 'light' ? 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-800' : 'bg-[#1E293B] hover:bg-slate-700 border-slate-700 text-white'
              }`}
            >
              <span>Ver Envíos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Negocios & Concesiones Estadio */}
        <div className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-between space-y-4 transition-colors ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0F1626] border-slate-700/80 hover:border-slate-600'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-xl border ${
                theme === 'light' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-amber-950/60 text-amber-400 border-amber-500/30'
              }`}>
                <Store className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-sports uppercase tracking-wider">
                {stats.activeStandsCount} activos
              </span>
            </div>
            <h3 className={`font-bold text-lg font-sports uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>Negocios del Estadio</h3>
            <p className={`text-xs leading-relaxed font-body ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Administración de puestos, concesiones comerciales, cartas de menú, comisiones y ubicación en estadio.
            </p>
          </div>

          <div className={`pt-3 border-t flex items-center justify-between ${
            theme === 'light' ? 'border-slate-100' : 'border-slate-800'
          }`}>
            <div>
              <span className={`text-[11px] block font-sports uppercase tracking-wider ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Concesiones</span>
              <span className="text-lg font-scoreboard font-bold text-amber-700 dark:text-amber-300 tracking-wider">Puestos y Menú</span>
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

        {/* Módulo Personal & Roles */}
        <div className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-between space-y-4 transition-colors ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0F1626] border-slate-700/80 hover:border-slate-600'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-xl border ${
                theme === 'light' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
              }`}>
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-500/40 px-2.5 py-0.5 rounded-full font-sports uppercase tracking-wider">
                Operaciones
              </span>
            </div>
            <h3 className={`font-bold text-lg font-sports uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>Personal & Roles</h3>
            <p className={`text-xs leading-relaxed font-body ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Declarar concesionarios de puestos, runners de estadio, taquilla y permisos de acceso.
            </p>
          </div>

          <div className={`pt-3 border-t flex items-center justify-between ${
            theme === 'light' ? 'border-slate-100' : 'border-slate-800'
          }`}>
            <div>
              <span className={`text-[11px] block font-sports uppercase tracking-wider ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Estadio & Ventas</span>
              <span className={`text-lg font-scoreboard font-bold tracking-wider ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>Asignar Roles</span>
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
        <div className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-between space-y-4 transition-colors ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0F1626] border-slate-700/80 hover:border-slate-600'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-xl border ${
                theme === 'light' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-red-950/60 text-red-400 border-red-500/30'
              }`}>
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-500/40 px-2.5 py-0.5 rounded-full font-sports uppercase tracking-wider">
                Sede
              </span>
            </div>
            <h3 className={`font-bold text-lg font-sports uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>Eventos & Partidos</h3>
            <p className={`text-xs leading-relaxed font-body ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Programar partidos y eventos, abrir/cerrar venta de boletos y configurar precios por sección.
            </p>
          </div>

          <div className={`pt-3 border-t flex items-center justify-between ${
            theme === 'light' ? 'border-slate-100' : 'border-slate-800'
          }`}>
            <div>
              <span className={`text-[11px] block font-sports uppercase tracking-wider ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Taquilla Sede</span>
              <span className={`text-lg font-scoreboard font-bold tracking-wider ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>Calendario</span>
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

        {/* Módulo Marcador en Vivo */}
        <div className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-between space-y-4 transition-colors ${
          theme === 'light' ? 'bg-white border-amber-300 shadow-sm' : 'bg-[#0F1626] border-amber-500/30 hover:border-amber-500/60'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-xl border ${
                theme === 'light' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-amber-950/60 text-amber-400 border-amber-500/30'
              }`}>
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-500/40 px-2.5 py-0.5 rounded-full font-sports uppercase tracking-wider">
                En Vivo
              </span>
            </div>
            <h3 className={`font-bold text-lg font-sports uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>Marcador en Tiempo Real</h3>
            <p className={`text-xs leading-relaxed font-body ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Control táctil para operar carreras, outs, goles, tarjetas y entradas en vivo para la afición.
            </p>
          </div>

          <div className={`pt-3 border-t flex items-center justify-between ${
            theme === 'light' ? 'border-slate-100' : 'border-slate-800'
          }`}>
            <div>
              <span className={`text-[11px] block font-sports uppercase tracking-wider ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Operación Sede</span>
              <span className="text-lg font-scoreboard font-bold text-amber-600 dark:text-amber-400 tracking-wider">Marcador Digital</span>
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

        {/* Módulo Banners & Publicidad */}
        <div className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-between space-y-4 transition-colors ${
          theme === 'light' ? 'bg-white border-rose-300 shadow-sm' : 'bg-[#0F1626] border-rose-500/30 hover:border-rose-500/60'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-xl border ${
                theme === 'light' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-rose-950/60 text-rose-400 border-rose-500/30'
              }`}>
                <Megaphone className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-500/40 px-2.5 py-0.5 rounded-full font-sports uppercase tracking-wider">
                Patrocinios
              </span>
            </div>
            <h3 className={`font-bold text-lg font-sports uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>Banners & Patrocinios</h3>
            <p className={`text-xs leading-relaxed font-body ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Gestión centralizada de banners Hero, Inline Grid y Popups con conteo de impresiones y clics en vivo.
            </p>
          </div>

          <div className={`pt-3 border-t flex items-center justify-between ${
            theme === 'light' ? 'border-slate-100' : 'border-slate-800'
          }`}>
            <div>
              <span className={`text-[11px] block font-sports uppercase tracking-wider ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Publicidad Sede</span>
              <span className="text-lg font-scoreboard font-bold text-rose-600 dark:text-rose-400 tracking-wider">Métricas en Vivo</span>
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
