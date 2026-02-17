// === /herohealth/boss/boss-scheduler.js — BPM/Beat Scheduler v20260217a ===
'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

/**
 * createBossScheduler
 * - getBpm(): number
 * - countInBeats: 0..4 (default 1)
 * - onTele(on:boolean, text?:string)
 * - onBeat(payload) -> called each beat when running a sequence
 *   payload: { i, total, token, symbol, beatMs, t0, now, lateMs }
 */
export function createBossScheduler(opts={}){
  const getBpm = opts.getBpm || (()=>120);
  const countInBeats = clamp(opts.countInBeats ?? 1, 0, 4);
  const onTele = opts.onTele || (()=>{});
  const onBeat = opts.onBeat || (()=>{});

  let active = null; // { token, seq, i, t0, beatMs, nextAt, dropped, done }
  let tokenSeq = 1;

  function beatMs(){
    const bpm = clamp(Number(getBpm()||120), 60, 220);
    return 60000 / bpm;
  }

  function stop(){
    active = null;
  }

  function isActive(){ return !!active; }

  function startSequence(seqSymbols, meta={}){
    const seq = Array.isArray(seqSymbols) ? seqSymbols.slice() : [];
    if (!seq.length) return null;

    const bm = beatMs();
    const now = performance.now();
    const token = `BOSSSEQ-${tokenSeq++}-${Math.floor(now)}`;

    // count-in telegraph
    if (countInBeats > 0){
      onTele(true, meta.teleText || 'RHYTHM!');
      setTimeout(()=> onTele(false), Math.min(900, bm*countInBeats));
    }

    active = {
      token,
      seq,
      i: 0,
      t0: now + bm * countInBeats, // sequence starts after count-in
      beatMs: bm,
      nextAt: now + bm * countInBeats,
      dropped: 0,
      done: false,
      meta
    };
    return token;
  }

  function tick(){
    if (!active) return;

    const now = performance.now();
    const bm = beatMs();
    active.beatMs = bm;

    // execute beats that are due (catch-up)
    // late guard: if too late, skip some beats but never more than 2 per tick
    let safety = 0;
    while (active && now >= active.nextAt && safety < 3){
      const i = active.i;
      const symbol = active.seq[i];

      const lateMs = now - active.nextAt;

      // if super late (> 0.9 beat), drop this beat (fair)
      if (lateMs > bm*0.90){
        active.dropped++;
      } else {
        onBeat({
          i,
          total: active.seq.length,
          token: active.token,
          symbol,
          beatMs: bm,
          t0: active.t0,
          now,
          lateMs,
          meta: active.meta
        });
      }

      active.i++;
      active.nextAt += bm;
      safety++;

      if (active.i >= active.seq.length){
        active.done = true;
        // let it auto clear
        const old = active;
        active = null;
        return old.token;
      }
    }
    return null;
  }

  return { startSequence, tick, stop, isActive };
}