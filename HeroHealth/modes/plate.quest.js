// === /HeroHealth/modes/plate.quest.js ===
// เกม Plate: จัดจานให้ครบ 5 หมู่ แต่ให้สุ่ม GOAL 2 + Mini 3 ตาม diff

function shuffle(a){
  const arr=a.slice();
  for(let i=arr.length-1;i>0;i--){
    const j=(Math.random()*(i+1))|0;
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

// สมมติว่าภายใน plate.safe.js นับ goodHits = จำนวนชิ้นที่จัดถูกหมู่, miss = ผิด, score = คะแนนรวม
const GOALS = {
  easy: [
    { id:'serve_15', pick(){const t=15;return {label:'จัดอาหารถูกหมู่ให้ได้ 15 ชิ้น',target:t,type:'good',threshold:t}; } },
    { id:'serve_20', pick(){const t=20;return {label:'จัดอาหารถูกหมู่ให้ได้ 20 ชิ้น',target:t,type:'good',threshold:t}; } },
    { id:'score_700', pick(){const t=700;return {label:'ทำคะแนนรวมจานอาหาร 700+',target:t,type:'score',threshold:t}; } },
    { id:'score_1000',pick(){const t=1000;return {label:'ทำคะแนนรวมจานอาหาร 1,000+',target:t,type:'score',threshold:t}; } },
    { id:'combo_7',  pick(){const t=7; return {label:'ทำคอมโบต่อเนื่อง ≥ 7',target:t,type:'combo',threshold:t}; } },
    { id:'combo_10', pick(){const t=10;return {label:'ทำคอมโบต่อเนื่อง ≥ 10',target:t,type:'combo',threshold:t}; } },
    { id:'miss_leq_5',pick(){const t=5;return {label:'จัดผิดไม่เกิน 5 ครั้ง',target:t,type:'miss_leq',threshold:t}; } },
    { id:'miss_leq_3',pick(){const t=3;return {label:'จัดผิดไม่เกิน 3 ครั้ง',target:t,type:'miss_leq',threshold:t}; } },
    { id:'five_groups',pick(){return {label:'พยายามให้ครบทั้ง 5 หมู่หลาย ๆ รอบ',target:0,type:'decor'};} },
    { id:'good_18', pick(){const t=18;return {label:'จัดถูกหมู่ 18 ชิ้น',target:t,type:'good',threshold:t}; } }
  ],
  normal: [],
  hard: []
};
GOALS.normal = GOALS.easy;
GOALS.hard   = GOALS.easy;

const MINIS = {
  easy: [
    { id:'good_10', pick(){const t=10;return {label:'จัดถูกหมู่ให้ครบ 10 ชิ้น',target:t,type:'good',threshold:t}; } },
    { id:'good_14', pick(){const t=14;return {label:'จัดถูกหมู่ให้ครบ 14 ชิ้น',target:t,type:'good',threshold:t}; } },
    { id:'good_18', pick(){const t=18;return {label:'จัดถูกหมู่ให้ครบ 18 ชิ้น',target:t,type:'good',threshold:t}; } },
    { id:'score_500',pick(){const t=500;return {label:'ทำคะแนนรวม 500+',target:t,type:'score',threshold:t}; } },
    { id:'score_800',pick(){const t=800;return {label:'ทำคะแนนรวม 800+',target:t,type:'score',threshold:t}; } },
    { id:'combo_5', pick(){const t=5; return {label:'คอมโบต่อเนื่อง 5 ครั้ง',target:t,type:'combo',threshold:t}; } },
    { id:'combo_9', pick(){const t=9; return {label:'คอมโบต่อเนื่อง 9 ครั้ง',target:t,type:'combo',threshold:t}; } },
    { id:'miss_leq_4',pick(){const t=4;return {label:'จัดผิดไม่เกิน 4 ครั้ง',target:t,type:'miss_leq',threshold:t}; } },
    { id:'miss_leq_6',pick(){const t=6;return {label:'จัดผิดไม่เกิน 6 ครั้ง',target:t,type:'miss_leq',threshold:t}; } },
    { id:'protein_focus',pick(){const t=8;return {label:'ช่วยเน้นหมู่โปรตีนอย่างน้อย 8 ชิ้น',target:t,type:'good',threshold:t}; } },
    { id:'veg_focus',   pick(){const t=8;return {label:'ช่วยเน้นผัก/ผลไม้ 8 ชิ้น',target:t,type:'good',threshold:t}; } },
    { id:'combo_peak',  pick(){const t=8;return {label:'ดันคอมโบสูงสุด ≥ 8',target:t,type:'combo',threshold:t}; } },
    { id:'score_rush',  pick(){const t=650;return {label:'เก็บคะแนนให้ถึง 650 ขึ้นไป',target:t,type:'score',threshold:t}; } },
    { id:'miss_leq_2',  pick(){const t=2;return {label:'ลองเล่นให้พลาดไม่เกิน 2 ครั้ง',target:t,type:'miss_leq',threshold:t}; } },
    { id:'good_12',     pick(){const t=12;return {label:'จัดถูกหมู่ 12 ชิ้น',target:t,type:'good',threshold:t}; } }
  ],
  normal: [],
  hard: []
};
MINIS.normal = MINIS.easy;
MINIS.hard   = MINIS.easy;

function evalProgress(def, ctx){
  if (!def) return {prog:0,done:false};
  let prog=0,done=false;
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
    default:
      prog=0;done=false;
  }
  return {prog,done};
}

export function createPlateQuest(diff){
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
        window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text:'จัดจานครบตาม GOAL แล้ว เก่งมาก!'}}));
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
        window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text:'Mini Quest ด้านจานอาหารสำเร็จ ได้ภารกิจใหม่!'}}));
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

export default { createPlateQuest };