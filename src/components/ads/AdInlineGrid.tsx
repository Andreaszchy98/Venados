import React, { useEffect } from 'react';
import { Advertisement } from '../../types';
import { trackAdImpression, trackAdClick } from '../../lib/advertisements';
import { ExternalLink, Sparkles } from 'lucide-react';

interface AdInlineGridProps {
  ad: Advertisement;
}

export const AdInlineGrid: React.FC<AdInlineGridProps> = ({ ad }) => {
  useEffect(() => {
    trackAdImpression(ad.id);
  }, [ad.id]);

  const handleClick = () => {
    trackAdClick(ad.id);
    if (ad.targetUrl) {
      window.open(ad.targetUrl, '_blank');
    }
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-amber-500/40 dark:border-amber-500/30 overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-full cursor-pointer group relative"
    >
      <div className="absolute top-3 left-3 z-10">
        <span className="px-2.5 py-1 bg-amber-500 text-slate-950 font-extrabold rounded-full text-xs uppercase tracking-wider flex items-center gap-1 shadow-md">
          <Sparkles className="w-3.5 h-3.5" />
          Patrocinado
        </span>
      </div>

      <div className="relative h-44 bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <img
          src={ad.imageUrl}
          alt={ad.sponsorName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80';
          }}
        />
      </div>

      <div className="p-5 flex flex-col justify-between flex-1 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
            {ad.sponsorName}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Anuncio destacado para la afición. Haz clic para conocer más beneficios exclusivos.
          </p>
        </div>

        {ad.targetUrl && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span>Visitar sitio oficial</span>
            <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        )}
      </div>
    </div>
  );
};
