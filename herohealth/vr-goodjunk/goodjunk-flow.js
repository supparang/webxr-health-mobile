// === /herohealth/vr-goodjunk/goodjunk-flow.js ===
// GoodJunkVR Flow Orchestrator (Warmup/Cooldown)
// v20260222a
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const KEY_PREFIX = 'HHA_FLOW_V1';
  const TODAY = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  })();

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  const zone = String(qs('zone', 'nutrition') || 'nutrition').toLowerCase();
  const game = String(qs('game', 'goodjunk') || 'goodjunk').toLowerCase();

  const storageKey = `${KEY_PREFIX}:${zone}:${TODAY}`;

  function readState(){
    try{
      const raw = localStorage.getItem(storageKey);
      if(!raw) return { warmupDone:false, cooldownDoneGames:{} };
      const s = JSON.parse(raw);
      return {
        warmupDone: !!s.warmupDone,
        cooldownDoneGames: s.cooldownDoneGames || {}
      };
    }catch(_){
      return { warmupDone:false, cooldownDoneGames:{} };
    }
  }

  function writeState(s){
    try{ localStorage.setItem(storageKey, JSON.stringify(s)); }catch(_){}
  }

  function markWarmupDone(){
    const s = readState();
    s.warmupDone = true;
    writeState(s);
  }

  function markCooldownDone(gameKey){
    const s = readState();
    s.cooldownDoneGames = s.cooldownDoneGames || {};
    s.cooldownDoneGames[String(gameKey||game)] = true;
    writeState(s);
  }

  function needsWarmup(){
    const s = readState();
    return !s.warmupDone;
  }

  function needsCooldown(gameKey){
    const s = readState();
    return !s.cooldownDoneGames?.[String(gameKey||game)];
  }

  function themeFor(zoneName, gameName){
    // เลือกธีมตาม zone/game
    const z = String(zoneName||'').toLowerCase();
    const g = String(gameName||'').toLowerCase();

    const base = {
      nutrition: {
        warmupTitle: 'Warmup • ครัวพลังงาน',
        warmupSub: 'เตรียมสมาธิ + โฟกัสก่อนเลือกอาหาร',
        cooldownTitle: 'Cooldown • สรุปพลังงาน',
        cooldownSub: 'หายใจลึก + ทบทวนการเลือกอาหาร',
        accent: 'nutrition'
      },
      hygiene: {
        warmupTitle: 'Warmup • ภารกิจความสะอาด',
        warmupSub: 'เตรียมสายตา + ความไว',
        cooldownTitle: 'Cooldown • ล้างภารกิจ',
        cooldownSub: 'คูลดาวน์ + ทบทวนขั้นตอน',
        accent: 'hygiene'
      },
      exercise: {
        warmupTitle: 'Warmup • เตรียมร่างกาย',
        warmupSub: 'อุ่นเครื่อง + จังหวะหายใจ',
        cooldownTitle: 'Cooldown • ผ่อนคลายกล้ามเนื้อ',
        cooldownSub: 'ยืดเบา ๆ + คืนชีพจร',
        accent: 'exercise'
      }
    };

    const t = base[z] || base.nutrition;

    // game-specific tweak
    if (z === 'nutrition' && g === 'goodjunk') {
      t.warmupTitle = 'Warmup • GoodJunk Scan';
      t.warmupSub   = 'โฟกัสเป้าดี/ขยะอาหาร ก่อนเข้าด่านจริง';
      t.cooldownTitle = 'Cooldown • Food Reset';
      t.cooldownSub   = 'คูลดาวน์ + ทบทวนว่าอะไรควรเลือก';
    }

    return t;
  }

  function byId(id){ return DOC.getElementById(id); }

  function ensureFlowLayer(){
    let root = byId('gjFlowOverlay');
    if (root) return root;

    root = DOC.createElement('div');
    root.id = 'gjFlowOverlay';
    root.className = 'gj-flow-overlay';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <div class="gj-flow-card" role="dialog" aria-label="Warmup/Cooldown">
        <div class="gj-flow-badge" id="gjFlowBadge">FLOW</div>
        <div class="gj-flow-title" id="gjFlowTitle">—</div>
        <div class="gj-flow-sub" id="gjFlowSub">—</div>

        <div class="gj-flow-steps" id="gjFlowSteps"></div>

        <div class="gj-flow-timer">
          <div class="gj-flow-timer-track">
            <div id="gjFlowTimerFill" class="gj-flow-timer-fill"></div>
          </div>
          <div id="gjFlowTimerText" class="gj-flow-timer-text">0s</div>
        </div>

        <div class="gj-flow-actions">
          <button id="btnFlowSkip" class="gj-btn" type="button">ข้าม</button>
          <button id="btnFlowGo" class="gj-btn primary" type="button">เริ่ม</button>
        </div>
      </div>
    `;
    DOC.body.appendChild(root);
    return root;
  }

  let active = null;

  function showOverlay(opts){
    const overlay = ensureFlowLayer();
    const titleEl = byId('gjFlowTitle');
    const subEl = byId('gjFlowSub');
    const badgeEl = byId('gjFlowBadge');
    const stepsEl = byId('gjFlowSteps');
    const fillEl = byId('gjFlowTimerFill');
    const txtEl = byId('gjFlowTimerText');
    const btnSkip = byId('btnFlowSkip');
    const btnGo = byId('btnFlowGo');

    const mode = opts.mode || 'warmup';
    const durationSec = Math.max(3, Number(opts.durationSec || 8));

    badgeEl.textContent = mode === 'cooldown' ? 'COOLDOWN' : 'WARMUP';
    titleEl.textContent = String(opts.title || '—');
    subEl.textContent = String(opts.sub || '—');

    stepsEl.innerHTML = '';
    (opts.steps || []).forEach((s, i) => {
      const div = DOC.createElement('div');
      div.className = 'gj-flow-step';
      div.innerHTML = `<span class="n">${i+1}</span><span class="t">${String(s)}</span>`;
      stepsEl.appendChild(div);
    });

    overlay.dataset.mode = mode;
    overlay.dataset.accent = String(opts.accent || 'nutrition');
    overlay.setAttribute('aria-hidden', 'false');
    DOC.body.classList.add('flow-open');

    let remain = durationSec;
    let raf = 0;
    let t0 = performance.now();
    let done = false;

    function render(){
      const pct = Math.max(0, Math.min(1, 1 - remain/durationSec));
      fillEl.style.width = `${Math.round(pct*100)}%`;
      txtEl.textContent = `${Math.ceil(remain)}s`;
    }
    render();

    function cleanup(){
      if (raf) cancelAnimationFrame(raf);
      btnSkip?.removeEventListener('click', onSkip);
      btnGo?.removeEventListener('click', onGo);
      active = null;
    }

    function close(){
      overlay.setAttribute('aria-hidden', 'true');
      DOC.body.classList.remove('flow-open');
    }

    function finish(result){
      if (done) return;
      done = true;
      cleanup();
      close();
      try { opts.onDone && opts.onDone(result); } catch(_){}
    }

    function onSkip(){ finish({ skipped:true }); }
    function onGo(){ finish({ skipped:false, manual:true }); }

    btnSkip?.addEventListener('click', onSkip);
    btnGo?.addEventListener('click', onGo);

    function loop(ts){
      const dt = Math.min(0.1, (ts - t0) / 1000);
      t0 = ts;
      remain -= dt;
      render();
      if (remain <= 0){
        finish({ skipped:false, auto:true });
        return;
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    active = { mode, finish };
    return active;
  }

  function warmupStepsForTheme(z, g){
    if (z === 'nutrition' && g === 'goodjunk') {
      return [
        'มองเป้า “ดี” กับ “JUNK” ให้ไว',
        'ทดลองแตะเป้า 2–3 ครั้ง (เล็งกลางจอใน VR)',
        'ตั้งใจ: เก็บ GOOD / ระวัง 💣💀'
      ];
    }
    return ['หายใจเข้า-ออก 2 รอบ', 'ทดสอบปุ่ม/การเล็ง', 'เตรียมเริ่มเกม'];
  }

  function cooldownStepsForTheme(z, g, summary){
    const miss = Number(summary?.misses ?? 0);
    const grade = summary?.grade || '—';
    if (z === 'nutrition' && g === 'goodjunk') {
      return [
        `ผลรอบนี้: Grade ${grade} / MISS ${miss}`,
        'ทบทวน: อะไรคืออาหารควรเลือก vs ควรเลี่ยง',
        'หายใจลึก 2 รอบ แล้วกลับ HUB'
      ];
    }
    return ['สรุปผลรอบเล่น', 'ผ่อนคลาย', 'กลับ HUB'];
  }

  function attachToGameLifecycle(){
    // รอฟัง event จบเกมจาก safe.js
    WIN.addEventListener('hha:end', (ev) => {
      const detail = ev?.detail || {};
      // ถ้า cooldown ของเกมนี้ทำแล้ววันนี้ อาจข้ามได้ (แต่ปกติอยากให้แสดงทุกครั้งหลังเล่น)
      // ถ้าต้องการ “แสดงทุกครั้ง” ให้ไม่เช็ค needsCooldown()
      if (!needsCooldown(game)) {
        return;
      }

      const th = themeFor(zone, game);
      showOverlay({
        mode: 'cooldown',
        title: th.cooldownTitle,
        sub: th.cooldownSub,
        accent: th.accent,
        durationSec: 7,
        steps: cooldownStepsForTheme(zone, game, detail),
        onDone: () => {
          markCooldownDone(game);
          WIN.dispatchEvent(new CustomEvent('hha:flow:cooldown-done', { detail:{ zone, game } }));
        }
      });
    }, { passive:true });
  }

  function gateGameStart(){
    // ใช้ body class + event เพื่อให้ boot/safe เริ่มหลัง warmup
    // ถ้าเกมเริ่มไปแล้วก็ไม่ใช้ gate นี้
    if (!needsWarmup()) {
      WIN.dispatchEvent(new CustomEvent('hha:flow:warmup-done', { detail:{ zone, game, skipped:true } }));
      return;
    }

    const th = themeFor(zone, game);
    showOverlay({
      mode: 'warmup',
      title: th.warmupTitle,
      sub: th.warmupSub,
      accent: th.accent,
      durationSec: 8,
      steps: warmupStepsForTheme(zone, game),
      onDone: () => {
        markWarmupDone();
        WIN.dispatchEvent(new CustomEvent('hha:flow:warmup-done', { detail:{ zone, game } }));
      }
    });
  }

  // public API (debug/override)
  WIN.GJ_FLOW = {
    readState,
    markWarmupDone,
    markCooldownDone,
    needsWarmup,
    needsCooldown,
    resetToday(){
      try{ localStorage.removeItem(storageKey); }catch(_){}
    },
    startGate: gateGameStart,
    attachToGameLifecycle
  };

  // init
  attachToGameLifecycle();
})();