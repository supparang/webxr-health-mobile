// === /herohealth/vr-clean/clean.data.js ===
// Clean Objects DATA — HOME GRID (10 hotspots) — v20260228-FULL
// Map: 10 (w) x 8 (h)
// Zones: kitchen / bathroom / living / bedroom
//
// Fields:
//  id, label, name, zone, x, y,
//  risk (0..100), traffic (0..1), touchLevel (0..1),
//  surfaceType (metal/plastic/glass/wood/tile/fabric),
//  timeLastCleanedMin (minutes since last cleaned)

'use strict';

export const MAP = {
  w: 10,
  h: 8,
  title: 'Home Grid'
};

// optional, if you want zone meta later
export const ZONES = {
  kitchen: { label: 'ครัว' },
  bathroom:{ label: 'ห้องน้ำ' },
  living:  { label: 'ห้องนั่งเล่น' },
  bedroom: { label: 'ห้องนอน' }
};

export const HOTSPOTS = [
  // --- KITCHEN (ซ้ายบน) ---
  {
    id: 'door_knob',
    label: 'D',
    name: 'มือจับประตูทางเข้า',
    zone: 'living',
    x: 1, y: 1,
    risk: 82,
    traffic: 0.95,
    touchLevel: 0.95,
    surfaceType: 'metal',
    timeLastCleanedMin: 18*60
  },
  {
    id: 'light_switch',
    label: 'L',
    name: 'สวิตช์ไฟ (โถง/ทางเข้า)',
    zone: 'living',
    x: 2, y: 2,
    risk: 76,
    traffic: 0.85,
    touchLevel: 0.92,
    surfaceType: 'plastic',
    timeLastCleanedMin: 22*60
  },
  {
    id: 'kitchen_counter',
    label: 'K',
    name: 'เคาน์เตอร์ครัว (เตรียมอาหาร)',
    zone: 'kitchen',
    x: 3, y: 1,
    risk: 68,
    traffic: 0.70,
    touchLevel: 0.80,
    surfaceType: 'tile',
    timeLastCleanedMin: 10*60
  },
  {
    id: 'fridge_handle',
    label: 'F',
    name: 'มือจับตู้เย็น',
    zone: 'kitchen',
    x: 4, y: 2,
    risk: 74,
    traffic: 0.65,
    touchLevel: 0.88,
    surfaceType: 'metal',
    timeLastCleanedMin: 16*60
  },

  // --- BATHROOM (ซ้ายล่าง) ---
  {
    id: 'tap_faucet',
    label: 'T',
    name: 'ก๊อกน้ำ',
    zone: 'bathroom',
    x: 2, y: 6,
    risk: 80,
    traffic: 0.75,
    touchLevel: 0.90,
    surfaceType: 'metal',
    timeLastCleanedMin: 14*60
  },
  {
    id: 'toilet_flush',
    label: 'W',
    name: 'ปุ่มกดชักโครก',
    zone: 'bathroom',
    x: 3, y: 7,
    risk: 86,
    traffic: 0.70,
    touchLevel: 0.95,
    surfaceType: 'plastic',
    timeLastCleanedMin: 26*60
  },

  // --- LIVING (กลางขวา) ---
  {
    id: 'remote_control',
    label: 'R',
    name: 'รีโมททีวี',
    zone: 'living',
    x: 7, y: 3,
    risk: 72,
    traffic: 0.55,
    touchLevel: 0.90,
    surfaceType: 'plastic',
    timeLastCleanedMin: 30*60
  },
  {
    id: 'table_surface',
    label: 'B',
    name: 'โต๊ะกินข้าว/โต๊ะกลาง',
    zone: 'living',
    x: 6, y: 4,
    risk: 60,
    traffic: 0.60,
    touchLevel: 0.65,
    surfaceType: 'wood',
    timeLastCleanedMin: 12*60
  },

  // --- BEDROOM (ขวาล่าง) ---
  {
    id: 'phone_screen',
    label: 'P',
    name: 'หน้าจอโทรศัพท์',
    zone: 'bedroom',
    x: 8, y: 6,
    risk: 78,
    traffic: 0.40,
    touchLevel: 0.98,
    surfaceType: 'glass',
    timeLastCleanedMin: 36*60
  },
  {
    id: 'pillow_case',
    label: 'S',
    name: 'ปลอกหมอน',
    zone: 'bedroom',
    x: 7, y: 7,
    risk: 58,
    traffic: 0.35,
    touchLevel: 0.50,
    surfaceType: 'fabric',
    timeLastCleanedMin: 3*24*60
  }
];