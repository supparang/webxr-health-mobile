// === /HeroHealth/modes/groups.quest.js (2025-11-14) ===
// ใช้ร่วมกับ groups.safe.js ที่ส่ง ctx = { score, goodHits, miss, comboMax, timeLeft, groupsDone }

function shuffle(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = (Math.random()*(i+1))|0;
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// GOALS (เลือก 2 จาก 10)
// ---------------------------------------------------------------------------
const GOALS = {
  easy: [
    {
      id:'score_800',
      pick(){ const t=800; return { label:'ทำคะแนนรวม ≥ 800', target:t, type:'score', threshold:t }; }
    },
    {
      id:'score_1200',
      pick(){ const t=1200; return { label:'ทำคะแนนรวม ≥ 1,200', target:t, type:'score', threshold:t }; }
    },
    {
      id:'good_20',
      pick(){ const t=20; return { label:'แยกเข้าหมู่ถูก ≥ 20 ชิ้น', target:t, type:'goodHits', threshold:t }; }
    },
    {
      id:'good_30',
      pick(){ const t=30; return { label:'แยกเข้าหมู่ถูก ≥ 30 ชิ้น', target:t, type:'goodHits', threshold:t }; }
    },
    {
      id:'combo_10',
      pick(){ const t=10; return { label:'ทำคอมโบ ≥ 10', target:t, type:'comboMax', threshold:t }; }
    },
    {
      id:'combo_15',
      pick(){ const t=15; return { label:'ทำคอมโบ ≥ 15', target:t, type:'comboMax', threshold:t }; }
    },
    {
      id:'miss_leq_5',
      pick(){ const t=5; return { label:'ผิดไม่เกิน 5 ครั้ง', target:t, type:'miss_leq', threshold:t }; }
    },
    {
      id:'miss_leq_3',
      pick(){ const t=3; return { label:'ผิดไม่เกิน 3 ครั้ง', target:t, type:'miss_leq', threshold:t }; }
    },
    {
      id:'groups_5',
      pick(){ const t=5; return { label:'จัดครบทั้ง 5 หมู่ อย่างน้อย 5 รอบ', target:t, type:'groupsDone', threshold:t }; }
    },
    {
      id:'groups_8',
      pick(){ const t=8; return { label:'จัดครบทั้ง 5 หมู่ อย่างน้อย 8 รอบ', target:t, type:'groupsDone', threshold:t }; }
    }
  ],
  normal: [],
  hard: []
};

GOALS.normal = GOALS.easy;
GOALS.hard   = GOALS.easy;

// ---------------------------------------------------------------------------
// MINI QUESTS (เลือก 3 จาก 15)
// ---------------------------------------------------------------------------
const MINIS = {
  easy: [
    { id:'good_10', pick(){ const t=10; return { label:'แยกหมู่ถูก 10 ชิ้น', target:t, type:'goodHits', threshold:t }; } },
    { id:'good_15', pick(){ const t=15; return { label:'แยกหมู่ถูก 15 ชิ้น', target:t, type:'goodHits', threshold:t }; } },
    { id:'good_25', pick(){ const t=25; return { label:'แยกหมู่ถูก 25 ชิ้น', target:t, type:'goodHits', threshold:t }; } },

    { id:'combo_6', pick(){ const t=6; return { label:'ทำคอมโบ ≥ 6', target:t, type:'comboMax', threshold:t }; } },
    { id:'combo_12',pick(){ const t=12;return { label:'ทำคอมโบ ≥ 12', target:t, type:'comboMax', threshold:t }; } },
    { id:'combo_18',pick(){ const t=18;return { label:'ทำคอมโบ ≥ 18', target:t, type:'comboMax', threshold:t }; } },

    { id:'miss_leq_4',pick(){ const t=4; return { label:'ผิดไม่เกิน 4 ครั้ง', target:t, type:'miss_leq', threshold:t }; } },
    { id:'miss_leq_2',pick(){ const t=2; return { label:'ผิดไม่เกิน 2 ครั้ง', target:t, type:'miss_leq', threshold:t }; } },

    { id:'score_500',pick(){ const t=500; return { label:'ทำคะแนน ≥ 500', target:t, type:'score', threshold:t }; } },
    { id:'score_900',pick(){ const t=900; return { label:'ทำคะแนน ≥ 900', target:t, type:'score', threshold:t }; } },

    { id:'groups_3', pick(){ const t=3; return { label:'จัดครบ 5 หมู่ 3 รอบ', target:t, type:'groupsDone', threshold:t }; } },
    { id:'groups_6', pick(){ const t=6; return { label:'จัดครบ 5 หมู่ 6 รอบ', target:t, type:'groupsDone', threshold:t }; } },

    { id:'ratio_good', pick(){ return { label:'ของถูกมากกว่าผิด ≥ 2 เท่า', target:2, type:'ratio_good' }; } },
    { id:'endgame_focus', pick(){ return { label:'รักษาฟอร์มจนปลายเกม', target:0, type:'decor' }; } },
    { id:'combo_peak', pick(){ const t=14; return { label:'ดันคอมโบ ≥ 14', target:t, type:'comboMax', threshold:t }; } },
  ],
  normal: [],
  hard: []
};

MINIS.normal = MINIS.easy;
MINIS.hard   = MINIS.easy;

// ---------------------------------------------------------------------------
// ประเมินความคืบหน้าเควสต์
// ---------------------------------------------------------------------------
function evalProgress(def, ctx){
  if (!def) return { prog:0, done:false };

  let prog=0, done=false;

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

    case 'groupsDone':
      prog = ctx.groupsDone|0;
      done = prog >= def.threshold;
      break;

    case 'miss_leq':
      prog = ctx.miss|0;
      // miss_leq เคลียร์เมื่อเวลา = 0 เท่านั้น
      done = (ctx.timeLeft<=0) ? (prog <= def.threshold) : false;
      break;

    case 'ratio_good': {
      const g = ctx.goodHits|0, m = ctx.miss|0;
      prog = (m===0)? g : (g/(m||1));
      done = g >= 5 && prog >= def.target;
      break;
    }

    default:
      prog=0; done=false;
  }

  return { prog, done };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createGroupsQuest(diff){
  const gPool = shuffle(GOALS[diff] || GOALS.easy).slice(0,2).map(q=>q.pick(diff));
  const mPool = shuffle(MINIS[diff] || MINIS.easy).slice(0,3).map(q=>q.pick(diff));

  let gIndex = 0;
  let mIndex = 0;

  let goalsCleared = 0;
  let miniCleared  = 0;

  function currentGoal(){ return gPool[gIndex] || null; }
  function currentMini(){ return mPool[mIndex] || null; }

  // ส่งข้อมูลให้ quest-hud.js
  function pushHUD(state){
    const cg = currentGoal();
    const cm = currentMini();

    const payload = {};

    if (cg){
      const r = evalProgress(cg,state);
      payload.goal = {
        label : cg.label,
        target: cg.target,
        prog  : Math.min(r.prog, cg.target),
        done  : r.done
      };
    }

    if (cm){
      const r = evalProgress(cm,state);
      payload.mini = {
        label : cm.label,
        target: cm.target || (r.prog|0),
        prog  : (cm.type==='ratio_good') ? Math.round(r.prog*10)/10 : Math.min(r.prog, cm.target || r.prog),
        done  : r.done
      };
    }

    if (payload.goal || payload.mini){
      window.dispatchEvent(new CustomEvent('hha:quest',{ detail:payload }));
    }
  }

  // อัปเดตเมื่อ state เปลี่ยน
  function update(state){
    state = state || {};
    let advanced = false;

    // ---------- Goal ----------
    const cg = currentGoal();
    if (cg){
      const r = evalProgress(cg,state);
      if (r.done && !cg._done){
        cg._done = true;
        goalsCleared++;
        gIndex++;
        advanced = true;
        window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text:'เก่งมาก! เคลียร์ GOAL แล้ว ได้เป้าใหม่!' }}));
      }
    }

    // ---------- Mini Quest ----------
    const cm = currentMini();
    if (cm){
      const r = evalProgress(cm,state);
      if (r.done && !cm._done){
        cm._done = true;
        miniCleared++;
        mIndex++;
        advanced = true;
        window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text:'Mini Quest สำเร็จแล้ว! ด่านถัดไปเริ่มทันที!' }}));
      }
    }

    // อัปเดต HUD
    pushHUD(state);

    return advanced;
  }

  function start(state){
    pushHUD(state||{});
  }

  function summary(){
    return {
      goalsCleared,
      goalsTotal : gPool.length,
      miniCleared,
      miniTotal  : mPool.length
    };
  }

  return { start, update, summary };
}

export default { createGroupsQuest };