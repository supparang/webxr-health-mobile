// === /herohealth/gate/gate-core.js ===
// HeroHealth Warmup/Cooldown Gate Core
// PATCH v20260308b-GATE-CORE-CANONICAL-GERM-FIX
//
// ✅ FIX: canonical herohealth root resolver
// ✅ FIX: Germ Detective next URL -> /herohealth/germ-detective/germ-detective.html
// ✅ FIX: anti-loop with wgskip=1
// ✅ FIX: remove plannedGame/finalGame/autoNext before forwarding
// ✅ KEEP: simple bootGate(appEl)

export function bootGate(appEl) {
  'use strict';

  const WIN = window;
  const DOC = document;

  function qs(k, d=''){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch{ return d; }
  }

  function normalizeMaybeEncodedUrl(v){
    v = String(v ?? '').trim();
    if(!v || v === 'null' || v === 'undefined') return '';
    if(/%3A|%2F|%3F|%26|%3D/i.test(v)){
      try{ v = decodeURIComponent(v); }catch(e){}
    }
    return v.trim();
  }

  function safeText(v){ return String(v ?? ''); }

  function normKey(v){
    return String(v || '').toLowerCase().replace(/[\s_\-]+/g,'').trim();
  }

  function heroRoot(){
    const origin = location.origin.replace(/\/+$/,'');
    const path = location.pathname || '/';
    const idx = path.indexOf('/herohealth/');
    if(idx >= 0){
      return origin + path.slice(0, idx + '/herohealth/'.length);
    }
    return origin + '/herohealth/';
  }

  function entryMap(){
    return {
      goodjunk: 'goodjunk-launcher.html',
      groups: 'groups-vr.html',
      hydration: 'hydration-vr.html',
      plate: 'plate-vr.html',

      handwash: 'hygiene-vr.html',
      brush: 'brush-vr.html',
      bath: 'bath-vr.html',
      cleanobject: 'clean-objects.html',
      cleanobjects: 'clean-objects.html',
      maskcough: 'maskcough-vr.html',

      germdetective: 'germ-detective.html',
      germ: 'germ-detective.html',

      shadowbreaker: 'shadow-breaker-vr.html',
      rhythmboxer: 'rhythm-boxer-vr.html',
      jumpduck: 'jump-duck-vr.html',
      balancehold: 'balance-hold-vr.html',
      fitnessplanner: 'fitness-planner/planner.html'
    };
  }

  function runMap(){
    return {
      germdetective: 'germ-detective/germ-detective.html',
      germ: 'germ-detective/germ-detective.html'
    };
  }

  function canonicalGameUrl(gameKey, mode='entry'){
    const gk = normKey(gameKey);
    const rel = mode === 'run' ? runMap()[gk] : entryMap()[gk];
    if(!rel) return '';
    return new URL(rel, heroRoot()).toString();
  }

  function currentThemeKey(){
    return normKey(
      qs('theme','') ||
      qs('game','') ||
      qs('plannedGame','') ||
      qs('finalGame','')
    );
  }

  function currentCatKey(){
    return String(qs('cat','') || qs('zone','')).toLowerCase().trim();
  }

  function currentScene(){
    return String(qs('scene','classroom') || 'classroom').toLowerCase().trim();
  }

  function appendPassThrough(url, extra){
    const u = new URL(url, location.href);
    const src = new URL(location.href).searchParams;
    const sp = u.searchParams;

    [
      'run','diff','time','seed','studyId','phase','conditionGroup','log','view','pid','api','ai','debug',
      'planSeq','planDay','planSlot','planMode','planSlots','planIndex','zone','cdnext','grade',
      'scene','room','battle','autostart','forfeit'
    ].forEach(k=>{
      const v = src.get(k);
      if(v != null && v !== '' && !sp.has(k)) sp.set(k, v);
    });

    sp.set('wgskip', '1');

    // IMPORTANT: remove loop-causing params
    sp.delete('plannedGame');
    sp.delete('finalGame');
    sp.delete('autoNext');

    if(extra && typeof extra === 'object'){
      Object.keys(extra).forEach(k=>{
        const v = extra[k];
        if(v === null || v === undefined || v === '') sp.delete(k);
        else sp.set(k, String(v));
      });
    }

    return u.toString();
  }

  function resolveNextUrl(){
    const theme = currentThemeKey();
    const cat = currentCatKey();

    // Germ Detective must go to RUN page directly
    if(theme === 'germdetective' || theme === 'germ'){
      const runUrl = canonicalGameUrl('germdetective', 'run');
      if(runUrl) return appendPassThrough(runUrl, { scene: currentScene() || 'classroom' });
    }

    const entryUrl = canonicalGameUrl(theme, 'entry');
    if(entryUrl) return appendPassThrough(entryUrl, {});

    if(cat === 'hygiene'){
      return appendPassThrough(canonicalGameUrl('handwash', 'entry') || new URL('hygiene-vr.html', heroRoot()).toString(), {});
    }
    if(cat === 'nutrition' || cat === 'fitness'){
      return appendPassThrough(new URL('hub.html', heroRoot()).toString(), {});
    }

    return appendPassThrough(new URL('hub.html', heroRoot()).toString(), {});
  }

  const alreadySkipped = qs('wgskip','0') === '1';

  function goNext(url, replace=true){
    if(!url) return;
    if(replace && alreadySkipped) return; // anti-loop
    const next = appendPassThrough(url, {});
    if(replace) location.replace(next);
    else location.href = next;
  }

  function dayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function buildDoneKey(kind, cat, theme, pid){
    return `HHA_${kind}_DONE:${pid}:${cat}:${theme}:${dayKey()}`;
  }

  function isWarmupDoneToday(){
    const pid = String(qs('pid','anon')).trim() || 'anon';
    const cat = currentCatKey() || 'hygiene';
    const theme = currentThemeKey() || 'unknown';

    try{
      return (
        localStorage.getItem(buildDoneKey('WARMUP', cat, theme, pid)) === '1' ||
        localStorage.getItem(`HHA_WARMUP_DONE::${cat}::${theme}::${pid}::${dayKey()}`) === '1' ||
        localStorage.getItem(`HHA_WARMUP_DONE:${pid}:${cat}:${theme}:${dayKey()}`) === '1'
      );
    }catch(_){
      return false;
    }
  }

  function markWarmupDoneToday(){
    const pid = String(qs('pid','anon')).trim() || 'anon';
    const cat = currentCatKey() || 'hygiene';
    const theme = currentThemeKey() || 'unknown';
    try{
      localStorage.setItem(buildDoneKey('WARMUP', cat, theme, pid), '1');
      localStorage.setItem(`HHA_WARMUP_DONE::${cat}::${theme}::${pid}::${dayKey()}`, '1');
      localStorage.setItem(`HHA_WARMUP_DONE:${pid}:${cat}:${theme}:${dayKey()}`, '1');
    }catch(_){}
  }

  function renderShell(){
    const nextUrl = resolveNextUrl();
    const theme = currentThemeKey() || 'game';
    const title = theme === 'germdetective' || theme === 'germ'
      ? 'Warmup — Germ Detective Scan'
      : `Warmup — ${theme || 'HeroHealth'}`;

    const doneToday = isWarmupDoneToday();

    appEl.innerHTML = `
      <div style="min-height:100dvh;background:#020617;color:#e5e7eb;font-family:system-ui,-apple-system,Segoe UI,Roboto,'Noto Sans Thai',sans-serif;padding:16px">
        <div style="max-width:760px;margin:0 auto">
          <div style="border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.72);border-radius:20px;padding:16px;box-shadow:0 18px 55px rgba(0,0,0,.35)">
            <div style="font-size:22px;font-weight:1000">${title}</div>
            <div style="margin-top:8px;color:#94a3b8;font-size:13px;font-weight:900">
              run=${safeText(qs('run','play'))} • diff=${safeText(qs('diff','normal'))} • scene=${safeText(currentScene())}
            </div>

            <div style="margin-top:14px;padding:14px;border:1px solid rgba(148,163,184,.16);border-radius:16px;background:rgba(255,255,255,.02)">
              <div style="font-weight:1000">${doneToday ? 'วันนี้ทำ warmup ของเกมนี้แล้ว' : 'พร้อมเริ่ม warmup'}</div>
              <div style="margin-top:6px;color:#94a3b8;font-size:13px;line-height:1.5">
                ${doneToday
                  ? 'ระบบจะข้ามไปเกมอัตโนมัติ โดยไม่ย้อน loop กลับเข้า warmup ซ้ำ'
                  : 'กดปุ่มด้านล่างเพื่อไปต่อเข้าเกม'}
              </div>
            </div>

            <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
              <button id="btnContinue" type="button"
                style="appearance:none;border:1px solid rgba(34,197,94,.30);background:rgba(34,197,94,.14);color:#e5e7eb;border-radius:14px;padding:12px 14px;font-weight:1000;cursor:pointer">
                ▶ ต่อไป
              </button>

              <a href="${appendPassThrough(new URL('hub.html', heroRoot()).toString(), {})}"
                style="display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.03);color:#e5e7eb;border-radius:14px;padding:12px 14px;font-weight:1000;text-decoration:none">
                🏠 กลับ HUB
              </a>
            </div>

            <div style="margin-top:14px;color:#94a3b8;font-size:12px;line-height:1.45;word-break:break-word">
              next = ${safeText(nextUrl)}
            </div>
          </div>
        </div>
      </div>
    `;

    const btnContinue = DOC.getElementById('btnContinue');
    if(btnContinue){
      btnContinue.onclick = ()=>{
        markWarmupDoneToday();
        const next = resolveNextUrl();
        if(!next) return;
        location.href = next; // manual continue can use href
      };
    }

    // auto-skip only if done today AND not already skipped
    if(doneToday && !alreadySkipped){
      setTimeout(()=>{
        const next = resolveNextUrl();
        if(!next) return;
        goNext(next, true);
      }, 600);
    }
  }

  if(!appEl){
    throw new Error('Missing #gate-app');
  }

  renderShell();
}