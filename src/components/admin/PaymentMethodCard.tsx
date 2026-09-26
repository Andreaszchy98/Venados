import React from 'react';
import { SaleTransaction } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { CreditCard, DollarSign, Award } from 'lucide-react';

interface PaymentMethodCardProps {
  transactions: SaleTransaction[];
}

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ transactions }) => {
  const { theme } = useTheme();

  // Robust check for completed transactions
  const completedTransactions = transactions.filter(
    (t) => t.status === 'completed' || t.status === 'completada'
  );

  // Parse Cash (Efectivo) transactions
  const efectivo = completedTransactions
    .filter((t) => {
      const pm = (t.paymentMethod || '').toLowerCase();
      return pm === 'cash' || pm === 'efectivo' || pm.includes('efectivo');
    })
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Parse Card (Tarjeta, Stripe, SPEI, MercadoPago, etc.)
  const tarjeta = completedTransactions
    .filter((t) => {
      const pm = (t.paymentMethod || '').toLowerCase();
      return (
        pm === 'card' ||
        pm === 'tarjeta' ||
        pm.includes('tarjeta') ||
        pm.includes('stripe') ||
        pm.includes('mercadopago') ||
        pm.includes('spei') ||
        pm.includes('transferencia')
      );
    })
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const total = efectivo + tarjeta;
  const porcentajeEfectivo = total > 0 ? ((efectivo / total) * 100).toFixed(1) : '0.0';
  const porcentajeTarjeta = total > 0 ? ((tarjeta / total) * 100).toFixed(1) : '0.0';

  // Find the top vendor who sold the most (highest total amount)
  const vendorSales: Record<string, number> = {};
  completedTransactions.forEach((t) => {
    const name = t.operatorName || t.issuedBy || 'Vendedor General';
    vendorSales[name] = (vendorSales[name] || 0) + (Number(t.amount) || 0);
  });

  const sortedVendors = Object.entries(vendorSales).sort((a, b) => b[1] - a[1]);
  const topVendorName = sortedVendors.length > 0 ? sortedVendors[0][0] : 'Ninguno';
  const topVendorAmount = sortedVendors.length > 0 ? sortedVendors[0][1] : 0;

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
          <CreditCard className="w-4 h-4 text-blue-500" />
          <span>💳 MÉTODO DE PAGO HOY</span>
        </h3>

        {/* Efectivo row */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold font-sports">
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-500" />
              <span>Efectivo</span>
            </span>
            <span className="font-mono text-amber-600 dark:text-amber-400">
              ${efectivo.toLocaleString('es-MX')} ({porcentajeEfectivo}%)
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-800/80 overflow-hidden border border-slate-700/50">
            <div
              className="h-full rounded-full bg-[#FF9500] transition-all duration-500"
              style={{ width: `${porcentajeEfectivo}%` }}
            />
          </div>
        </div>

        {/* Tarjeta row */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold font-sports">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-blue-400" />
              <span>Tarjeta (Stripe / SPEI)</span>
            </span>
            <span className="font-mono text-blue-600 dark:text-blue-400">
              ${tarjeta.toLocaleString('es-MX')} ({porcentajeTarjeta}%)
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-800/80 overflow-hidden border border-slate-700/50">
            <div
              className="h-full rounded-full bg-[#3B82F6] transition-all duration-500"
              style={{ width: `${porcentajeTarjeta}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer statistics & top vendor */}
      <div
        className={`pt-3 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-sports ${
          theme === 'light' ? 'border-slate-100 text-slate-700' : 'border-slate-800 text-slate-300'
        }`}
      >
        <div>
          <span className="block text-[10px] uppercase text-slate-400">Recaudado Hoy</span>
          <span className="text-sm font-scoreboard font-bold tracking-wider text-emerald-500">
            ${total.toLocaleString('es-MX')} MXN
          </span>
        </div>

        {sortedVendors.length > 0 && (
          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase text-slate-400 flex items-center gap-1 justify-start sm:justify-end">
              <Award className="w-3 h-3 text-yellow-500" /> Vendedor Líder
            </span>
            <span className="font-extrabold text-blue-500 block truncate max-w-[150px]" title={topVendorName}>
              {topVendorName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
