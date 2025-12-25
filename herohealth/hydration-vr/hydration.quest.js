// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest system for Hydration
// - Goal: รักษา GREEN รวมให้ครบ X วินาที
// - Minis: Perfect streak / No-bad streak / Boss hit count (เมื่อเข้าสู่ RAID)
// Emits: quest:update + hha:celebrate

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function emit(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }

function diffTargets(diff){
  diff = String(diff||'normal').toLowerCase();
  if(diff==='easy'){
    return { goalGreen:18, miniPerfect:5, miniNoBad:7, miniBossHits:4 };
  }
  if(diff==='hard'){
    return { goalGreen:26, miniPerfect:7, miniNoBad:9, miniBossHits:6 };
  }
  return { goalGreen:22, miniPerfect:6, miniNoBad:8, miniBossHits:5 };
}

export function createHydrationQuest(opts={}){
  const diff = String(opts.diff||'normal').toLowerCase();
  const run  = String(opts.run||'play').toLowerCase();

  const T = diffTargets(diff);

  const st = {
    started:false,
    // goal
    greenTotal:0,
    goalDone:false,

    // minis
    perfectStreak:0,
    miniPerfectDone:false,

    noBadStreak:0,
    miniNoBadDone:false,

    bossHits:0,
    miniBossDone:false,

    questNum:1,
    text:'',
    sub:'',
    done:''
  };

  function updateUI(){
    // Priority: Goal until done; then minis chain
    if(!st.goalDone){
      st.questNum = 1;
      st.text = 'Goal: รักษา GREEN ให้ครบ 🟢';
      st.sub  = `สะสม GREEN รวม ${st.greenTotal}/${T.goalGreen} วิ`;
      st.done = st.goalDone ? 'PASS ✅' : '';
      emit('quest:update', { questNum: st.questNum, text: st.text, sub: st.sub, done: st.done });
      return;
    }

    // Minis chain (แสดงตัวที่ยังไม่ผ่านตัวแรก)
    const minis = [
      { id:'m1', ok: st.miniPerfectDone, label:'Mini: Perfect Streak ✨', sub: `${st.perfectStreak}/${T.miniPerfect}` },
      { id:'m2', ok: st.miniNoBadDone,   label:'Mini: No-bad Streak 🧼', sub: `${st.noBadStreak}/${T.miniNoBad}` },
      { id:'m3', ok: st.miniBossDone,    label:'Mini: Boss Hits 🌀',     sub: `${st.bossHits}/${T.miniBossHits}` }
    ];

    const cur = minis.find(x=>!x.ok) || minis[minis.length-1];
    st.questNum = 2;
    st.text = cur.label;
    st.sub  = cur.sub;
    st.done = cur.ok ? 'PASS ✅' : '';
    emit('quest:update', { questNum: st.questNum, text: st.text, sub: st.sub, done: st.done });
  }

  function celebrate(kind, id){
    emit('hha:celebrate', { kind, id });
  }

  function start(){
    st.started = true;
    updateUI();
  }

  // tick each second from hydration.safe.js
  function tick(secLeft, ctx={}){
    if(!st.started) return;

    const zone = ctx.zone || ctx.waterZone;
    if(!st.goalDone && zone === 'GREEN'){
      st.greenTotal++;
      if(st.greenTotal >= T.goalGreen){
        st.goalDone = true;
        celebrate('goal', 'green_total');
      }
      updateUI();
    }

    // Boss mini only counts if boss is active (ctx.boss true)
    if(ctx.boss && !st.miniBossDone){
      // no-op here; increment comes from onHit
      updateUI();
    }

    // If all minis passed → celebrate all
    if(st.goalDone && st.miniPerfectDone && st.miniNoBadDone && st.miniBossDone){
      celebrate('all', 'hydration_all');
    }
  }

  function onHit(e={}){
    if(!st.started) return;

    const itemType = String(e.itemType||'');
    const isGood   = !!e.isGood;
    const isPower  = !!e.isPower;
    const perfect  = !!e.perfect;

    // Perfect streak
    if(!st.miniPerfectDone){
      if(isGood && !isPower && itemType==='good' && perfect){
        st.perfectStreak++;
        if(st.perfectStreak >= T.miniPerfect){
          st.miniPerfectDone = true;
          celebrate('mini','perfect_streak');
        }
      } else if(itemType==='bad' || itemType==='fakeGood' || itemType==='bossDecoy' || e.gateFail || e.grazed){
        st.perfectStreak = 0;
      }
    }

    // No-bad streak
    if(!st.miniNoBadDone){
      if(itemType==='bad' || itemType==='fakeGood' || itemType==='bossDecoy' || e.gateFail || e.grazed){
        st.noBadStreak = 0;
      } else if(isGood){
        st.noBadStreak++;
        if(st.noBadStreak >= T.miniNoBad){
          st.miniNoBadDone = true;
          celebrate('mini','no_bad');
        }
      }
    }

    // Boss hits
    if(!st.miniBossDone){
      if(itemType==='boss' && isGood){
        st.bossHits++;
        if(st.bossHits >= T.miniBossHits){
          st.miniBossDone = true;
          celebrate('mini','boss_hits');
        }
      }
    }

    updateUI();
  }

  function getState(){
    return JSON.parse(JSON.stringify(st));
  }

  return { start, tick, onHit, getState };
}

export default { createHydrationQuest };
