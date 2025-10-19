// systems/leaderboard.js
export class Leaderboard {
  key(mode, diff){ return `etp_lb_${mode}_${diff}`; }
  load(mode,diff){ try{ return JSON.parse(localStorage.getItem(this.key(mode,diff))||'[]'); }catch{ return []; } }
  save(mode,diff,list){ try{ localStorage.setItem(this.key(mode,diff), JSON.stringify(list.slice(0,10))); }catch{} }
  submit(mode,diff,score){
    const list=this.load(mode,diff);
    list.push({score, at: Date.now()});
    list.sort((a,b)=>b.score-a.score);
    this.save(mode,diff,list);
    return list.slice(0,10);
  }
}
