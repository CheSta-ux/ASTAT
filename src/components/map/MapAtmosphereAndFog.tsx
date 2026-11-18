import React, { useEffect, useRef } from 'react';
import type { WorldEnvironment } from '../../types/game';
import { FOG_OVERFLOW, latLngToWorldPixel } from './mapHelpers';

interface MapAtmosphereAndFogProps {
  environment?: WorldEnvironment;
  containerSize: { width: number; height: number };
  cameraWorld: { x: number; y: number };
  campScreen: { x: number; y: number };
  playerScreen: { x: number; y: number };
  exploredSectors: string[];
  liveRadarRadius: number;
  zoom: number;
}

export const MapAtmosphereAndFog: React.FC<MapAtmosphereAndFogProps> = ({
  environment,
  containerSize,
  cameraWorld,
  campScreen,
  playerScreen,
  exploredSectors,
  liveRadarRadius,
  zoom
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = containerSize.width + FOG_OVERFLOW * 2;
    const h = containerSize.height + FOG_OVERFLOW * 2;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#030704';
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-out';

    exploredSectors.forEach((key) => {
      const parts = key.split('-');
      if (parts.length >= 2) {
        const sLat = parseFloat(parts[0]);
        const sLng = parseFloat(parts[1]);
        if (!isNaN(sLat) && !isNaN(sLng)) {
          const wPos = latLngToWorldPixel(sLat, sLng, zoom);
          const sx = wPos.x - cameraWorld.x + containerSize.width / 2 + FOG_OVERFLOW;
          const sy = wPos.y - cameraWorld.y + containerSize.height / 2 + FOG_OVERFLOW;

          if (sx > -100 && sx < w + 100 && sy > -100 && sy < h + 100) {
            const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, 75);
            grad.addColorStop(0, 'rgba(0,0,0,0.7)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, 75, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    });

    const campSx = campScreen.x + FOG_OVERFLOW;
    const campSy = campScreen.y + FOG_OVERFLOW;
    const campGrad = ctx.createRadialGradient(campSx, campSy, 15, campSx, campSy, 100);
    campGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
    campGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = campGrad;
    ctx.beginPath();
    ctx.arc(campSx, campSy, 100, 0, Math.PI * 2);
    ctx.fill();

    const pSx = playerScreen.x + FOG_OVERFLOW;
    const pSy = playerScreen.y + FOG_OVERFLOW;
    const innerRadius = Math.round(liveRadarRadius * 0.28);
    const liveGrad = ctx.createRadialGradient(pSx, pSy, innerRadius, pSx, pSy, liveRadarRadius);
    liveGrad.addColorStop(0, 'rgba(0,0,0,1)');
    liveGrad.addColorStop(0.7, 'rgba(0,0,0,0.95)');
    liveGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = liveGrad;
    ctx.beginPath();
    ctx.arc(pSx, pSy, liveRadarRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
  }, [
    containerSize.width,
    containerSize.height,
    cameraWorld.x,
    cameraWorld.y,
    campScreen.x,
    campScreen.y,
    playerScreen.x,
    playerScreen.y,
    exploredSectors,
    liveRadarRadius,
    zoom
  ]);

  return (
    <>
      {environment && (
        <div className="absolute inset-0 pointer-events-none z-[5] overflow-hidden">
          {environment.dayPhase === 'night' && (
            <div className="absolute inset-0 bg-[#030b14]/45 mix-blend-multiply" />
          )}
          {(environment.dayPhase === 'dawn' || environment.dayPhase === 'dusk') && (
            <div className="absolute inset-0 bg-amber-950/20" />
          )}
          {environment.weatherCategory === 'fog' && (
            <div className="absolute inset-0 bg-slate-300/10" />
          )}
          {(environment.weatherCategory === 'rain' || environment.weatherCategory === 'storm') && (
            <div
              className="absolute inset-0 opacity-35 animate-pulse"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(108deg, transparent 0px, transparent 14px, rgba(125, 211, 252, 0.35) 15px, transparent 16px)'
              }}
            />
          )}
          {environment.weatherCategory === 'snow' && (
            <div
              className="absolute inset-0 opacity-40 animate-pulse"
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(240, 249, 255, 0.75) 1px, transparent 1.5px)',
                backgroundSize: '28px 28px'
              }}
            />
          )}
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          left: -FOG_OVERFLOW,
          top: -FOG_OVERFLOW,
          width: containerSize.width + FOG_OVERFLOW * 2,
          height: containerSize.height + FOG_OVERFLOW * 2
        }}
        className="pointer-events-none z-10 opacity-95"
      />
    </>
  );
};