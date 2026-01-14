// === /herohealth/plate/plate.boss.js ===
// PlateVR Boss Phase (sequence of 5 groups)
// Emits: hha:judge {type:'boss', on, seq, pos, reset?, cleared?}
// API:
//   createBoss({ rng, onNeedSpawn, onCoach, onDone, strictJunk=true })
//   boss.start() / boss.stop() / boss.isOn()
//   boss.onHitGood(groupIndex) -> returns { ok, cleared, pos }
//   boss.onHitJunk() -> returns { ok:false, reset:true }

'use strict';

const EMO = ['🍚','🥦','🍖','🥛','🍌'];
const NAME = ['ข้าว-แป้ง','ผัก','เนื้อ/โปรตีน','นม','ผลไม้'];

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createBoss(opts={}){
  const rng = opts.rng || Math.random;
  const onNeedSpawn = typeof opts.onNeedSpawn === 'function' ? opts.onNeedSpawn : ()=>{};
  const onCoach = typeof opts.onCoach === 'function' ? opts.onCoach : ()=>{};
  const onDone  = typeof opts.onDone  === 'function' ? opts.onDone  : ()=>{};
  const strictJunk = (opts.strictJunk !== false);

  const S = {
    on:false,
    seq:[0,1,2,3,4],
    pos:0,
    mistakes:0
  };

  function emitJudge(detail){
    window.dispatchEvent(new CustomEvent('hha:judge', { detail }));
  }

  function shuffle5(){
    const arr = [0,1,2,3,4];
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    return arr;
  }

  function hintText(){
    const want = S.seq[S.pos] ?? 0;
    return `บอส! เก็บ “${NAME[want]}” ${EMO[want]} ตามลำดับ`;
  }

  function start(){
    S.on = true;
    S.seq = shuffle5();
    S.pos = 0;
    S.mistakes = 0;

    emitJudge({ type:'boss', on:true, seq:S.seq, pos:S.pos, reset:true });
    onCoach(hintText(), 'Boss');
    onNeedSpawn(S.seq[S.pos]); // ขอให้เกมสปอน "หมู่ที่ต้องการ"
  }

  function stop(){
    S.on = false;
    emitJudge({ type:'boss', on:false });
  }

  function isOn(){ return !!S.on; }

  function onHitGood(groupIndex){
    if(!S.on) return { ok:true, cleared:false, pos:S.pos };

    const want = S.seq[S.pos];
    const gi = clamp(groupIndex, 0, 4);

    if(gi === want){
      S.pos++;
      emitJudge({ type:'boss', on:true, pos:S.pos });

      if(S.pos >= S.seq.length){
        emitJudge({ type:'boss', on:true, cleared:true, pos:S.pos });
        onCoach('ผ่านบอสแล้ว! 🎉', 'Boss');
        onDone({ cleared:true, mistakes:S.mistakes });
        stop();
        return { ok:true, cleared:true, pos:S.pos };
      }else{
        onCoach(hintText(), 'Boss');
        onNeedSpawn(S.seq[S.pos]);
        return { ok:true, cleared:false, pos:S.pos };
      }
    }

    // ผิดลำดับ => reset progress
    S.mistakes++;
    S.pos = 0;
    emitJudge({ type:'boss', on:true, seq:S.seq, pos:S.pos, reset:true });
    onCoach('ผิดลำดับ! เริ่มใหม่ 😵', 'Boss');
    onNeedSpawn(S.seq[S.pos]);
    return { ok:false, reset:true, pos:S.pos };
  }

  function onHitJunk(){
    if(!S.on) return { ok:false, reset:false };
    if(!strictJunk) return { ok:false, reset:false };

    // โดน junk ตอนบอส => reset
    S.mistakes++;
    S.pos = 0;
    emitJudge({ type:'boss', on:true, seq:S.seq, pos:S.pos, reset:true });
    onCoach('โดนของหวาน/ทอด! รีเซ็ต 😵‍💫', 'Boss');
    onNeedSpawn(S.seq[S.pos]);
    return { ok:false, reset:true };
  }

  return { start, stop, isOn, onHitGood, onHitJunk };
}