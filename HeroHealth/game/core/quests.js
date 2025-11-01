// === core/quests.js ===
// เควสต์เบื้องต้น: sync HUD chips + อัปเดตจาก event('hit'|'miss')
const DEFAULT = [
  { key:'score1k', icon:'🏁', label:'ถึง 1,000 คะแนน', need:1000, progress:0, done:false },
  { key:'perfect3', icon:'💥', label:'PERFECT x3', need:3, progress:0, done:false },
  { key:'streak10', icon:'🔥', label:'คอมโบ x10', need:10, progress:0, done:false },
];

let ctx = { hud:null, coach:null, chips:[], lang:'TH' };

export const Quests = {
  bindToMain({ hud, coach, lang='TH' } = {}){
    ctx.hud = hud || null; ctx.coach = coach || null; ctx.lang = String(lang).toUpperCase();
    ctx.chips = DEFAULT.map(x=>({ ...x }));
    ctx.hud?.setQuestChips?.(ctx.chips);
    return { refresh(){ ctx.hud?.setQuestChips?.(ctx.chips); } };
  },
  beginRun(mode, diff, lang='TH', timeSec=45){
    ctx.lang = String(lang).toUpperCase();
    ctx.chips = DEFAULT.map(x=>({ ...x, progress:0, done:false, fail:false }));
    ctx.hud?.setQuestChips?.(ctx.chips);
  },
  event(type, payload = {}){
    if (!ctx.hud) return;
    if (type === 'hit'){
      const pts = payload.points|0;
      if (pts) { inc('score1k', pts); }
      const kind = payload.result || 'good';
      if (kind === 'perfect') inc('perfect3', 1);
      const comboNow = payload.comboNow|0;
      if (comboNow >= 10) markDone('streak10');
      ctx.hud.setQuestChips(ctx.chips);
    }
    if (type === 'miss'){
      // อาจจะ reset บางเควสต์ถ้าต้องการ (ตอนนี้ไม่รีเซ็ต)
      ctx.hud.setQuestChips(ctx.chips);
    }
  },
  tick(){ /* อนาคตใช้สำหรับนับเวลาเควสต์ */ },
  endRun(){ return ctx.chips.slice(); }
};

function inc(key, by){
  const c = ctx.chips.find(x=>x.key===key);
  if (!c) return;
  c.progress = Math.max(0, (c.progress|0) + (by|0));
  if ((c.progress|0) >= (c.need|0)) c.done = true;
}
function markDone(key){
  const c = ctx.chips.find(x=>x.key===key);
  if (!c) return;
  c.done = true; c.progress = c.need;
}

export default Quests;
