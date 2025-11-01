// === core/quests.js ===
// จัดการ mini quest แบบ "ทีละภารกิจ" (queue), อัปเดตชิป HUD และเรียก coach

const QUEST_POOL = [
  { key:'veg',    icon:'🥦', labelTH:'เก็บผัก', labelEN:'Collect veggies', needByDiff:{Easy:6, Normal:8, Hard:10}, filter:{kind:'good', tag:'veggies'} },
  { key:'fruit',  icon:'🍎', labelTH:'เก็บผลไม้', labelEN:'Collect fruits', needByDiff:{Easy:6, Normal:8, Hard:10}, filter:{kind:'good', tag:'fruits'} },
  { key:'avoid',  icon:'🚫', labelTH:'หลบของไม่ดี', labelEN:'Avoid junk', needByDiff:{Easy:6, Normal:8, Hard:10}, filter:{kind:'bad', avoid:true} },
  { key:'perfect',icon:'💯', labelTH:'ทำ Perfect', labelEN:'Get Perfects', needByDiff:{Easy:3, Normal:5, Hard:7},   filter:{result:'perfect'} },
  { key:'combo',  icon:'🔥', labelTH:'ทำคอมโบ', labelEN:'Reach combo', needByDiff:{Easy:8, Normal:12, Hard:16},    filter:{comboReach:true} },
  { key:'shield', icon:'🛡️', labelTH:'รับโล่',  labelEN:'Pick shields', needByDiff:{Easy:1, Normal:2, Hard:3},     filter:{power:'shield'} },
  { key:'star',   icon:'⭐', labelTH:'เก็บดาว', labelEN:'Pick stars',   needByDiff:{Easy:1, Normal:2, Hard:3},     filter:{power:'star'} },
  { key:'fever',  icon:'⚡', labelTH:'เปิดโหมดไฟลุก', labelEN:'Trigger fever', needByDiff:{Easy:1, Normal:1, Hard:1}, filter:{fever:true} },
  { key:'score',  icon:'🏆', labelTH:'ทำคะแนน', labelEN:'Score target', needByDiff:{Easy:120, Normal:200, Hard:280}, filter:{score:true} },
  { key:'streak', icon:'🔗', labelTH:'สตรีคไม่พลาด', labelEN:'No-miss streak', needByDiff:{Easy:6, Normal:10, Hard:14}, filter:{noMiss:true} }
];

function pickN(arr, n){
  const a = arr.slice(); const out=[];
  while (a.length && out.length < n) {
    out.push(a.splice((Math.random()*a.length)|0,1)[0]);
  }
  return out;
}

export const Quests = (function(){
  let hud=null, coach=null, current=null, queue=[], diff='Normal', lang='TH', stats=null;

  function bindToMain(ctx){
    hud = ctx.hud; coach = ctx.coach;
    window.__HHA_HUD_API = hud; // ให้ coach เรียก say ได้
    return { refresh(){ render(); } };
  }

  function beginRun(modeKey, diffStr, langStr, time){
    diff = diffStr||'Normal';
    lang = (langStr||'TH').toUpperCase();
    queue = buildQueue(10);
    current = queue.shift();
    stats = { score:0, noMiss:true };
    render();
    coach?.onQuestStart(labelFor(current));
  }

  function buildQueue(n){
    const base = pickN(QUEST_POOL, n);
    for (const q of base){
      q.progress = 0;
      q.need = (q.needByDiff?.[diff] ?? q.needByDiff?.Normal ?? 8)|0;
      q.done = false; q.fail = false;
    }
    return base;
  }

  function labelFor(q){
    return lang==='EN' ? (q.labelEN || q.key) : (q.labelTH || q.key);
  }

  function event(kind, payload){
    // kind: 'hit'
    if (!current) return;
    if (kind === 'hit') {
      if (payload?.result === 'perfect' && current.filter?.result === 'perfect') inc();
      if (payload?.meta?.tag === current.filter?.tag && current.filter?.kind === 'good') inc();
      if (current.filter?.avoid && payload?.result === 'bad') { /* ignore */ }
      if (payload?.power === 'shield' && current.filter?.power === 'shield') inc();
      if (payload?.power === 'star'   && current.filter?.power === 'star')   inc();
      // combo reach
      if (current.filter?.comboReach && (payload?.comboNow|0) >= current.need) current.progress = current.need;
      // fever trigger handled by tick/update via score.tryActivate
    }
    render();
    if (current.progress >= current.need) complete();
  }

  function inc(){ current.progress = Math.min(current.need, (current.progress|0)+1); }

  function tick({ score }){
    stats.score = score|0;
    render();
    if (!current) return;
    if (current.filter?.score && stats.score >= current.need) { current.progress = current.need; complete(); }
  }

  function complete(){
    current.done = true;
    coach?.onQuestDone?.();
    next();
  }

  function next(){
    current = queue.shift() || null;
    render();
    if (current) coach?.onQuestStart(labelFor(current));
  }

  function endRun(){ const out=[current, ...queue].filter(Boolean); return out; }

  function render(){
    const chips=[];
    if (current) {
      chips.push({
        key: current.key, icon: current.icon,
        label: labelFor(current),
        progress: current.progress|0, need: current.need|0,
        done: current.done||false, fail: current.fail||false
      });
    }
    hud?.setQuestChips?.(chips);
  }

  return { bindToMain, beginRun, event, tick, endRun };
})();
