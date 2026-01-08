/* === /herohealth/vr-groups/groups.fx.js ===
GroupsVR FX Router — PRODUCTION (Research-safe)
✅ Listens: hha:judge, groups:progress, hha:rank, hha:end, quest:update
✅ Toggles body classes: fx-hit/fx-good/fx-bad/fx-perfect/fx-combo/fx-storm/fx-boss/fx-end/fx-miss
✅ Persistent: storm/boss (auto release)
✅ Research-safe: auto OFF in run=research|practice
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;
  if (root.__HHA_GROUPS_FX_LOADED__) return;
  root.__HHA_GROUPS_FX_LOADED__ = true;

  const qs = (k, d = null) => {
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch { return d; }
  };

  function runMode(){
    const r = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
    if (r.includes('research')) return 'research';
    if (r.includes('practice')) return 'practice';
    return 'play';
  }

  const CFG = Object.assign({
    // ✅ set false to hard disable (or set true by default)
    enabled: true,

    // pulse durations
    hitMs: 140,
    goodMs: 220,
    badMs: 240,
    missMs: 220,
    perfectMs: 260,
    comboMs: 420,
    endMs: 520,

    // persistent max durations (safety)
    stormMaxMs: 12000,
    bossMaxMs: 12000,

    // minimal cooldowns to avoid spam
    minGapMs: 70,
  }, root.HHA_GROUPS_FX_CONFIG || {});

  // auto disable for research/practice
  const RM = runMode();
  if (RM !== 'play') CFG.enabled = false;

  // expose for debugging
  root.GroupsVR = root.GroupsVR || {};
  root.GroupsVR.__fx = { enabled: CFG.enabled, runMode: RM };

  const body = DOC.body;

  function add(cls){ body.classList.add(cls); }
  function rem(cls){ body.classList.remove(cls); }

  function pulse(cls, ms){
    if (!CFG.enabled) return;
    add(cls);
    root.clearTimeout(pulse._t && pulse._t[cls]);
    pulse._t = pulse._t || {};
    pulse._t[cls] = root.setTimeout(() => rem(cls), ms);
  }

  function latch(cls, on, maxMs){
    if (!CFG.enabled) return;
    if (on){
      add(cls);
      root.clearTimeout(latch._t && latch._t[cls]);
      latch._t = latch._t || {};
      latch._t[cls] = root.setTimeout(() => rem(cls), maxMs || 8000);
    } else {
      rem(cls);
      if (latch._t && latch._t[cls]) root.clearTimeout(latch._t[cls]);
    }
  }

  // rate-limit
  let lastAnyAt = 0;
  function allow(){
    const t = (root.performance && performance.now) ? performance.now() : Date.now();
    if (t - lastAnyAt < CFG.minGapMs) return false;
    lastAnyAt = t;
    return true;
  }

  // ---------------- Event mapping ----------------

  // hha:judge {kind,text,...}
  root.addEventListener('hha:judge', (ev) => {
    if (!CFG.enabled) return;
    if (!allow()) return;

    const d = (ev && ev.detail) || {};
    const k = String(d.kind || '').toLowerCase();

    // generic hit pulse
    if (k) pulse('fx-hit', CFG.hitMs);

    if (k === 'good' || k === 'celebrate') pulse('fx-good', CFG.goodMs);
    else if (k === 'bad') pulse('fx-bad', CFG.badMs);
    else if (k === 'miss') pulse('fx-miss', CFG.missMs);
    else if (k === 'perfect') pulse('fx-perfect', CFG.perfectMs);
    else if (k === 'storm') latch('fx-storm', true, CFG.stormMaxMs);
    else if (k === 'boss') latch('fx-boss', true, CFG.bossMaxMs);
  }, { passive:true });

  // groups:progress {kind,...}
  root.addEventListener('groups:progress', (ev) => {
    if (!CFG.enabled) return;
    const d = (ev && ev.detail) || {};
    const kind = String(d.kind || '').toLowerCase();

    if (kind === 'storm_on'){
      latch('fx-storm', true, CFG.stormMaxMs);
      body.classList.add('groups-storm'); // already used by CSS
    }
    if (kind === 'storm_off'){
      latch('fx-storm', false);
      body.classList.remove('groups-storm');
    }
    if (kind === 'boss_spawn'){
      latch('fx-boss', true, CFG.bossMaxMs);
    }
    if (kind === 'boss_down'){
      latch('fx-boss', false);
      pulse('fx-good', CFG.goodMs);
      pulse('fx-perfect', CFG.perfectMs);
    }
    if (kind === 'perfect_switch'){
      pulse('fx-perfect', CFG.perfectMs);
      pulse('fx-combo', CFG.comboMs);
    }
    if (kind === 'miss'){
      pulse('fx-miss', CFG.missMs);
      pulse('fx-bad', CFG.badMs);
    }
  }, { passive:true });

  // hha:rank {grade, accuracy}
  root.addEventListener('hha:rank', (ev) => {
    if (!CFG.enabled) return;
    const d = (ev && ev.detail) || {};
    const g = String(d.grade || '').toUpperCase();

    // combo-ish excitement for high ranks
    if (g === 'S' || g === 'SS' || g === 'SSS'){
      pulse('fx-combo', CFG.comboMs);
    }
  }, { passive:true });

  // quest:update -> mini urgent flash (optional)
  root.addEventListener('quest:update', (ev) => {
    if (!CFG.enabled) return;
    const d = (ev && ev.detail) || {};
    const left = Number(d.miniTimeLeftSec || 0);

    // mark urgent when <=3 sec
    body.classList.toggle('groups-mini-urgent', (left > 0 && left <= 3));
  }, { passive:true });

  // hha:end -> end pulse + clear latches
  root.addEventListener('hha:end', (ev) => {
    const d = (ev && ev.detail) || {};
    const rm = String(d.runMode || RM || 'play').toLowerCase();

    // always clear persistent visual classes
    latch('fx-storm', false);
    latch('fx-boss', false);
    body.classList.remove('groups-storm','groups-mini-urgent');

    if (rm !== 'play') return; // research/practice: keep quiet

    if (!CFG.enabled) return;
    pulse('fx-end', CFG.endMs);

    // fireworks for S and above (if Particles exists)
    const grade = String(d.grade || '').toUpperCase();
    if (grade === 'S' || grade === 'SS' || grade === 'SSS'){
      try{
        root.Particles && root.Particles.celebrate && root.Particles.celebrate();
      }catch(_){}
    }
  }, { passive:true });

})(typeof window !== 'undefined' ? window : globalThis);