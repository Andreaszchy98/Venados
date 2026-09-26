import React from 'react';
import { SaleTransaction } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { Users, Star, TrendingUp, BarChart2 } from 'lucide-react';

interface TopVendorCardProps {
  transactions: SaleTransaction[];
  onOpenRanking?: () => void;
}

export const TopVendorCard: React.FC<TopVendorCardProps> = ({ transactions, onOpenRanking }) => {
  const { theme } = useTheme();

  // Filter completed sales
  const completed = transactions.filter(
    (t) => t.status === 'completed' || t.status === 'completada'
  );

  const vendorSales: Record<string, { count: number; total: number }> = {};

  completed.forEach((t) => {
    const name = t.operatorName || t.issuedBy || 'Vendedor General';
    if (!vendorSales[name]) {
      vendorSales[name] = { count: 0, total: 0 };
    }
    vendorSales[name].count += 1;
    vendorSales[name].total += Number(t.amount) || 0;
  });

  // Sort vendors by total revenue generated
  const sortedVendors = Object.entries(vendorSales).sort(
    (a, b) => b[1].total - a[1].total
  );

  const topVendor = sortedVendors[0];

  if (!topVendor) {
    return (
      <div
        className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-center items-center text-center space-y-2 h-full ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-500 shadow-xs'
            : 'bg-[#0F1626] border-slate-700/80 text-slate-400'
        }`}
      >
        <Users className="w-8 h-8 text-slate-600 animate-pulse" />
        <h3 className="text-xs font-black uppercase tracking-wider font-sports">👤 VENDEDOR TOP HOY</h3>
        <p className="text-xs">No hay datos de ventas disponibles hoy.</p>
      </div>
    );
  }

  const [name, data] = topVendor;
  const promedio = data.count > 0 ? (data.total / data.count).toFixed(0) : '0';

  // Aesthetic rating based on total revenue milestones (e.g., up to 5 stars)
  const starCount = Math.min(5, Math.max(1, Math.ceil(data.total / 10000)));

  return (
    <div
      className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-between space-y-4 ${
        theme === 'light'
          ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
          : 'bg-[#0F1626] border-slate-700/80 text-white'
      }`}
    >
      <div className="space-y-3">
        <h3
          className={`text-xs font-black uppercase tracking-wider font-sports flex items-center gap-2 ${
            theme === 'light' ? 'text-slate-600' : 'text-slate-300'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-500" />
          <span>👤 VENDEDOR TOP HOY</span>
        </h3>

        {/* Vendor info and stars */}
        <div className="flex justify-between items-center bg-[#141E34]/20 p-3 rounded-xl border border-slate-700/20">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-black font-sports uppercase truncate text-red-500 dark:text-red-400" title={name}>
              {name}
            </h4>
            <div className="flex items-center gap-1 mt-1 text-amber-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < starCount ? 'fill-current text-amber-500' : 'text-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className={`p-2.5 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-[#141E34]/50 border-slate-800'}`}>
            <span className="block text-[10px] uppercase text-slate-400 font-sports font-extrabold">Recaudado</span>
            <span className="text-xs sm:text-sm font-scoreboard font-bold text-emerald-500 block mt-1">
              ${data.total.toLocaleString('es-MX')}
            </span>
          </div>

          <div className={`p-2.5 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-[#141E34]/50 border-slate-800'}`}>
            <span className="block text-[10px] uppercase text-slate-400 font-sports font-extrabold">Ventas</span>
            <span className="text-xs sm:text-sm font-scoreboard font-bold text-blue-400 block mt-1">
              {data.count}
            </span>
          </div>

          <div className={`p-2.5 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-[#141E34]/50 border-slate-800'}`}>
            <span className="block text-[10px] uppercase text-slate-400 font-sports font-extrabold">Promedio</span>
            <span className="text-xs sm:text-sm font-scoreboard font-bold text-amber-500 block mt-1">
              ${Number(promedio).toLocaleString('es-MX')}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onOpenRanking}
        className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 hover:text-red-500 border border-red-500/30 text-red-400 rounded-xl font-sports text-[11px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
      >
        <BarChart2 className="w-3.5 h-3.5" />
        <span>Ver Ranking de Vendedoras</span>
      </button>
    </div>
  );
};
