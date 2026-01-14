// === /herohealth/plate/plate.boss.js ===
// PlateVR Boss Module — PRODUCTION (simple, kids-friendly)
// - Triggers boss at timeLeft threshold (default 20s) in PLAY only
// - Boss asks for 3-step group sequence (no harsh penalty)
// - On clear: score bonus + time bonus (small) + judge events

'use strict';

export function createPlateBoss(opts = {}){
  const cfg = Object.assign({
    triggerAtSec: 20,   // when timeLeft === triggerAtSec
    seqLen: 3,
    timeBonusSec: 6,
    stepScore: 60,
    clearScore: 250,
    enabled: true
  }, opts || {});

  const B = {
    on:false,
    cleared:false,
    seq:[],
    pos:0
  };

  function groupEmoji(i){
    return ['🍚','🥦','🍖','🥛','🍌'][i] || '🍽️';
  }

  function makeSeq(rng){
    const pool = [0,1,2,3,4];
    const seq = [];
    while(seq.length < cfg.seqLen && pool.length){
      const idx = Math.floor((rng?.() ?? Math.random()) * pool.length);
      seq.push(pool.splice(idx,1)[0]);
    }
    return seq;
  }

  function hint(emit){
    const s = B.seq.map(groupEmoji).join(' → ');
    emit('hha:coach', { msg:`🧟‍♂️ บอสมาแล้ว! จัดตามลำดับ: ${s}`, tag:'Boss' });
    emit('hha:judge', { type:'boss', on:true, seq:[...B.seq], pos:B.pos });
  }

  function reset(emit){
    B.pos = 0;
    emit('hha:coach', { msg:'เกือบถูก! เริ่มลำดับใหม่อีกครั้ง ✨', tag:'Boss' });
    emit('hha:judge', { type:'boss', on:true, reset:true, pos:B.pos });
  }

  function open({ rng, emit }){
    if(!cfg.enabled || B.cleared || B.on) return;
    B.on = true;
    B.seq = makeSeq(rng);
    B.pos = 0;
    hint(emit);
  }

  function close({ emit, cleared=false }){
    B.on = false;
    if(cleared) B.cleared = true;
    emit('hha:judge', { type:'boss', on:false, cleared:!!cleared });
  }

  function maybeTrigger({ runMode, timeLeft, rng, emit }){
    if(!cfg.enabled) return;
    if(String(runMode||'').toLowerCase() !== 'play') return; // play only
    if(B.on || B.cleared) return;
    if(Number(timeLeft) === Number(cfg.triggerAtSec)) open({ rng, emit });
  }

  // call on each good hit. returns boss result object or null
  function onGoodHit({ groupIndex, emit, addScore, addTime, timeLeft }){
    if(!B.on || B.cleared) return null;

    const need = B.seq[B.pos];
    if(groupIndex === need){
      B.pos++;
      addScore?.(cfg.stepScore);
      emit('hha:judge', { type:'boss', on:true, pos:B.pos, need });

      if(B.pos >= B.seq.length){
        // clear!
        addScore?.(cfg.clearScore);
        const tl = addTime?.(cfg.timeBonusSec, timeLeft);
        emit('hha:coach', { msg:'🎉 ผ่านบอสแล้ว! เก่งมาก!', tag:'Boss' });
        close({ emit, cleared:true });
        return { cleared:true, timeLeft: tl };
      }
      return { step:true, pos:B.pos };
    }else{
      reset(emit);
      return { reset:true };
    }
  }

  function snapshot(){
    return { bossOn: B.on, bossCleared: B.cleared, bossPos: B.pos, bossSeq:[...B.seq] };
  }

  return { maybeTrigger, onGoodHit, snapshot };
}