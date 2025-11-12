// === /HeroHealth/game/main.js (2025-11-12 start wiring + autostart) ===
import { GameHub } from '../hub.js';
import * as goodjunk from '../modes/goodjunk.safe.js';

const $ = (s)=>document.querySelector(s);
const params = new URLSearchParams(location.search);
const mode = (params.get('mode')||'goodjunk').toLowerCase();
const diff = (params.get('diff')||'normal').toLowerCase();
const auto = params.get('autostart') === '1';

let hub;

function wireHUD(){
  window.addEventListener('hha:time', e=>{
    const sec = e?.detail?.sec ?? 0;
    // โชว์เวลาบนปุ่ม start ด้วย (ถ้ามี)
    const btn = $('#btnStart');
    if(btn) btn.textContent = sec>0?`เล่นอยู่ (${sec}s)`: 'เริ่มเกม';
  });
  window.addEventListener('hha:score', e=>{
    // ถ้าคุณมีตัวอัปเดตคะแนน/คอมโบ ให้ผูกที่นี่
  });
}

async function startGame(){
  const cfg = { difficulty: diff, duration: Number(params.get('time')||60) };
  if (mode === 'goodjunk') {
    const ctrl = await goodjunk.boot(cfg);
    // เริ่ม
    ctrl.start();
  } else {
    alert('โหมดนี้ยังไม่พร้อม: ' + mode);
  }
}

function bindStartButtons(){
  const vrBtn  = $('#vrStartBtn');
  const domBtn = $('#btnStart');
  const doStart = async()=>{
    try{
      // ปิดปุ่มซ้ำ
      domBtn && (domBtn.disabled = true);
      await startGame();
    }catch(err){
      console.error('[main] start error', err);
      domBtn && (domBtn.disabled = false);
    }
  };
  vrBtn  && vrBtn.addEventListener('click', (e)=>{ e.preventDefault(); doStart(); });
  domBtn && domBtn.addEventListener('click', (e)=>{ e.preventDefault(); doStart(); });

  if (auto) doStart(); // autostart=1
}

window.addEventListener('DOMContentLoaded', ()=>{
  try{ hub = new GameHub(); }catch(e){ console.warn('[main] hub optional', e); }
  wireHUD();
  bindStartButtons();
  console.log('[main] ready — mode=', mode, 'diff=', diff);
});
