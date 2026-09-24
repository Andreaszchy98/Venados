import React, { useEffect, useState, useRef } from 'react';
import { SponsorAd } from '../../types';
import { getActiveSponsorAds, trackAdImpression, trackAdClick } from '../../lib/sponsorAds';
import { normalizeGoogleDriveImageUrl } from '../../lib/imageUtils';
import { X, ExternalLink, Sparkles } from 'lucide-react';

interface PopupAdModalProps {
  venueId: string;
}

export const PopupAdModal: React.FC<PopupAdModalProps> = ({ venueId }) => {
  const [popupAd, setPopupAd] = useState<SponsorAd | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const trackedRef = useRef(false);

  useEffect(() => {
    // Revisar si ya se mostró en esta sesión
    const sessionShown = sessionStorage.getItem(`vxp_popup_ad_${venueId}`);
    if (sessionShown) return;

    getActiveSponsorAds(venueId, 'popup').then((ads) => {
      if (ads.length > 0) {
        const chosen = ads[Math.floor(Math.random() * ads.length)];
        setPopupAd(chosen);
        setIsOpen(true);
        sessionStorage.setItem(`vxp_popup_ad_${venueId}`, 'true');

        if (!trackedRef.current) {
          trackedRef.current = true;
          trackAdImpression(chosen.id);
        }
      }
    });
  }, [venueId]);

  if (!isOpen || !popupAd) return null;

  const handleAction = () => {
    trackAdClick(popupAd.id);
    if (popupAd.targetUrl) {
      window.open(popupAd.targetUrl, '_blank', 'noopener,noreferrer');
    }
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden bg-[#0F1626] border border-slate-700/80 shadow-2xl">
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/70 hover:bg-black text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Imagen publicitaria */}
        <div className="relative h-64 sm:h-72 w-full bg-black">
          <img
            src={normalizeGoogleDriveImageUrl(popupAd.imageUrl)}
            alt={popupAd.sponsorName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1626] via-transparent to-black/40" />

          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 border border-white/10 text-[10px] font-sports font-bold tracking-wider uppercase text-amber-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Patrocinador Oficial</span>
          </div>
        </div>

        {/* Info y botón */}
        <div className="p-5 pt-2 text-center space-y-4">
          <div>
            <h3 className="text-xl font-black font-sports uppercase tracking-wider text-white">
              {popupAd.sponsorName}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Promoción y beneficios exclusivos para la afición del estadio.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-sports font-bold uppercase transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            {popupAd.targetUrl && (
              <button
                type="button"
                onClick={handleAction}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-sports font-black uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Ver Promoción</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
