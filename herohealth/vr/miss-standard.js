/* === A: /herohealth/vr/miss-standard.js ===
HHA Miss Standard — PRODUCTION
✅ createCounter({gameTag,dedupeMs,rules})
✅ count({kind,targetId,tsMs}) -> {misses, breakdown}
✅ get(), set(n), getBreakdown()
✅ Dedupe: กันนับซ้ำกรณี event ซ้ำ/คลิกซ้อน/expire+remove ชนกัน
✅ Breakdown: wrong_hit, junk_hit, expire, shoot_miss, mini, other
Rules:
- wrongHitCounts, junkHitCounts, goodExpiredCounts, shootMissCounts (default: true,true,true,false)
*/

(function(root){
  'use strict';
  const WIN = root || window;

  if (WIN.HHA_Miss && WIN.HHA_Miss.createCounter) return;

  function nowMs(){
    return (WIN.performance && performance.now) ? performance.now() : Date.now();
  }

  function clamp(n,a,b){
    n = Number(n); if(!isFinite(n)) n = a;
    return n<a?a:(n>b?b:n);
  }

  function normalizeKind(k){
    k = String(k||'other').toLowerCase();
    if (k === 'wrong' || k === 'wronghit' || k === 'wrong_hit') return 'wrong_hit';
    if (k === 'junk' || k === 'junkhit' || k === 'junk_hit') return 'junk_hit';
    if (k === 'expire' || k === 'expired' || k === 'expire_good' || k === 'expire_good_target') return 'expire';
    if (k === 'shoot' || k === 'shootmiss' || k === 'shoot_miss') return 'shoot_miss';
    if (k === 'mini' || k === 'mini_fail' || k === 'mini_fail_miss') return 'mini';
    return 'other';
  }

  function defaultRules(){
    return {
      wrongHitCounts: true,
      junkHitCounts: true,
      goodExpiredCounts: true,
      shootMissCounts: false
    };
  }

  function shouldCount(kind, rules){
    if (kind === 'wrong_hit')  return !!rules.wrongHitCounts;
    if (kind === 'junk_hit')   return !!rules.junkHitCounts;
    if (kind === 'expire')     return !!rules.goodExpiredCounts;
    if (kind === 'shoot_miss') return !!rules.shootMissCounts;
    if (kind === 'mini')       return true;      // mini_fail นับ miss เสมอ
    return true;                                // other นับ
  }

  function makeKey(gameTag, kind, targetId){
    const g = String(gameTag || 'HHA');
    const k = String(kind || 'other');
    const t = String(targetId || '');
    return g + '|' + k + '|' + t;
  }

  function createCounter(cfg){
    cfg = cfg || {};
    const gameTag = String(cfg.gameTag || 'HHA');
    const dedupeMs = clamp(cfg.dedupeMs ?? 320, 120, 1200);
    const rules = Object.assign(defaultRules(), cfg.rules || {});

    let misses = 0;

    const breakdown = {
      wrong_hit: 0,
      junk_hit: 0,
      expire: 0,
      shoot_miss: 0,
      mini: 0,
      other: 0
    };

    // dedupe map: key -> lastTsMs
    const seen = new Map();

    function gc(ts){
      // กวาดของเก่า (กัน map โต)
      if (seen.size < 120) return;
      const cutoff = ts - (dedupeMs * 4);
      for (const [k,v] of seen.entries()){
        if (v < cutoff) seen.delete(k);
      }
    }

    function get(){ return misses|0; }
    function set(n){ misses = Math.max(0, Number(n)||0)|0; return misses; }

    function getBreakdown(){
      // copy (กันโดนแก้จากภายนอก)
      return {
        wrong_hit: breakdown.wrong_hit|0,
        junk_hit: breakdown.junk_hit|0,
        expire: breakdown.expire|0,
        shoot_miss: breakdown.shoot_miss|0,
        mini: breakdown.mini|0,
        other: breakdown.other|0
      };
    }

    function count(evt){
      evt = evt || {};
      const ts = (evt.tsMs != null) ? Number(evt.tsMs) : nowMs();
      const kind = normalizeKind(evt.kind);
      const targetId = (evt.targetId == null) ? '' : String(evt.targetId);

      // dedupe: ถ้า kind+targetId ซ้ำในช่วงสั้นๆ -> ignore
      const key = makeKey(gameTag, kind, targetId);
      const last = seen.get(key) || -1e18;
      if ((ts - last) < dedupeMs){
        return { misses:get(), breakdown:getBreakdown(), deduped:true, kind };
      }
      seen.set(key, ts);
      gc(ts);

      // apply rule
      if (!shouldCount(kind, rules)){
        // ถึงไม่เพิ่ม miss ก็เก็บ breakdown ได้ (เช่น shoot_miss)
        if (breakdown[kind] != null) breakdown[kind] += 1;
        else breakdown.other += 1;

        return { misses:get(), breakdown:getBreakdown(), counted:false, kind };
      }

      misses += 1;
      if (breakdown[kind] != null) breakdown[kind] += 1;
      else breakdown.other += 1;

      return { misses:get(), breakdown:getBreakdown(), counted:true, kind };
    }

    return { gameTag, rules, dedupeMs, get, set, count, getBreakdown };
  }

  WIN.HHA_Miss = { createCounter };

})(typeof window !== 'undefined' ? window : globalThis);