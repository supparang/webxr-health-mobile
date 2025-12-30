// === /herohealth/hub.safe.js ===
// HeroHealth HUB — PRODUCTION ++ HISTORY + CSV + Path-Fixed (PATCHED)
// ✅ อ่าน localStorage: HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY
// ✅ ตาราง 4 เกมล่าสุด + Action (Play + Copy JSON)
// ✅ Export CSV (last / recent4)
// ✅ Launch 4 games + ส่งพารามิเตอร์ (hub, run, diff, time, seed + passthrough research ctx)
// ✅ UX: แตะ 1 ครั้ง = Copy, แตะ 2 ครั้ง = Play (ทั้งปุ่มเกมและแถว history)
// ✅ PATCH: guard กัน bind ซ้ำ + seed sanitize + กัน event ซ้ำเวลารัน render ใหม่

'use strict';

if (window.__HHA_HUB_BOUND__) {
  // กัน bind ซ้ำกรณีโหลดสคริปต์ซ้ำด้วย query v=
  console.warn('[HHA HUB] already bound');
} else {
  window.__HHA_HUB_BOUND__ = true;

  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  const $ = (id)=>document.getElementById(id);

  function clamp(v,min,max){
    v = Number(v);
    if(!isFinite(v)) v = min;
    return v<min?min : (v>max?max:v);
  }

  function loadJson(key, fallback){
    try{
      const s = localStorage.getItem(key);
      if(!s) return fallback;
      return JSON.parse(s);
    }catch(e){ return fallback; }
  }
  function saveJson(key, obj){
    try{ localStorage.setItem(key, JSON.stringify(obj)); }catch(e){}
  }

  function nowLocalText(){
    try{
      const d = new Date();
      return d.toLocaleString('th-TH', { hour12:false });
    }catch(e){
      return new Date().toISOString();
    }
  }

  function toast(msg){
    try{
      let el = document.querySelector('.hha-toast');
      if(!el){
        el = document.createElement('div');
        el.className = 'hha-toast';
        el.style.cssText = `
          position:fixed; left:50%; bottom:calc(86px + env(safe-area-inset-bottom,0px));
          transform:translateX(-50%);
          background:rgba(2,6,23,.85);
          color:rgba(229,231,235,.95);
          border:1px solid rgba(148,163,184,.18);
          padding:10px 12px;
          border-radius:999px;
          font: 900 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", sans-serif;
          box-shadow:0 22px 70px rgba(0,0,0,.45);
          z-index:9999;
          opacity:0;
          transition: opacity .16s ease, transform .16s ease;
          pointer-events:none;
          white-space:nowrap;
        `;
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(-2px)';
      clearTimeout(toast._t);
      toast._t = setTimeout(()=>{
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50%) translateY(0px)';
      }, 900);
    }catch(e){}
  }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(String(text));
      toast('คัดลอกแล้ว ✅');
      return true;
    }catch(e){
      try{
        const ta = document.createElement('textarea');
        ta.value = String(text);
        ta.style.position='fixed';
        ta.style.left='-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        toast('คัดลอกแล้ว ✅');
        return true;
      }catch(err){
        toast('คัดลอกไม่สำเร็จ');
        return false;
      }
    }
  }

  function pulse(el, kind){
    if(!el) return;
    const good = 'pulseGood', warn='pulseWarn', bad='pulseBad';
    el.classList.remove(good,warn,bad);
    void el.offsetWidth;
    el.classList.add(kind === 'good' ? good : (kind === 'warn' ? warn : bad));
    clearTimeout(pulse._t);
    pulse._t = setTimeout(()=>el.classList.remove(good,warn,bad), 520);
  }

  // ---------- CSV ----------
  function toCsv(rows){
    if(!rows || !rows.length) return '';
    const keys = new Set();
    rows.forEach(r=>{
      if(r && typeof r === 'object'){
        Object.keys(r).forEach(k=>keys.add(k));
      }
    });
    const headers = Array.from(keys);

    function esc(v){
      if(v == null) return '';
      if(typeof v === 'object') v = JSON.stringify(v);
      v = String(v);
      if(/[",\n]/.test(v)) v = `"${v.replace(/"/g,'""')}"`;
      return v;
    }

    const lines = [];
    lines.push(headers.map(esc).join(','));
    for(const r of rows){
      const line = headers.map(k=>esc(r ? r[k] : '')).join(',');
      lines.push(line);
    }
    return lines.join('\n');
  }

  function downloadText(filename, content){
    try{
      const blob = new Blob([content], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
    }catch(e){
      try{
        const u = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
        window.open(u, '_blank');
      }catch(err){}
    }
  }

  // ---------- Path mapping (✅ FIX HERE) ----------
  const GAME_PATHS = {
    goodjunk: './goodjunk-vr.html',
    hydration: './hydration-vr.html',
    plate: './plate-vr.html',              // ✅ ตัวจริงอยู่ root
    groups: './vr-groups/groups-vr.html'
  };

  // passthrough research context keys
  const PASS_KEYS = [
    'studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode','schoolYear','semester',
    'studentKey','schoolCode','schoolName','classRoom','studentNo','nickName','gender','age','gradeLevel',
    'heightCm','weightKg','bmi','bmiGroup','vrExperience','gameFrequency','handedness','visionIssue',
    'healthDetail','consentParent'
  ];

  function buildHubUrl(){
    try{
      const u = new URL(location.href);
      u.hash = '';
      return u.toString();
    }catch(e){
      return location.href;
    }
  }

  function buildGameUrl(gameKey, opts){
    const base = GAME_PATHS[gameKey] || './hub.html';
    const hubUrl = buildHubUrl();

    const u = new URL(base, location.href);

    // required: hub back link
    u.searchParams.set('hub', hubUrl);

    // core game params
    if(opts.run)  u.searchParams.set('run', String(opts.run));
    if(opts.diff) u.searchParams.set('diff', String(opts.diff));
    if(opts.time != null) u.searchParams.set('time', String(opts.time));

    // seed (sanitize)
    if(opts.seed != null && String(opts.seed).trim() !== '' && isFinite(Number(opts.seed))){
      u.searchParams.set('seed', String(Number(opts.seed)));
    }else{
      u.searchParams.delete('seed');
    }

    // passthrough ctx from hub URL
    try{
      const hubU = new URL(location.href);
      PASS_KEYS.forEach(k=>{
        const v = hubU.searchParams.get(k);
        if(v != null && v !== '') u.searchParams.set(k, v);
      });
    }catch(e){}

    return u.toString();
  }

  // ---------- UI wiring ----------
  let selectedGame = null;

  // tap system: single = copy, double = play
  function bindTapCopyPlay(targetEl, getUrlFn, playFn){
    if(!targetEl) return;
    if(targetEl.__tapBound) return; // ✅ PATCH: กัน bind ซ้ำต่อ element เดิม
    targetEl.__tapBound = true;

    let lastTap = 0;

    targetEl.addEventListener('click', async ()=>{
      const t = Date.now();
      const dt = t - lastTap;
      lastTap = t;

      // double tap
      if(dt > 0 && dt < 420){
        const url = getUrlFn();
        pulse(targetEl, 'warn');
        playFn(url);
        return;
      }

      // single tap => copy link
      const url = getUrlFn();
      pulse(targetEl, 'good');
      await copyText(url);
    }, { passive:true });
  }

  function renderNow(){
    const el = $('nowText');
    if(!el) return;
    el.textContent = nowLocalText();
    setInterval(()=>{ el.textContent = nowLocalText(); }, 1000);
  }

  function gradeToClass(g){
    g = String(g||'').toUpperCase();
    if(g === 'SSS' || g === 'SS' || g === 'S' || g === 'A') return 'good';
    if(g === 'B') return 'warn';
    return 'bad';
  }

  function setBadge(el, txt, cls){
    if(!el) return;
    el.textContent = txt;
    el.classList.remove('good','warn','bad');
    if(cls) el.classList.add(cls);
  }

  function normalizeGameName(game){
    const g = String(game||'').toLowerCase();
    if(g.includes('goodjunk')) return 'goodjunk';
    if(g.includes('hydration')) return 'hydration';
    if(g.includes('plate')) return 'plate';
    if(g.includes('groups')) return 'groups';
    return g || 'unknown';
  }

  function prettyGame(gameKey){
    switch(gameKey){
      case 'goodjunk': return '🥦 GoodJunk';
      case 'hydration': return '💧 Hydration';
      case 'plate': return '🍽️ Plate';
      case 'groups': return '🍎 Groups';
      default: return String(gameKey||'—');
    }
  }

  function playUrl(url){
    try{ location.href = url; }catch(e){ location.assign(url); }
  }

  function readControls(){
    const run  = ($('selRun')?.value || 'play').toLowerCase();
    const diff = ($('selDiff')?.value || 'normal').toLowerCase();
    const time = clamp($('inpTime')?.value || 70, 20, 9999);

    const seedRaw = $('inpSeed')?.value;
    let seed = null;
    if(seedRaw != null && String(seedRaw).trim() !== ''){
      const n = Number(seedRaw);
      seed = isFinite(n) ? n : null; // ✅ PATCH
    }
    return { run, diff, time, seed };
  }

  function applyPreset(){
    const run = ($('selRun')?.value || 'play').toLowerCase();
    const diff = ($('selDiff')?.value || 'normal').toLowerCase();
    const inpTime = $('inpTime');
    if(!inpTime) return;

    let t = 70;
    if(run === 'play'){
      if(diff === 'easy') t = 70;
      if(diff === 'normal') t = 70;
      if(diff === 'hard') t = 80;
    }else{
      t = 70;
    }
    inpTime.value = String(t);
    toast('ตั้งเวลาอัตโนมัติแล้ว ⚙️');
  }

  function updateLinkHint(){
    const hint = $('linkHint');
    if(!hint) return;
    hint.textContent = selectedGame ? `เลือก: ${prettyGame(selectedGame)} • แตะ 1=Copy / 2=Play` : 'เลือกเกมด้านบนก่อน';
  }

  function bindGameButtons(){
    document.querySelectorAll('.gameBtn[data-game]').forEach(btn=>{
      const key = btn.getAttribute('data-game');

      if(!btn.__selectBound){
        btn.__selectBound = true;
        btn.addEventListener('click', ()=>{
          selectedGame = key;
          document.querySelectorAll('.gameBtn').forEach(x=>x.style.outline='none');
          btn.style.outline = '2px solid rgba(34,197,94,.35)';
          updateLinkHint();
        }, { passive:true });
      }

      bindTapCopyPlay(
        btn,
        ()=> buildGameUrl(key, readControls()),
        (url)=>playUrl(url)
      );
    });

    const btnCopy = $('btnCopyLink');
    if(btnCopy && !btnCopy.__bound){
      btnCopy.__bound = true;
      btnCopy.addEventListener('click', async ()=>{
        if(!selectedGame){
          toast('ยังไม่ได้เลือกเกม');
          return;
        }
        const url = buildGameUrl(selectedGame, readControls());
        await copyText(url);
      }, { passive:true });
    }

    const ap = $('btnApplyPreset');
    if(ap && !ap.__bound){
      ap.__bound = true;
      ap.addEventListener('click', applyPreset, { passive:true });
    }
  }

  // ---------- Last summary + History ----------
  function flattenForCsv(obj){
    const out = {};
    if(!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(k=>{
      const v = obj[k];
      if(v && typeof v === 'object') out[k] = JSON.stringify(v);
      else out[k] = v;
    });
    return out;
  }

  function escapeHtml(s){
    s = String(s ?? '');
    return s.replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function renderLast(){
    const last = loadJson(LS_LAST, null);

    const empty = $('lastEmpty');
    const panel = $('lastPanel');

    if(!last){
      if(empty) empty.style.display = 'block';
      if(panel) panel.style.display = 'none';
      return;
    }

    if(empty) empty.style.display = 'none';
    if(panel) panel.style.display = 'block';

    const gKey = normalizeGameName(last.game || last.gameMode || last.projectTag);
    const grade = String(last.grade || '—').toUpperCase();

    setBadge($('badgeGame'), prettyGame(gKey), '');
    setBadge($('badgeGrade'), `GRADE ${grade}`, gradeToClass(grade));

    $('lastSession') && ($('lastSession').textContent = last.sessionId || '—');
    $('lastScore') && ($('lastScore').textContent = last.scoreFinal ?? 0);
    $('lastCombo') && ($('lastCombo').textContent = last.comboMax ?? 0);
    $('lastMiss') && ($('lastMiss').textContent = last.misses ?? 0);
    $('lastGoals') && ($('lastGoals').textContent = `${last.goalsCleared ?? 0}/${last.goalsTotal ?? 0}`);
    $('lastMinis') && ($('lastMinis').textContent = `${last.miniCleared ?? 0}/${last.miniTotal ?? 0}`);
    $('lastDur') && ($('lastDur').textContent = `${last.durationPlayedSec ?? 0}s`);

    $('lastMode') && ($('lastMode').textContent = last.runMode || last.run || '—');
    $('lastDiff') && ($('lastDiff').textContent = last.diff || '—');
    $('lastSeed') && ($('lastSeed').textContent = last.seed ?? '—');

    $('lastJson') && ($('lastJson').textContent = JSON.stringify(last, null, 2));

    // ✅ PATCH: ใช้ onclick แทน addEventListener ซ้ำ ๆ
    const btnReplay = $('btnReplayLast');
    if(btnReplay){
      btnReplay.onclick = ()=>{
        const run  = (last.runMode || last.run || 'play');
        const df = (last.diff || 'normal');
        const tm = (last.durationPlannedSec || last.time || 70);
        const sd = (last.seed != null ? last.seed : null);

        const gameKey = normalizeGameName(last.game || last.gameMode || '');
        if(!GAME_PATHS[gameKey]){
          toast('ไม่รู้จักเกมในผลล่าสุด');
          return;
        }
        playUrl(buildGameUrl(gameKey, { run, diff: df, time: tm, seed: sd }));
      };
    }

    const btnCopyJson = $('btnCopyLastJson');
    if(btnCopyJson){
      btnCopyJson.onclick = async ()=> {
        await copyText(JSON.stringify(last, null, 2));
      };
    }

    const btnExport = $('btnExportLastCsv');
    if(btnExport){
      btnExport.onclick = ()=>{
        const csv = toCsv([flattenForCsv(last)]);
        downloadText(`HHA_last_${(last.game||'game')}_${Date.now()}.csv`, csv);
      };
    }

    const btnClear = $('btnClearLast');
    if(btnClear){
      btnClear.onclick = ()=>{
        try{ localStorage.removeItem(LS_LAST); }catch(e){}
        toast('ล้างผลล่าสุดแล้ว 🧹');
        renderLast();
        renderHistory();
      };
    }
  }

  function renderHistory(){
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    const recent = arr.slice(0,4);

    const empty = $('recentEmpty');
    const panel = $('recentPanel');
    const tbody = $('recentTbody');
    const hint = $('historyHint');

    if(!recent.length){
      if(empty) empty.style.display = 'block';
      if(panel) panel.style.display = 'none';
      if(hint) hint.textContent = '—';
      if(tbody) tbody.innerHTML = `<tr><td colspan="10" class="muted">—</td></tr>`;
      return;
    }

    if(empty) empty.style.display = 'none';
    if(panel) panel.style.display = 'block';
    if(hint) hint.textContent = `รวม ${arr.length} รายการ (แสดง 4 ล่าสุด)`;

    if(!tbody) return;
    tbody.innerHTML = '';

    recent.forEach((it, idx)=>{
      const gameKey = normalizeGameName(it.game || it.gameMode || '');
      const grade = String(it.grade || '—').toUpperCase();

      const tr = document.createElement('tr');
      tr.setAttribute('data-i', String(idx));

      const timeTxt = (()=> {
        try{
          const d = new Date(it.timestampIso || it.startTimeIso || Date.now());
          return d.toLocaleString('th-TH', { hour12:false });
        }catch(e){
          return it.timestampIso || '—';
        }
      })();

      const mode = it.runMode || it.run || '—';
      const df = it.diff || '—';
      const score = it.scoreFinal ?? 0;
      const miss = it.misses ?? 0;
      const goals = `${it.goalsCleared ?? 0}/${it.goalsTotal ?? 0}`;
      const minis = `${it.miniCleared ?? 0}/${it.miniTotal ?? 0}`;

      tr.innerHTML = `
        <td>${escapeHtml(timeTxt)}</td>
        <td class="tdGame">${escapeHtml(prettyGame(gameKey))}</td>
        <td>${escapeHtml(mode)}</td>
        <td>${escapeHtml(df)}</td>
        <td>${escapeHtml(String(score))}</td>
        <td><span class="gradeTag ${gradeToClass(grade)}">${escapeHtml(grade)}</span></td>
        <td>${escapeHtml(String(miss))}</td>
        <td>${escapeHtml(goals)}</td>
        <td>${escapeHtml(minis)}</td>
        <td>
          <div class="actWrap">
            <span class="actBtn play" data-act="play">▶ Play</span>
            <span class="actBtn json" data-act="json">📋 JSON</span>
          </div>
        </td>
      `;

      bindTapCopyPlay(
        tr,
        ()=>{
          const run  = (it.runMode || it.run || 'play');
          const df2 = (it.diff || 'normal');
          const tm = (it.durationPlannedSec || it.time || 70);
          const sd = (it.seed != null ? it.seed : null);
          return buildGameUrl(gameKey, { run, diff: df2, time: tm, seed: sd });
        },
        (url)=>playUrl(url)
      );

      // action buttons
      tr.querySelectorAll('[data-act]').forEach(btn=>{
        btn.addEventListener('click', async (e)=>{
          e.stopPropagation();
          const act = btn.getAttribute('data-act');
          if(act === 'play'){
            const run  = (it.runMode || it.run || 'play');
            const df2 = (it.diff || 'normal');
            const tm = (it.durationPlannedSec || it.time || 70);
            const sd = (it.seed != null ? it.seed : null);
            pulse(tr, 'warn');
            playUrl(buildGameUrl(gameKey, { run, diff: df2, time: tm, seed: sd }));
          }else if(act === 'json'){
            await copyText(JSON.stringify(it, null, 2));
            pulse(tr, 'good');
          }
        }, { passive:false });
      });

      tbody.appendChild(tr);
    });

    const btnExportRecent = $('btnExportRecentCsv');
    if(btnExportRecent){
      btnExportRecent.onclick = ()=>{
        const csv = toCsv(recent.map(flattenForCsv));
        downloadText(`HHA_recent4_${Date.now()}.csv`, csv);
      };
    }

    const btnClear = $('btnClearHistory');
    if(btnClear){
      btnClear.onclick = ()=>{
        try{ localStorage.removeItem(LS_HIST); }catch(e){}
        toast('ล้าง History แล้ว 🧹');
        renderHistory();
      };
    }
  }

  // ---------- Init ----------
  (function init(){
    renderNow();
    bindGameButtons();
    updateLinkHint();

    renderLast();
    renderHistory();

    // default select = goodjunk
    const first = document.querySelector('.gameBtn[data-game="goodjunk"]');
    if(first){
      selectedGame = 'goodjunk';
      first.style.outline = '2px solid rgba(34,197,94,.35)';
      updateLinkHint();
    }
  })();
}