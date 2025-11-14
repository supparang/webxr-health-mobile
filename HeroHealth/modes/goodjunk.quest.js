// === /HeroHealth/modes/goodjunk.quest.js (สุ่มเป้า 2 + Mini 3 สำหรับ Good vs Junk) ===

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = (Math.random()*(i+1))|0;
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

// ctx: { score, goodHits, miss, comboMax, timeLeft }
const GOALS = {
  easy: [
    { id:'score_800',
      pick(diff){ const t=800; return { label:'ทำคะแนนรวม 800+', target:t, type:'score', threshold:t }; }
    },
    { id:'score_1200',
      pick(){ const t=1200;return {label:'ทำคะแนนรวม 1,200+',target:t,type:'score',threshold:t}; }
    },
    { id:'good_25',
      pick(){ const t=25;return {label:'เก็บของดีให้ได้ 25 ชิ้น',target:t,type:'goodHits',threshold:t}; }
    },
    { id:'good_30',
      pick(){ const t=30;return {label:'เก็บของดีให้ได้ 30 ชิ้น',target:t,type:'goodHits',threshold:t}; }
    },
    { id:'combo_10',
      pick(){ const t=10;return {label:'ทำคอมโบสูงสุดอย่างน้อย 10',target:t,type:'comboMax',threshold:t}; }
    },
    { id:'miss_leq_6',
      pick(){ const t=6;return {label:'พลาดไม่เกิน 6 ครั้ง',target:t,type:'miss_leq',threshold:t}; }
    },
    { id:'ratio_2x',
      pick(){ return {label:'เก็บของดี ≥ 2 เท่าของของเสีย',target:2,type:'ratio_gh_miss'}; }
    },
    { id:'score_1000',
      pick(){ const t=1000;return {label:'ทำคะแนนรวม 1,000+',target:t,type:'score',threshold:t}; }
    },
    { id:'good_20',
      pick(){ const t=20;return {label:'เก็บของดีให้ได้ 20 ชิ้น',target:t,type:'goodHits',threshold:t}; }
    },
    { id:'combo_8',
      pick(){ const t=8;return {label:'ทำคอมโบสูงสุดอย่างน้อย 8',target:t,type:'comboMax',threshold:t}; }
    }
  ],
  normal: [],
  hard: []
};
// ถ้า normal/hard ไม่ระบุ ให้ fallback easy แล้ว scale เป้า
GOALS.normal = GOALS.easy;
GOALS.hard   = GOALS.easy;

const MINIS = {
  easy: [
    { id:'combo_6', pick(){const t=6; return {label:'คอมโบต่อเนื่อง 6 ครั้ง',target:t,type:'comboMax',threshold:t}; } },
    { id:'combo_8', pick(){const t=8; return {label:'คอมโบต่อเนื่อง 8 ครั้ง',target:t,type:'comboMax',threshold:t}; } },
    { id:'combo_12',pick(){const t=12;return {label:'คอมโบต่อเนื่อง 12 ครั้ง',target:t,type:'comboMax',threshold:t}; } },
    { id:'good_10', pick(){const t=10;return {label:'เก็บของดีติดมือ 10 ชิ้น',target:t,type:'goodHits',threshold:t}; } },
    { id:'good_18', pick(){const t=18;return {label:'เก็บของดีติดมือ 18 ชิ้น',target:t,type:'goodHits',threshold:t}; } },
    { id:'good_22', pick(){const t=22;return {label:'เก็บของดีติดมือ 22 ชิ้น',target:t,type:'goodHits',threshold:t}; } },
    { id:'miss_leq_4', pick(){const t=4;return {label:'พลาดไม่เกิน 4 ครั้ง',target:t,type:'miss_leq',threshold:t}; } },
    { id:'miss_leq_8', pick(){const t=8;return {label:'พลาดไม่เกิน 8 ครั้ง',target:t,type:'miss_leq',threshold:t}; } },
    { id:'score_600', pick(){const t=600;return {label:'ทำคะแนนรวมอย่างน้อย 600',target:t,type:'score',threshold:t}; } },
    { id:'score_900', pick(){const t=900;return {label:'ทำคะแนนรวมอย่างน้อย 900',target:t,type:'score',threshold:t}; } },
    { id:'ratio_15',pick(){return {label:'ของดีมากกว่าของเสีย 1.5 เท่า',target:1.5,type:'ratio_gh_miss'}; } },
    { id:'ratio_2', pick(){return {label:'ของดีมากกว่าของเสีย 2 เท่า',target:2,type:'ratio_gh_miss'}; } },
    { id:'no_miss_5s',pick(){return {label:'พยายามไม่พลาดช่วงท้ายเกม',target:0,type:'decor'};} }, // purely info
    { id:'combo_plateau',pick(){const t=10;return {label:'พยายามดันคอมโบสูงสุด ≥ 10',target:t,type:'comboMax',threshold:t}; } },
    { id:'good_streak',pick(){const t=15;return {label:'เก็บของดีรวม 15 ชิ้น',target:t,type:'goodHits',threshold:t}; } }
  ],
  normal: [],
  hard: []
};
MINIS.normal = MINIS.easy;
MINIS.hard   = MINIS.easy;

function evalProgress(def, state){
  if (!def) return { prog:0, done:false };
  const t  = def.target;
  const ctx = state;
  let prog = 0, done = false;

  switch(def.type){
    case 'score':
      prog = ctx.score|0;
      done = prog >= def.threshold;
      break;
    case 'goodHits':
      prog = ctx.goodHits|0;
      done = prog >= def.threshold;
      break;
    case 'comboMax':
      prog = ctx.comboMax|0;
      done = prog >= def.threshold;
      break;
    case 'miss_leq':
      prog = ctx.miss|0;
      done = (ctx.timeLeft<=0) ? (prog <= def.threshold) : false;
      break;
    case 'ratio_gh_miss': {
      const g = ctx.goodHits|0, m = ctx.miss|0;
      prog = (m===0)? g : (g/(m||1));
      done = g>=5 && prog >= def.target;
      break;
    }
    default:
      prog = 0; done=false;
  }
  return { prog, done };
}

export function createGoodJunkQuest(diff){
  const gPoolBase = GOALS[diff] || GOALS.easy;
  const mPoolBase = MINIS[diff] || MINIS.easy;

  const gPool = shuffle(gPoolBase).slice(0,2).map(q=>q.pick(diff));
  const mPool = shuffle(mPoolBase).slice(0,3).map(q=>q.pick(diff));

  let gIndex = 0, mIndex = 0;
  let goalsCleared = 0, miniCleared = 0;

  function currentGoal(){ return gPool[gIndex] || null; }
  function currentMini(){ return mPool[mIndex] || null; }

  function pushHUD(state){
    const cg = currentGoal();
    const cm = currentMini();

    const payload = {};
    if (cg){
      const r = evalProgress(cg,state);
      payload.goal = {
        label: cg.label,
        target: cg.target,
        prog: Math.min(r.prog, cg.target),
        done: r.done
      };
    }
    if (cm){
      const r = evalProgress(cm,state);
      payload.mini = {
        label: cm.label,
        target: cm.target || (r.prog|0),
        prog: (cm.type==='ratio_gh_miss') ? Math.round(r.prog*10)/10 : Math.min(r.prog, cm.target||r.prog),
        done: r.done
      };
    }
    if (payload.goal || payload.mini){
      window.dispatchEvent(new CustomEvent('hha:quest',{ detail:payload }));
    }
  }

  function update(state){
    state = state || {};
    let advanced = false;

    const cg = currentGoal();
    if (cg){
      const r = evalProgress(cg,state);
      if (r.done && !cg._done){
        cg._done = true;
        goalsCleared++;
        gIndex++;
        advanced = true;
        window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text:'เยี่ยม! เคลียร์ GOAL แล้ว ได้เป้าใหม่เพิ่ม!'}}));
      }
    }
    const cm = currentMini();
    if (cm){
      const r = evalProgress(cm,state);
      if (r.done && !cm._done){
        cm._done = true;
        miniCleared++;
        mIndex++;
        advanced = true;
        window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text:'Mini Quest สำเร็จแล้ว ได้เควสต์ใหม่ต่อทันที!'}}));
      }
    }

    // ถ้าเวลาหมดแล้ว ไม่ต้องดัน HUD ต่อ
    pushHUD(state);
    return advanced;
  }

  function start(state){
    pushHUD(state||{});
  }

  function summary(){
    return {
      goalsCleared,
      goalsTotal: gPool.length,
      miniCleared,
      miniTotal: mPool.length
    };
  }

  return { start, update, summary };
}

export default { createGoodJunkQuest };