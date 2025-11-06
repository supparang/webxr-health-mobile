// === vr/difficulty.js ===
export class Difficulty{
  constructor(){
    this.config = {
      easy:   { size:0.8, rate: 700, life: 2500 },
      normal: { size:0.6, rate: 520, life: 2000 },
      hard:   { size:0.4, rate: 380, life: 1400 }
    };
  }
  resolve(levels){
    const val = {easy:1, normal:2, hard:3};
    const inv = ['easy','normal','hard'];
    const s = levels.map(x=>val[x||'normal']).sort((a,b)=>a-b);
    const idx = Math.max(0, Math.min(2, Math.floor(s[Math.floor(s.length/2)]-1)));
    return inv[idx];
  }
}
