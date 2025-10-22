export class Leaderboard{
  submit(mode,diff,score){
    try{
      const k='hha_board';
      const arr = JSON.parse(localStorage.getItem(k)||'[]');
      arr.push({t:Date.now(), mode, diff, score});
      // เก็บล่าสุดไม่เกิน 200 รายการ
      const trimmed = arr.slice(-200);
      localStorage.setItem(k, JSON.stringify(trimmed));
    }catch{}
  }
  getTop(n=5){
    try{
      const k='hha_board';
      const arr = JSON.parse(localStorage.getItem(k)||'[]');
      return arr.sort((a,b)=>b.score-a.score).slice(0,n);
    }catch{ return []; }
  }
}
