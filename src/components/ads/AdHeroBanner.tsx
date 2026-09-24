import React, { useState, useEffect } from 'react';
import { Advertisement } from '../../types';
import { trackAdImpression, trackAdClick } from '../../lib/advertisements';
import { ExternalLink, Sparkles } from 'lucide-react';

interface AdHeroBannerProps {
  ads: Advertisement[];
}

export const AdHeroBanner: React.FC<AdHeroBannerProps> = ({ ads }) => {
  const heroAds = ads.filter(ad => ad.type === 'hero' && ad.active);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (heroAds.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % heroAds.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [heroAds.length]);

  useEffect(() => {
    if (heroAds.length > 0 && heroAds[currentIndex]) {
      trackAdImpression(heroAds[currentIndex].id);
    }
  }, [currentIndex, heroAds]);

  if (heroAds.length === 0) return null;

  const currentAd = heroAds[currentIndex];

  const handleClick = () => {
    trackAdClick(currentAd.id);
    if (currentAd.targetUrl) {
      window.open(currentAd.targetUrl, '_blank');
    }
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto px-4 py-4">
      <div
        onClick={handleClick}
        className="relative h-56 sm:h-72 md:h-80 rounded-3xl overflow-hidden shadow-xl cursor-pointer group bg-slate-900 border border-slate-800 transition-transform duration-300 hover:scale-[1.01]"
      >
        <img
          src={currentAd.imageUrl}
          alt={currentAd.sponsorName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
              Patrocinador Oficial
            </span>
            <span className="text-slate-300 text-xs font-medium">
              {currentAd.sponsorName}
            </span>
          </div>
          <div className="flex justify-between items-end">
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
              {currentAd.sponsorName} — Experiencia Exclusiva
            </h2>
            {currentAd.targetUrl && (
              <span className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-xl text-sm font-semibold transition-colors">
                Ver más <ExternalLink className="w-4 h-4" />
              </span>
            )}
          </div>
        </div>

        {/* Indicadores / Dots */}
        {heroAds.length > 1 && (
          <div className="absolute top-4 right-4 flex gap-1.5 z-10 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
            {heroAds.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-red-500 w-6' : 'bg-white/50 hover:bg-white'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
