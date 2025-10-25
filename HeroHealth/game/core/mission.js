// Random Mission per round + evaluation hooks
export class MissionSystem {
  constructor(){
    this.pool = {
      goodjunk: [
        {key:'collect_goods', target:[20,30,40]},
        {key:'no_miss', target:[0]},                 // ห้ามพลาด (นับ miss)
        {key:'score_reach', target:[150,220,300]}
      ],
      groups: [
        {key:'target_hits', target:[12,18,24]},
        {key:'no_wrong_group', target:[0]},
        {key:'score_reach', target:[160,240,320]}
      ],
      hydration: [
        {key:'hold_ok_sec', target:[15,20,30]},
        {key:'no_overflow', target:[0]},
        {key:'score_reach', target:[150,220,300]}
      ],
      plate: [
        {key:'perfect_plates', target:[1,2,3]},
        {key:'no_over_quota', target:[0]},
        {key:'score_reach', target:[180,260,340]}
      ]
    };
  }

  _rand(arr){ return arr[(Math.random()*arr.length)|0]; }

  start(mode){
    const cand = this.pool[mode] || [{key:'score_reach', target:[200,260,320]}];
    const pick = this._rand(cand);
    const tgt  = this._rand(pick.target);
    return {key:pick.key, target:tgt, remainSec:45, done:false, success:false};
  }

  describe(m){
    const map = {
      collect_goods:t=>`เก็บของดีให้ครบ ${t} ชิ้น`,
      no_miss:     _=>`ห้ามพลาดสักครั้ง`,
      score_reach: t=>`ทำคะแนนให้ถึง ${t}`,
      target_hits: t=>`เก็บให้ตรงหมวด ${t} ครั้ง`,
      no_wrong_group:_=>`ห้ามเก็บผิดหมวด`,
      hold_ok_sec: t=>`อยู่โซนสมดุลน้ำ ${t}s`,
      no_overflow: _=>`ห้ามน้ำเกินโซน`,
      perfect_plates:t=>`ทำจานสมบูรณ์ ${t} จาน`,
      no_over_quota:_=>`ห้ามเกินโควตา`
    };
    return (map[m.key]||(()=>m.key))(m.target);
  }

  // เรียกทุกวินาทีจาก tick()
  evaluate(state, score, cb){
    if(!state.mission || state.mission.done) return;
    const m = state.mission; let ok=false, fail=false;

    switch(m.key){
      case 'collect_goods':   ok = (state.ctx.goodHits||0) >= m.target; break;
      case 'no_miss':         fail = (state.ctx.miss||0) > 0; break;
      case 'score_reach':     ok = score.score >= m.target; break;
      case 'target_hits':     ok = (state.ctx.targetHitsTotal||0) >= m.target; break;
      case 'no_wrong_group':  fail = (state.ctx.wrongGroup||0) > 0; break;
      case 'hold_ok_sec':
        if(state.modeKey==='hydration'){
          const z = state.hyd<state.hydMin?'low':(state.hyd>state.hydMax?'high':'ok');
          if(z==='ok') state.ctx.hydOkSec = (state.ctx.hydOkSec||0) + 1;
        }
        ok = (state.ctx.hydOkSec||0) >= m.target; break;
      case 'no_overflow':     fail = (state.ctx.overflow||0) > 0; break;
      case 'perfect_plates':  ok = (state.ctx.perfectPlates||0) >= m.target; break;
      case 'no_over_quota':   fail = (state.ctx.overfillCount||0) > 0; break;
    }

    if(ok){ m.done=true; m.success=true; cb?.({success:true}); }
    else if(fail){ m.done=true; m.success=false; cb?.({success:false}); }
  }
}
