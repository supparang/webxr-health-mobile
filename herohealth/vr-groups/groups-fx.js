/* === /herohealth/vr-groups/groups.fx.js ===
GroupsVR FX Director — PRODUCTION
✅ listens: hha:judge, hha:score, groups:progress, hha:end
✅ toggles body classes: fx-hit/fx-good/fx-bad/fx-perfect/fx-combo/fx-storm/fx-boss/fx-end/fx-miss
✅ anti-stuck + rate-limit + priority
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC || root.__GROUPS_FX__) return;
  root.__GROUPS_FX__ = true;

  const BODY = DOC.body;

  function add(cls){ try{ BODY.classList.add(cls); }catch(_){} }
  function rm(cls){ try{ BODY.classList.remove(cls); }catch(_){} }
  function has(cls){ try{ return BODY.classList.contains(cls); }catch(_){ return false; } }

  // ---- timers per class to avoid stuck ----
  const timers = new Map();
  function pulse(cls, ms){
    ms = Math.max(60, Number(ms)||180);
    add(cls);
    if (timers.has(cls)) clearTimeout(timers.get(cls));
    timers.set(cls, setTimeout(()=>{ rm(cls); timers.delete(cls); }, ms));
  }

  // ---- priority: end > boss/storm > bad > good > hit ----
  const LAST = { at: 0, kind: '' };
  function gate(kind, minGap){
    const t = (root.performance && performance.now) ? performance.now() : Date.now();
    minGap = Number(minGap)||90;
    // allow higher-priority kind to override quickly
    const pri = { end:5, boss:4, storm:3, bad:2, good:1, hit:0, miss:2, perfect:2, combo:1 };
    const pNew = pri[kind] ?? 0;
    const pOld = pri[LAST.kind] ?? 0;

    if (t - LAST.at < minGap && pNew <= pOld) return false;
    LAST.at = t; LAST.kind = kind;
    return true;
  }

  // ---- state for combo fx ----
  let lastCombo = 0;
  let stormOn = false;
  let rageOn = false;

  // ===== listeners =====
  root.addEventListener('hha:score', (e)=>{
    const d = (e && e.detail) || {};
    const combo = Number(d.combo)||0;

    // combo pulse when increases
    if (combo > lastCombo){
      if (combo >= 10) { if (gate('combo',120)) pulse('fx-combo', 260); }
      else if (combo >= 6) { if (gate('combo',120)) pulse('fx-combo', 200); }
    }
    lastCombo = combo;
  }, { passive:true });

  root.addEventListener('groups:progress', (e)=>{
    const d = (e && e.detail) || {};
    const k = String(d.kind || '');

    if (k === 'storm_on'){
      stormOn = true;
      add('fx-storm');
      if (gate('storm',80)) pulse('fx-hit', 140);
      return;
    }
    if (k === 'storm_off'){
      stormOn = false;
      rm('fx-storm');
      if (gate('hit',80)) pulse('fx-hit', 140);
      return;
    }

    if (k === 'boss_spawn'){
      if (gate('boss',80)) pulse('fx-boss', 280);
      return;
    }
    if (k === 'boss_down'){
      if (gate('good',90)) { pulse('fx-good', 220); pulse('fx-hit', 140); }
      return;
    }

    if (k === 'miss'){
      if (gate('miss',90)) pulse('fx-miss', 220);
      return;
    }

    if (k === 'rage_on'){
      rageOn = true;
      // keep storm vibe if already on
      if (gate('bad',80)) pulse('fx-bad', 260);
      return;
    }
    if (k === 'rage_off'){
      rageOn = false;
      if (gate('hit',80)) pulse('fx-hit', 140);
      return;
    }
  }, { passive:true });

  root.addEventListener('hha:judge', (e)=>{
    const d = (e && e.detail) || {};
    const kind = String(d.kind || '').toLowerCase();

    // kinds from engine: good/bad/miss/perfect/boss/storm
    if (kind === 'good'){
      if (gate('good',70)) { pulse('fx-good', 200); pulse('fx-hit', 120); }
      return;
    }
    if (kind === 'bad'){
      if (gate('bad',70)) { pulse('fx-bad', 220); pulse('fx-hit', 120); }
      return;
    }
    if (kind === 'miss'){
      if (gate('miss',70)) { pulse('fx-miss', 220); pulse('fx-hit', 120); }
      return;
    }
    if (kind === 'perfect'){
      if (gate('perfect',70)) pulse('fx-perfect', 240);
      return;
    }
    if (kind === 'boss'){
      if (gate('boss',70)) pulse('fx-boss', 220);
      return;
    }
    if (kind === 'storm'){
      // keep a short pulse; persistent handled by groups:progress
      if (gate('storm',80)) pulse('fx-storm', 240);
      return;
    }
  }, { passive:true });

  root.addEventListener('hha:end', (e)=>{
    // force cleanup & end fx
    stormOn = false;
    rageOn = false;
    lastCombo = 0;

    // clear persistent
    rm('fx-storm');
    rm('fx-boss');

    // pulse end
    pulse('fx-end', 520);
    if (gate('end',50)) pulse('fx-hit', 160);

    // hard safety: remove everything after 1.2s
    setTimeout(()=>{
      ['fx-hit','fx-good','fx-bad','fx-block','fx-perfect','fx-combo','fx-storm','fx-boss','fx-end','fx-miss']
        .forEach(rm);
    }, 1200);
  }, { passive:true });

})(typeof window !== 'undefined' ? window : globalThis);