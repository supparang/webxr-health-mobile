// === /HeroHealth/modes/groups.quest.js ===
// Quest Director สำหรับเกม GROUPS
// ระบบ: Goal 2 จาก 10 + Mini Quest 3 จาก 15
// ปรับตามระดับความยาก, ออกเควสต์ใหม่ได้เรื่อย ๆ จนกว่าจะหมดเวลา

// ------------------------------------------------------------
// 1) Goal Pool (เลือก 2 จาก 10)
// ------------------------------------------------------------
const GOAL_POOL = [
  { id:'g1',  label:'เก็บอาหารหมู่ 1 ให้ครบ 10 ชิ้น',        need:10, group:1 },
  { id:'g2',  label:'เก็บอาหารหมู่ 2 ให้ครบ 10 ชิ้น',        need:10, group:2 },
  { id:'g3',  label:'เก็บอาหารหมู่ 3 ให้ครบ 10 ชิ้น',        need:10, group:3 },
  { id:'g4',  label:'เก็บอาหารหมู่ 4 ให้ครบ 10 ชิ้น',        need:10, group:4 },
  { id:'g5',  label:'เก็บอาหารหมู่ 5 ให้ครบ 10 ชิ้น',        need:10, group:5 },

  { id:'g6',  label:'เก็บอาหารหมู่เป้าหมายรวม 20 ชิ้น',      need:20, group:'target' },
  { id:'g7',  label:'เก็บถูกหมู่มากกว่า 15 ครั้ง',            need:15, group:'target' },
  { id:'g8',  label:'เก็บอาหารหมู่ที่กำหนด 8 ชิ้น',          need:8,  group:'target' },
  { id:'g9',  label:'เก็บอาหารให้ถูก 12 ครั้งติดกัน',         need:12, chain:true },
  { id:'g10', label:'เก็บอาหารเป้าหมายโดยไม่พลาด 6 ครั้ง',   need:6,  nomiss:true },
];

// ------------------------------------------------------------
// 2) Mini Quest Pool (เลือก 3 จาก 15)
// ------------------------------------------------------------
const MINI_POOL = [
  { id:'m1', label:'ทำคอมโบให้ถึง 6',   need:6,  type:'combo' },
  { id:'m2', label:'ทำคอมโบให้ถึง 10',  need:10, type:'combo' },
  { id:'m3', label:'ทำคอมโบให้ถึง 15',  need:15, type:'combo' },

  { id:'m4', label:'เก็บหมู่เป้าหมาย 12 ชิ้น',   need:12, type:'target' },
  { id:'m5', label:'เก็บหมู่เป้าหมาย 18 ชิ้น',   need:18, type:'target' },

  { id:'m6', label:'ไม่พลาด 5 ครั้ง',  need:5, type:'miss' },
  { id:'m7', label:'ไม่พลาด 3 ครั้งติด', need:3, type:'nomiss' },

  { id:'m8',  label:'เก็บอาหารหมู่ 1 รวม 8 ชิ้น', need:8, group:1, type:'group' },
  { id:'m9',  label:'เก็บอาหารหมู่ 2 รวม 8 ชิ้น', need:8, group:2, type:'group' },
  { id:'m10', label:'เก็บอาหารหมู่ 3 รวม 8 ชิ้น', need:8, group:3, type:'group' },
  { id:'m11', label:'เก็บอาหารหมู่ 4 รวม 8 ชิ้น', need:8, group:4, type:'group' },
  { id:'m12', label:'เก็บอาหารหมู่ 5 รวม 8 ชิ้น', need:8, group:5, type:'group' },

  { id:'m13', label:'เก็บเป้าติดกัน 5 ครั้ง', need:5, type:'chain' },
  { id:'m14', label:'ทำคะแนนรวมถึง 3000', need:3000, type:'score' },
  { id:'m15', label:'ลด miss ให้เหลือน้อยกว่า 3', need:3, type:'misslow' },
];

// ------------------------------------------------------------
function pickRandom(list, n){
  const a = list.slice();
  const out = [];
  while(out.length < n && a.length){
    const i = (Math.random()*a.length)|0;
    out.push(a.splice(i,1)[0]);
  }
  return out;
}

// ------------------------------------------------------------
export function createGroupsQuest(diff='normal'){
  let goals   = [];
  let minis   = [];

  let goalsCleared = 0;
  let minisCleared = 0;

  let totalGoal   = 0;
  let totalMini   = 0;

  let lastState   = {};   // เก็บ state ล่าสุดจาก safe.js

  // ------------------------------------------------------------
  // เริ่มเควสต์ชุดใหม่
  // ------------------------------------------------------------
  function start(state){
    lastState = state || {};

    goals = pickRandom(GOAL_POOL, 2);
    minis = pickRandom(MINI_POOL, 3);

    totalGoal += goals.length;
    totalMini += minis.length;

    pushUpdate();
  }

  // ------------------------------------------------------------
  // ตรวจ goal ทีละอัน
  // ------------------------------------------------------------
  function checkGoal(g, st){
    const { hitsByGroup, comboMax, misses } = st;

    // แบบกำหนดหมู่ตรง ๆ
    if (g.group >= 1 && g.group <= 5){
      const c = hitsByGroup[g.group] || 0;
      return c >= g.need;
    }

    if (g.group === 'target'){
      const sum = st.activeGroups.reduce((s,grp)=>s + (hitsByGroup[grp]||0), 0);
      return sum >= g.need;
    }

    if (g.chain){
      return comboMax >= g.need;
    }

    if (g.nomiss){
      return misses <= (g.need===6?6:3);
    }

    return false;
  }

  // ------------------------------------------------------------
  // ตรวจ mini quest
  // ------------------------------------------------------------
  function checkMini(m, st){
    const { hitsByGroup, comboMax, misses, score, activeGroups } = st;

    switch(m.type){
      case 'combo':
        return comboMax >= m.need;
      case 'target':
        const tot = activeGroups.reduce((s,g)=>s + (hitsByGroup[g]||0), 0);
        return tot >= m.need;
      case 'miss':
        return misses <= m.need;
      case 'nomiss':
        return misses === 0;
      case 'group':
        const num = hitsByGroup[m.group] || 0;
        return num >= m.need;
      case 'chain':
        return comboMax >= m.need;
      case 'score':
        return score >= m.need;
      case 'misslow':
        return misses < m.need;
      default:
        return false;
    }
  }

  // ------------------------------------------------------------
  // อัปเดตเควสต์ (เรียกทุกครั้งที่ safe.js ส่งสถิติมา)
  // ------------------------------------------------------------
  function update(st){
    lastState = st;

    // ตรวจ goal
    goals.forEach(g=>{
      if (!g._done && checkGoal(g, st)){
        g._done = true;
        goalsCleared++;
      }
    });

    // ตรวจ mini
    minis.forEach(m=>{
      if (!m._done && checkMini(m, st)){
        m._done = true;
        minisCleared++;
      }
    });

    // ถ้า goal + mini ครบ และยังมีเวลาเหลือ → สุ่มชุดใหม่
    const allDone = goals.every(g=>g._done) && minis.every(m=>m._done);
    if (allDone && st.timeLeft > 3){
      start(st);
    }

    pushUpdate();
  }

  // ------------------------------------------------------------
  // ยิงผลให้ quest-hud.js
  // ------------------------------------------------------------
  function pushUpdate(){
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        goals,
        minis,
        goalsCleared,
        minisCleared,
        goalsTotal: totalGoal,
        minisTotal: totalMini
      }
    }));
  }

  // ------------------------------------------------------------
  // ส่งสรุปตอนจบ
  // ------------------------------------------------------------
  function summary(){
    return {
      goalsCleared,
      goalsTotal: totalGoal,
      miniCleared: minisCleared,
      miniTotal: totalMini
    };
  }

  return { start, update, summary };
}

export default { createGroupsQuest };