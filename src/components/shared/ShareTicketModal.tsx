import React, { useState, useEffect } from 'react';
import { Ticket } from '../../types';
import { generateTicketClaimData, ClaimLinkDetails, getPublicAppBaseUrl } from '../../lib/tickets';
import { cleanSeatValue, cleanSectionValue, formatRowLabel } from '../../lib/seatUtils';
import { useTheme } from '../../context/ThemeContext';
import {
  X,
  Share2,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  ShieldCheck,
  Ticket as TicketIcon,
  Sparkles,
  Globe,
  Settings2,
} from 'lucide-react';

interface ShareTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
}

export const ShareTicketModal: React.FC<ShareTicketModalProps> = ({
  isOpen,
  onClose,
  ticket,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [claimData, setClaimData] = useState<ClaimLinkDetails | null>(null);
  const [copied, setCopied] = useState(false);
  const [customDomain, setCustomDomain] = useState<string>(() => {
    try {
      return localStorage.getItem('vxp_public_domain') || '';
    } catch {
      return '';
    }
  });
  const [showDomainConfig, setShowDomainConfig] = useState(false);

  const loadClaimData = (overrideDomain?: string) => {
    if (!ticket) return;
    setLoading(true);
    generateTicketClaimData(ticket.id, overrideDomain || customDomain || undefined)
      .then((data) => {
        setClaimData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error al generar enlace de reclamo:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen && ticket) {
      loadClaimData();
    } else {
      setClaimData(null);
      setCopied(false);
      setShowDomainConfig(false);
    }
  }, [isOpen, ticket]);

  if (!isOpen || !ticket) return null;

  const handleSaveDomain = (newDomain: string) => {
    const clean = newDomain.trim();
    setCustomDomain(clean);
    try {
      if (clean) {
        localStorage.setItem('vxp_public_domain', clean);
      } else {
        localStorage.removeItem('vxp_public_domain');
      }
    } catch {}
    loadClaimData(clean);
  };

  const handleCopyLink = async () => {
    if (!claimData) return;
    try {
      await navigator.clipboard.writeText(claimData.claimUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const handleNativeShare = async () => {
    if (!claimData) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: claimData.shareTitle,
          text: claimData.shareText,
          url: claimData.claimUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleOpenWhatsApp = () => {
    if (!claimData) return;
    window.open(claimData.whatsappUrl, '_blank');
  };

  const isDevOrigin = typeof window !== 'undefined' && window.location.origin.includes('ais-dev-');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden transition-all duration-200 ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#0F1626] border-slate-700/80 text-white'
        }`}
      >
        {/* Cabecera modal */}
        <div className="p-5 border-b flex items-center justify-between relative bg-gradient-to-r from-red-600/10 via-transparent to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 text-red-500 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black font-sports uppercase tracking-wide">
                Compartir Butaca
              </h3>
              <p className="text-[11px] text-slate-400">
                Pase de invitado directo sin registro ni cuenta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-500/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-4">
          {/* Tarjeta resumen de la butaca */}
          <div
            className={`p-3.5 rounded-2xl border text-center space-y-2 ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-200'
                : 'bg-[#141C2E] border-slate-700/80'
            }`}
          >
            <div className="text-xs font-black font-sports uppercase tracking-wide text-red-500">
              {ticket.matchTitle}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700/40 text-center">
              <div>
                <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">Zona</span>
                <span className="text-xs font-black font-sports truncate block">
                  {cleanSectionValue(ticket.section)}
                </span>
              </div>
              <div className="border-x border-slate-700/40">
                <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">Fila</span>
                <span className="text-xs font-black text-amber-400 font-mono block">
                  {formatRowLabel(ticket.row)}
                </span>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">Butaca</span>
                <span className="text-xs font-black text-red-500 font-mono block">
                  {cleanSeatValue(ticket.seat)}
                </span>
              </div>
            </div>
          </div>

          {/* Aviso de Enlace Público y Seguro */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="block text-emerald-200 font-bold font-sports uppercase tracking-wider text-[11px]">
                Enlace Público para Invitados
              </strong>
              <span className="text-[11px] text-emerald-300/90 leading-relaxed block">
                {isDevOrigin
                  ? 'El enlace se envía a través del servidor público (Preview), por lo que Google NO le pedirá iniciar sesión ni cuenta.'
                  : 'Cualquier persona que reciba este enlace podrá ver su QR oficial y pasar los torniquetes sin registrarse.'}
              </span>
            </div>
          </div>

          {/* Opciones de envío */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={loading || !claimData}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider font-sports flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>Enviar por WhatsApp</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={loading || !claimData}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold font-sports uppercase tracking-wider border flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                  copied
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-[#141C2E] hover:bg-[#1A253D] border-slate-700 text-slate-200'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>¡Enlace Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-amber-500" />
                    <span>Copiar Enlace</span>
                  </>
                )}
              </button>

              {typeof navigator !== 'undefined' && (navigator as any).share && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  disabled={loading || !claimData}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold font-sports uppercase tracking-wider border flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                      : 'bg-[#141C2E] hover:bg-[#1A253D] border-slate-700 text-slate-200'
                  }`}
                  title="Más opciones de compartir"
                >
                  <Share2 className="w-4 h-4 text-red-500" />
                  <span>Más</span>
                </button>
              )}
            </div>
          </div>

          {claimData && (
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Enlace directo para el invitado:</span>
                <button
                  type="button"
                  onClick={() => setShowDomainConfig(!showDomainConfig)}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer font-sports font-bold uppercase tracking-wider"
                >
                  <Settings2 className="w-3 h-3" />
                  <span>{showDomainConfig ? 'Ocultar dominio' : 'Cambiar dominio / Vercel'}</span>
                </button>
              </div>

              {showDomainConfig && (
                <div className="p-3 rounded-xl bg-[#0A0E17] border border-slate-700 space-y-2 animate-in fade-in duration-100">
                  <label className="block text-[10px] text-slate-300 font-bold uppercase font-sports">
                    Dominio de Producción / Vercel (Opcional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://tu-proyecto.vercel.app"
                    defaultValue={customDomain}
                    onBlur={(e) => handleSaveDomain(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveDomain((e.target as HTMLInputElement).value);
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-[#141C2E] border border-slate-600 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-red-500"
                  />
                  <p className="text-[9px] text-slate-400 leading-tight">
                    Si dejas este campo vacío, se usará automáticamente el enlace público compartido de Google Studio (Preview).
                  </p>
                </div>
              )}

              <div className="p-2 rounded-lg bg-black/40 border border-slate-800 font-mono text-[10px] text-slate-300 truncate select-all">
                {claimData.claimUrl}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
