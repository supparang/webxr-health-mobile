import { MissionDeck } from './mission.js';
export const POWERUPS = { enabled: true, basePerMin:{star:3,diamond:1,shield:2}, scale:{easy:1.2,normal:1.0,hard:0.8} };
export function dropRate(level='normal'){ const s=POWERUPS.scale[level]||1, b=POWERUPS.basePerMin;
  return { star:b.star*s, diamond:b.diamond*s, shield:b.shield*s }; }
export const QUEST_DECK = { /* …ตามที่สรุปไว้เมื่อครู่… */ };
export function drawThree(mode='goodjunk', level='normal'){ const pool = QUEST_DECK[mode]?.[level]||[];
  const copy=[...pool], out=[]; for(let i=0;i<3&&copy.length;i++){ const k=Math.floor(Math.random()*copy.length);
  out.push(copy.splice(k,1)[0]); } return out; }
