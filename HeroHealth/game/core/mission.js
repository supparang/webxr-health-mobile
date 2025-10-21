export class MissionSystem{
  constructor(){ this.goal=null; this.completed=false; }
  roll(mode){ const goals={goodjunk:{type:'score',target:150},groups:{type:'hits',target:20},hydration:{type:'hydration',target:60},plate:{type:'perfectPlates',target:3}}; this.goal={mode,...(goals[mode]||{type:'score',target:100})}; this.completed=false; }
  evaluate(ctx){ if(!this.goal||this.completed) return false; const {type,target}=this.goal; let progress=0;
    if(type==='score')progress=ctx.score||0; if(type==='hits')progress=ctx.hits||0; if(type==='hydration')progress=ctx.hyd||0; if(type==='perfectPlates')progress=ctx.perfectPlates||0; if(progress>=target){ this.completed=true; return true;} return false; }
  status(){ if(!this.goal) return '🎯 ภารกิจ: -'; const n={score:'คะแนน',hits:'จำนวนเป้า',hydration:'ค่าน้ำ',perfectPlates:'จานสุขภาพ'}[this.goal.type]; return `🎯 ภารกิจ: ${n} ≥ ${this.goal.target}`; }
}