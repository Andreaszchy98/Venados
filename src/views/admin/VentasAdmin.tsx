import React, { useState, useEffect } from 'react';
import { SaleTransaction, SaleChannel, UserProfile } from '../../types';
import {
  subscribeToSalesAuditLog,
  calculateMetricsFromTransactions,
} from '../../lib/sales';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  DollarSign,
  TrendingUp,
  Ticket,
  ShoppingBag,
  Utensils,
  Search,
  Filter,
  Calendar,
  Download,
  CreditCard,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { StripePendingPaymentsModal } from '../../components/admin/StripePendingPaymentsModal';

interface VentasAdminProps {
  user?: UserProfile;
}

export const VentasAdmin: React.FC<VentasAdminProps> = ({ user }) => {
  const venueId = user?.venueId || DEFAULT_VENUE_ID;
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'todos' | 'hoy' | 'semana'>('todos');
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);
  const [metrics, setMetrics] = useState({
    totalGrossRevenue: 0,
    ticketsRevenue: 0,
    merchRevenue: 0,
    foodRevenue: 0,
    totalTransactions: 0,
  });

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToSalesAuditLog(
      (liveSales) => {
        setSales(liveSales);
        setMetrics(calculateMetricsFromTransactions(liveSales));
        setLoading(false);
      },
      (err) => {
        console.error('Error in sales real-time stream:', err);
        setLoading(false);
      },
      venueId
    );

    return () => unsubscribe();
  }, [venueId]);

  const filteredSales = sales.filter((s) => {
    const matchesChannel =
      selectedChannel === 'Todos' || s.channel === selectedChannel;
    const matchesSearch =
      (s.customerName && s.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.referenceId && s.referenceId.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesChannel && matchesSearch;
  });

  const getChannelBadge = (channel: SaleChannel) => {
    switch (channel) {
      case 'boletos':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-950/70 text-blue-400 border border-blue-800/60 font-sports">
            <Ticket className="w-3 h-3 text-blue-400" /> Boletos / Taquilla
          </span>
        );
      case 'tienda_merch':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-950/70 text-red-400 border border-red-800/60 font-sports">
            <ShoppingBag className="w-3 h-3 text-red-400" /> Tienda Oficial
          </span>
        );
      case 'concesion_alimentos':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-950/70 text-amber-400 border border-amber-800/60 font-sports">
            <Utensils className="w-3 h-3 text-amber-400" /> Concesión Alimentos
          </span>
        );
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono">{channel}</span>;
    }
  };

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['ID,Canal,Cliente,Concepto,Monto,MetodoPago,Fecha,Estado']
        .concat(
          filteredSales.map(
            (s) =>
              `"${s.id}","${s.channel}","${s.customerName || ''}","${s.description.replace(/"/g, '""')}","${s.amount}","${s.paymentMethod}","${s.date}","${s.status}"`
          )
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_ventas_venados_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header y Exportar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide uppercase font-sports flex items-center gap-2">
            <Receipt className="w-6 h-6 text-red-500" />
            <span>Administración & Auditoría de Ventas</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 font-sports">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              En Vivo
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Registro unificado y en tiempo real de transacciones de taquilla, tienda oficial y concesiones
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setIsStripeModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-300 hover:text-white font-black text-xs uppercase tracking-wider rounded-xl border border-indigo-700/60 shadow-sm flex items-center gap-2 font-sports transition-colors cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <span>Verificar Pagos Stripe</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-[#141E34] hover:bg-[#1A2846] text-white font-black text-xs uppercase tracking-wider rounded-xl border border-slate-700 shadow-sm flex items-center gap-2 font-sports transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Exportar a CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Ventas por Canal (Scoreboard Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0F1626] p-4 rounded-2xl border border-slate-700/80 shadow-lg flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-950/50 text-red-400 border border-red-800/40">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider font-sports">Ventas Totales Brutas</p>
            <p className="text-2xl font-black text-white font-scoreboard tracking-wide">
              ${metrics.totalGrossRevenue.toLocaleString('es-MX')} <span className="text-xs text-slate-400 font-sans">MXN</span>
            </p>
          </div>
        </div>

        <div className="bg-[#0F1626] p-4 rounded-2xl border border-slate-700/80 shadow-lg flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-950/50 text-blue-400 border border-blue-800/40">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider font-sports">Taquilla & Boletos</p>
            <p className="text-2xl font-black text-blue-400 font-scoreboard tracking-wide">
              ${metrics.ticketsRevenue.toLocaleString('es-MX')} <span className="text-xs text-slate-400 font-sans">MXN</span>
            </p>
          </div>
        </div>

        <div className="bg-[#0F1626] p-4 rounded-2xl border border-slate-700/80 shadow-lg flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-950/50 text-red-400 border border-red-800/40">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider font-sports">Tienda Oficial (Merch)</p>
            <p className="text-2xl font-black text-red-400 font-scoreboard tracking-wide">
              ${metrics.merchRevenue.toLocaleString('es-MX')} <span className="text-xs text-slate-400 font-sans">MXN</span>
            </p>
          </div>
        </div>

        <div className="bg-[#0F1626] p-4 rounded-2xl border border-slate-700/80 shadow-lg flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-950/50 text-amber-400 border border-amber-800/40">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider font-sports">Alimentos & Bebidas</p>
            <p className="text-2xl font-black text-amber-400 font-scoreboard tracking-wide">
              ${metrics.foodRevenue.toLocaleString('es-MX')} <span className="text-xs text-slate-400 font-sans">MXN</span>
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros de Auditoría */}
      <div className="bg-[#0F1626] p-4 rounded-2xl border border-slate-700/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, descripción o ID de referencia..."
            className="w-full pl-9 pr-3 py-2 bg-[#141E34] border border-slate-700 text-white placeholder-slate-500 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="px-3 py-2 border border-slate-700 rounded-xl text-xs font-bold bg-[#141E34] text-white focus:outline-hidden focus:ring-2 focus:ring-red-500 font-sports uppercase tracking-wider cursor-pointer"
          >
            <option value="Todos">Todos los Canales</option>
            <option value="boletos">Taquilla / Boletos</option>
            <option value="tienda_merch">Tienda Oficial Merch</option>
            <option value="concesion_alimentos">Alimentos & Bebidas</option>
          </select>
        </div>
      </div>

      {/* Tabla de Auditoría */}
      {loading ? (
        <LoadingSpinner message="Generando reporte de auditoría de ventas..." />
      ) : filteredSales.length === 0 ? (
        <div className="bg-[#0F1626] border border-slate-700/80 rounded-2xl p-12 text-center text-slate-400">
          No hay transacciones registradas que coincidan con los filtros.
        </div>
      ) : (
        <div className="bg-[#0F1626] rounded-2xl border border-slate-700/80 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#141E34] text-slate-400 font-black uppercase tracking-wider text-[11px] font-sports border-b border-slate-700/80">
                <tr>
                  <th className="py-3.5 px-4">Canal de Venta</th>
                  <th className="py-3.5 px-4">Concepto / Descripción</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Método de Pago</th>
                  <th className="py-3.5 px-4">Fecha & Hora</th>
                  <th className="py-3.5 px-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-[#141E34]/50 transition-colors">
                    <td className="py-3.5 px-4">{getChannelBadge(sale.channel)}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-white text-sm">{sale.description}</p>
                      {sale.referenceId && (
                        <span className="font-mono text-[10px] text-slate-400">Ref: {sale.referenceId}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200">{sale.customerName || 'Público General'}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-medium">{sale.paymentMethod}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(sale.date).toLocaleDateString()} {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-base text-emerald-400 font-scoreboard tracking-wide">
                      +${sale.amount.toLocaleString('es-MX')} <span className="text-[10px] text-slate-400 font-sans">MXN</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal para verificar y conciliar pagos pendientes en Stripe */}
      <StripePendingPaymentsModal
        isOpen={isStripeModalOpen}
        onClose={() => setIsStripeModalOpen(false)}
      />
    </div>
  );
};
