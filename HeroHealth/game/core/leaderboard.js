
export class Leaderboard{
  submit(mode,diff,score){
    try{
      const k='hha_board'; const arr=JSON.parse(localStorage.getItem(k)||'[]');
      arr.push({t:Date.now(),mode,diff,score});
      localStorage.setItem(k, JSON.stringify(arr).slice(0,200000));
    }catch{}
  }
  getAll(){ try{ return JSON.parse(localStorage.getItem('hha_board')||'[]'); }catch{ return []; } }
  getTop(n=10){ return this.getAll().sort((a,b)=>b.score-a.score).slice(0,n); }
}
