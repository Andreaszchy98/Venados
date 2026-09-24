import React, { useEffect, useState, useRef } from 'react';
import { SponsorAd } from '../../types';
import { getActiveSponsorAds, trackAdImpression, trackAdClick } from '../../lib/sponsorAds';
import { normalizeGoogleDriveImageUrl } from '../../lib/imageUtils';
import { ExternalLink, Sparkles } from 'lucide-react';

interface HeroAdBannerProps {
  venueId: string;
}

export const HeroAdBanner: React.FC<HeroAdBannerProps> = ({ venueId }) => {
  const [ads, setAds] = useState<SponsorAd[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const trackedImpressions = useRef<Set<string>>(new Set());

  useEffect(() => {
    getActiveSponsorAds(venueId, 'hero').then((fetched) => {
      setAds(fetched);
      if (fetched.length > 0 && !trackedImpressions.current.has(fetched[0].id)) {
        trackedImpressions.current.add(fetched[0].id);
        trackAdImpression(fetched[0].id);
      }
    });
  }, [venueId]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % ads.length;
        const currentAd = ads[next];
        if (currentAd && !trackedImpressions.current.has(currentAd.id)) {
          trackedImpressions.current.add(currentAd.id);
          trackAdImpression(currentAd.id);
        }
        return next;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [ads]);

  if (ads.length === 0) return null;

  const currentAd = ads[currentIndex];
  if (!currentAd) return null;

  const handleClick = () => {
    trackAdClick(currentAd.id);
    if (currentAd.targetUrl) {
      window.open(currentAd.targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative w-full rounded-2xl overflow-hidden shadow-lg border border-slate-700/60 transition-all ${
        currentAd.targetUrl ? 'cursor-pointer group hover:border-red-500/60' : ''
      }`}
    >
      <div className="relative h-28 sm:h-36 md:h-44 w-full bg-black/40 overflow-hidden">
        <img
          src={normalizeGoogleDriveImageUrl(currentAd.imageUrl)}
          alt={currentAd.sponsorName}
          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />

        {/* Badge de Patrocinador Oficial */}
        <div className="absolute top-2.5 left-3 flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs border border-white/10 text-[10px] font-sports font-bold tracking-wider uppercase text-amber-400">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Patrocinador Oficial</span>
        </div>

        {/* Info */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
          <div>
            <span className="text-xs sm:text-base font-black font-sports uppercase tracking-wide text-white drop-shadow-md">
              {currentAd.sponsorName}
            </span>
          </div>
          {currentAd.targetUrl && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600/90 group-hover:bg-red-600 text-white text-[10px] font-sports font-bold uppercase tracking-wider shadow-md">
              <span>Visitar</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          )}
        </div>

        {/* Indicadores de carrusel si hay más de uno */}
        {ads.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
            {ads.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? 'w-4 bg-red-500' : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
