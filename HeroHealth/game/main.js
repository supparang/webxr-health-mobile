// ==== IMPORTS (เพิ่ม Progress) ====
import { Progress } from './core/progression.js';
import { PowerUpSystem } from './core/powerup.js';      // มีอยู่แล้วจากรอบก่อน
import { MissionSystem } from './core/mission-system.js'; // ถ้ายังไม่ได้ import
import { createHUD } from './core/hud.js';

// ==== STATE (เพิ่มตัวนับเพื่อคิด accuracy และเวลาที่เล่น) ====
let R = {
  playing:false, startedAt:0, remain:45, raf:0,
  sys:{ score:null, sfx:null },
  modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, hud:null, coach:null,
  ms:null, power:null,
  hits:0, miss:0, combo:0, maxCombo:0, _secAccum:0
};

// ==== อัปเดต bus ให้แจ้ง Progress ด้วย ====
function busFor(){
  return {
    sfx: R.sys.sfx,

    // เรียกเมื่อ "โดนเป้า" (ของดี/เพอร์เฟ็กต์/โกลเดน)
    hit(e){
      if (e?.points) R.sys.score.add(e.points);
      const cur = R.sys.score.get?.() || 0;
      R.hud?.updateScore?.(cur);

      // นับคอมโบ/ฮิต
      R.hits = (R.hits|0) + 1;
      R.combo = (R.combo|0) + 1;
      R.maxCombo = Math.max(R.maxCombo|0, R.combo|0);

      // แจ้ง Progress แบบเหตุการณ์
      Progress.notify('score_tick', { score: cur });
      Progress.notify('combo_best', { value: R.maxCombo|0 });
      if (e?.kind === 'perfect') Progress.notify('perfect');
      if (e?.kind === 'golden')  Progress.notify('golden');

      // FX ตามเดิม (มีอยู่แล้วก็ไม่ต้องซ้ำ)
      if (e?.ui) {
        FX.popText?.(`+${e.points|0}`, e.ui);
      }
    },

    // เมื่อพลาด (ปล่อยหมดอายุ/คลิกผิด ฯลฯ)
    miss(){
      // ลองกันด้วย shield ก่อน (PowerUp v3)
      if (R.power?.consumeShield?.()){
        R.hud?.updatePowerBar?.(R.power.getCombinedTimers());
        R.coach?.say?.(R.state?.lang==='EN' ? 'Shield saved!' : 'โล่ช่วยไว้!');
        return;
      }
      R.miss = (R.miss|0) + 1;
      R.combo = 0;
      R.hud?.dimPenalty?.();
      R.coach?.onBad?.();
    },

    // ให้โหมดเรียกใช้พาวเวอร์อัปได้
    power(kind, seconds){
      R.power?.apply?.(kind, seconds);
      R.hud?.updatePowerBar?.(R.power.getCombinedTimers());

      // นับ “FEVER-like” event เมื่อเปิด x2 (ใช้แทน trigger FEVER รายวัน)
      if (kind === 'x2') {
        Progress.notify('fever');
      }
    },

    // ภารกิจ (MissionSystem) เรียกเมื่อสำเร็จเพื่อสะสม daily “mission done” ในโหมดนั้น
    missionDone(){
      try{ Progress.addMissionDone(R.modeKey); }catch{}
    }
  };
}

// ==== เริ่มเกม ====
async function startGame(){
  await loadCore();
  Progress.init?.(); // โหลดโปรไฟล์/ภารกิจรายวัน
  const lang = (localStorage.getItem('hha_lang')||'TH').toUpperCase();
  const diff = (window.__HHA_DIFF || document.body.getAttribute('data-diff') || 'Normal');

  // แจ้งเริ่ม run → ใช้สำหรับ daily binding
  Progress.beginRun(R.modeKey, diff, lang);

  // Systems
  R.power = new PowerUpSystem();
  R.power.attachToScore(R.sys.score);
  R.power.onChange((t)=> R.hud?.updatePowerBar?.(t));
  R.hud?.updatePowerBar?.(R.power.getCombinedTimers());

  // MissionSystem เริ่ม (เหมือนรอบก่อน)
  if (!R.ms) R.ms = new MissionSystem();
  const run = R.ms.start(R.modeKey, { seconds:45, count:3, lang });
  R.state = R.ms.attachToState(run, (R.state||{}));

  // เคลียร์ตัวนับ
  R.hits=0; R.miss=0; R.combo=0; R.maxCombo=0;

  // เคานต์ดาวน์
  R.playing = true;
  R.startedAt = performance.now();
  R._secMark = performance.now();
  R._dtMark  = performance.now();
  R.remain = run.seconds|0;
  R.hud?.updateTime?.(R.remain);

  document.body.setAttribute('data-playing','1');
  document.getElementById('menuBar')?.setAttribute('data-hidden','1');
  R.raf = requestAnimationFrame(gameTick);
}

// ==== วนลูปหลัก (ผนวก tick → Progress + MissionSystem) ====
function gameTick(){
  if (!R.playing) return;
  const tNow = performance.now();

  // เดินวินาที
  const secGone = Math.floor((tNow - R._secMark)/1000);
  if (secGone >= 1){
    R.remain = Math.max(0, (R.remain|0) - secGone);
    R._secMark = tNow;
    R.hud?.updateTime?.(R.remain);

    // แจ้ง score ปัจจุบันให้ Progress เก็บ snapshot
    const cur = R.sys?.score?.get?.() || 0;
    Progress.notify('score_tick', { score: cur });

    // เดิน MissionSystem + HUD ชิป
    try{
      R.ms?.tick(
        R.state,
        { score: cur },
        (ev)=>{ if (ev?.success) busFor().missionDone(); }, // สำเร็จภารกิจ → นับ missionDone
        { hud: R.hud, coach: R.coach, lang: R.state?.lang || 'TH' }
      );
    }catch{}
  }

  // อัปเดตโหมด (เคารพ freeze)
  const frozen = R.power?.isFrozen?.();
  const dt = (tNow - (R._dtMark||tNow)) / 1000; R._dtMark = tNow;
  if (!frozen){
    try{
      if (R.modeInst?.update) R.modeInst.update(dt, busFor());
      else if (R.modeAPI?.tick) R.modeAPI.tick(R.state||{}, R.sys, R.hud||{});
    }catch(e){ console.warn('[mode.update]', e); }
  }

  if (R.remain <= 0) return endGame(false);
  R.raf = requestAnimationFrame(gameTick);
}

// ==== จบเกม → คิด accuracy + แจ้ง Progress.endRun ====
function endGame(){
  if (!R.playing) return;
  R.playing = false;
  cancelAnimationFrame(R.raf);

  const score = R.sys?.score?.get?.() || 0;
  const hits  = R.hits|0;
  const miss  = R.miss|0;
  const total = Math.max(1, hits + miss);
  const acc   = Math.round((hits/total)*100);

  try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, R.hud); }catch{}

  // แจ้งปิดรอบให้ Progress (จะนับ Daily: runs_any_2, score_ge_400, combo_ge_15, acc_ge_70 ฯลฯ อัตโนมัติ)
  Progress.endRun({ score, bestCombo: R.maxCombo|0, timePlayed: ((performance.now()-R.startedAt)|0), acc });

  // แสดงสรุปผล (HUD)
  R.hud?.showResult?.({
    score, combo:R.maxCombo|0, time:R.remain|0,
    missions: (R.state?.missions||[]).map(m=>({
      id:m.key, title:`${m.icon||'⭐'} ${m.key}`, done:m.done && m.success, note:`${m.progress|0}/${m.target|0}`
    }))
  });

  document.body.removeAttribute('data-playing');
  document.getElementById('menuBar')?.removeAttribute('data-hidden');
  window.HHA && (window.HHA._busy = false);
}
