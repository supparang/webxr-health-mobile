// === fitness/js/engine.js — Shadow Breaker Engine FX + Boss Phase v3 (2025-11-27b clean) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';

const BUILD_VERSION = 'sb-2025-11-27b';

// ---------- Utility ----------
const $ = (s)=>document.querySelector(s);
const clamp = (v,min,max)=>v<min?min:v>max?max:v;

// ---------- Config ----------
const DIFF_CONFIG = {
  easy:{ timeSec:60, spawnIntervalMs:1100, targetLifetimeMs:2200, baseSizePx:180 },
  normal:{ timeSec:60, spawnIntervalMs:900, targetLifetimeMs:2000, baseSizePx:150 },
  hard:{ timeSec:60, spawnIntervalMs:750, targetLifetimeMs:1700, baseSizePx:130 }
};

const BOSSES=[
  { id:0, name:'Bubble Glove', emoji:'🐣', title:'โฟกัสที่เป้าฟองแล้วตีให้ทัน', hp:100, spawnMultiplier:1.0 },
  { id:1, name:'Neon Knuckle', emoji:'⚡', title:'เป้าเริ่มเล็กลง เร็วขึ้น', hp:120, spawnMultiplier:0.9 },
  { id:2, name:'Shadow Guard', emoji:'🛡️', title:'มีเป้าลวงและระเบิด', hp:140, spawnMultiplier:0.8 },
  { id:3, name:'Final Burst', emoji:'💥', title:'โหมดโหดสุด คอมโบต่อเนื่อง!', hp:160, spawnMultiplier:0.7 }
];

// ---------- Helper FX ----------
function popupText(host, msg, cls=''){
  const el=document.createElement('div');
  el.className='sb-fx-score '+cls;
  el.textContent=msg;
  host.appendChild(el);
  setTimeout(()=>el.remove(),800);
}

// ---------- Engine ----------
class ShadowBreakerEngine {
  constructor(opts){
    this.diffKey=opts.diffKey||'normal';
    this.diffConf=DIFF_CONFIG[this.diffKey];
    this.renderer=opts.renderer;
    this.hooks=opts.hooks||{};
    this.wrap=opts.wrap||document.body;
    this.eventLogger=opts.eventLogger;
    this.sessionLogger=opts.sessionLogger;
    this.mode=opts.mode||'normal';
    this.reset();
    if(this.renderer) this.renderer.onTargetHit=(id,pos)=>this.handleHit(id,pos);
  }

  reset(){
    this.started=false; this.ended=false;
    this.phaseIndex=0; this.boss=BOSSES[0]; this.bossHP=this.boss.hp;
    this.playerHP=100; this.score=0; this.combo=0; this.maxCombo=0;
    this.missCount=0; this.totalTargets=0; this.targets=new Map();
  }

  start(){
    if(this.started)return;
    this.started=true;
    this.startTime=performance.now();
    this.nextSpawnAt=this.startTime+400;
    requestAnimationFrame(ts=>this.loop(ts));
    this._updateBossHUD();
  }

  loop(ts){
    if(this.ended)return;
    if(ts>=this.nextSpawnAt) this.spawn(ts);
    this._checkTimeouts(ts);
    this._updateHUD();
    requestAnimationFrame(t=>this.loop(t));
  }

  spawn(now){
    const d=this.diffConf;
    const id=++this.totalTargets;
    const t={
      id,
      boss_id:this.boss.id,
      boss_phase:this.phaseIndex+1,
      sizePx:d.baseSizePx*(1+(Math.random()*0.25-0.12)),
      lifeMs:d.targetLifetimeMs,
      expireTime:now+d.targetLifetimeMs,
      x_norm:Math.random(),
      y_norm:Math.random(),
      zone_lr:['L','C','R'][Math.floor(Math.random()*3)],
      zone_ud:['U','M','D'][Math.floor(Math.random()*3)],
      diffKey:this.diffKey
    };
    this.targets.set(id,t);
    this.renderer?.spawnTarget(t);
    this.nextSpawnAt=now+d.spawnIntervalMs;
  }

  _checkTimeouts(now){
    for(const [id,t] of this.targets){
      if(now>=t.expireTime){
        this._registerMiss(t);
        this.renderer?.removeTarget(id,'timeout');
        this.targets.delete(id);
      }
    }
  }

  handleHit(id,pos){
    const t=this.targets.get(id);
    if(!t)return;
    this.targets.delete(id);
    this.renderer?.removeTarget(id,'hit');

    const ratio=(performance.now()-t.expireTime+t.lifeMs)/t.lifeMs;
    let grade='good';
    if(ratio<=0.35) grade='perfect';
    else if(ratio>=0.9) grade='bad';

    const addScore = grade==='perfect'?120:grade==='good'?80:40;
    this.score+=addScore; this.combo++;
    if(this.combo>this.maxCombo) this.maxCombo=this.combo;
    this._damageBoss(grade==='perfect'?3:2);

    popupText(this.wrap, grade==='perfect'?`+${addScore} PERFECT!`:
                        grade==='good'?`+${addScore} GOOD`:
                        grade==='bad'?`+${addScore}`:'', grade);

    const fb=$('#sb-feedback');
    if(fb){ fb.textContent=
      grade==='perfect'?'สุดยอด! PERFECT 🎯':
      grade==='good'?'ดีมาก! 💪':
      grade==='bad'?'ช้าไปนิด 😅':'MISS!'; }

    this._updateHUD();
  }

  _registerMiss(t){
    this.missCount++; this.combo=0;
    popupText(this.wrap,'MISS!','miss');
    const fb=$('#sb-feedback'); if(fb) fb.textContent='พลาดจังหวะ!';
  }

  _damageBoss(amount){
    this.bossHP=clamp(this.bossHP-amount,0,this.boss.hp);
    this._updateBossHUD();
    if(this.bossHP<=0) this._nextBoss();
    else if(this.bossHP/this.boss.hp<=0.33){
      const wrap=$('#sb-wrap')||document.body;
      wrap.classList.add('sb-shake');
      setTimeout(()=>wrap.classList.remove('sb-shake'),300);
    }
  }

  _nextBoss(){
    if(this.phaseIndex<BOSSES.length-1){
      this.phaseIndex++;
      this.boss=BOSSES[this.phaseIndex];
      this.bossHP=this.boss.hp;
      this._updateBossHUD();
    } else {
      this._finish('all-boss-cleared');
    }
  }

  _finish(reason){
    this.ended=true;
    this.hooks.onEnd?.({reason,score:this.score,combo:this.maxCombo});
  }

  // ---------- HUD ----------
  _updateHUD(){
    const sEl=$('#stat-score'); if(sEl) sEl.textContent=this.score;
    const cEl=$('#stat-combo'); if(cEl) cEl.textContent=this.combo;
  }

  _updateBossHUD(){
    const ratio=this.bossHP/this.boss.hp;
    const bg=$('#sb-bg');
    if(bg){
      bg.classList.remove('bg-phase1','bg-phase2','bg-phase3');
      if(ratio>0.66) bg.classList.add('bg-phase1');
      else if(ratio>0.33) bg.classList.add('bg-phase2');
      else bg.classList.add('bg-phase3');
    }
    const label=$('#boss-phase-label');
    if(label){
      label.textContent = (ratio>0.66) ? 'BOSS PHASE I'
        : (ratio>0.33) ? 'BOSS PHASE II'
        : 'BOSS PHASE III';
    }
    const n=$('#boss-portrait-name'); if(n) n.textContent=this.boss.name;
    const h=$('#boss-portrait-hint'); if(h) h.textContent=this.boss.title;
    const e=$('#boss-portrait-emoji'); if(e) e.textContent=this.boss.emoji;
  }
}

// ---------- Init ----------
export function initShadowBreaker(){
  const wrap=$('#sb-wrap')||document.body;
  const target=$('#target-layer')||wrap;
  const renderer=new DomRenderer(target||wrap,{});
  const engine=new ShadowBreakerEngine({diffKey:'normal',renderer,wrap});
  const btn=$('[data-action="start-normal"]');
  if(btn) btn.addEventListener('click',()=>engine.start());
  console.log('[ShadowBreaker FX clean] ready');
}
