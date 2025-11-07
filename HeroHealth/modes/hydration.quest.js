// === modes/hydration.quest.js — production shim (ensures named export) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

// พูลพื้นฐาน: เครื่องดื่มดี/เสี่ยง
const GOOD_DRINKS = ['💧','🥛','🫖','🍵','🧃']; // น้ำ/นม/ชา ฯลฯ
const RISK_DRINKS = ['🥤','🧋','🍹','🍺','🍷','🍻','🍾']; // น้ำหวาน/แอลกอฮอล์

const INTERNAL =
  (typeof start === 'function' && start) ||
  (typeof run   === 'function' && run)   ||
  (typeof init  === 'function' && init)  || null;

export async function boot(config = {}) {
  console.log('[hydration] boot mode', config);

  if (INTERNAL) return await INTERNAL(config);

  // judge เบื้องต้น: ของดี +10, ของเสี่ยง -7 (สมดุลจะไปจัดลึกในเวอร์ชันเต็ม)
  const judge = (char, ctx) => {
    if (ctx?.type === 'timeout') return { good: false, scoreDelta: -2 };
    if (GOOD_DRINKS.includes(char)) return { good: true, scoreDelta: 10, feverDelta: 1 };
    if (RISK_DRINKS.includes(char)) return { good: false, scoreDelta: -7 };
    return { good: false, scoreDelta: -2 };
  };

  return await factoryBoot({
    name: 'hydration',
    pools: { good: GOOD_DRINKS, bad: RISK_DRINKS },
    judge,
    ui: { questMainSel: '#tQmain' },
    goldenRate: 0.04,
    goodRate: 0.75,
    ...config
  });
}

export default { boot };