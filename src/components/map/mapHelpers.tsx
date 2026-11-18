import React from 'react';
import {
  MapPin,
  Tent,
  Building2,
  Factory,
  Route,
  Waves,
  Anchor,
  Compass,
  Ship,
  TreePine,
  Wheat,
  Zap,
  Mountain
} from 'lucide-react';
import type { SectorDefinition } from '../../types/game';

export interface TargetSelection {
  lat: number;
  lng: number;
  data: SectorDefinition;
  dist: number;
  isFog?: boolean;
}

export const FOG_OVERFLOW = 48;

export const SectorTacticalIcon: React.FC<{ icon: string; className?: string }> = ({
  icon,
  className = 'w-5 h-5'
}) => {
  switch (icon) {
    case 'camp':
      return <Tent className={`${className} text-emerald-400`} />;
    case 'building':
      return <Building2 className={`${className} text-slate-300`} />;
    case 'factory':
      return <Factory className={`${className} text-amber-400`} />;
    case 'highway':
      return <Route className={`${className} text-slate-400`} />;
    case 'waves':
      return <Waves className={`${className} text-cyan-400`} />;
    case 'anchor':
      return <Anchor className={`${className} text-teal-400`} />;
    case 'shallows':
      return <Compass className={`${className} text-teal-300`} />;
    case 'pier':
      return <Ship className={`${className} text-teal-400`} />;
    case 'forest':
      return <TreePine className={`${className} text-emerald-400`} />;
    case 'field':
      return <Wheat className={`${className} text-yellow-400`} />;
    case 'anomaly':
      return <Zap className={`${className} text-rose-400 animate-pulse`} />;
    case 'mountain':
      return <Mountain className={`${className} text-stone-300`} />;
    default:
      return <MapPin className={`${className} text-slate-400`} />;
  }
};

export const latLngToWorldPixel = (lat: number, lng: number, zoom: number) => {
  const n = 256 * Math.pow(2, zoom);
  const x = ((lng + 180.0) / 360.0) * n;
  const latRad = (lat * Math.PI) / 180.0;
  const y = ((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0) * n;
  return { x, y };
};

export const worldPixelToLatLng = (x: number, y: number, zoom: number) => {
  const n = 256 * Math.pow(2, zoom);
  const lng = (x / n) * 360.0 - 180.0;
  const latRad = Math.atan(Math.sinh(Math.PI * (1.0 - (2.0 * y) / n)));
  const lat = (latRad * 180.0) / Math.PI;
  return { lat, lng };
};

export const formatTravelDuration = (totalSeconds: number): string => {
  if (totalSeconds < 60) return `${totalSeconds} с`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins} хв ${secs} с`;
};