export class MissionSystem{
  constructor(){ this.missions=[]; this.done=false; }
  roll(modeKey){
    const pool={
      goodjunk:[
        {id:'gj_combo', text:'ทำคอมโบถึง x4', check:(ctx)=>ctx.combo>=4, reward:50},
        {id:'gj_clean', text:'เก็บของดี 12 ชิ้น', check:(ctx)=>ctx.goodHits>=12, reward:60},
      ],
      groups:[
        {id:'gp_targets', text:'ทำเป้าหมายถูก 6 ครั้ง', check:(ctx)=>ctx.targetHitsTotal>=6, reward:70},
        {id:'gp_streak', text:'เก็บถูก 5 ชิ้นติด', check:(ctx)=>ctx.bestStreak>=5, reward:60},
      ],
      hydration:[
        {id:'hy_water', text:'เก็บ 💧 14 หยด', check:(ctx)=>ctx.waterHits>=14, reward:70},
        {id:'hy_avoid', text:'หลบหวาน 8 ชิ้น', check:(ctx)=>ctx.sweetMiss>=8, reward:60},
      ],
      plate:[
        {id:'pl_perfect', text:'Perfect Plate 1 ครั้ง', check:(ctx)=>ctx.perfectPlates>=1, reward:90},
        {id:'pl_fill', text:'เติมหมวดครบ 7 ช่อง', check:(ctx)=>ctx.plateFills>=7, reward:60},
      ]
    };
    const arr = pool[modeKey] || []; this.missions = arr.slice(0,2); this.done=false;
  }
  evaluate(ctx){ if(this.done) return 0; const allDone=this.missions.every(m=>m.check(ctx)); if(allDone){ this.done=true; return this.missions.reduce((s,m)=>s+m.reward,0); } return 0; }
}