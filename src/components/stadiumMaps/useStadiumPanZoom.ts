import React, { useState, useRef, useCallback, useEffect } from 'react';

export interface UseStadiumPanZoomOptions {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
}

export interface StadiumRegionPreset {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: string;
  normX: number; // 0 (left) to 1 (right), 0.5 is center
  normY: number; // 0 (top) to 1 (bottom), 0.5 is center
  scale: number;
}

export function useStadiumPanZoom({
  minScale = 0.7,
  maxScale = 4.0,
  initialScale = 1,
}: UseStadiumPanZoomOptions = {}) {
  const [scale, setScale] = useState<number>(initialScale);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeRegionId, setActiveRegionId] = useState<string>('all');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const startMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);

  // Touch handling
  const touchStartDist = useRef<number | null>(null);
  const touchStartScale = useRef<number>(1);
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);

  // Helper para zoom focal en coordenadas de contenedor
  const zoomToPoint = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;

      setActiveRegionId('custom');

      setScale((prevScale) => {
        const newScale = Math.min(Math.max(prevScale * factor, minScale), maxScale);
        if (newScale === prevScale) return prevScale;

        setPosition((prevPos) => {
          const newX = dx - (dx - prevPos.x) * (newScale / prevScale);
          const newY = dy - (dy - prevPos.y) * (newScale / prevScale);
          return { x: newX, y: newY };
        });

        return newScale;
      });
    },
    [minScale, maxScale]
  );

  // Zoom enfocado en una región específica normalizada (normX: 0..1, normY: 0..1)
  const zoomToRegion = useCallback(
    (normX: number, normY: number, targetScale: number = 2.0, regionId?: string) => {
      if (regionId) setActiveRegionId(regionId);
      const newScale = Math.min(Math.max(targetScale, minScale), maxScale);

      if (!containerRef.current) {
        setScale(newScale);
        if (newScale <= 1.05) {
          setPosition({ x: 0, y: 0 });
        }
        return;
      }

      if (newScale <= 1.05) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
        if (regionId) setActiveRegionId(regionId);
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;

      // Calcular el desplazamiento necesario para que (normX, normY) quede al centro
      const offsetX = -(normX - 0.5) * W * newScale;
      const offsetY = -(normY - 0.5) * H * newScale;

      setScale(newScale);
      setPosition({ x: offsetX, y: offsetY });
    },
    [minScale, maxScale]
  );

  // Botón Zoom In (hacia el centro o posición actual)
  const handleZoomIn = useCallback(() => {
    setActiveRegionId('custom');
    if (!containerRef.current) {
      setScale((s) => Math.min(s + 0.35, maxScale));
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    zoomToPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.3);
  }, [zoomToPoint, maxScale]);

  // Botón Zoom Out
  const handleZoomOut = useCallback(() => {
    setActiveRegionId('custom');
    if (!containerRef.current) {
      setScale((s) => Math.max(s - 0.35, minScale));
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    zoomToPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.77);
  }, [zoomToPoint, minScale]);

  // Restablecer posición y zoom
  const handleResetZoom = useCallback(() => {
    setActiveRegionId('all');
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Manejo de Rueda del Ratón (Wheel) con listener nativo para zoom focal exacto
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      zoomToPoint(e.clientX, e.clientY, factor);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [zoomToPoint]);

  // Doble click para acercar o resetear la zona clickeada
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (scale >= 2.5) {
        handleResetZoom();
      } else {
        zoomToPoint(e.clientX, e.clientY, 1.8);
      }
    },
    [scale, handleResetZoom, zoomToPoint]
  );

  // Mouse drag handlers para paneo libre e ilimitado
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startMousePos.current = { x: e.clientX, y: e.clientY };
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    const totalMoved =
      Math.abs(e.clientX - startMousePos.current.x) + Math.abs(e.clientY - startMousePos.current.y);
    if (totalMoved > 4) {
      hasMovedRef.current = true;
      setActiveRegionId('custom');
    }

    lastMousePos.current = { x: e.clientX, y: e.clientY };
    setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  // Touch handlers para móviles (un dedo para arrastrar, dos dedos para pinch-zoom)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastTouchPos.current = { x: touch.clientX, y: touch.clientY };
        startMousePos.current = { x: touch.clientX, y: touch.clientY };
        hasMovedRef.current = false;
        setIsDragging(true);
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        touchStartDist.current = dist;
        touchStartScale.current = scale;
      }
    },
    [scale]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1 && lastTouchPos.current) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastTouchPos.current.x;
        const dy = touch.clientY - lastTouchPos.current.y;

        const totalMoved =
          Math.abs(touch.clientX - startMousePos.current.x) +
          Math.abs(touch.clientY - startMousePos.current.y);
        if (totalMoved > 5) {
          hasMovedRef.current = true;
          setActiveRegionId('custom');
        }

        lastTouchPos.current = { x: touch.clientX, y: touch.clientY };
        setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      } else if (e.touches.length === 2 && touchStartDist.current) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        const factor = dist / touchStartDist.current;
        const targetScale = Math.min(Math.max(touchStartScale.current * factor, minScale), maxScale);

        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const dx = midX - centerX;
          const dy = midY - centerY;

          setActiveRegionId('custom');
          setScale((prevScale) => {
            if (prevScale === targetScale) return prevScale;
            setPosition((prevPos) => ({
              x: dx - (dx - prevPos.x) * (targetScale / prevScale),
              y: dy - (dy - prevPos.y) * (targetScale / prevScale),
            }));
            return targetScale;
          });
        }
      }
    },
    [minScale, maxScale]
  );

  const handleTouchEnd = useCallback(() => {
    lastTouchPos.current = null;
    touchStartDist.current = null;
    setIsDragging(false);
  }, []);

  return {
    scale,
    position,
    isDragging,
    hasMovedRef,
    containerRef,
    activeRegionId,
    setActiveRegionId,
    zoomToRegion,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    zoomToPoint,
    handleDoubleClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    transformStyle: {
      transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
      transformOrigin: 'center center',
      transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)',
      willChange: 'transform',
    },
  };
}
