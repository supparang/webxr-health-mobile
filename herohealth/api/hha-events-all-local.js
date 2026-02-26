// ===== AUTO: export + goto cooldown gate (daily-first per game) =====
  const autoCsv = String(qs('autoCsv','0')) === '1';
  const autoClear = String(qs('autoClear','0')) === '1';
  const autoDelay = (function(){
    const v = Number(qs('autoCsvCooldown',''));
    if(Number.isFinite(v) && v >= 0) return Math.min(15000, v);
    return 1200;
  })();

  const autoCooldown = String(qs('autoCooldown','0')) === '1'; // NEW
  const autoCooldownDelay = (function(){
    const v = Number(qs('autoCooldownDelay',''));
    if(Number.isFinite(v) && v >= 0) return Math.min(15000, v);
    return 1700; // default after export
  })();

  function localDayKeyBangkok(){
    try{
      return new Intl.DateTimeFormat('en-CA', {
        timeZone:'Asia/Bangkok', year:'numeric', month:'2-digit', day:'2-digit'
      }).format(new Date());
    }catch(e){
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // map names like "GoodJunkVR" -> "goodjunk" (safe for other games too)
  function normalizeGameKey(name){
    const s = String(name||'').toLowerCase();
    if(!s) return '';
    if(s.includes('goodjunk')) return 'goodjunk';
    if(s.includes('hydration')) return 'hydration';
    if(s.includes('groups')) return 'groups';
    if(s.includes('plate')) return 'plate';
    if(s.includes('handwash')) return 'handwash';
    if(s.includes('brush')) return 'brush';
    if(s.includes('mask')) return 'maskcough';
    if(s.includes('germ')) return 'germdetective';
    if(s.includes('bath')) return 'bath';
    if(s.includes('shadow')) return 'shadow';
    if(s.includes('rhythm')) return 'rhythm';
    if(s.includes('jump')) return 'jumpduck';
    if(s.includes('balance')) return 'balance';
    if(s.includes('planner')) return 'planner';
    return s.replace(/[^a-z0-9]+/g,'').slice(0,32) || s.slice(0,32);
  }

  function cooldownDailyKeys(cat, pid, gameKey){
    const c = String(cat||'').toLowerCase() || 'nutrition';
    const p = String(pid||'anon').trim() || 'anon';
    const g = String(gameKey||'').toLowerCase() || 'unknown';
    const day = localDayKeyBangkok();
    return [
      `HHA_COOLDOWN_DONE:${c}:${g}:${p}:${day}`, // NEW (per game)
      `HHA_COOLDOWN_DONE:${c}:${p}:${day}`,      // old fallback
      `HHA_COOLDOWN_DONE:${c}:${p}`,
      `HHA_COOLDOWN_DONE:${p}:${day}`,
      `HHA_COOLDOWN_DONE:${p}`,
    ];
  }

  function isCooldownDoneToday(cat, pid, gameKey){
    try{
      const keys = cooldownDailyKeys(cat, pid, gameKey);
      for(const k of keys){
        if(localStorage.getItem(k) === '1') return true;
      }
      return false;
    }catch(e){
      return false;
    }
  }

  function abs(url){
    if(!url) return '';
    try{ return new URL(url, location.href).toString(); }catch(e){ return url; }
  }

  function resolveHubUrl(){
    const raw = String(qs('hub','')||'').trim();
    if(raw) return abs(raw);
    return abs('../hub.html');
  }

  function buildGateCooldownUrl(nextAfterCooldownUrl, gameKey){
    const gate = new URL('../warmup-gate.html', location.href);
    gate.searchParams.set('gatePhase','cooldown');
    gate.searchParams.set('cat', String(qs('cat','nutrition')||'nutrition'));
    gate.searchParams.set('theme', String(gameKey||'unknown'));
    gate.searchParams.set('pid', String(qs('pid','anon')||'anon'));
    gate.searchParams.set('hub', resolveHubUrl());
    gate.searchParams.set('next', abs(nextAfterCooldownUrl || resolveHubUrl()));

    // passthrough (เหมือนที่คุณใช้ในแพลตฟอร์ม)
    const sp = new URL(location.href).searchParams;
    [
      'run','diff','time','seed','studyId','phase','conditionGroup','view','pick','variant',
      'warmup','cooldown','dur','cdur',
      'planSeq','planDay','planSlot','planMode','planSlots','planIndex','autoNext','plannedGame','finalGame','zone',
      'flush','endpoint'
    ].forEach(k=>{
      const v = sp.get(k);
      if(v!=null && v!=='') gate.searchParams.set(k, v);
    });

    return gate.toString();
  }

  let autoLatch = 0;
  function autoExportOnce(){
    const t = Date.now();
    if(t - autoLatch < 1800) return;
    autoLatch = t;

    try{
      exportAllCsv();
      if(autoClear){
        setTimeout(()=>{ try{ clearQ(); }catch(e){} }, 400);
      }
    }catch(e){}
  }

  function shouldAutoGoCooldown(gameKey){
    const cooldownFlag = String(qs('cooldown','0')||'0') === '1';
    if(!cooldownFlag) return false;

    const cat = String(qs('cat','nutrition')||'nutrition');
    const pid = String(qs('pid','anon')||'anon');

    return !isCooldownDoneToday(cat, pid, gameKey);
  }

  // Hook at game end: export first (optional) then go cooldown (optional)
  WIN.addEventListener('hha:game-ended', (ev)=>{
    const end = ev?.detail || null;
    const g = normalizeGameKey(String(qs('theme','')||resolveGameName(end)||''));
    const gameKey = g || normalizeGameKey(resolveGameName(end));

    if(autoCsv){
      setTimeout(autoExportOnce, autoDelay);
    }

    if(autoCooldown && shouldAutoGoCooldown(gameKey)){
      // ไป cooldown หลัง export/overlay นิดนึง
      const hub = resolveHubUrl();
      const cdnext = String(qs('cdnext','')||'').trim();
      const nextAfterCooldown = cdnext ? abs(cdnext) : hub;

      setTimeout(()=>{
        try{
          location.href = buildGateCooldownUrl(nextAfterCooldown, gameKey);
        }catch(e){}
      }, autoCooldownDelay);
    }
  });