// === fitness/js/engine.js — Shadow Breaker Engine FX + Boss Phase v3 (2025-11-27 full) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';

const BUILD_VERSION = 'sb-2025-11-27';

// ---------- Utilities ----------
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const clamp = (v,min,max)=>v<min?min:v>max?max:v;
const randChoice = (a)=>a[Math.floor(Math.random()*a.length)];

// ---------- Config ----------
const DIFF_CONFIG = {
  easy:{ key:'easy', label:'Easy', timeSec:60, spawnIntervalMs:1100, targetLifetimeMs:2200, baseSizePx:180 },
  normal:{ key:'normal', label:'Normal', timeSec:60, spawnIntervalMs:900, targetLifetimeMs:2000, baseSizePx:150 },
  hard:{ key:'hard', label:'Hard', timeSec:60, spawnIntervalMs:750, targetLifetimeMs:1700, baseSizePx:130 }
};

const BOSSES=[
  {id:0,name:'Bubble Glove',emoji:'🐣',title:'โฟกัสที่เป้าฟองแล้วตีให้ทัน',hp:100,spawnMultiplier:1.0},
  {id:1,name:'Neon Knuckle',emoji:'⚡',title:'เป้าเริ่มเล็กขึ้น เร็วขึ้น',hp:120,spawnMultiplier:0.9},
  {id:2,name:'Shadow Guard',emoji:'🛡️',title:'มีเป้าลวงกับบอมบ์ แทรกมาบ่อยขึ้น',hp:140,spawnMultiplier:0.8},
  {id:3,name:'Final Burst',emoji:'💥',title:'โหมดโหดสุด คอมโบยาว ๆ ไปเลย',hp:160,spawnMultiplier:0.7}
];

// ---------- FX ----------
function spawnHitFX(host,pos,grade,score){
  if(!host) return;
  const fx=document.createElement('div');
  fx.className='sb-scorefx';
  fx.textContent=
    grade==='perfect'?`+${score} PERFECT!`:
    grade==='good'?`+${score} GOOD`:
    grade==='bad'?`+${score}`:
    grade==='miss'?'MISS!':'';
  fx.style.left=(pos?.x??window.innerWidth/2)+'px';
  fx.style.top=(pos?.y??window.innerHeight/2)+'px';
  host.appendChild(fx);
  setTimeout(()=>fx.remove(),650);
}

// ---------- Core ----------
class ShadowBreakerEngine{
  constructor(opts){
    this.diffKey=opts.diffKey||'normal';
    this.diffConf=DIFF_CONFIG[this.diffKey];
    this.renderer=opts.renderer;
    this.eventLogger=opts.eventLogger;
    this.sessionLogger=opts.sessionLogger;
    this.hooks=opts.hooks||{};
    this.wrap=opts.wrap||document.body;
    this.mode=opts.mode||'normal';
    this.participant=opts.participant||'';
    this.group=opts.group||'';
    this.note=opts.note||'';
    this.menuToPlayMs=opts.menuToPlayMs||0;
    this.sessionId=`SB_${Date.now()}_${Math.floor(Math.random()*9999)}`;
    this.resetState();
    if(this.renderer) this.renderer.onTargetHit=(id,pos)=>this.handleHit(id,pos);
  }

  resetState(){
    this.started=false;this.ended=false;
    this.phaseIndex=0;this.boss=BOSSES[0];this.bossHP=this.boss.hp;
    this.playerHP=100;this.score=0;this.combo=0;this.maxCombo=0;
    this.missCount=0;this.goodCount=0;this.perfectCount=0;this.badCount=0;
    this.totalTargets=0;this.totalHits=0;this.targets=new Map();
  }

  start(){
    if(this.started)return;
    this.started=true;
    this.startPerf=performance.now();
    this.nextSpawnAt=this.startPerf+500;
    const loop=(ts)=>{if(this.ended)return;this._tick(ts);requestAnimationFrame(loop);};
    requestAnimationFrame(loop);
    this._updateBossHUD();
  }

  stop(reason='manual'){if(!this.ended){this.ended=true;this.hooks.onEnd?.({reason,score:this.score});}}

  _tick(ts){
    if(ts>=this.nextSpawnAt)this._spawnTarget(ts);
    this._checkTimeouts(ts);
    this._updateHUD();
  }

  // ---------- Spawning ----------
  _spawnTarget(now){
    const diff=this.diffConf;const boss=this.boss;
    const r=Math.random();let type='normal';
    if(r>0.92)type='bomb';else if(r>0.85)type='decoy';
    const sizePx=diff.baseSizePx*(1+(Math.random()*0.25-0.12));
    const id=++this.totalTargets;
    const t={
      id,boss_id:boss.id,boss_phase:this.phaseIndex+1,type,
      spawnTime:now,lifeMs:diff.targetLifetimeMs,expireTime:now+diff.targetLifetimeMs,
      sizePx,spawn_interval_ms:diff.spawnIntervalMs,
      x_norm:Math.random(),y_norm:Math.random(),
      zone_lr:randChoice(['L','C','R']),zone_ud:randChoice(['U','M','D']),
      diffKey:this.diffKey
    };
    this.targets.set(id,t);
    this.renderer?.spawnTarget(t);
    this.nextSpawnAt=now+diff.spawnIntervalMs;
  }

  _checkTimeouts(now){
    for(const [id,t] of this.targets){
      if(now>=t.expireTime){this._registerMiss(t);this.renderer?.removeTarget(id,'timeout');this.targets.delete(id);}
    }
  }

  // ---------- Hit ----------
  handleHit(id,pos){
    const t=this.targets.get(id);if(!t)return;
    this.targets.delete(id);this.renderer?.removeTarget(id,'hit');
    const age=performance.now()-t.spawnTime;
    const ratio=clamp(age/t.lifeMs,0,1);
    let grade='good';
    if(ratio<=0.35)grade='perfect';else if(ratio>=0.9)grade='bad';
    const scoreDelta=grade==='perfect'?120:grade==='good'?80:40;
    this.score+=scoreDelta;this.combo++;if(this.combo>this.maxCombo)this.maxCombo=this.combo;
    this._damageBoss(grade==='perfect'?3:grade==='good'?2:1);
    spawnHitFX(this.wrap,pos,grade,scoreDelta);
    const fb=$('#sb-feedback');
    if(fb){fb.className='';fb.classList.add(grade);
      fb.textContent=grade==='perfect'?'สุดยอด! PERFECT 🎯':
                     grade==='good'?'ดีมาก! 💪':
                     grade==='bad'?'ช้าไปนิด 😅':'MISS!';}
    this._updateHUD();
  }

  _registerMiss(t){
    this.missCount++;this.combo=0;
    spawnHitFX(this.wrap,{x:window.innerWidth/2,y:window.innerHeight/2},'miss',0);
    const fb=$('#sb-feedback');if(fb){fb.className='miss';fb.textContent='MISS!';}
    this._updateHUD();
  }

  // ---------- Damage & Phase ----------
  _damageBoss(amount){
    this.bossHP=clamp(this.bossHP-amount,0,this.boss.hp);
    this._updateBossHUD();
    if(this.bossHP<=0)this._nextBoss();
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
    }else{
      this.stop('all-boss-cleared');
    }
  }

  // ---------- HUD ----------
  _updateHUD(){
    $('#stat-score')?.textContent=this.score;
    $('#stat-combo')?.textContent=this.combo;
  }

  _updateBossHUD(){
    const bg=$('#sb-bg');const label=$('#boss-phase-label');
    const ratio=this.bossHP/this.boss.hp;
    if(bg){
      bg.classList.remove('bg-phase1','bg-phase2','bg-phase3');
      if(ratio>0.66)bg.classList.add('bg-phase1');
      else if(ratio>0.33)bg.classList.add('bg-phase2');
      else bg.classList.add('bg-phase3');
    }
    if(label){
      label.textContent=ratio>0.66?'BOSS PHASE I':ratio>0.33?'BOSS PHASE II':'BOSS PHASE III';
    }
    const nameEl=$('#boss-portrait-name');
    const hintEl=$('#boss-portrait-hint');
    const emojiEl=$('#boss-portrait-emoji');
    if(nameEl)nameEl.textContent=this.boss.name;
    if(hintEl)hintEl.textContent=this.boss.title;
    if(emojiEl)emojiEl.textContent=this.boss.emoji;
  }
}

// ---------- Init ----------
export function initShadowBreaker(){
  const wrap=$('#sb-wrap')||document.body;
  const targetLayer=$('#target-layer')||wrap;
  const renderer=new DomRenderer(targetLayer||wrap,{});
  const btn=$('[data-action="start-normal"]');
  const engine=new ShadowBreakerEngine({
    diffKey:'normal',renderer,wrap,
    hooks:{onEnd:(s)=>alert('Game End!')}
  });
  btn?.addEventListener('click',()=>engine.start());
  console.log('[ShadowBreaker FX v3] Ready');
}
