// === Hero Health Academy — game/main.js (unified for 4 modes; full screen, core-wired) ===
window.__HHA_BOOT_OK = 'main';

import { FX, Engine } from './core/engine.js';
import { createHUD } from './core/hud.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission-system.js';
import { Progress } from './core/progression.js';

// lazy: score/sfx stubs (ถ้า core/score.js, core/sfx.js ยังไม่พร้อม)
let ScoreSystem, SFXClass;
try { ({ ScoreSystem } = await import('./core/score.js')); }
catch { ScoreSystem = class{ constructor(){this.v=0; this._boostFn=null;} add(n){ this.v+=(this._boostFn?this._boostFn(n):n)|0; } get(){return this.v|0;} reset(){this.v=0;} setBoostFn(f){this._boostFn=f;} }; }
try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
catch { SFXClass = class{ play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

const MODE_PATH = (k)=> `./modes/${k}.js`;
async function loadMode(key){ return await import(MODE_PATH(key)); }

let R = {
  playing:false, startedAt:0, remain:45, raf:0,
  sys:{ score:null, sfx:null },
  modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, hud:null, coach:null,
  ms:null, power:null, combo:0, maxCombo:0, hits:0, miss:0
};

function busFor(){
  return {
    sfx:R.sys.sfx,
    hit(e){
      if(e?.points) R.sys.score.add(e.points);
      const sc = R.sys.score.get?.()||0;
      R.hud?.updateScore(sc);
      R.hits=(R.hits|0)+1; R.combo=(R.combo|0)+1; R.maxCombo=Math.max(R.maxCombo|0, R.combo|0);
      Progress.notify('score_tick', { score: sc });
      Progress.notify('combo_best', { value: R.maxCombo|0 });
      if(e?.kind==='perfect') Progress.notify('perfect');
      if(e?.kind==='golden'){ Progress.notify('golden'); R.power?.apply('x2'); }
      if(e?.ui) FX.popText(`+${e.points|0}`, e.ui);
    },
    miss(){
      if(R.power?.consumeShield()){
        R.hud?.updatePowerBar?.(R.power.getCombinedTimers());
        return;
      }
      R.miss=(R.miss|0)+1; R.combo=0;
      R.hud?.dimPenalty?.();
    },
    power(kind,sec){
      R.power?.apply(kind,sec);
      R.hud?.updatePowerBar?.(R.power.getCombinedTimers());
      if(kind==='sweep'){
        // เก็บของดีบนจอทั้งหมดทันที (soft auto-collect)
        document.querySelectorAll('#spawnHost .spawn-emoji').forEach(n=>{
          const rect=n.getBoundingClientRect();
          const isGood = n.dataset?.good==='1' || /[🥦🥕🍎🍌🥗🐟🥜🍚🍞🥛🍇🍓🍊🍅🍆🥬🥝🍍🍐🍑]/.test(n.textContent||'');
          try{ n.remove(); }catch{}
          if(isGood){
            R.sys.score.add(R.power?.getCombinedTimers?.().x2?200:100);
            const sc=R.sys.score.get?.()||0; R.hud?.updateScore(sc);
            FX.popText('+100', { x: rect.left+rect.width/2, y: rect.top+rect.height/2 });
            R.hits=(R.hits|0)+1; R.combo=(R.combo|0)+1; R.maxCombo=Math.max(R.maxCombo|0, R.combo|0);
            Progress.notify('score_tick', { score: sc }); Progress.notify('combo_best', { value: R.maxCombo|0 });
          }
        });
      }
    }
  };
}

async function startGame(){
  Progress.init?.();
  const lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase();
  const diff=(document.body.getAttribute('data-diff')||'Normal');
  R.modeKey = (document.body.getAttribute('data-mode')||'goodjunk');

  R.sys.score = new ScoreSystem(); R.sys.score.reset?.();
  R.sys.sfx   = new SFXClass();

  R.hud = createHUD({ onHome:()=>location.reload(), onReplay:()=>startGame() });
  new Engine(); // ensure canvas exists and never blocks click

  R.power = new PowerUpSystem();
  R.power.attachToScore(R.sys.score);
  R.power.onChange((t)=>R.hud?.updatePowerBar?.(t));
  R.hud?.updatePowerBar?.(R.power.getCombinedTimers());

  if(!R.ms) R.ms = new MissionSystem();
  const run = R.ms.start(R.modeKey, { seconds:45, count:3, lang });
  R.state = R.ms.attachToState(run, (R.state||{}));

  Progress.beginRun(R.modeKey, diff, lang);

  R.combo=0; R.maxCombo=0; R.hits=0; R.miss=0;
  R.playing = true; R.startedAt = performance.now();
  R._secMark = performance.now(); R._dtMark = performance.now();
  R.remain = run.seconds|0; R.hud?.updateTime(R.remain);

  document.body.setAttribute('data-playing','1');
  document.getElementById('menuBar')?.setAttribute('data-hidden','1');

  // load mode
  try{
    const mod = await loadMode(R.modeKey);
    // โมดูลรองรับทั้งแบบ start/update/stop หรือ factory create()
    if (mod.create){
      R.modeInst = mod.create({ hud:R.hud });
      R.modeInst.start?.({ difficulty: diff, lang });
    } else if (mod.start){
      R.modeInst = mod; R.modeInst.start({ difficulty: diff, lang });
    }
  }catch(e){
    console.error('Failed to load mode', R.modeKey, e);
    alert('Failed to load mode: '+R.modeKey);
    R.playing=false; return;
  }

  R.raf = requestAnimationFrame(gameTick);
}

function gameTick(){
  if(!R.playing) return;
  const now = performance.now();

  const secGone = Math.floor((now - R._secMark)/1000);
  if (secGone >=1){
    R.remain = Math.max(0, (R.remain|0) - secGone);
    R._secMark = now; R.hud?.updateTime(R.remain);
    // missions
    const sc = R.sys.score.get?.()||0;
    try{
      R.ms?.tick(R.state, { score: sc }, (ev)=>{ if(ev?.success){ /* optionally: toast */ } }, { hud:R.hud, lang:(localStorage.getItem('hha_lang')||'TH') });
    }catch{}
  }

  const frozen = R.power?.isFrozen?.();
  const dt = (now - (R._dtMark||now))/1000; R._dtMark = now;
  if (!frozen){
    try{
      if (R.modeInst?.update) R.modeInst.update(dt, busFor());
      else if (R.modeInst?.tick) R.modeInst.tick(dt, busFor());
    }catch(e){ console.warn('[mode.update]', e); }
  }

  if (R.remain <= 0) return endGame();
  R.raf = requestAnimationFrame(gameTick);
}

function endGame(){
  if(!R.playing) return;
  R.playing=false; cancelAnimationFrame(R.raf);
  try{ R.modeInst?.stop?.(); }catch{}
  const score = R.sys.score.get?.()||0;
  const hits  = R.hits|0; const miss = R.miss|0; const tot=Math.max(1,hits+miss);
  const acc = Math.round((hits/tot)*100);
  Progress.endRun({ score, bestCombo:R.maxCombo|0, timePlayed:((performance.now()-R.startedAt)|0), acc });
  R.hud?.showResult({ score, combo:R.maxCombo|0 });
  document.body.removeAttribute('data-playing');
  document.getElementById('menuBar')?.removeAttribute('data-hidden');
}

(function bindStartStrong(){
  const b=document.getElementById('btn_start');
  if(!b) return;
  const clone=b.cloneNode(true);
  b.parentNode.replaceChild(clone,b);
  clone.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); }, {capture:true});
})();
// ----- Imports (ด้านบนไฟล์ main.js) -----
import { sfx as SFX } from './core/sfx.js';
import { PowerUpSystem } from './core/powerup.js';
// ...imports อื่น ๆ

// ----- Boot/SFX binding (หลังสร้าง engine แล้ว) -----
engine.sfx = SFX;
// ชุดไอดีที่ใช้ (ถ้าคุณเพิ่ม/ลดไฟล์ สามารถปรับลิสต์ได้)
SFX.loadIds(['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup']);
SFX.setVolume(0.9); // ตามชอบ 0..1

// ปุ่มเปิด/ปิดเสียงในเมนู (ถ้ามี)
const btnSound = document.querySelector('[data-action="sound"]');
if (btnSound){
  const sync = () => btnSound.setAttribute('aria-pressed', SFX.isEnabled() ? 'true' : 'false');
  sync();
  btnSound.addEventListener('click', () => { SFX.setEnabled(!SFX.isEnabled()); sync(); }, { passive:true });
}

// ตัวอย่าง: ผูก PowerUp → เล่นเสียงตอนรับบัฟ
const power = new PowerUpSystem();
power.onChange((t) => {
  // ติดไฟบัฟครั้งแรก หรือกดได้สกิลใหม่
  if ((t?.x2|0)===1 || (t?.sweep|0)===1 || (t?.shield|0)===1) {
    engine.sfx?.power();
  }
});
