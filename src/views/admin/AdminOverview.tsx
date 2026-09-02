import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { getSalesMetrics } from '../../lib/sales';
import { getInventoryProducts } from '../../lib/inventory';
import { getAllMerchOrders } from '../../lib/logistics';
import { getStadiumStands } from '../../lib/stands';
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
} from 'lucide-react';

interface AdminOverviewProps {
  onNavigateTab: (tab: 'ventas' | 'inventario' | 'logistica' | 'personal' | 'negocios') => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ onNavigateTab }) => {
  const [loading, setLoading] = useState(true);
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
          getSalesMetrics().catch(() => ({
            totalGrossRevenue: 0,
            ticketsRevenue: 0,
            merchRevenue: 0,
            foodRevenue: 0,
            totalTransactions: 0,
          })),
          getInventoryProducts().catch(() => []),
          getAllMerchOrders().catch(() => []),
          getStadiumStands().catch(() => []),
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
    return <LoadingSpinner message="Consolidando métricas ejecutivas de Venados App..." />;
  }

  return (
    <div className="space-y-6">
      {/* Banner Principal del Negocio */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 text-white p-6 sm:p-8 border border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-800/80 text-red-200 border border-red-700/50">
              <ShieldCheck className="w-3.5 h-3.5" /> Centro de Mando Empresarial Venados
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Gestión Integral del Negocio y Operaciones
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Monitoreo centralizado de ventas multicanal, despacho logístico de mercancía y control de inventario de almacén en tiempo real.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end bg-white/5 backdrop-blur-md p-4 rounded-xl border border-white/10 shrink-0">
            <span className="text-xs text-slate-400 font-medium">Facturación Bruta Consolidada</span>
            <span className="text-2xl sm:text-3xl font-black text-white">
              ${stats.totalGrossRevenue.toLocaleString('es-MX')} <span className="text-xs font-semibold text-red-400">MXN</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tarjetas de Control Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Módulo Ventas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-700">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400">Canales Activos</span>
            </div>
            <h3 className="font-extrabold text-base text-slate-900">Administración de Ventas</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Auditoría unificada de ingresos por boletaje, venta en línea de uniformes y alimentos del estadio.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Transacciones</span>
              <span className="text-base font-black text-slate-900">{stats.totalTransactions} registradas</span>
            </div>
            <button
              onClick={() => onNavigateTab('ventas')}
              className="px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition-colors"
            >
              <span>Ver Auditoría</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Inventario */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
                <Boxes className="w-5 h-5" />
              </div>
              {stats.lowStockCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> {stats.lowStockCount} alertas
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-base text-slate-900">Gestión de Inventario</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Catálogo de mercancía oficial, conteo de stock, costos y alertas de reabastecimiento en almacén.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Almacén Tienda</span>
              <span className="text-base font-black text-slate-900">Stock en Línea</span>
            </div>
            <button
              onClick={() => onNavigateTab('inventario')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition-colors"
            >
              <span>Gestionar Stock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Logística */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700">
                <Truck className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400">Despacho</span>
            </div>
            <h3 className="font-extrabold text-base text-slate-900">Logística de Envíos</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Preparación de paquetes, asignación de números de guía DHL/Estafeta y tracking de entregas.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Por Despachar</span>
              <span className="text-base font-black text-purple-900">{stats.pendingShipmentsCount} pedidos</span>
            </div>
            <button
              onClick={() => onNavigateTab('logistica')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition-colors"
            >
              <span>Ver Envíos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Negocios & Concesiones Estadio */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
                <Store className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                {stats.activeStandsCount} activos
              </span>
            </div>
            <h3 className="font-extrabold text-base text-slate-900">Negocios del Estadio</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Administración de puestos, concesiones comerciales, cartas de menú, comisiones y ubicación en estadio.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Concesiones</span>
              <span className="text-base font-black text-amber-900">Puestos y Menú</span>
            </div>
            <button
              id="overview-goto-negocios"
              onClick={() => onNavigateTab('negocios')}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition-colors"
            >
              <span>Administrar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Módulo Personal & Roles (Concesionarios y Runners) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                Operaciones
              </span>
            </div>
            <h3 className="font-extrabold text-base text-slate-900">Personal & Roles</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Declarar concesionarios de puestos, runners de estadio, taquilla y permisos de acceso.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Estadio & Ventas</span>
              <span className="text-base font-black text-slate-900">Asignar Roles</span>
            </div>
            <button
              onClick={() => onNavigateTab('personal')}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition-colors"
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
