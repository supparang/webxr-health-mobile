// ===== /herohealth/hub.boot.patch-quest-ux.js =====
// Quest Toast + Daily Badges (self-contained patch) — v20260219a
// ✅ Reads: HHA_DAILY_QUESTS, HHA_QUEST_REWARD_CLAIMED, HHA_QUEST_REWARD_TOTAL, HHA_ZONE_PLAY, HHA_THEME_PLAY
// ✅ Shows toast when quest newly claimed
// ✅ Renders Daily Badges panel (badgeGrid)
// ✅ Provides: window.HHA_refreshQuestUX(), window.HHA_pushToast(), window.HHA_resetQuestToastsAndBadgesToday(pid)

(function(){
  'use strict';
  const WIN = window, DOC = document;

  // ---------- tiny utils ----------
  function getLocalDayKey(){
    const d=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(2,'0');
    const dd=String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function qs(k,d=''){
    try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
    catch{ return d; }
  }
  function readJSON(key){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch{ return null; }
  }
  function writeJSON(key, obj){
    try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
  }
  function getNum(key){
    try{ return Number(localStorage.getItem(key)||'0')||0; }catch{ return 0; }
  }

  function dayPid(pid){ return `${pid||'anon'}:${getLocalDayKey()}`; }

  // ---------- keys ----------
  function kDailyQuest(pid){ return `HHA_DAILY_QUESTS:${dayPid(pid)}`; }
  function kClaimed(pid){ return `HHA_QUEST_REWARD_CLAIMED:${dayPid(pid)}`; }
  function kRewardTotal(pid){ return `HHA_QUEST_REWARD_TOTAL:${dayPid(pid)}`; }
  function kZonePlay(zone,pid){ return `HHA_ZONE_PLAY:${String(zone||'').toLowerCase()}:${dayPid(pid)}`; }
  function kThemePlay(theme,pid){ return `HHA_THEME_PLAY:${String(theme||'').toLowerCase()}:${dayPid(pid)}`; }

  // toast dedupe (separate from reward-claimed)
  function kToastShown(pid){ return `HHA_QUEST_TOAST_SHOWN:${dayPid(pid)}`; }

  // daily badges snapshot
  function kDailyBadges(pid){ return `HHA_DAILY_BADGES:${dayPid(pid)}`; }

  function getQuestProgressHub(q, pid){
    if(!q) return { value:0, target:1, done:false };
    const target = Number(q.target||1)||1;

    if(q.type==='theme-play'){
      const v = getNum(kThemePlay(q.theme, pid));
      return { value:v, target, done: v >= target };
    }
    if(q.type==='zone-play'){
      const v = getNum(kZonePlay(q.zone, pid));
      return { value:v, target, done: v >= target };
    }
    if(q.type==='all-zones'){
      const zones = ['nutrition','hygiene','exercise'];
      let c=0;
      zones.forEach(z=>{ if(getNum(kZonePlay(z,pid)) > 0) c++; });
      return { value:c, target, done: c >= target };
    }
    return { value:0, target, done:false };
  }

  // ---------- Toast UI ----------
  function ensureToastWrap(){
    let wrap = DOC.getElementById('hhToastWrap');
    if(!wrap){
      wrap = DOC.createElement('div');
      wrap.id = 'hhToastWrap';
      wrap.className = 'hh-toast-wrap';
      wrap.setAttribute('aria-live','polite');
      wrap.setAttribute('aria-atomic','false');
      DOC.body.appendChild(wrap);
    }
    return wrap;
  }

  function pushToast({title='', msg='', type='ok', icon='🏅', timeout=2600}){
    const wrap = ensureToastWrap();

    const el = DOC.createElement('div');
    el.className = `hh-toast ${type||'ok'}`;
    el.innerHTML = `
      <div class="icon">${icon}</div>
      <div class="txt">
        <div class="t">${title}</div>
        <div class="m">${msg}</div>
      </div>
      <button class="x" type="button">ปิด</button>
    `;
    wrap.appendChild(el);

    const close = ()=>{
      el.classList.remove('show');
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 180);
    };

    el.querySelector('.x')?.addEventListener('click', close);

    requestAnimationFrame(()=> el.classList.add('show'));
    setTimeout(close, Math.max(1000, Number(timeout)||2600));
  }

  WIN.HHA_pushToast = pushToast;

  // ---------- Badge engine ----------
  const BADGE_DEFS = [
    {
      id:'badge-theme-hunter',
      icon:'🎯',
      name:'Theme Hunter',
      desc:'สำเร็จ Theme Quest ของวันนี้',
      check: ({quests, claimed}) => {
        const q = (quests||[]).find(x=>x && x.type==='theme-play');
        return !!(q && claimed && claimed[q.id]);
      }
    },
    {
      id:'badge-zone-ranger',
      icon:'🧭',
      name:'Zone Ranger',
      desc:'สำเร็จ Zone Quest ของวันนี้',
      check: ({quests, claimed}) => {
        const q = (quests||[]).find(x=>x && x.type==='zone-play');
        return !!(q && claimed && claimed[q.id]);
      }
    },
    {
      id:'badge-3zone-hero',
      icon:'🔥',
      name:'3-Zone Hero',
      desc:'เล่นครบ Nutrition + Hygiene + Exercise ในวันเดียว',
      check: ({quests, claimed, zoneCount}) => {
        const q = (quests||[]).find(x=>x && x.type==='all-zones');
        return !!((q && claimed && claimed[q.id]) || (zoneCount >= 3));
      }
    },
  ];

  function computeDailyBadges(pid){
    const qData = readJSON(kDailyQuest(pid)) || {};
    const quests = Array.isArray(qData.quests) ? qData.quests : [];
    const claimed = readJSON(kClaimed(pid)) || {};
    const rewardTotal = getNum(kRewardTotal(pid));

    const zoneCount =
      (getNum(kZonePlay('nutrition',pid))>0 ? 1:0) +
      (getNum(kZonePlay('hygiene',pid))>0 ? 1:0) +
      (getNum(kZonePlay('exercise',pid))>0 ? 1:0);

    const ctx = { quests, claimed, rewardTotal, zoneCount };
    const out = {
      day: getLocalDayKey(),
      pid: pid || 'anon',
      rewardTotal,
      zoneCount,
      items: BADGE_DEFS.map(b=>{
        let unlocked = false;
        try{ unlocked = !!b.check(ctx); }catch{}
        return {
          id: b.id,
          icon: b.icon,
          name: b.name,
          desc: b.desc,
          unlocked
        };
      })
    };

    writeJSON(kDailyBadges(pid), out);
    return out;
  }

  function renderDailyBadges(){
    const pid = qs('pid','anon');
    const grid = DOC.getElementById('badgeGrid');
    const meta = DOC.getElementById('badgeMeta');
    if(!grid) return;

    const data = computeDailyBadges(pid);

    const unlockedCount = (data.items||[]).filter(x=>x.unlocked).length;
    if(meta){
      meta.textContent = `ปลดแล้ว ${unlockedCount}/${(data.items||[]).length} • Reward +${Number(data.rewardTotal||0)}%`;
    }

    grid.innerHTML = (data.items||[]).map(b=>`
      <div class="badgecard ${b.unlocked ? 'ok' : 'locked'}">
        <div class="badgeicon">${b.icon}</div>
        <div class="badgetxt">
          <div class="name">${b.name}</div>
          <div class="meta">${b.desc}</div>
          <div class="badgepill ${b.unlocked ? 'ok' : 'lock'}">
            ${b.unlocked ? 'UNLOCKED' : 'LOCKED'}
          </div>
        </div>
      </div>
    `).join('');
  }

  WIN.HHA_renderDailyBadges = renderDailyBadges;

  // ---------- Quest complete toast watcher ----------
  function watchQuestToasts(){
    const pid = qs('pid','anon');
    const qData = readJSON(kDailyQuest(pid));
    const claimed = readJSON(kClaimed(pid)) || {};
    if(!qData || !Array.isArray(qData.quests)) return;

    const shown = readJSON(kToastShown(pid)) || {}; // { questId:true, rewardTotal:N }

    // quest-level toasts
    qData.quests.forEach(q=>{
      if(!q || !q.id || !claimed[q.id] || shown[q.id]) return;

      const prog = getQuestProgressHub(q, pid);
      if(!prog.done) return;

      let icon = '🏅', title = 'Quest Complete!', msg = 'สำเร็จเควสต์วันนี้';
      if(q.type==='theme-play'){
        icon = '🎯';
        title = 'Theme Quest Complete!';
        msg = `${q.title || 'Theme quest'} • โบนัส warmup พร้อมใช้งาน`;
      }else if(q.type==='zone-play'){
        icon = '🧭';
        title = 'Zone Quest Complete!';
        msg = `${q.title || 'Zone quest'} • ได้โบนัสเพิ่มใน warmup`;
      }else if(q.type==='all-zones'){
        icon = '🔥';
        title = '3-Zone Complete!';
        msg = `ครบ 3 โซนแล้ววันนี้ • เก่งมาก!`;
      }

      pushToast({ title, msg, icon, type:'ok', timeout: 3200 });
      shown[q.id] = true;
    });

    // summary toast when reward total increased (per unique total)
    const rewardTotal = getNum(kRewardTotal(pid));
    const rewardKey = `rewardTotal:${rewardTotal}`;
    if(rewardTotal > 0 && !shown[rewardKey]){
      pushToast({
        title: 'Quest Reward Updated',
        msg: `โบนัส warmup สะสมวันนี้: +${rewardTotal}%`,
        icon: '⚡',
        type:'ok',
        timeout: 2400
      });
      shown[rewardKey] = true;
    }

    writeJSON(kToastShown(pid), shown);
  }

  WIN.HHA_watchQuestToasts = watchQuestToasts;

  // ---------- Reset helpers (today only) ----------
  function resetQuestToastsAndBadgesToday(pid){
    try{ localStorage.removeItem(kToastShown(pid)); }catch{}
    try{ localStorage.removeItem(kDailyBadges(pid)); }catch{}
  }
  WIN.HHA_resetQuestToastsAndBadgesToday = resetQuestToastsAndBadgesToday;

  // ---------- Boot hooks ----------
  function refreshAll(){
    try{ renderDailyBadges(); }catch{}
    try{ watchQuestToasts(); }catch{}
  }

  WIN.HHA_refreshQuestUX = refreshAll;

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', refreshAll, { once:true });
  }else{
    refreshAll();
  }
})();