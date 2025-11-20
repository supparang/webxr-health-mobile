// === fitness/js/engine.js — Shadow Breaker core (2025-11-20 LAZY RENDERER) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';

/* ------------------------------------------------------------------ */
/*  CONFIG                                                            */
/* ------------------------------------------------------------------ */

const GAME_DURATION = 60; // วินาทีต่อรอบ

const DIFF_CONFIG = {
  easy: {
    spawnInterval: 950,
    targetLifetime: 1400,
    decoyRate: 0.14,
    baseBossHp: 80,
    playerDamageOnMiss: 4,
    feverGain: { perfect: 8, good: 5, bad: 3 },
    feverLossMiss: 10,
    sizePx: 110
  },
  normal: {
    spawnInterval: 800,
    targetLifetime: 1200,
    decoyRate: 0.22,
    baseBossHp: 110,
    playerDamageOnMiss: 6,
    feverGain: { perfect: 7, good: 4, bad: 2 },
    feverLossMiss: 12,
    sizePx: 96
  },
  hard: {
    spawnInterval: 650,
    targetLifetime: 1050,
    decoyRate: 0.28,
    baseBossHp: 140,
    playerDamageOnMiss: 8,
    feverGain: { perfect: 6, good: 3, bad: 2 },
    feverLossMiss: 14,
    sizePx: 84
  }
};

const BOSSES = [
  {
    id: 1,
    name: 'Bubble Glove',
    emoji: '🐣',
    title: 'บอสมือใหม่สายฟอง',
    desc: 'เป้าใหญ่ เด้งช้า เหมาะสำหรับวอร์มอัพ 🔰',
    theme: '#38bdf8'
  },
  {
    id: 2,
    name: 'Neon Knuckle',
    emoji: '🌀',
    title: 'หมัดนีออนสายสปีด',
    desc: 'เป้าเร็วขึ้น มีเป้าลวงคอยกวนสมาธิ 💫',
    theme: '#a855f7'
  },
  {
    id: 3,
    name: 'Shadow Guard',
    emoji: '🛡️',
    title: 'ผู้พิทักษ์เงา',
    desc: 'ต้องตีต่อเนื่อง ไม่งั้น HP ไม่ลดเท่าที่ควร 🛡️',
    theme: '#f97316'
  },
  {
    id: 4,
    name: 'Final Burst',
    emoji: '💀',
    title: 'บอสสุดท้ายสายระเบิด',
    desc: 'ช่วงท้ายจะ spawn เป้าเร็วมาก เน้นโหมด FEVER ⚡',
    theme: '#ef4444'
  }
];

const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const clamp = (v,a,b)=> v<a?a:(v>b?b:v);

function safePlay(id){
  const el=document.getElementById(id);
  if(!el) return;
  try{
    el.currentTime=0;
    const p=el.play();
    if(p && typeof p.catch==='function') p.catch(()=>{});
  }catch(e){}
}

/* ------------------------------------------------------------------ */
/*  CORE GAME CLASS                                                   */
/* ------------------------------------------------------------------ */

class ShadowBreakerGame {
  constructor() {
    // Views
    this.viewMenu   = $('#view-menu');
    this.viewForm   = $('#view-research-form');
    this.viewPlay   = $('#view-play');
    this.viewResult = $('#view-result');

    // HUD
    this.statMode    = $('#stat-mode');
    this.statDiff    = $('#stat-diff');
    this.statScore   = $('#stat-score');
    this.statHp      = $('#stat-hp');
    this.statCombo   = $('#stat-combo');
    this.statPerfect = $('#stat-perfect');
    this.statMiss    = $('#stat-miss');
    this.statTime    = $('#stat-time');

    // FEVER
    this.feverFill   = $('#fever-fill');
    this.feverStatus = $('#fever-status');

    // Boss HUD / portrait
    this.bossName   = $('#boss-name');
    this.bossFill   = $('#boss-fill');
    this.bossPortraitEmoji = $('#boss-portrait-emoji');
    this.bossPortraitName  = $('#boss-portrait-name');
    this.bossPortraitHint  = $('#boss-portrait-hint');
    this.bossPortraitBox   = $('#boss-portrait');

    // Boss intro overlay
    this.bossIntro       = $('#boss-intro');
    this.bossIntroEmoji  = $('#boss-intro-emoji');
    this.bossIntroName   = $('#boss-intro-name');
    this.bossIntroTitle  = $('#boss-intro-title');
    this.bossIntroDesc   = $('#boss-intro-desc');

    // Result
    this.resMode       = $('#res-mode');
    this.resDiff       = $('#res-diff');
    this.resEndReason  = $('#res-endreason');
    this.resScore      = $('#res-score');
    this.resMaxCombo   = $('#res-maxcombo');
    this.resMiss       = $('#res-miss');
    this.resAccuracy   = $('#res-accuracy');
    this.resTotalHits  = $('#res-totalhits');
    this.resRtNormal   = $('#res-rt-normal');
    this.resRtDecoy    = $('#res-rt-decoy');
    this.resParticipant= $('#res-participant');

    // Target layer + renderer (LAZY)
    this.targetLayer = $('#target-layer');
    this.renderer = null;
    if (this.targetLayer) {
      this.renderer = new DomRenderer(this, this.targetLayer, { sizePx: 96 });
    } else {
      console.warn('ShadowBreaker: #target-layer not found at init, will lazy attach.');
    }

    this.resetState();
    this.wireUI();
  }

  resetState() {
    this.mode = 'normal';
    this.diff = 'normal';
    this.config = DIFF_CONFIG.normal;

    this.running = false;
    this.ended   = false;
    this.timeLeft = GAME_DURATION;
    this._loopHandle = null;
    this._spawnTimer = null;
    this._startTime  = 0;

    this.playerHp = 100;
    this.score    = 0;
    this.combo    = 0;
    this.maxCombo = 0;
    this.perfect  = 0;
    this.miss     = 0;

    this.totalTargets = 0;
    this.hitCount     = 0;

    this.targets = new Map();
    this._nextTargetId = 1;

    this.fever  = 0;
    this.feverOn = false;
    this._feverTimeout = null;

    this.bossIndex = 0;
    this.currentBoss = BOSSES[0];
    this.bossHpMax = this.hpForBoss(0);
    this.bossHp    = this.bossHpMax;

    this.researchMeta = { participant:'', group:'', note:'' };
    this.hitLogs = [];
  }

  hpForBoss(idx){
    const base=this.config.baseBossHp;
    return Math.round(base*(1+idx*0.15));
  }

  wireUI() {
    const btnStartResearch = this.viewMenu.querySelector('[data-action="start-research"]');
    const btnStartNormal   = this.viewMenu.querySelector('[data-action="start-normal"]');

    btnStartResearch.addEventListener('click', () => {
      this.showView('research-form');
    });

    btnStartNormal.addEventListener('click', () => {
      this.mode = 'normal';
      this.startFromMenu();
    });

    const btnResearchBegin = this.viewForm.querySelector('[data-action="research-begin-play"]');
    const btnFormBack      = this.viewForm.querySelector('[data-action="back-to-menu"]');

    btnFormBack.addEventListener('click', () => {
      this.showView('menu');
    });

    btnResearchBegin.addEventListener('click', () => {
      const id    = $('#research-id').value.trim();
      const group = $('#research-group').value.trim();
      const note  = $('#research-note').value.trim();
      this.mode = 'research';
      this.researchMeta = { participant:id||'-', group:group||'-', note:note||'-' };
      this.startFromMenu();
    });

    const btnStopEarly = this.viewPlay.querySelector('[data-action="stop-early"]');
    btnStopEarly.addEventListener('click', () => {
      this.stopGame('หยุดก่อนเวลา');
    });

    const btnResultBack = this.viewResult.querySelector('[data-action="back-to-menu"]');
    const btnPlayAgain  = this.viewResult.querySelector('[data-action="play-again"]');
    const btnDownload   = this.viewResult.querySelector('[data-action="download-csv"]');

    btnResultBack.addEventListener('click', () => {
      this.showView('menu');
    });

    btnPlayAgain.addEventListener('click', () => {
      this.startFromMenu(true);
    });

    btnDownload.addEventListener('click', () => {
      this.downloadCsv();
    });

    this.bossIntro.addEventListener('pointerdown', () => {
      this.hideBossIntro();
    });

    window.addEventListener('keydown', (ev) => {
      if (!this.running) return;
      if (ev.key === ' ') {
        ev.preventDefault();
      }
    });
  }

  showView(name){
    this.viewMenu.classList.add('hidden');
    this.viewForm.classList.add('hidden');
    this.viewPlay.classList.add('hidden');
    this.viewResult.classList.add('hidden');
    this.bossIntro.classList.add('hidden');

    if (name==='menu') this.viewMenu.classList.remove('hidden');
    else if (name==='research-form') this.viewForm.classList.remove('hidden');
    else if (name==='play') this.viewPlay.classList.remove('hidden');
    else if (name==='result') this.viewResult.classList.remove('hidden');
  }

  startFromMenu(useSameDiff=false){
    if (!useSameDiff){
      const sel=$('#difficulty');
      this.diff=(sel && sel.value) || 'normal';
    }

    this.config = DIFF_CONFIG[this.diff] || DIFF_CONFIG.normal;
    this.resetState();
    this.config = DIFF_CONFIG[this.diff] || DIFF_CONFIG.normal;

    this.currentBoss = BOSSES[this.bossIndex];
    this.bossHpMax   = this.hpForBoss(this.bossIndex);
    this.bossHp      = this.bossHpMax;

    // resize target ตาม diff (ถ้ามี renderer แล้ว)
    if (this.renderer) {
      this.renderer.sizePx = this.config.sizePx;
    }

    this.statMode.textContent = this.mode === 'research' ? 'Research' : 'Normal';
    this.statDiff.textContent = this.diff;

    this.updateHUD();
    this.updateBossHUD();
    this.updateFeverHUD();

    this.showView('play');

    this.showBossIntro(this.currentBoss, {
      first:true,
      onDone: () => this.beginGameLoop()
    });
  }

  beginGameLoop(){
    if (this.running) return;
    this.running = true;
    this.ended   = false;
    this.timeLeft= GAME_DURATION;
    this._startTime = performance.now();

    if (this.renderer) this.renderer.clear();
    this.targets.clear();

    this._spawnTimer && clearInterval(this._spawnTimer);
    this._spawnTimer = setInterval(()=>this.spawnTarget(), this.config.spawnInterval);

    const loop = (t)=>{
      if (!this.running) return;
      const elapsed = (t - this._startTime)/1000;
      this.timeLeft = clamp(GAME_DURATION - elapsed, 0, GAME_DURATION);
      this.statTime.textContent = this.timeLeft.toFixed(1);
      if (this.timeLeft<=0){
        this.stopGame('หมดเวลา');
        return;
      }
      this._loopHandle = requestAnimationFrame(loop);
    };
    this._loopHandle = requestAnimationFrame(loop);
  }

  stopGame(reason){
    if (!this.running && this.ended) return;
    this.running=false;
    this.ended=true;

    this._spawnTimer && clearInterval(this._spawnTimer);
    this._spawnTimer=null;
    this._loopHandle && cancelAnimationFrame(this._loopHandle);
    this._loopHandle=null;
    this._feverTimeout && clearTimeout(this._feverTimeout);
    this._feverTimeout=null;

    if (this.renderer) this.renderer.clear();
    this.targets.clear();

    const totalShots = this.hitCount + this.miss;
    const accuracy   = totalShots>0 ? (this.hitCount/totalShots)*100 : 0;

    this.resMode.textContent      = this.mode==='research'?'วิจัย':'ปกติ';
    this.resDiff.textContent      = this.diff;
    this.resEndReason.textContent = reason||'-';
    this.resScore.textContent     = String(this.score);
    this.resMaxCombo.textContent  = String(this.maxCombo);
    this.resMiss.textContent      = String(this.miss);
    this.resAccuracy.textContent  = accuracy.toFixed(1)+' %';
    this.resTotalHits.textContent = String(this.hitCount);
    this.resRtNormal.textContent  = '-';
    this.resRtDecoy.textContent   = '-';
    this.resParticipant.textContent = this.researchMeta.participant || '-';

    this.showView('result');
  }

  /* ------------------ BOSS ------------------ */

  updateBossHUD(){
    const boss=this.currentBoss;
    if(!boss) return;
    this.bossName.textContent = `Boss ${boss.id}/4 — ${boss.name}`;
    this.bossPortraitEmoji.textContent = boss.emoji;
    this.bossPortraitName.textContent  = boss.name;
    this.bossPortraitHint.textContent  =
      `HP เหลือประมาณ ${Math.round((this.bossHp/this.bossHpMax)*100)}%`;

    const ratio=clamp(this.bossHp/this.bossHpMax,0,1);
    this.bossFill.style.transform = `scaleX(${ratio})`;
  }

  showBossIntro(boss,opts={}){
    if(!boss) return;
    this.bossIntroEmoji.textContent = boss.emoji;
    this.bossIntroName.textContent  = boss.name;
    this.bossIntroTitle.textContent = boss.title;
    this.bossIntroDesc.textContent  = boss.desc;
    this.bossIntro.classList.remove('hidden');
    this._introActive=true;
    this._introOnDone=opts.onDone || null;
    safePlay('sfx-boss');
  }

  hideBossIntro(){
    if(!this._introActive) return;
    this._introActive=false;
    this.bossIntro.classList.add('hidden');
    if(this._introOnDone){
      const fn=this._introOnDone;
      this._introOnDone=null;
      fn();
    }
  }

  advanceBoss(){
    this.bossIndex++;
    if(this.bossIndex>=BOSSES.length){
      this.stopGame('เคลียร์บอสครบทั้ง 4 ตัว!');
      return;
    }
    this.currentBoss = BOSSES[this.bossIndex];
    this.bossHpMax   = this.hpForBoss(this.bossIndex);
    this.bossHp      = this.bossHpMax;
    this.updateBossHUD();
    this.showBossIntro(this.currentBoss,{ onDone:()=>{} });
  }

  /* ------------------ FEVER ------------------ */

  updateFeverHUD(){
    const ratio=clamp(this.fever/100,0,1);
    this.feverFill.style.transform=`scaleX(${ratio})`;
    if(this.feverOn){
      this.feverStatus.textContent='FEVER!!';
      this.feverStatus.classList.add('on');
    }else{
      this.feverStatus.classList.remove('on');
      this.feverStatus.textContent = (ratio>=1)?'READY':'FEVER';
    }
  }

  addFever(kind){
    if(this.feverOn) return;
    const gain=this.config.feverGain[kind] || 3;
    this.fever = clamp(this.fever+gain,0,100);
    this.updateFeverHUD();
    if(this.fever>=100) this.triggerFever();
  }

  loseFeverOnMiss(){
    if(this.feverOn) return;
    this.fever = clamp(this.fever-this.config.feverLossMiss,0,100);
    this.updateFeverHUD();
  }

  triggerFever(){
    if(this.feverOn) return;
    this.feverOn=true;
    safePlay('sfx-fever');
    this.updateFeverHUD();
    this._feverTimeout && clearTimeout(this._feverTimeout);
    this._feverTimeout = setTimeout(()=>{
      this.feverOn=false;
      this.fever=40;
      this.updateFeverHUD();
    },7000);
  }

  /* ------------------ TARGETS ------------------ */

  spawnTarget(){
    if(!this.running) return;

    // LAZY attach renderer + host
    if(!this.renderer || !this.renderer.host){
      this.targetLayer = document.querySelector('#target-layer');
      if(this.targetLayer){
        this.renderer = new DomRenderer(this, this.targetLayer, {
          sizePx: this.config.sizePx || 96
        });
        console.info('ShadowBreaker: DomRenderer re-attached lazily.');
      }else{
        console.warn('ShadowBreaker: no #target-layer, skip spawn.');
        return;
      }
    }

    const id = this._nextTargetId++;
    const decoy = Math.random()<this.config.decoyRate;
    const now = performance.now();

    const t = {
      id,
      emoji: decoy ? '💣' : '🥊',
      decoy,
      createdAt: now,
      lifetime: this.config.targetLifetime,
      hit:false,
      dom:null
    };

    this.targets.set(id,t);
    this.totalTargets++;

    this.renderer.spawnTarget(t);

    setTimeout(()=>{
      const cur=this.targets.get(id);
      if(!cur || cur.hit) return;
      this.handleMiss(cur);
    }, this.config.targetLifetime+80);
  }

  registerTouch(x,y,targetId){
    if(!this.running) return;
    if(targetId==null) return;
    const t=this.targets.get(targetId);
    if(!t || t.hit) return;

    const now=performance.now();
    const age=now-t.createdAt;
    const life=this.config.targetLifetime;

    let grade='bad';
    if(age<=life*0.33) grade='perfect';
    else if(age<=life*0.66) grade='good';

    if(t.decoy) this.handleDecoyHit(t);
    else this.handleHit(t,grade,age);
  }

  handleHit(t,grade,ageMs){
    t.hit=true;
    this.targets.delete(t.id);
    if(this.renderer) this.renderer.removeTarget(t);

    let baseScore=0;
    if(grade==='perfect') baseScore=120;
    else if(grade==='good') baseScore=80;
    else baseScore=40;

    let dmg = grade==='perfect'?8:(grade==='good'?5:3);
    if(this.feverOn){
      baseScore=Math.round(baseScore*1.5);
      dmg=Math.round(dmg*1.8);
    }

    this.score+=baseScore;
    this.combo++;
    this.maxCombo=Math.max(this.maxCombo,this.combo);
    if(grade==='perfect') this.perfect++;
    this.hitCount++;

    this.addFever(grade==='perfect'?'perfect':'good');

    this.bossHp = clamp(this.bossHp-dmg,0,this.bossHpMax);
    this.updateBossHUD();

    if(this.renderer){
      this.renderer.spawnHitEffect(t,{
        grade,
        score:baseScore,
        fever:this.feverOn
      });
    }
    safePlay('sfx-hit');

    this.hitLogs.push({
      ts:(performance.now()-this._startTime)/1000,
      id:t.id,
      decoy:false,
      grade,
      ageMs
    });

    if(this.bossHp<=0){
      this.advanceBoss();
    }
    this.updateHUD();
  }

  handleDecoyHit(t){
    t.hit=true;
    this.targets.delete(t.id);
    if(this.renderer) this.renderer.removeTarget(t);

    this.score=Math.max(0,this.score-60);
    this.combo=0;
    this.playerHp=clamp(this.playerHp-10,0,100);
    this.miss++;
    this.loseFeverOnMiss();

    if(this.renderer){
      this.renderer.spawnHitEffect(t,{
        decoy:true,
        grade:'bad',
        score:-60
      });
    }
    safePlay('sfx-hit');

    this.hitLogs.push({
      ts:(performance.now()-this._startTime)/1000,
      id:t.id,
      decoy:true,
      grade:'bad'
    });

    if(this.playerHp<=0){
      this.updateHUD();
      this.stopGame('HP ผู้เล่นหมด');
      return;
    }
    this.updateHUD();
  }

  handleMiss(t){
    if(!this.targets.has(t.id) || t.hit) return;
    this.targets.delete(t.id);
    if(this.renderer) this.renderer.removeTarget(t);

    this.miss++;
    this.combo=0;
    this.playerHp=clamp(this.playerHp-this.config.playerDamageOnMiss,0,100);
    this.loseFeverOnMiss();

    if(this.renderer){
      this.renderer.spawnHitEffect(t,{ miss:true, score:0 });
    }
    safePlay('sfx-hit');

    this.hitLogs.push({
      ts:(performance.now()-this._startTime)/1000,
      id:t.id,
      decoy:t.decoy,
      grade:'miss'
    });

    if(this.playerHp<=0){
      this.updateHUD();
      this.stopGame('HP ผู้เล่นหมด');
      return;
    }
    this.updateHUD();
  }

  /* ------------------ HUD ------------------ */

  updateHUD(){
    this.statScore.textContent   = String(this.score);
    this.statHp.textContent      = String(this.playerHp);
    this.statCombo.textContent   = String(this.combo);
    this.statPerfect.textContent = String(this.perfect);
    this.statMiss.textContent    = String(this.miss);
  }

  /* ------------------ CSV (วิจัย) ------------------ */

  downloadCsv(){
    if(this.mode!=='research'){
      alert('การดาวน์โหลด CSV ใช้ในโหมดวิจัยเท่านั้น');
      return;
    }
    if(!this.hitLogs.length){
      alert('ยังไม่มีข้อมูลรอบเล่นสำหรับบันทึก');
      return;
    }
    const header=[
      'participant','group','note',
      'timestamp_s','target_id','is_decoy','grade','age_ms'
    ];
    const rows=[header.join(',')];
    for(const log of this.hitLogs){
      rows.push([
        JSON.stringify(this.researchMeta.participant || ''),
        JSON.stringify(this.researchMeta.group || ''),
        JSON.stringify(this.researchMeta.note || ''),
        log.ts.toFixed(3),
        log.id,
        log.decoy?1:0,
        log.grade,
        log.ageMs!=null?log.ageMs.toFixed(1):''
      ].join(','));
    }
    const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const pid=(this.researchMeta.participant || 'Pxxx').replace(/[^a-z0-9_-]/gi,'');
    a.href=url;
    a.download=`shadow-breaker-${pid}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/* ------------------------------------------------------------------ */
/*  PUBLIC INIT                                                       */
/* ------------------------------------------------------------------ */

export function initShadowBreaker(){
  const game=new ShadowBreakerGame();
  window.__shadowBreaker = game;
}
