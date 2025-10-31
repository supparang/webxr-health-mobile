// === เพิ่ม import ด้านบนของ main.js ===
import { MissionSystem } from './core/mission-system.js';
import { createHUD } from './core/hud.js';            // ถ้าใช้ HUD รุ่นที่ผมให้ไป
import { Leaderboard } from './core/leaderboard.js';  // ถ้ามีบอร์ดคะแนน

// ... (โค้ดเดิมของคุณ) ...

// --------- Engine state ----------
let R = {
  playing:false, startedAt:0, remain:45, raf:0,
  sys:{ score:null, sfx:null },
  modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, hud:null, coach:null,
  ms:null,             // <-- MissionSystem instance
  board:null,          // <-- Leaderboard (ถ้าใช้)
  combo:0, maxCombo:0, miss:0
};

// สร้าง HUD (ถ้าใช้ core/hud.js)
const HUD = createHUD({
  onHome:  ()=>window.location.reload(),
  onReplay:()=>{ try{ R.ms?.reset(R.state); }catch{}; startGame(); }
});

// --------- Bus สำหรับส่ง event ไป MissionSystem ----------
function busFor(){
  return {
    sfx: R.sys.sfx,
    hit(e){ // {kind:'good'|'perfect'|'golden', points, ui:{x,y}, combo?}
      // คะแนน
      if (e?.points) R.sys.score.add(e.points);
      const cur = R.sys.score.get?.() || R.sys.score.value || 0;
      HUD.setScore(cur);

      // คอมโบ
      if (e?.kind) {
        R.combo = (e.kind === 'bad' ? 0 : (R.combo+1));
        R.maxCombo = Math.max(R.maxCombo, R.combo);
      }

      // FX pop score
      if (e?.ui) { /* แสดง +คะแนน */ }

      // โค้ช
      if (e?.kind === 'perfect') R.coach?.onPerfect();
      else if (e?.kind === 'good' || e?.kind === 'golden') R.coach?.onGood();

      // === ส่งให้ MissionSystem ===
      if (e?.kind === 'perfect') R.ms?.onEvent('perfect', {count:1}, R.state);
      else if (e?.kind === 'golden') R.ms?.onEvent('golden', {count:1}, R.state);
      else /* good ทั่วไป */ R.ms?.onEvent('good', {count:1}, R.state);

      if (R.combo) R.ms?.onEvent('combo', { value: R.combo }, R.state);
    },
    miss(){
      R.miss += 1; R.combo = 0;
      HUD.dimPenalty?.();
      R.ms?.onEvent('miss', {count:1}, R.state);
      R.ms?.onEvent('combo', { value: 0 }, R.state);
      R.coach?.onBad?.();
    }
  };
}

// --------- Main loop ----------
function gameTick(){
  if (!R.playing) return;
  const tNow = performance.now();

  // second tick
  const secGone = Math.floor((tNow - R._secMark)/1000);
  if (secGone >= 1){
    R.remain = Math.max(0, (R.remain|0) - secGone);
    R._secMark = tNow;
    HUD.setTime(R.remain);

    if (R.remain === 10) R.coach?.onTimeLow?.();

    // === Mission tick: อัปเดตชิปภารกิจบน HUD ===
    try {
      R.ms?.tick(
        R.state,
        { score: (R.sys.score.get?.() || 0) },
        (ev)=>{ /* cb เมื่อภารกิจสำเร็จ/ล้มเหลว ถ้าต้องการแจ้งเพิ่มเติม */ },
        { hud: HUD, coach: R.coach, lang: R.state?.lang || 'TH' }
      );
    } catch(e){}
  }

  // โหมดอัปเดต
  try {
    const dt = (tNow - (R._dtMark||tNow)) / 1000; R._dtMark = tNow;
    if (R.modeInst?.update) R.modeInst.update(dt, busFor());
    else if (R.modeAPI?.tick) R.modeAPI.tick(R.state||{}, R.sys, HUD||{});
  } catch(e){ console.warn('[mode.update] error', e); }

  if (R.remain <= 0) return endGame(false);
  R.raf = requestAnimationFrame(gameTick);
}

async function startGame(){
  if (window.HHA?._busy) return; window.HHA._busy = true;

  await loadCore();
  // …โหลด systems อื่น ๆ ตามเดิม…

  // === สร้าง MissionSystem & เริ่มชุดภารกิจ ===
  R.ms = new MissionSystem();
  const seconds = 45;               // ความยาวเกม
  const count   = 3;                // จำนวนภารกิจที่แสดงพร้อมกัน
  const lang    = (localStorage.getItem('hha_lang')||'TH').toUpperCase();
  const run     = R.ms.start(R.modeKey, { seconds, count, lang });
  R.state = R.state || {};
  R.ms.attachToState(run, R.state);

  // สร้าง Leaderboard (ถ้าใช้)
  R.board = new Leaderboard({ key: 'hha_board' });

  // รีเซ็ตคอมโบ/พลาด
  R.combo = 0; R.maxCombo = 0; R.miss = 0;

  // เคานต์ดาวน์/เริ่ม loop ตามเดิม…
  R.playing = true; R._secMark = performance.now(); R._dtMark = performance.now();
  R.remain = seconds;
  HUD.setTime(R.remain);
  document.body.setAttribute('data-playing','1');
  document.getElementById('menuBar')?.setAttribute('data-hidden','1');

  R.raf = requestAnimationFrame(gameTick);
}

function endGame(){
  if (!R.playing) return;
  R.playing = false; cancelAnimationFrame(R.raf);
  try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, HUD); } catch {}

  const finalScore = R.sys?.score?.get?.() || 0;
  const finalCombo = R.maxCombo|0;

  // บันทึกลงบอร์ด (ถ้าต้องการ)
  try { R.board?.submit(R.modeKey, (R.state?.difficulty||'Normal'), finalScore, { name: localStorage.getItem('hha_name')||'Player' }); } catch {}

  // สรุปผล + ปุ่ม Home/Replay
  HUD.showResult({
    score: finalScore,
    combo: finalCombo,
    time:  (R.remain|0),
    breakdown: { miss: R.miss, maxCombo: R.maxCombo },
    missions: (R.state?.missions||[]).map(m=>({ id:m.key, title: `${m.icon||'⭐'} ${R.ms.describe(m, R.state.lang)}`, done:m.done && m.success, note: `${m.progress|0}/${m.target|0}` }))
  });

  document.body.removeAttribute('data-playing');
  document.getElementById('menuBar')?.removeAttribute('data-hidden');
  window.HHA._busy = false;
}
