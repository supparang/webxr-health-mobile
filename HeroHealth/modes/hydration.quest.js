// === /HeroHealth/modes/hydration.quest.js ===
// ใช้ ctx แบบเดียวกับ goodjunk: {score, goodHits, miss, comboMax, timeLeft}
// goodHits = จำนวนครั้งที่ดื่ม/เทน้ำถูก, miss = ผิด, score ตามระบบเกมน้ำ

function shuffle(a){
  const arr = a.slice();
  for(let i=arr.length-1;i>0;i--){
    const j=(Math.random()*(i+1))|0;
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

const GOALS = {
  easy: [
    { id:'score_600', pick(){const t=600;return {label:'รักษาสมดุลน้ำ ทำคะแนนรวม 600+',target:t,type:'score',threshold:t}; } },
    { id:'good_15',  pick(){const t=15;return {label:'ดื่มน้ำ/ทิ้งส่วนเกินถูก 15 ครั้ง',target:t,type:'good',threshold:t}; } },
    { id:'good_20',  pick(){const t=20;return {label:'ดื่มน้ำอย่างเหมาะสม 20 ครั้ง',target:t,type:'good',threshold:t}; } },
    { id:'miss_leq_5',pick(){const t=5;return {label:'พลาดไม่เกิน 5 ครั้งทั้งเกม',target:t,type:'miss_leq',threshold:t}; } },
    { id:'combo_8',  pick(){const t=8; return {label:'ทำคอมโบต่อเนื่อง ≥ 8',target:t,type:'combo',threshold:t}; } },
    { id:'score_900',pick(){const t=900;return {label:'ทำคะแนนรวมน้ำ 900+',target:t,type:'score',threshold:t}; } },
    { id:'good_10', pick(){const t=10;return {label:'ดื่มน้ำถูกอย่างน้อย 10 ครั้ง',target:t,type:'good',threshold:t}; } },
    { id:'combo_6', pick(){const t=6; return {label:'ทำคอมโบต่อเนื่อง ≥ 6',target:t,type:'combo',threshold:t}; } },
    { id:'miss_leq_3',pick(){const t=3;return {label:'พลาดไม่เกิน 3 ครั้ง',target:t,type:'miss_leq',threshold:t}; } },
    { id:'score_750',pick(){const t=750;return {label:'ทำคะแนนรวม 750+',target:t,type:'score',threshold:t}; } }
  ],
  normal: [],
  hard: []
};
GOALS.normal = GOALS.easy;
GOALS.hard   = GOALS.easy;

const MINIS = {
  easy: [
    { id:'good_8',  pick(){const t=8; return {label:'เก็บจังหวะดื่มน้ำถูก 8 ครั้ง',target:t,type:'good',threshold:t}; } },
    { id:'good_12', pick(){const t=12;return {label:'ดื่มน้ำถูก 12 ครั้ง',target:t,type:'good',threshold:t}; } },
    { id:'good_16', pick(){const t=16;return {label:'ดื่มน้ำถูก 16 ครั้ง',target:t,type:'good',threshold:t}; } },
    { id:'miss_leq_4',pick(){const t=4;return {label:'พลาดไม่เกิน 4 ครั้ง',target:t,type:'miss_leq',threshold:t}; } },
    { id:'miss_leq_6',pick(){const t=6;return {label:'พลาดไม่เกิน 6 ครั้ง',target:t,type:'miss_leq',threshold:t}; } },
    { id:'combo_5', pick(){const t=5; return {label:'คอมโบต่อเนื่อง 5 ครั้ง',target:t,type:'combo',threshold:t}; } },
    { id:'combo_9', pick(){const t=9; return {label:'คอมโบต่อเนื่อง 9 ครั้ง',target:t,type:'combo',threshold:t}; } },
    { id:'score_500',pick(){const t=500;return {label:'ทำคะแนนรวม 500+',target:t,type:'score',threshold:t}; } },
    { id:'score_700',pick(){const t=700;return {label:'ทำคะแนนรวมน้ำ 700+',target:t,type:'score',threshold:t}; } },
    { id:'good_6',  pick(){const t=6; return {label:'เริ่มต้นให้ติดมือ 6 ครั้ง',target:t,type:'good',threshold:t}; } },
    { id:'good_18', pick(){const t=18;return {label:'สะสมจังหวะดี 18 ครั้ง',target:t,type:'good',threshold:t}; } },
    { id:'ratio_good',pick(){return {label:'จังหวะถูกมากกว่าผิด 2 เท่า',target:2,type:'ratio_good'};} },
    { id:'endgame_safe',pick(){return {label:'ช่วยควบคุมน้ำให้ดีจนจบเกม',target:0,type:'decor'};} },
    { id:'combo_peak',pick(){const t=7; return {label:'ดันคอมโบสูงสุด ≥ 7',target:t,type:'combo',threshold:t}; } },
    { id:'miss_leq_2',pick(){const t=2;return {label:'ลองเล่นให้พลาดไม่เกิน 2 ครั้ง',target:t,type:'miss_leq',threshold:t}; } }
  ],
  normal: [],
  hard: []
};
MINIS.normal = MINIS.easy;
MINIS.hard   = MINIS.easy;

function evalProgress(def, ctx){
  if (!def) return {prog:0,done:false};
  let prog=0, done=false;
  switch(def.type){
    case 'score':
      prog = ctx.score|0;
      done = prog>=def.threshold;
      break;
    case 'good':
      prog = ctx.goodHits|0;
      done = prog>=def.threshold;
      break;
    case 'combo':
      prog = ctx.comboMax|0;
      done = prog>=def.threshold;
      break;
    case 'miss_leq':
      prog = ctx.miss|0;
      done = (ctx.timeLeft<=0) ? (prog<=def.threshold) : false;
      break;
    case 'ratio_good': {
      const g=ctx.goodHits|0,m=ctx.miss|0;
      prog = (m===0)? g : (g/(m||1));
      done = g>=5 && prog>=def.target;
      break;
    }
    default:
      prog=0;done=false;
  }
  return {prog,done};
}

export function createHydrationQuest(diff){
  const gPoolBase = GOALS[diff] || GOALS.easy;
  const mPoolBase = MINIS[diff] || MINIS.easy;

  const gPool = shuffle(gPoolBase).slice(0,2).map(q=>q.pick(diff));
  const mPool = shuffle(mPoolBase).slice(0,3).map(q=>q.pick(diff));

  let gIndex=0,mIndex=0;
  let goalsCleared=0,miniCleared=0;

  function currentGoal(){ return gPool[gIndex] || null; }
  function currentMini(){ return mPool[mIndex] || null; }

  function pushHUD(state){
    const cg=currentGoal(), cm=currentMini();
    const payload={};

    if (cg){
      const r=evalProgress(cg,state);
      payload.goal={
        label:cg.label,
        target:cg.target,
        prog:Math.min(r.prog,cg.target),
        done:r.done
      };
    }
    if (cm){
      const r=evalProgress(cm,state);
      payload.mini={
        label:cm.label,
        target:cm.target || (r.prog|0),
        prog:Math.min(r.prog,cm.target||r.prog),
        done:r.done
      };
    }
    if (payload.goal || payload.mini){
      window.dispatchEvent(new CustomEvent('hha:quest',{detail:payload}));
    }
  }

  function update(state){
    state = state || {};
    let advanced=false;

    const cg=currentGoal();
    if (cg){
      const r=evalProgress(cg,state);
      if (r.done && !cg._done){
        cg._done=true;
        goalsCleared++;
        gIndex++;
        advanced=true;
        window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text:'เยี่ยม! รักษาสมดุลน้ำตาม GOAL สำเร็จแล้ว'}}));
      }
    }
    const cm=currentMini();
    if (cm){
      const r=evalProgress(cm,state);
      if (r.done && !cm._done){
        cm._done=true;
        miniCleared++;
        mIndex++;
        advanced=true;
        window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text:'Mini Quest ด้านน้ำสำเร็จ ได้เควสต์ใหม่แล้ว!'}}));
      }
    }

    pushHUD(state);
    return advanced;
  }

  function start(state){ pushHUD(state||{}); }

  function summary(){
    return {
      goalsCleared,
      goalsTotal:gPool.length,
      miniCleared,
      miniTotal:mPool.length
    };
  }

  return { start, update, summary };
}

export default { createHydrationQuest };