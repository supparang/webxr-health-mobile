/* === /herohealth/vr/miss-standard.js ===
HHA Miss Standard — PRODUCTION
✅ Unified miss counting with dedupe (anti double-count)
✅ Pluggable rules per game
✅ API:
   - window.HHA_Miss.createCounter({gameTag, dedupeMs, rules})
   - counter.count({kind, targetId, tsMs, meta}) -> newValue
   - counter.set(n), counter.get()
   - counter.getBreakdown(), counter.reset()
Kinds (recommended):
 - 'wrong_hit'   : hit wrong (counts miss)
 - 'junk_hit'    : hit junk (counts miss unless rules say no)
 - 'expire'      : good expired (counts miss unless rules say no)
 - 'shoot_miss'  : shot into empty (counts miss only if rules say yes)
 - 'other'       : fallback
*/

(function(root){
  'use strict';
  const WIN = root;
  const DOC = root.document;

  function nowMs(){ return (WIN.performance && performance.now) ? performance.now() : Date.now(); }
  function clampInt(v,a,b){
    v = (v|0);
    if (v < a) return a;
    if (v > b) return b;
    return v;
  }

  function safeStr(x){ try{ return String(x ?? ''); }catch(_){ return ''; } }

  function makeDedupeKey(kind, targetId){
    const k = safeStr(kind).toLowerCase();
    const t = (targetId == null) ? '' : safeStr(targetId);
    return k + '::' + t;
  }

  function defaultRules(){
    return {
      // whether each source contributes to "misses" (HUD miss metric)
      wrongHitCounts: true,
      junkHitCounts: true,
      goodExpiredCounts: true,
      shootMissCounts: false,   // usually NO for HHA (ยิงพลาด = คอมโบหลุด)
    };
  }

  function createCounter(cfg){
    cfg = cfg || {};
    const rules = Object.assign(defaultRules(), cfg.rules || {});
    const dedupeMs = Math.max(0, Number(cfg.dedupeMs ?? 350) || 0);

    let misses = 0;

    // breakdown is optional but useful for research/back-end
    const breakdown = {
      wrong_hit: 0,
      junk_hit: 0,
      expire: 0,
      shoot_miss: 0,
      other: 0
    };

    // dedupe map: key -> lastTsMs
    const lastSeen = new Map();

    function shouldCount(kind){
      kind = safeStr(kind).toLowerCase();
      if (kind === 'wrong_hit') return !!rules.wrongHitCounts;
      if (kind === 'junk_hit')  return !!rules.junkHitCounts;
      if (kind === 'expire')    return !!rules.goodExpiredCounts;
      if (kind === 'shoot_miss')return !!rules.shootMissCounts;
      return true;
    }

    function bumpBreakdown(kind){
      kind = safeStr(kind).toLowerCase();
      if (breakdown.hasOwnProperty(kind)) breakdown[kind] += 1;
      else breakdown.other += 1;
    }

    function count(evt){
      evt = evt || {};
      const kind = safeStr(evt.kind || 'other').toLowerCase();
      const targetId = evt.targetId ?? null;
      const ts = Number(evt.tsMs ?? nowMs());

      // dedupe: same (kind,targetId) in short window -> ignore
      const key = makeDedupeKey(kind, targetId);
      const prev = lastSeen.get(key);
      if (prev != null && (ts - prev) >= 0 && (ts - prev) <= dedupeMs){
        return misses;
      }
      lastSeen.set(key, ts);

      // record breakdown always (even if not counted) => can be changed if you prefer
      bumpBreakdown(kind);

      if (!shouldCount(kind)) return misses;

      misses += 1;
      return misses;
    }

    function set(n){
      misses = clampInt(Number(n)||0, 0, 999999);
      return misses;
    }

    function get(){ return misses|0; }

    function getBreakdown(){
      // return copy
      return {
        wrong_hit: breakdown.wrong_hit|0,
        junk_hit: breakdown.junk_hit|0,
        expire: breakdown.expire|0,
        shoot_miss: breakdown.shoot_miss|0,
        other: breakdown.other|0
      };
    }

    function reset(){
      misses = 0;
      breakdown.wrong_hit = 0;
      breakdown.junk_hit = 0;
      breakdown.expire = 0;
      breakdown.shoot_miss = 0;
      breakdown.other = 0;
      lastSeen.clear();
      return misses;
    }

    return {
      gameTag: safeStr(cfg.gameTag || ''),
      rules,
      dedupeMs,
      count,
      set,
      get,
      getBreakdown,
      reset
    };
  }

  WIN.HHA_Miss = WIN.HHA_Miss || {};
  WIN.HHA_Miss.createCounter = createCounter;

})(typeof window !== 'undefined' ? window : globalThis);