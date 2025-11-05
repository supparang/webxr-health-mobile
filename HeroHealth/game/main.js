// === Hero Health — main.js (GoodJunk glue + Mission + BGM/Cheer) ===
import * as goodjunk from './modes/goodjunk.safe.js';

// ----- Safe picks (fallback ถ้าไม่มีคลาสเดิม) -----
const $ = (s)=>document.querySelector(s);
const HUD = (window.HUD)||class{
  setTimer(){} setScore(){} setCombo(){} setStatus(){}
  showMission(){} setMissionGoal(){} updateMission(){}
  showResult(o){ alert(o?.summary||'จบเกม'); }
};
const Coach = (window.Coach)||class{
  say(){} cheer(){} playBGM(){} stopBGM(){} sfx(){}
};
const SFX = (window.SFX)||class{
  static async init(){ return new SFX(); }
  play(){};
};

// ----- Init -----
let hud, coach, sfx, gj;
let mission = { goal: 25, good: 0, junk: 0 }; // 🎯 เป้าหมาย: คลิก GOOD ให้ครบ 25

async function boot(){
  hud = new HUD();
  coach = new Coach();
  sfx = await SFX.init();

  // แสดงมิชชันใน HUD (ถ้า HUD รองรับ)
  hud.setMissionGoal?.(mission.goal);
  hud.showMission?.(true);
  hud.updateMission?.(mission.good, mission.goal);

  // ปุ่มเริ่ม
  const startBtn = $('[data-action="start"]') || $('#startBtn');
  startBtn?.addEventListener('click', startGoodJunk);

  // Auto-start (ถ้าต้องการ)
  // startGoodJunk();
}

function startGoodJunk(){
  // รีเซ็ตมิชชัน/สกอร์
  mission.good = 0; mission.junk = 0;
  hud.updateMission?.(mission.good, mission.goal);
  hud.setScore?.(0); hud.setCombo?.(1); hud.setStatus?.('READY');

  // เตรียม host
  const host = document.getElementById('spawnHost') || document.getElementById('gameLayer') || document.querySelector('.game-wrap') || document.body;

  // BGM
  coach.playBGM?.('bgm_main');

  // Coach บิวด์อัพ
  coach.say?.('เริ่มภารกิจ: คลิกอาหารดีให้ครบ '+mission.goal+' ชิ้น!');

  // Mount โหมด
  gj = goodjunk.mount({
    host,
    hud,
    sfx: {
      pop: ()=>coach.sfx?.('pop'),
      boo: ()=>coach.sfx?.('boo')
    },
    onEvent: (ev)=>{
      switch(ev.type){
        case 'start':
          hud.setStatus?.('PLAY');
          break;
        case 'tick':
          // เวลาอัปเดตใน hud ผ่าน onUpdateHUD อยู่แล้ว
          break;
        case 'hit':
          if(ev.payload?.kind==='good'){
            mission.good++;
            hud.updateMission?.(mission.good, mission.goal);
            // Cheer ตาม milestone
            if(mission.good===5) coach.say?.('ดีมาก! เหลืออีก '+(mission.goal-mission.good));
            if(mission.good===15) coach.say?.('ใกล้ครึ่งหลังแล้ว รัว ๆ!');
            if(mission.good===mission.goal-5) coach.say?.('อีก 5 ชิ้นสุดท้าย สู้!');
            if(mission.good===mission.goal) coach.cheer?.('great'); // เคลียร์เป้าหมาย
          }else{
            mission.junk++;
            coach.say?.('ระวังของหวาน—คอมโบรีเซ็ต!');
          }
          break;
        case 'pause':
          coach.say?.('พักแป๊บ'); hud.setStatus?.('PAUSED'); coach.stopBGM?.();
          break;
        case 'resume':
          coach.say?.('ไปต่อ!'); hud.setStatus?.('PLAY'); coach.playBGM?.('bgm_main');
          break;
        case 'end':
          coach.stopBGM?.();
          showEnd(ev.payload);
          break;
      }
    }
  });

  gj.start();
}

function showEnd(res){
  const cleared = mission.good >= mission.goal;
  const stars = cleared ? (res.score>=300?5: (res.score>=220?4:3)) : (res.score>=160?2:1);
  coach.cheer?.(cleared?'victory':'okay');

  hud.showResult?.({
    mode:'goodjunk',
    score:res.score,
    time:res.time,
    stars,
    banner: cleared ? 'MISSION CLEAR' : 'TIME UP',
    details:{
      mission:{goal:mission.goal, good:mission.good, junk:mission.junk},
      maxCombo:res.maxCombo,
      good:res.hits.good,
      junk:res.hits.junk
    },
    summary: `ผลลัพธ์: ${cleared?'ผ่านภารกิจ':'ยังไม่ผ่าน'} | คะแนน ${res.score} | ⭐ ${stars} ดาว | ดี ${res.hits.good} | ขยะ ${res.hits.junk} | คอมโบสูงสุด x${res.maxCombo}`
  });
}

// start
boot();
