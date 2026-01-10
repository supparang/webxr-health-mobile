/* === /herohealth/vr/miss-standard.js ===
HHA Miss Standard — shared logic across games
- Prevent double counting (dedupe by targetId + reason)
- Supports GoodJunk rule: miss = goodExpired + junkHit (shield-block => NOT miss)
*/

(function(root){
  'use strict';

  function nowMs(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }

  function createCounter(opts){
    opts = Object.assign({
      gameTag: 'Unknown',
      // dedupe window prevents same event counted twice
      dedupeMs: 350,
      // per-game rules:
      rules: {
        // GoodJunk special:
        goodExpiredCounts: true,
        junkHitCounts: true,
        wrongHitCounts: true,
        shootMissCounts: true
      }
    }, opts || {});

    let misses = 0;
    const seen = new Map(); // key -> time

    function keyOf(e){
      const id = String(e.targetId ?? e.id ?? '');
      const reason = String(e.reason ?? e.kind ?? 'miss');
      return id ? (id+'::'+reason) : ('_::'+reason+'::'+Math.random());
    }

    function canCount(e){
      const k = keyOf(e);
      const t = nowMs();
      const prev = seen.get(k);
      if (prev && (t - prev) < opts.dedupeMs) return false;
      seen.set(k, t);
      // cleanup light
      if (seen.size > 200){
        for (const [kk,tt] of seen){
          if ((t-tt) > 1200) seen.delete(kk);
        }
      }
      return true;
    }

    function count(e){
      e = e || {};
      const kind = String(e.kind || e.reason || 'miss');

      // blocked means shield/UI prevented damage => never count
      if (kind === 'blocked' || e.blocked === true) return misses;

      // apply rule switches
      if (kind === 'good_expire' && !opts.rules.goodExpiredCounts) return misses;
      if (kind === 'junk_hit'   && !opts.rules.junkHitCounts) return misses;
      if (kind === 'wrong_hit'  && !opts.rules.wrongHitCounts) return misses;
      if (kind === 'shoot_miss' && !opts.rules.shootMissCounts) return misses;

      if (!canCount(e)) return misses;

      misses += 1;

      // emit standardized event for HUD/log
      try{
        root.dispatchEvent(new CustomEvent('hha:miss', {
          detail: {
            gameTag: opts.gameTag,
            misses,
            kind,
            targetId: e.targetId ?? null
          }
        }));
      }catch(_){}

      return misses;
    }

    function get(){ return misses; }
    function set(v){ misses = Math.max(0, Number(v)||0); }

    return { count, get, set };
  }

  root.HHA_Miss = { createCounter };

})(typeof window !== 'undefined' ? window : globalThis);