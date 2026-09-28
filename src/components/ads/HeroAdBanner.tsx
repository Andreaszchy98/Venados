import React, { useEffect, useState, useRef } from 'react';
import { SponsorAd } from '../../types';
import { getActiveSponsorAds, trackAdImpression, trackAdClick } from '../../lib/sponsorAds';
import { getVenueById } from '../../lib/venues';
import { normalizeGoogleDriveImageUrl, DEFAULT_STORE_PROMO_BANNER } from '../../lib/imageUtils';
import { ExternalLink, Sparkles, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroAdBannerProps {
  venueId: string;
  onSelectStore?: (type: 'tienda' | 'comida') => void;
}

interface CarouselItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  badgeLabel: string;
  isStorePromo?: boolean;
  targetUrl?: string;
  linkDestinationType?: 'external' | 'store_item' | 'concession_dish';
  targetItemId?: string;
  targetItemName?: string;
  adId?: string;
}

export const HeroAdBanner: React.FC<HeroAdBannerProps> = ({ venueId, onSelectStore }) => {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const trackedImpressions = useRef<Set<string>>(new Set());

  // Touch swipe refs
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;
    async function loadContent() {
      const combined: CarouselItem[] = [];

      // 1. Cargar promoción de tienda oficial de la sede si está configurada
      try {
        const venue = await getVenueById(venueId);
        if (venue && venue.storePromoActive !== false) {
          const banner = venue.storePromoBannerUrl
            ? normalizeGoogleDriveImageUrl(venue.storePromoBannerUrl)
            : (venueId === 'venue-teodoro-mariscal' ? DEFAULT_STORE_PROMO_BANNER : null);

          if (banner) {
            combined.push({
              id: `store-promo-${venue.id}`,
              title: venue.storePromoTitle || 'Tienda Oficial Venados Store',
              subtitle: venue.storePromoSubtitle || 'Jerseys oficiales, gorras y souvenirs con entrega en tu butaca',
              imageUrl: banner,
              badgeLabel: '🛍️ TIENDA OFICIAL',
              isStorePromo: true,
            });
          }
        }
      } catch (e) {
        console.warn('Error cargando banner de tienda para hero:', e);
      }

      // 2. Cargar anuncios de patrocinadores activos
      try {
        const ads = await getActiveSponsorAds(venueId, 'hero');
        ads.forEach((ad) => {
          combined.push({
            id: ad.id,
            title: ad.sponsorName,
            imageUrl: normalizeGoogleDriveImageUrl(ad.imageUrl),
            badgeLabel: ad.badgeLabel || 'Patrocinador Oficial',
            targetUrl: ad.targetUrl,
            linkDestinationType: ad.linkDestinationType || 'external',
            targetItemId: ad.targetItemId,
            targetItemName: ad.targetItemName,
            adId: ad.id,
          });
        });
      } catch (e) {
        console.warn('Error cargando anuncios de patrocinadores:', e);
      }

      if (isMounted) {
        setItems(combined);
        if (combined.length > 0 && combined[0].adId && !trackedImpressions.current.has(combined[0].adId)) {
          trackedImpressions.current.add(combined[0].adId);
          trackAdImpression(combined[0].adId);
        }
      }
    }

    loadContent();
    return () => {
      isMounted = false;
    };
  }, [venueId]);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % items.length;
        const currentItem = items[next];
        if (currentItem && currentItem.adId && !trackedImpressions.current.has(currentItem.adId)) {
          trackedImpressions.current.add(currentItem.adId);
          trackAdImpression(currentItem.adId);
        }
        return next;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [items]);

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];
  if (!currentItem) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 40;
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => {
      const next = (prev + 1) % items.length;
      const currentItem = items[next];
      if (currentItem && currentItem.adId && !trackedImpressions.current.has(currentItem.adId)) {
        trackedImpressions.current.add(currentItem.adId);
        trackAdImpression(currentItem.adId);
      }
      return next;
    });
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => {
      const next = (prev - 1 + items.length) % items.length;
      const currentItem = items[next];
      if (currentItem && currentItem.adId && !trackedImpressions.current.has(currentItem.adId)) {
        trackedImpressions.current.add(currentItem.adId);
        trackAdImpression(currentItem.adId);
      }
      return next;
    });
  };

  const handleClick = () => {
    if (currentItem.isStorePromo) {
      onSelectStore?.('tienda');
    } else if (currentItem.linkDestinationType === 'store_item' && currentItem.targetItemId) {
      if (currentItem.adId) trackAdClick(currentItem.adId);
      try {
        sessionStorage.setItem('vxp_target_product_id', currentItem.targetItemId);
      } catch {}
      onSelectStore?.('tienda');
    } else if (currentItem.linkDestinationType === 'concession_dish' && currentItem.targetItemId) {
      if (currentItem.adId) trackAdClick(currentItem.adId);
      try {
        sessionStorage.setItem('vxp_target_dish_id', currentItem.targetItemId);
      } catch {}
      onSelectStore?.('comida');
    } else if (currentItem.targetUrl) {
      if (currentItem.adId) trackAdClick(currentItem.adId);
      window.open(currentItem.targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-slate-700/60 transition-all cursor-pointer group hover:border-red-500/60 select-none"
    >
      <div className="relative h-28 sm:h-36 md:h-44 w-full bg-black/40 overflow-hidden">
        <img
          src={currentItem.imageUrl}
          alt={currentItem.title}
          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500 pointer-events-none"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />

        {/* Botones de navegación lateral (visibles en hover) */}
        {items.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-white/20 z-10"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-white/20 z-10"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Badge superior */}
        <div className="absolute top-2.5 left-3 flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs border border-white/10 text-[10px] font-sports font-bold tracking-wider uppercase text-amber-400">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>{currentItem.badgeLabel}</span>
        </div>

        {/* Info inferior */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
          <div className="max-w-[70%]">
            <span className="text-xs sm:text-base font-black font-sports uppercase tracking-wide text-white drop-shadow-md block truncate">
              {currentItem.title}
            </span>
            {currentItem.subtitle && (
              <p className="text-[10px] sm:text-xs text-slate-300 font-medium line-clamp-1 drop-shadow-xs mt-0.5">
                {currentItem.subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600/90 group-hover:bg-red-600 text-white text-[10px] font-sports font-bold uppercase tracking-wider shadow-md shrink-0">
            <span>{currentItem.isStorePromo ? 'Ver Tienda' : 'Visitar'}</span>
            {currentItem.isStorePromo ? <ShoppingBag className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
          </div>
        </div>

        {/* Indicadores de carrusel (puntos interactivos) */}
        {items.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? 'w-4 bg-red-500' : 'w-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Ir al anuncio ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
