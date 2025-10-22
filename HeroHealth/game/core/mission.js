// โหมด Challenge Mission 45s
export class MissionSystem{
  // เริ่มภารกิจตามโหมด
  start(mode){
    // ตัวอย่างภารกิจต่อโหมด
    const byMode = {
      goodjunk: { key:'collect_goods', target:30 },           // เก็บของดี 30 ชิ้น
      groups:   { key:'target_hits', target:18 },             // เก็บเข้าหมวดเป้าหมาย 18 ครั้ง
      hydration:{ key:'hold_ok_zone', target:20 },            // อยู่ในโซน ok รวม 20s
      plate:    { key:'perfect_plates', target:2 }            // ทำ Perfect Plate 2 ครั้ง
    };
    const cfg = byMode[mode] || { key:'score_reach', target:200 };
    return { ...cfg, remainSec:45, done:false, success:false };
  }

  // ประเมินผล (เรียกจาก tick)
  evaluate(state, score, cb){
    if(!state.mission || state.mission.done) return;
    const m = state.mission;
    let ok = false;

    switch(m.key){
      case 'collect_goods': ok = (state.ctx.goodHits||0) >= m.target; break;
      case 'target_hits':   ok = (state.ctx.targetHitsTotal||0) >= m.target; break;
      case 'hold_ok_zone':  ok = (state.ctx.hydOkSec||0) >= m.target; break;
      case 'perfect_plates':ok = (state.ctx.perfectPlates||0) >= m.target; break;
      case 'score_reach':   ok = score.score >= m.target; break;
    }

    // นับเวลาสำหรับ hold_ok_zone (เรียกทุก 1s จาก tick)
    if(state.modeKey==='hydration'){
      const z = (state.hyd<state.hydMin) ? 'low' : (state.hyd>state.hydMax ? 'high' : 'ok');
      if(z==='ok'){ state.ctx.hydOkSec = (state.ctx.hydOkSec||0) + 1; }
    }

    if(ok){
      m.done = true; m.success = true;
      cb?.({success:true, key:m.key});
    }
  }
}
