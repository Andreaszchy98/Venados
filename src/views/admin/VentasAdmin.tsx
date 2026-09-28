import React, { useState, useEffect } from 'react';
import { SaleTransaction, SaleChannel, UserProfile, VenueEvent, Ticket } from '../../types';
import {
  subscribeToSalesAuditLog,
  calculateMetricsFromTransactions,
} from '../../lib/sales';
import { subscribeVenueEvents } from '../../lib/venueEvents';
import { getEventTickets, getAllTickets } from '../../lib/tickets';
import { DEFAULT_VENUE_ID, DEFAULT_EVENT_ID } from '../../lib/defaultVenue';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { useTheme } from '../../context/ThemeContext';
import {
  DollarSign,
  TrendingUp,
  Ticket as TicketIcon,
  ShoppingBag,
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
  Layers,
  Armchair,
  PieChart,
  BarChart3,
  MapPin,
  Users,
} from 'lucide-react';
import { StripePendingPaymentsModal } from '../../components/admin/StripePendingPaymentsModal';
import { PaymentMethodCard } from '../../components/admin/PaymentMethodCard';
import { TopVendorCard } from '../../components/admin/TopVendorCard';
import { TransactionTableImproved } from '../../components/admin/TransactionTableImproved';

interface VentasAdminProps {
  user?: UserProfile;
}

export const VentasAdmin: React.FC<VentasAdminProps> = ({ user }) => {
  const { theme } = useTheme();
  const venueId = user?.venueId || DEFAULT_VENUE_ID;
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'todos' | 'boletos' | 'tienda_merch'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);
  
  // Estados para Filtrado por Evento y Análisis de Butacas
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('todos');
  const [eventTickets, setEventTickets] = useState<Ticket[]>([]);
  const [loadingEventTickets, setLoadingEventTickets] = useState(false);

  const [metrics, setMetrics] = useState({
    totalGrossRevenue: 0,
    ticketsRevenue: 0,
    merchRevenue: 0,
    foodRevenue: 0,
    totalTransactions: 0,
  });

  // Cargar transacciones de ventas
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToSalesAuditLog(
      (liveSales) => {
        const adminSales = liveSales.filter((s) => s.channel !== 'concesion_alimentos');
        setSales(adminSales);
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

  // Cargar lista de eventos de la sede
  useEffect(() => {
    const unsubEvents = subscribeVenueEvents(
      venueId,
      (venueEvents) => {
        setEvents(venueEvents);
        if (venueEvents.length > 0 && selectedEventId === 'todos') {
          setSelectedEventId(venueEvents[0].id);
        }
      },
      (err) => {
        console.error('Error loading venue events in VentasAdmin:', err);
      }
    );
    return () => unsubEvents();
  }, [venueId]);

  // Cargar boletos / butacas ocupadas cuando cambia el evento seleccionado
  useEffect(() => {
    const fetchEventData = async () => {
      setLoadingEventTickets(true);
      try {
        if (selectedEventId === 'todos') {
          const allTix = await getAllTickets(venueId);
          setEventTickets(allTix);
        } else {
          const tix = await getEventTickets(selectedEventId);
          setEventTickets(tix);
        }
      } catch (err) {
        console.error('Error fetching event tickets:', err);
      } finally {
        setLoadingEventTickets(false);
      }
    };
    fetchEventData();
  }, [selectedEventId, venueId]);

  // Filtrado de ventas por pestaña, evento seleccionado y buscador
  const filteredSales = sales.filter((s) => {
    const matchesChannel =
      activeTab === 'todos' || s.channel === activeTab;
    
    // Si estamos en boletos y hay un evento específico seleccionado, filtrar por eventId
    const matchesEvent =
      activeTab !== 'boletos' ||
      selectedEventId === 'todos' ||
      s.eventId === selectedEventId;

    const matchesSearch =
      (s.customerName && s.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.referenceId && s.referenceId.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesChannel && matchesEvent && matchesSearch;
  });

  // Filtrado de boletos por evento seleccionado para análisis de butacas y zonas
  const filteredTickets = eventTickets.filter((t) => {
    if (selectedEventId === 'todos') return true;
    return t.eventId === selectedEventId;
  });

  // Calcular métricas y distribución por zona (porcentaje de ventas)
  const zoneStats = React.useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    let totalRev = 0;

    for (const t of filteredTickets) {
      if (t.status === 'cancelado') continue;
      const zone = t.section || 'General';
      const price = Number(t.price) || 0;
      if (!map[zone]) {
        map[zone] = { count: 0, revenue: 0 };
      }
      map[zone].count += 1;
      map[zone].revenue += price;
      totalRev += price;
    }

    const zonesArray = Object.entries(map).map(([zone, data]) => ({
      zone,
      count: data.count,
      revenue: data.revenue,
      percentage: totalRev > 0 ? (data.revenue / totalRev) * 100 : 0,
    }));

    zonesArray.sort((a, b) => b.revenue - a.revenue);

    return {
      zonesArray,
      totalTicketsSold: filteredTickets.filter(t => t.status !== 'cancelado').length,
      totalTicketRevenue: totalRev,
    };
  }, [filteredTickets]);

  const getChannelBadge = (channel: SaleChannel) => {
    switch (channel) {
      case 'boletos':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider font-sports ${
            theme === 'light' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-blue-950/70 text-blue-400 border border-blue-800/60'
          }`}>
            <TicketIcon className="w-3 h-3 text-blue-500" /> Taquilla & Boletos
          </span>
        );
      case 'tienda_merch':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider font-sports ${
            theme === 'light' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-red-950/70 text-red-400 border border-red-800/60'
          }`}>
            <ShoppingBag className="w-3 h-3 text-red-500" /> Tienda Oficial
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
              `"${s.id}","${s.channel}","${s.customerName || ''}","${(s.description || '').replace(/"/g, '""')}","${s.amount}","${s.paymentMethod}","${s.date}","${s.status}"`
          )
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_ventas_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header y Exportar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-black tracking-wide uppercase font-sports flex items-center gap-2 ${
            theme === 'light' ? 'text-slate-900' : 'text-white'
          }`}>
            <Receipt className="w-6 h-6 text-red-500" />
            <span>Auditoría y Gestión de Ventas</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 font-sports">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              En Vivo
            </span>
          </h2>
          <p className={`text-xs mt-0.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
            Registro separado y especializado por canal: Taquilla y Tienda Oficial
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setIsStripeModalOpen(true)}
            className={`px-4 py-2.5 font-black text-xs uppercase tracking-wider rounded-xl border shadow-sm flex items-center gap-2 font-sports transition-colors cursor-pointer ${
              theme === 'light' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-300 border-indigo-700/60'
            }`}
          >
            <CreditCard className="w-4 h-4 text-indigo-500" />
            <span>Verificar Pagos Stripe</span>
          </button>

          <button
            onClick={handleExportCSV}
            className={`px-4 py-2.5 font-black text-xs uppercase tracking-wider rounded-xl border shadow-sm flex items-center gap-2 font-sports transition-colors cursor-pointer ${
              theme === 'light' ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50' : 'bg-[#141E34] hover:bg-[#1A2846] text-white border-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Exportar Canal CSV</span>
          </button>
        </div>
      </div>

      {/* Pestañas de Navegación por Canal */}
      <div className={`p-1.5 rounded-2xl border grid grid-cols-1 sm:grid-cols-3 gap-2 ${
        theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
      }`}>
        <button
          onClick={() => setActiveTab('todos')}
          className={`py-3 px-4 rounded-xl font-sports font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'todos'
              ? 'bg-red-600 text-white shadow-md'
              : theme === 'light' ? 'text-slate-700 hover:bg-white' : 'text-slate-400 hover:bg-[#141E34] hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Consolidado General</span>
        </button>

        <button
          onClick={() => setActiveTab('boletos')}
          className={`py-3 px-4 rounded-xl font-sports font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'boletos'
              ? 'bg-blue-600 text-white shadow-md'
              : theme === 'light' ? 'text-slate-700 hover:bg-white' : 'text-slate-400 hover:bg-[#141E34] hover:text-white'
          }`}
        >
          <TicketIcon className="w-4 h-4" />
          <span>Taquilla & Boletos</span>
        </button>

        <button
          onClick={() => setActiveTab('tienda_merch')}
          className={`py-3 px-4 rounded-xl font-sports font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'tienda_merch'
              ? 'bg-red-600 text-white shadow-md'
              : theme === 'light' ? 'text-slate-700 hover:bg-white' : 'text-slate-400 hover:bg-[#141E34] hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Tienda Oficial</span>
        </button>
      </div>

      {/* MÉTRICAS, SELECTOR DE EVENTO Y BUTACAS OCUPADAS: Se despliegan EXCLUSIVAMENTE si se presiona el botón/pestaña de Taquilla & Boletos */}
      {activeTab === 'boletos' && (
        <>
          {/* SELECTOR DE EVENTO ESPECÍFICO */}
          <div className={`p-4 rounded-2xl border shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <label className={`text-[10px] font-black uppercase tracking-wider font-sports block ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                  Filtrar Métricas y Butacas por Partido / Evento
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className={`mt-1 w-full max-w-full sm:max-w-md truncate font-bold text-xs sm:text-sm px-3 py-2 rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                    theme === 'light' ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#141E34] border-slate-700 text-white'
                  }`}
                >
                  <option value="todos">🌐 Todos los Eventos (Consolidado Sede)</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      ⚾ {ev.name} ({ev.date})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0 pl-10 sm:pl-0">
              <span className={`text-[11px] font-bold uppercase tracking-wider font-sports block ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                Boletos Ocupados en este Evento
              </span>
              <span className="text-xl font-black font-scoreboard text-blue-500 dark:text-blue-400">
                {zoneStats.totalTicketsSold} butacas vendidas
              </span>
            </div>
          </div>

          {/* GRÁFICA DE RENDIMIENTO POR ZONA & LISTA DETALLADA DE BUTACAS OCUPADAS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* GRÁFICA / DISTRIBUCIÓN DE VENTAS POR ZONA (40%) */}
            <div className={`lg:col-span-5 rounded-2xl border p-5 shadow-xl space-y-4 ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
                <h3 className={`text-sm font-black uppercase tracking-wider font-sports flex items-center gap-2 ${
                  theme === 'light' ? 'text-slate-900' : 'text-white'
                }`}>
                  <PieChart className="w-4 h-4 text-blue-500" />
                  <span>Rendimiento por Zona (¿Cuál vende más?)</span>
                </h3>
              </div>

              {zoneStats.zonesArray.length === 0 ? (
                <p className={`text-xs text-center py-8 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                  No hay boletos vendidos para este evento aún.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {zoneStats.zonesArray.map((item, idx) => (
                    <div key={item.zone} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold font-sports">
                        <span className={`flex items-center gap-1.5 truncate pr-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][idx % 6] }} />
                          <span className="truncate">{item.zone} ({item.count} boletos)</span>
                        </span>
                        <span className="font-scoreboard text-sm text-emerald-500 dark:text-emerald-400 shrink-0">
                          ${item.revenue.toLocaleString('es-MX')} ({item.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-800/80 overflow-hidden border border-slate-700/50">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(item.percentage, 3)}%`,
                            backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][idx % 6],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* LISTA DETALLADA DE BUTACAS OCUPADAS (60%) - Sin QR */}
            <div className={`lg:col-span-7 rounded-2xl border p-5 shadow-xl space-y-4 ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
                <h3 className={`text-sm font-black uppercase tracking-wider font-sports flex items-center gap-2 ${
                  theme === 'light' ? 'text-slate-900' : 'text-white'
                }`}>
                  <Armchair className="w-4 h-4 text-emerald-500" />
                  <span>Butacas Ocupadas y Vendidas ({filteredTickets.length})</span>
                </h3>
              </div>

              {loadingEventTickets ? (
                <LoadingSpinner message="Cargando mapa de butacas ocupadas..." />
              ) : filteredTickets.length === 0 ? (
                <p className={`text-xs text-center py-8 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                  No se encontraron butacas ocupadas para el filtro seleccionado.
                </p>
              ) : (
                <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
                  {filteredTickets.map((t) => (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                        theme === 'light' ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-[#141E34] border-slate-700/80 hover:bg-[#1A2846]'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 shrink-0 mt-0.5 sm:mt-0">
                          <Armchair className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-black font-sports uppercase tracking-wide truncate ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                            Zona: <strong className="text-blue-500 dark:text-blue-400">{t.section}</strong> • Fila: <strong className="text-emerald-500 dark:text-emerald-400">{t.row}</strong> • Asiento: <strong className="text-amber-500">{t.seat}</strong>
                          </p>
                          <p className={`text-[11px] mt-0.5 truncate ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                            Comprador: <strong className={theme === 'light' ? 'text-slate-900' : 'text-white'}>{t.customerName || 'Aficionado'}</strong> ({t.customerEmail || 'N/A'})
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right shrink-0 pl-10 sm:pl-0">
                        <span className="font-scoreboard font-black text-sm text-emerald-500 dark:text-emerald-400">
                          +${t.price} MXN
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tarjetas KPI del Canal Seleccionado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-2xl border shadow-lg flex items-center gap-3 ${
          theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
        }`}>
          <div className={`p-3 rounded-xl border ${
            theme === 'light' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-red-950/50 text-red-400 border-red-800/40'
          }`}>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wider font-sports ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Ventas Totales Brutas</p>
            <p className={`text-2xl font-black font-scoreboard tracking-wide ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              ${activeTab === 'todos' ? metrics.totalGrossRevenue.toLocaleString('es-MX') : activeTab === 'boletos' ? metrics.ticketsRevenue.toLocaleString('es-MX') : metrics.merchRevenue.toLocaleString('es-MX')} <span className="text-xs text-slate-400 font-sans">MXN</span>
            </p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-lg flex items-center gap-3 ${
          theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
        }`}>
          <div className={`p-3 rounded-xl border ${
            theme === 'light' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-950/50 text-blue-400 border-blue-800/40'
          }`}>
            <TicketIcon className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wider font-sports ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Taquilla & Boletos</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 font-scoreboard tracking-wide">
              ${zoneStats.totalTicketRevenue > 0 && activeTab === 'boletos' ? zoneStats.totalTicketRevenue.toLocaleString('es-MX') : metrics.ticketsRevenue.toLocaleString('es-MX')} <span className="text-xs text-slate-400 font-sans">MXN</span>
            </p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-lg flex items-center gap-3 ${
          theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
        }`}>
          <div className={`p-3 rounded-xl border ${
            theme === 'light' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-red-950/50 text-red-400 border-red-800/40'
          }`}>
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wider font-sports ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Tienda Oficial (Merch)</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400 font-scoreboard tracking-wide">
              ${metrics.merchRevenue.toLocaleString('es-MX')} <span className="text-xs text-slate-400 font-sans">MXN</span>
            </p>
          </div>
        </div>
      </div>

      {/* Nuevas Tarjetas: Método de Pago Hoy & Vendedor Top */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PaymentMethodCard transactions={sales} />
        <TopVendorCard transactions={sales} />
      </div>

      {/* Barra de Búsqueda */}
      <div className={`p-4 rounded-2xl border shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
      }`}>
        <div className="relative flex-1">
          <Search className={`w-4 h-4 absolute left-3 top-3 ${theme === 'light' ? 'text-slate-400' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Buscar transacciones en ${activeTab === 'todos' ? 'todos los canales' : activeTab === 'boletos' ? 'boletos y taquilla' : 'tienda oficial'}...`}
            className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-red-500 border ${
              theme === 'light' ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-[#141E34] border-slate-700 text-white placeholder-slate-500'
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold uppercase font-sports tracking-wider ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
            Mostrando: <strong className="text-red-500 uppercase">{activeTab === 'todos' ? 'Consolidado' : activeTab}</strong> ({filteredSales.length} registros)
          </span>
        </div>
      </div>

      {/* Tabla de Auditoría */}
      {loading ? (
        <LoadingSpinner message="Generando reporte de auditoría de ventas..." />
      ) : filteredSales.length === 0 ? (
        <div className={`border rounded-2xl p-12 text-center ${
          theme === 'light' ? 'bg-white border-slate-200 text-slate-500 shadow-sm' : 'bg-[#0F1626] border-slate-700/80 text-slate-400'
        }`}>
          No hay transacciones registradas para el canal seleccionado ({activeTab}).
        </div>
      ) : (
        <TransactionTableImproved transactions={filteredSales} />
      )}

      {/* Modal para verificar y conciliar pagos pendientes en Stripe */}
      <StripePendingPaymentsModal
        isOpen={isStripeModalOpen}
        onClose={() => setIsStripeModalOpen(false)}
      />
    </div>
  );
};
