import React, { useState, useEffect } from 'react';
import { SaleTransaction, SaleChannel } from '../../types';
import { getSalesAuditLog, getSalesMetrics } from '../../lib/sales';
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
} from 'lucide-react';

export const VentasAdmin: React.FC = () => {
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'todos' | 'hoy' | 'semana'>('todos');
  const [metrics, setMetrics] = useState({
    totalGrossRevenue: 0,
    ticketsRevenue: 0,
    merchRevenue: 0,
    foodRevenue: 0,
    totalTransactions: 0,
  });

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const [logs, stats] = await Promise.all([
        getSalesAuditLog(),
        getSalesMetrics(),
      ]);
      setSales(logs);
      setMetrics(stats);
    } catch (err) {
      console.error('Error fetching sales data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, []);

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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <Ticket className="w-3 h-3 text-blue-600" /> Boletos / Taquilla
          </span>
        );
      case 'tienda_merch':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-800 border border-red-200">
            <ShoppingBag className="w-3 h-3 text-red-600" /> Tienda Oficial
          </span>
        );
      case 'concesion_alimentos':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Utensils className="w-3 h-3 text-amber-600" /> Concesión Alimentos
          </span>
        );
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">{channel}</span>;
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
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-red-700" />
            Administración & Auditoría de Ventas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro unificado y en tiempo real de transacciones de taquilla, tienda oficial y concesiones
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 self-start sm:self-auto"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Exportar a CSV / Excel</span>
        </button>
      </div>

      {/* Tarjetas KPI de Ventas por Canal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-900 text-white">
            <TrendingUp className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Ventas Totales Brutas</p>
            <p className="text-lg font-black text-slate-900">
              ${metrics.totalGrossRevenue.toLocaleString('es-MX')} MXN
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-700">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Taquilla & Boletos</p>
            <p className="text-lg font-black text-blue-900">
              ${metrics.ticketsRevenue.toLocaleString('es-MX')} MXN
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-50 text-red-700">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Tienda Oficial (Merch)</p>
            <p className="text-lg font-black text-red-900">
              ${metrics.merchRevenue.toLocaleString('es-MX')} MXN
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-700">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Alimentos & Bebidas</p>
            <p className="text-lg font-black text-amber-900">
              ${metrics.foodRevenue.toLocaleString('es-MX')} MXN
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros de Auditoría */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, descripción o ID de referencia..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-700"
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
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
          No hay transacciones registradas que coincidan con los filtros.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Canal de Venta</th>
                  <th className="py-3.5 px-4">Concepto / Descripción</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Método de Pago</th>
                  <th className="py-3.5 px-4">Fecha & Hora</th>
                  <th className="py-3.5 px-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">{getChannelBadge(sale.channel)}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-extrabold text-slate-900">{sale.description}</p>
                      {sale.referenceId && (
                        <span className="font-mono text-[10px] text-slate-400">Ref: {sale.referenceId}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{sale.customerName || 'Público General'}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{sale.paymentMethod}</td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(sale.date).toLocaleDateString()} {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-sm text-slate-900">
                      +${sale.amount.toLocaleString('es-MX')} MXN
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
