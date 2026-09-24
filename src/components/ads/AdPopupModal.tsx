import React, { useState, useEffect } from 'react';
import { Advertisement } from '../../types';
import { trackAdImpression, trackAdClick } from '../../lib/advertisements';
import { X, ExternalLink, Sparkles } from 'lucide-react';

interface AdPopupModalProps {
  ads: Advertisement[];
}

export const AdPopupModal: React.FC<AdPopupModalProps> = ({ ads }) => {
  const [activePopup, setActivePopup] = useState<Advertisement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const popupAds = ads.filter(ad => ad.type === 'popup' && ad.active);
    if (popupAds.length === 0) return;

    // Frecuencia controlada: máximo 1 vez por sesión
    const hasShownPopup = sessionStorage.getItem('vxp_popup_shown');
    if (!hasShownPopup) {
      // Elegir el de mayor prioridad o el primero
      const selected = popupAds[0];
      setActivePopup(selected);
      setIsOpen(true);
      sessionStorage.setItem('vxp_popup_shown', 'true');
      trackAdImpression(selected.id);
    }
  }, [ads]);

  if (!isOpen || !activePopup) return null;

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleClick = () => {
    trackAdClick(activePopup.id);
    if (activePopup.targetUrl) {
      window.open(activePopup.targetUrl, '_blank');
    }
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative animate-in zoom-in-95 duration-300">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors shadow-lg"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          onClick={handleClick}
          className="cursor-pointer group"
        >
          <div className="relative h-64 bg-slate-900 overflow-hidden">
            <img
              src={activePopup.imageUrl}
              alt={activePopup.sponsorName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-1 bg-amber-500 text-slate-950 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3.5 h-3.5" />
                  Especial Afición
                </span>
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                {activePopup.sponsorName}
              </h3>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Descubre las promociones exclusivas que {activePopup.sponsorName} tiene preparadas para esta temporada en el estadio.
            </p>

            {activePopup.targetUrl && (
              <div className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-center flex items-center justify-center gap-2 shadow-lg transition-colors">
                <span>Ver Promoción</span>
                <ExternalLink className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
