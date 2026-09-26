import React, { useState } from 'react';
import { SaleTransaction, SaleChannel } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import {
  Ticket,
  ShoppingBag,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  DollarSign,
  CreditCard,
} from 'lucide-react';

interface TransactionTableImprovedProps {
  transactions: SaleTransaction[];
}

type SortField = 'channel' | 'description' | 'customerName' | 'operatorName' | 'paymentMethod' | 'amount' | 'date';
type SortOrder = 'asc' | 'desc';

export const TransactionTableImproved: React.FC<TransactionTableImprovedProps> = ({ transactions }) => {
  const { theme } = useTheme();
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedTransactions = React.useMemo(() => {
    return [...transactions].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'channel':
          valA = a.channel || '';
          valB = b.channel || '';
          break;
        case 'description':
          valA = a.description || a.concept || '';
          valB = b.description || b.concept || '';
          break;
        case 'customerName':
          valA = a.customerName || '';
          valB = b.customerName || '';
          break;
        case 'operatorName':
          valA = a.operatorName || a.issuedBy || '';
          valB = b.operatorName || b.issuedBy || '';
          break;
        case 'paymentMethod':
          valA = a.paymentMethod || '';
          valB = b.paymentMethod || '';
          break;
        case 'amount':
          valA = Number(a.amount) || 0;
          valB = Number(b.amount) || 0;
          break;
        case 'date':
          valA = new Date(a.date).getTime();
          valB = new Date(b.date).getTime();
          break;
        default:
          break;
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
  }, [transactions, sortField, sortOrder]);

  const getChannelBadge = (channel: SaleChannel | string) => {
    switch (channel) {
      case 'boletos':
      case 'taquilla':
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider font-sports border ${
              theme === 'light'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-blue-950/70 text-blue-400 border-blue-800/60'
            }`}
          >
            <Ticket className="w-3 h-3 text-blue-500" /> Taquilla
          </span>
        );
      case 'tienda_merch':
      case 'tienda':
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider font-sports border ${
              theme === 'light'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-red-950/70 text-red-400 border-red-800/60'
            }`}
          >
            <ShoppingBag className="w-3 h-3 text-red-500" /> Tienda
          </span>
        );
      default:
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
              theme === 'light'
                ? 'bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            {channel}
          </span>
        );
    }
  };

  const getPaymentBadge = (method: string) => {
    const pm = (method || '').toLowerCase();
    const isCash = pm === 'cash' || pm === 'efectivo' || pm.includes('efectivo');

    if (isCash) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
            theme === 'light'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-amber-950/50 text-amber-400 border border-amber-900/40'
          }`}
        >
          <span>💵</span>
          <span>Efectivo</span>
        </span>
      );
    } else {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
            theme === 'light'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-blue-950/50 text-blue-400 border border-blue-900/40'
          }`}
        >
          <span>💳</span>
          <span>Tarjeta</span>
        </span>
      );
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => {
    const isSorted = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className="py-3.5 px-4 cursor-pointer select-none group transition-colors hover:text-red-500"
      >
        <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[11px] font-sports">
          <span>{label}</span>
          <span className="shrink-0 transition-opacity">
            {isSorted ? (
              sortOrder === 'asc' ? (
                <ChevronUp className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-red-500" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-80" />
            )}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div
      className={`rounded-2xl border shadow-xl overflow-hidden ${
        theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
      }`}
    >
      <div className="overflow-x-auto">
        <table className={`w-full text-left text-xs ${theme === 'light' ? 'text-slate-800' : 'text-slate-300'}`}>
          <thead
            className={`font-black uppercase tracking-wider text-[11px] font-sports border-b ${
              theme === 'light'
                ? 'bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-[#141E34] text-slate-400 border-slate-700/80'
            }`}
          >
            <tr>
              <SortHeader field="channel" label="Canal" />
              <SortHeader field="description" label="Concepto" />
              <SortHeader field="customerName" label="Cliente" />
              <SortHeader field="operatorName" label="Vendedor" />
              <SortHeader field="paymentMethod" label="Método Pago" />
              <SortHeader field="amount" label="Monto" />
              <SortHeader field="date" label="Hora" />
            </tr>
          </thead>
          <tbody
            className={`divide-y ${
              theme === 'light' ? 'divide-slate-200' : 'divide-slate-800/60'
            }`}
          >
            {sortedTransactions.map((t, idx) => {
              const rowBg =
                idx % 2 === 0
                  ? 'bg-transparent'
                  : theme === 'light'
                  ? 'bg-slate-50/50'
                  : 'bg-[#101625]/40';

              const conceptText = t.description || t.concept || 'Venta General';
              const vendorText = t.operatorName || t.issuedBy || 'General';

              return (
                <tr
                  key={t.id}
                  className={`transition-all ${rowBg} ${
                    theme === 'light'
                      ? 'hover:bg-red-50/35 hover:text-slate-900'
                      : 'hover:bg-[#141E34]/80'
                  }`}
                >
                  <td className="py-3.5 px-4">{getChannelBadge(t.channel)}</td>
                  <td className="py-3.5 px-4 font-semibold max-w-[200px] truncate" title={conceptText}>
                    {conceptText}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-xs" title={t.customerName}>
                    {t.customerName || 'Cliente General'}
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-blue-500 dark:text-blue-400">
                    {vendorText}
                  </td>
                  <td className="py-3.5 px-4">{getPaymentBadge(t.paymentMethod)}</td>
                  <td className="py-3.5 px-4 font-black text-sm text-emerald-600 dark:text-emerald-400 font-scoreboard tracking-wide">
                    ${(Number(t.amount) || 0).toLocaleString('es-MX')} MXN
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {new Date(t.date).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
