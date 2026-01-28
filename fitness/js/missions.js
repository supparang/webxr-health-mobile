// === /fitness/js/missions.js ===
// Mini Missions (fun + replayable)
// - Choose 3 missions per run
// - Track progress and completion
// - Designed to be readable + motivating for kids

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export class MissionDirector {
  constructor(){
    this.active = [];
    this.completed = new Set();
    this.progress = {};
  }

  reset(){
    this.active = [];
    this.completed.clear();
    this.progress = {};
  }

  // Build missions based on difficulty
  pick(diffKey){
    this.reset();

    const pool = [
      { id:'M_COMBO10', title:'ทำคอมโบ 10', desc:'ทำคอมโบให้ถึง 10 สักครั้ง', type:'combo', target:10 },
      { id:'M_PERF5',   title:'Perfect 5',  desc:'ทำ PERFECT 5 ครั้ง', type:'perfect', target:5 },
      { id:'M_SURVIVE', title:'รอดให้ได้', desc:'จบเกมโดยไม่ตาย (HP > 0)', type:'survive', target:1 },
      { id:'M_SHIELD2', title:'เกราะ 2',   desc:'สะสม Shield ให้ถึง 2', type:'shield', target:2 },
      { id:'M_NOMISS20',title:'ไม่พลาด 20 วิ', desc:'อยู่ให้ครบ 20 วิโดยไม่ MISS', type:'nomiss', target:20000 },
      { id:'M_BOSSFACE1',title:'หมัดเด็ด 1', desc:'ตีหน้า Boss (Boss Face) ให้โดน 1 ครั้ง', type:'bossface', target:1 },
    ];

    // hard gets stricter mix
    const picks = (diffKey==='hard')
      ? ['M_COMBO10','M_PERF5','M_BOSSFACE1']
      : (diffKey==='easy')
      ? ['M_SURVIVE','M_SHIELD2','M_NOMISS20']
      : ['M_COMBO10','M_SHIELD2','M_NOMISS20'];

    this.active = picks.map(id => pool.find(p=>p.id===id)).filter(Boolean);

    for (const m of this.active) this.progress[m.id] = 0;
    return this.active;
  }

  // update from engine state + event
  onTick(state){
    if (!state) return;

    // nomiss timer handled in engine by providing state.missStreakMs
    for (const m of this.active){
      if (this.completed.has(m.id)) continue;
      if (m.type === 'shield'){
        this.progress[m.id] = clamp(state.shield, 0, 99);
        if (this.progress[m.id] >= m.target) this.completed.add(m.id);
      }
      if (m.type === 'combo'){
        this.progress[m.id] = clamp(state.maxCombo, 0, 999);
        if (this.progress[m.id] >= m.target) this.completed.add(m.id);
      }
      if (m.type === 'nomiss'){
        this.progress[m.id] = clamp(state.missStreakMs||0, 0, 9999999);
        if (this.progress[m.id] >= m.target) this.completed.add(m.id);
      }
      if (m.type === 'survive'){
        // check at end only (engine can call finalize)
      }
    }
  }

  onEvent(evt, state){
    if (!evt) return;
    for (const m of this.active){
      if (this.completed.has(m.id)) continue;

      if (m.type === 'perfect' && evt.type==='hit' && evt.grade==='perfect'){
        this.progress[m.id] += 1;
        if (this.progress[m.id] >= m.target) this.completed.add(m.id);
      }
      if (m.type === 'bossface' && evt.type==='hit' && evt.targetType==='bossface'){
        this.progress[m.id] += 1;
        if (this.progress[m.id] >= m.target) this.completed.add(m.id);
      }
    }
  }

  finalize(state){
    for (const m of this.active){
      if (this.completed.has(m.id)) continue;
      if (m.type === 'survive'){
        if (state && state.playerHp > 0) this.completed.add(m.id);
      }
    }
  }

  summary(){
    const out = [];
    for (const m of this.active){
      const done = this.completed.has(m.id);
      const p = this.progress[m.id] ?? 0;
      const text =
        m.type==='nomiss'
          ? `${done?'✅':'⬜'} ${m.title} (${Math.floor(p/1000)}s/${Math.floor(m.target/1000)}s)`
          : `${done?'✅':'⬜'} ${m.title} (${p}/${m.target})`;
      out.push(text);
    }
    return out;
  }

  doneCount(){
    return this.completed.size;
  }
}