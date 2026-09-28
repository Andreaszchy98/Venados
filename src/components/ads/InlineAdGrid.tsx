import React, { useEffect, useState, useRef } from 'react';
import { SponsorAd } from '../../types';
import { getActiveSponsorAds, trackAdImpression, trackAdClick } from '../../lib/sponsorAds';
import { normalizeGoogleDriveImageUrl } from '../../lib/imageUtils';
import { useTheme } from '../../context/ThemeContext';
import { ExternalLink, Sparkles } from 'lucide-react';

interface InlineAdGridProps {
  venueId: string;
  onSelectStore?: (type: 'tienda' | 'comida') => void;
}

export const InlineAdGrid: React.FC<InlineAdGridProps> = ({ venueId, onSelectStore }) => {
  const { theme } = useTheme();
  const [ads, setAds] = useState<SponsorAd[]>([]);
  const trackedImpressions = useRef<Set<string>>(new Set());

  useEffect(() => {
    getActiveSponsorAds(venueId, 'inline').then((fetched) => {
      setAds(fetched);
      fetched.forEach((ad) => {
        if (!trackedImpressions.current.has(ad.id)) {
          trackedImpressions.current.add(ad.id);
          trackAdImpression(ad.id);
        }
      });
    });
  }, [venueId]);

  if (ads.length === 0) return null;

  const handleClick = (ad: SponsorAd) => {
    trackAdClick(ad.id);
    if (ad.linkDestinationType === 'store_item' && ad.targetItemId) {
      try {
        sessionStorage.setItem('vxp_target_product_id', ad.targetItemId);
      } catch {}
      onSelectStore?.('tienda');
    } else if (ad.linkDestinationType === 'concession_dish' && ad.targetItemId) {
      try {
        sessionStorage.setItem('vxp_target_dish_id', ad.targetItemId);
      } catch {}
      onSelectStore?.('comida');
    } else if (ad.targetUrl) {
      window.open(ad.targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-2.5 my-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[11px] font-sports font-black uppercase tracking-wider text-slate-400">
          Marcas Oficiales del Club
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {ads.map((ad) => (
          <div
            key={ad.id}
            onClick={() => handleClick(ad)}
            className={`rounded-2xl border overflow-hidden shadow-sm transition-all group ${
              ad.targetUrl ? 'cursor-pointer hover:border-red-500/60 hover:shadow-md' : ''
            } ${
              theme === 'light'
                ? 'bg-white border-slate-200'
                : 'bg-[#0F1626] border-slate-700/80'
            }`}
          >
            <div className="relative h-28 w-full bg-black/30 overflow-hidden">
              <img
                src={normalizeGoogleDriveImageUrl(ad.imageUrl)}
                alt={ad.sponsorName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs border border-white/10 text-[9px] font-sports font-bold tracking-wider uppercase text-amber-300">
                {ad.badgeLabel || 'Patrocinador Oficial'}
              </div>
              <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between">
                <span className="text-xs font-black font-sports uppercase tracking-wider text-white truncate">
                  {ad.sponsorName}
                </span>
                {ad.targetUrl && (
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
