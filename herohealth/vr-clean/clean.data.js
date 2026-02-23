// === /herohealth/vr-clean/clean.data.js ===
// Clean Objects — Home Grid Map (MVP) — v20260223
'use strict';

export const MAP = {
  id: 'home',
  title: 'Home',
  w: 12,
  h: 8,
  // grid units are abstract; UI can map to pixels
};

// Zones are rectangles in grid coordinates (x,y,w,h)
export const ZONES = [
  { id:'entry',   name:'Entry',   x:0,  y:0, w:3,  h:2 },
  { id:'living',  name:'Living',  x:3,  y:0, w:5,  h:4 },
  { id:'kitchen', name:'Kitchen', x:8,  y:0, w:4,  h:3 },
  { id:'bath',    name:'Bath',    x:8,  y:3, w:4,  h:3 },
  { id:'bed',     name:'Bed',     x:0,  y:2, w:3,  h:6 },
  { id:'hall',    name:'Hall',    x:3,  y:4, w:5,  h:4 },
];

// Touch level normalized: low=0.3, med=0.6, high=1.0
// Traffic normalized: low=0.3, med=0.6, high=1.0
// timeLastCleanedMin: minutes since last cleaned
export const HOTSPOTS = [
  {
    id:'door_knob',
    name:'Door knob',
    zone:'entry',
    x:2, y:1,
    risk: 78,
    traffic: 1.0,
    surfaceType: 'metal',
    touchLevel: 1.0,
    timeLastCleanedMin: 720, // 12h
    tags: ['touchHigh','shared']
  },
  {
    id:'light_switch',
    name:'Light switch',
    zone:'living',
    x:4, y:1,
    risk: 62,
    traffic: 0.8,
    surfaceType: 'plastic',
    touchLevel: 1.0,
    timeLastCleanedMin: 1440, // 24h
    tags: ['touchHigh']
  },
  {
    id:'dining_table',
    name:'Dining table',
    zone:'living',
    x:6, y:2,
    risk: 55,
    traffic: 0.6,
    surfaceType: 'wood',
    touchLevel: 0.6,
    timeLastCleanedMin: 480,
    tags: ['shared']
  },
  {
    id:'tv_remote',
    name:'TV remote',
    zone:'living',
    x:7, y:1,
    risk: 70,
    traffic: 0.7,
    surfaceType: 'plastic',
    touchLevel: 1.0,
    timeLastCleanedMin: 2880, // 2 days
    tags: ['touchHigh','shared']
  },
  {
    id:'faucet',
    name:'Faucet',
    zone:'bath',
    x:9, y:4,
    risk: 66,
    traffic: 0.8,
    surfaceType: 'metal',
    touchLevel: 1.0,
    timeLastCleanedMin: 960, // 16h
    tags: ['touchHigh','wet']
  },
  {
    id:'fridge_handle',
    name:'Fridge handle',
    zone:'kitchen',
    x:10, y:1,
    risk: 74,
    traffic: 1.0,
    surfaceType: 'metal',
    touchLevel: 1.0,
    timeLastCleanedMin: 1440,
    tags: ['touchHigh','shared']
  },
  {
    id:'toilet_flush',
    name:'Toilet flush / handle',
    zone:'bath',
    x:11, y:5,
    risk: 82,
    traffic: 0.7,
    surfaceType: 'plastic',
    touchLevel: 1.0,
    timeLastCleanedMin: 2880,
    tags: ['touchHigh','wet']
  },
  {
    id:'phone_tablet',
    name:'Phone / tablet',
    zone:'bed',
    x:1, y:4,
    risk: 68,
    traffic: 0.6,
    surfaceType: 'glass',
    touchLevel: 1.0,
    timeLastCleanedMin: 2160,
    tags: ['touchHigh','shared']
  },
  {
    id:'entry_floor',
    name:'Entry floor spot',
    zone:'entry',
    x:1, y:0,
    risk: 58,
    traffic: 1.0,
    surfaceType: 'tile',
    touchLevel: 0.3,
    timeLastCleanedMin: 720,
    tags: ['trafficHigh']
  },
  {
    id:'shared_toys',
    name:'Shared items (toys)',
    zone:'hall',
    x:5, y:6,
    risk: 72,
    traffic: 0.7,
    surfaceType: 'plastic',
    touchLevel: 1.0,
    timeLastCleanedMin: 4320, // 3 days
    tags: ['touchHigh','shared']
  },
];

// Surface cleaning efficiency (fraction risk reduced)
// MVP: higher for metal/plastic/glass, lower for wood/tile
export const SURFACE_EFF = {
  metal: 0.75,
  plastic: 0.65,
  glass: 0.70,
  wood: 0.55,
  tile: 0.50,
  fabric: 0.40,
};

export function zoneIds(){
  return Array.from(new Set(ZONES.map(z=>z.id)));
}

export function surfaceTypes(){
  return Array.from(new Set(HOTSPOTS.map(h=>h.surfaceType)));
}

export function getHotspot(id){
  return HOTSPOTS.find(h=>h.id===id) || null;
}

export function clamp(v,min,max){
  v = Number(v);
  if(!Number.isFinite(v)) v = min;
  return Math.max(min, Math.min(max, v));
}

export function norm01(v, min, max){
  if(max <= min) return 0;
  return clamp((v - min) / (max - min), 0, 1);
}