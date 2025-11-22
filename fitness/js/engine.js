// === js/engine.js — Shadow Breaker core (2025-11-24 Research-Ready v2 + SFX) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';

/* ------------------------------------------------------------------ */
/*  CONFIG                                                            */
/* ------------------------------------------------------------------ */

const DIFF_CONFIG = {
  easy: {
    label: 'easy',
    duration: 45,
    spawnInterval: 1100,
    targetLifetime: 1600,
    decoyRate: 0.12,
    baseBossHp: 80,
    playerDamageOnMiss: 4,
    feverGain: { perfect: 9, good: 6, bad: 3 },
    feverLossMiss: 8,
    sizePx: 130
  },
  normal: {
    label: 'normal',
    duration: 60,
    spawnInterval: 850,
    targetLifetime: 1250,
    decoyRate: 0.2,
    baseBossHp: 110,
    playerDamageOnMiss: 6,
    feverGain: { perfect: 7, good: 4, bad: 2 },
    feverLossMiss: 11,
    sizePx: 100
  },
  hard: {
    label: 'hard',
    duration: 75,
    spawnInterval: 600,
    targetLifetime: 950,
    decoyRate: 0.28,
    baseBossHp: 140,
    playerDamageOnMiss: 8,
    feverGain: { perfect: 6, good: 3, bad: 2 },
    feverLossMiss: 14,
    sizePx: 86
  }
};

const BOSSES = [
  {
    id: 1,
    name: 'Bubble Glove',
    emoji: '🐣',
    title: 'บอสมือใหม่สายฟอง',
    desc: 'เป้าใหญ่ เด้งช้า เหมาะสำหรับวอร์มอัพ 🔰'
  },
  {
    id: 2,
    name: 'Neon Knuckle',
    emoji: '🌀',
    title: 'หมัดนีออนสายสปีด',
    desc: 'เป้าเร็วขึ้น มีเป้าลวงคอยกวนสมาธิ 💫'
  },
  {
    id: 3,
    name: 'Shadow Guard',
    emoji: '🛡️',
    title: 'ผู้พิทักษ์เงา',
    desc: 'ต้องตีต่อเนื่อง ไม่งั้น HP ไม่ลดเท่าที่ควร 🛡️'
  },
  {
    id: 4,
    name: 'Final Burst',
    emoji: '💀',
    title: 'บอสสุดท้ายสายระเบิด',
    desc: 'ช่วงท้ายจะ spawn เป้าเร็วมาก เน้นโหมด FEVER ⚡'
  }
];

const $  = (s) => document.querySelector(s);
const clamp = (v,a,b)=> v<a?a:(v>b?b:v);

/* --- SFX helper ---------------------------------------------------- */

function playSfx(name, opts){
  if (window.SFX && typeof window.SFX.play === 'function'){
    window.SFX.play(name, opts || {});
  }
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
    this.wrap       = $('#sb-wrap');

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
    this.hpBossVal  = $('#hp-boss-val');
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

    // Feedback bubble
    this.feedbackEl = $('#sb-feedback');
    this._feedbackTimer = null;

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
    this.resGrade      = $('#res-grade');

    // Target layer + renderer (LAZY)
    this.targetLayer = $('#target-layer');
    this.renderer = null;
    if (this.targetLayer) {
      this.renderer = new DomRenderer(this, this.targetLayer, { sizePx: 100 });
    }

    this.resetState();
    this.wireUI();
  }

  resetState() {
    this.mode = 'normal';
    this.diff = 'normal';
    this.config = DIFF_CONFIG.normal;
    this.gameDuration = this.config.duration;

    this.running = false;
    this.ended   = false;
    this.timeLeft = this.gameDuration;
    this._loopHandle = null;
    this._spawnTimer = null;
    this._startTime  = 0;

    this.playerHp = 100;
    this.score    = 0;
    this.combo    = 0;
    this.maxCombo = 0;
    this.perfect  = 0;
    this.miss     = 0;
    this.bombHits = 0;

    this.totalTargets = 0;
    this.hitCount     = 0;

    this.targets = new Map();
    this._nextTargetId = 1;

    this.fever    = 0;
    this.feverOn  = false;
    this.feverUse = 0;
    this._feverTimeout = null;

    this.bossIndex = 0;
    this.currentBoss = BOSSES[0];
    this.bossHpMax = this.hpForBoss(0);
    this.bossHp    = this.bossHpMax;

    this.researchMeta = { participant:'', group:'', note:'' };
    this.hitLogs = [];

    if(this.wrap){
      this.wrap.dataset.diff  = this.diff;
      this.wrap.dataset.boss  = String(this.bossIndex);
      this.wrap.dataset.phase = '1';
    }
  }

  hpForBoss(idx){
    const base=this.config.baseBossHp;
    return Math.round(base*(1+idx*0.15));
  }

  wireUI() {
    // menu
    const btnStartResearch = this.viewMenu.querySelector('[data-action="start-research"]');
    const btnStartNormal   = this.viewMenu.querySelector('[data-action="start-normal"]');

    btnStartResearch.addEventListener('click', () => {
      this.showView('research-form');
    });

    btnStartNormal.addEventListener('click', () => {
      this.mode = 'normal';
      this.startFromMenu();
    });

    // research form
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

    // play view controls
    const btnStopEarly = this.viewPlay.querySelector('[data-action="stop-early"]');
    btnStopEarly.addEventListener('click', () => {
      this.stopGame('หยุดก่อนเวลา');
    });

    // result view controls
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

    // boss intro
    this.bossIntro.addEventListener('pointerdown', () => {
      this.hideBossIntro();
    });

    // prevent space scroll
    window.addEventListener('keydown', (ev) => {
      if (!this.running) return;
      if (ev.key === ' ') ev.preventDefault();
    });
  }

  /* ------------------ View switch ------------------ */

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

  /* ------------------ Feedback bubble ------------------ */

  setFeedback(kind){
    if(!this.feedbackEl) return;
    let text = '';
    let cls  = '';

    switch(kind){
      case 'perfect':
        text = 'ตรงเป๊ะ! ⭐';
        cls  = 'perfect';
        break;
      case 'good':
        text = 'ใกล้แล้ว! 😀';
        cls  = 'good';
        break;
      case 'miss':
        text = 'พลาดเป้า! ลองใหม่ 😅';
        cls  = 'miss';
        break;
      case 'bomb':
        text = 'โดนระเบิด! -60 คะแนน -10 HP 💥';
        cls  = 'bomb';
        break;
      case 'heal':
        text = 'ชนะบอส! ฟื้น HP +20 💙';
        cls  = 'heal';
        break;
      default:
        text = 'โฟกัสที่เป้าตรงกลางจอ แล้วตีให้ทันนะ 🎯';
        cls  = '';
    }

    this.feedbackEl.textContent = text;
    this.feedbackEl.classList.remove('good','perfect','miss','bomb','heal');
    if (cls) this.feedbackEl.classList.add(cls);

    if(this._feedbackTimer){
      clearTimeout(this._feedbackTimer);
      this._feedbackTimer = null;
    }
    if(kind && kind!=='heal'){
      this._feedbackTimer = setTimeout(()=>{
        this.setFeedback('');
      }, 1400);
    }
  }

  /* ------------------ Start / loop ------------------ */

  startFromMenu(useSameDiff=false){
    if (!useSameDiff){
      const sel=$('#difficulty');
      this.diff=(sel && sel.value) || 'normal';
    }

    this.config = DIFF_CONFIG[this.diff] || DIFF_CONFIG.normal;
    this.gameDuration = this.config.duration;

    // reset core state (ไม่ยุ่ง researchMeta)
    this.running = false;
    this.ended   = false;
    this.timeLeft = this.gameDuration;
    this._loopHandle = null;
    this._spawnTimer = null;
    this._startTime  = 0;

    this.playerHp = 100;
    this.score    = 0;
    this.combo    = 0;
    this.maxCombo = 0;
    this.perfect  = 0;
    this.miss     = 0;
    this.bombHits = 0;

    this.totalTargets = 0;
    this.hitCount     = 0;

    this.targets = new Map();
    this._nextTargetId = 1;

    this.fever    = 0;
    this.feverOn  = false;
    this.feverUse = 0;
    this._feverTimeout && clearTimeout(this._feverTimeout);
    this._feverTimeout = null;

    this.bossIndex = 0;
    this.currentBoss = BOSSES[0];
    this.bossHpMax   = this.hpForBoss(this.bossIndex);
    this.bossHp      = this.bossHpMax;

    this.hitLogs = [];

    if(this.wrap){
      this.wrap.dataset.diff  = this.diff;
      this.wrap.dataset.boss  = String(this.bossIndex);
      this.wrap.dataset.phase = '1';
    }

    if (this.renderer) {
      this.renderer.sizePx = this.config.sizePx;
    }

    this.statMode.textContent = this.mode === 'research' ? 'Research' : 'Normal';
    this.statDiff.textContent = this.diff;

    this.updateHUD();
    this.updateBossHUD();
    this.updateFeverHUD();
    this.setFeedback('');

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
    this.timeLeft= this.gameDuration;
    this._startTime = performance.now();

    if (this.renderer) this.renderer.clear();
    this.targets.clear();

    this._spawnTimer && clearInterval(this._spawnTimer);
    this._spawnTimer = setInterval(()=>this.spawnTarget(), this.config.spawnInterval);

    const loop = (t)=>{
      if (!this.running) return;
      const elapsed = (t - this._startTime)/1000;
      this.timeLeft = clamp(this.gameDuration - elapsed, 0, this.gameDuration);
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

    // analytics RT
    let sumRtNormal=0, cntRtNormal=0;
    let sumRtDecoy=0,  cntRtDecoy=0;

    for(const log of this.hitLogs){
      if(log.event_type!=='hit') continue;
      if(log.decoy){
        if(log.age_ms!=null){
          sumRtDecoy += log.age_ms;
          cntRtDecoy++;
        }
      }else{
        if(log.age_ms!=null){
          sumRtNormal += log.age_ms;
          cntRtNormal++;
        }
      }
    }

    const avgRtNormal = cntRtNormal ? (sumRtNormal/cntRtNormal) : 0;
    const avgRtDecoy  = cntRtDecoy  ? (sumRtDecoy/cntRtDecoy)  : 0;

    // Grade
    const grade = this.computeGrade({
      accuracy,
      score: this.score,
      miss : this.miss,
      bombs: this.bombHits,
      diff : this.diff
    });

    this.resMode.textContent      = this.mode==='research'?'วิจัย':'ปกติ';
    this.resDiff.textContent      = this.diff;
    this.resEndReason.textContent = reason||'-';
    this.resScore.textContent     = String(this.score);
    this.resMaxCombo.textContent  = String(this.maxCombo);
    this.resMiss.textContent      = String(this.miss);
    this.resAccuracy.textContent  = accuracy.toFixed(1)+' %';
    this.resTotalHits.textContent = String(this.hitCount);
    this.resRtNormal.textContent  = cntRtNormal ? (avgRtNormal.toFixed(0)+' ms') : '-';
    this.resRtDecoy.textContent   = cntRtDecoy  ? (avgRtDecoy.toFixed(0)+' ms')  : '-';
    this.resParticipant.textContent = this.researchMeta.participant || '-';
    if(this.resGrade){
      this.resGrade.textContent = grade;
    }

    this.showView('result');
  }

  /* ------------------ Grade logic ------------------ */

  computeGrade({accuracy, score, miss, bombs, diff}){
    const acc = accuracy || 0;
    const penalty = miss + bombs*1.5;
    const baseScore = score - penalty*10;

    let grade = 'C';

    if(acc >= 95 && baseScore >= 5000){
      grade = 'SSS';
    }else if(acc >= 92 && baseScore >= 4200){
      grade = 'SS';
    }else if(acc >= 88 && baseScore >= 3500){
      grade = 'S';
    }else if(acc >= 80 && baseScore >= 2600){
      grade = 'A';
    }else if(acc >= 70){
      grade = 'B';
    }

    if(diff==='hard' && grade!=='SSS'){
      const order = ['C','B','A','S','SS','SSS'];
      const idx = order.indexOf(grade);
      if(idx>0) grade = order[idx+1] || grade;
    }

    return grade;
  }

  /* ------------------ BOSS ------------------ */

  updateBossHUD(){
    const boss=this.currentBoss;
    if(!boss) return;

    if (this.wrap) {
      this.wrap.dataset.boss = String(this.bossIndex);
    }

    const ratio=clamp(this.bossHp/this.bossHpMax,0,1);
    let phase = 1;
    if(ratio <= 0.33) phase = 3;
    else if(ratio <= 0.66) phase = 2;
    if(this.wrap){
      this.wrap.dataset.phase = String(phase);
    }

    this.bossName.textContent = `Boss ${boss.id}/4 — ${boss.name}`;
    this.bossPortraitEmoji.textContent = boss.emoji;
    this.bossPortraitName.textContent  = boss.name;
    this.bossPortraitHint.textContent  =
      `HP เหลือประมาณ ${Math.round(ratio*100)}%`;

    this.bossFill.style.transform = `scaleX(${ratio})`;
    this.hpBossVal.textContent    = Math.round(ratio*100) + '%';

    if (ratio <= 0.25) {
      this.bossPortraitBox.classList.add('sb-shake');
    } else {
      this.bossPortraitBox.classList.remove('sb-shake');
    }
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
    playSfx('boss', { group:'boss', baseVolume:0.9, intensity:1.0, baseRate:1.0 });
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

  onBossDefeated(){
    const heal = 20;
    this.playerHp = clamp(this.playerHp + heal, 0, 100);
    this.setFeedback('heal');
    this.updateHUD();

    this.bossIndex++;
    if(this.bossIndex>=BOSSES.length){
      this.stopGame('เคลียร์บอสครบทั้ง 4 ตัว!');
      return;
    }
    this.currentBoss = BOSSES[this.bossIndex];
    this.bossHpMax   = this.hpForBoss(this.bossIndex);
    this.bossHp      = this.bossHpMax;

    if(this.wrap){
      this.wrap.dataset.boss  = String(this.bossIndex);
      this.wrap.dataset.phase = '1';
    }

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
    this.feverUse++;
    playSfx('fever', { group:'fever', baseVolume:0.85, intensity:1.0, baseRate:1.05 });
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

    if(!this.renderer || !this.renderer.host){
      this.targetLayer = document.querySelector('#target-layer');
      if(this.targetLayer){
        this.renderer = new DomRenderer(this, this.targetLayer, {
          sizePx: this.config.sizePx || 100
        });
      }else{
        console.warn('ShadowBreaker: no #target-layer, skip spawn.');
        return;
      }
    }

    const id = this._nextTargetId++;

    const hpRatio = this.bossHpMax > 0 ? this.bossHp / this.bossHpMax : 1;
    let bossFace = false;
    let decoy    = false;

    if (hpRatio <= 0.25 && Math.random() < 0.35) {
      bossFace = true;
    } else {
      decoy = Math.random() < this.config.decoyRate;
    }

    const emoji = bossFace
      ? (this.currentBoss?.emoji || '😈')
      : (decoy ? '💣' : '🥊');

    const now = performance.now();
    const t = {
      id,
      emoji,
      decoy,
      bossFace,
      createdAt: now,
      lifetime: this.config.targetLifetime,
      hit:false,
      _el:null,
      _onPtr:null
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

    if(t.decoy) this.handleDecoyHit(t,age);
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

    if (t.bossFace) {
      baseScore = Math.round(baseScore * 1.6);
      dmg       = Math.round(dmg * 1.8);
    }

    if(this.feverOn){
      baseScore=Math.round(baseScore*1.5);
      dmg=Math.round(dmg*1.5);
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
        fever:this.feverOn,
        bossFace: t.bossFace
      });
    }

    this.setFeedback(grade==='perfect' ? 'perfect' : 'good');

    const intensity = grade==='perfect' ? 1.0 : (grade==='good' ? 0.75 : 0.55);
    playSfx('hit', {
      group:'hit',
      intensity,
      baseVolume:0.8,
      baseRate:1.0,
      pitchSpread:0.06
    });

    const ratio = this.bossHpMax>0 ? this.bossHp/this.bossHpMax : 1;
    let phase = 1;
    if(ratio <= 0.33) phase = 3;
    else if(ratio <= 0.66) phase = 2;

    this.hitLogs.push({
      event_type: 'hit',
      ts: (performance.now()-this._startTime)/1000,
      target_id: t.id,
      decoy: false,
      bossFace: !!t.bossFace,
      grade,
      age_ms: ageMs,
      diff: this.diff,
      boss_id: this.currentBoss?.id || 0,
      boss_phase: phase,
      fever_on: this.feverOn ? 1 : 0,
      score_delta: baseScore,
      combo_after: this.combo,
      player_hp_after: this.playerHp
    });

    if(this.bossHp<=0){
      this.onBossDefeated();
    }
    this.updateHUD();
  }

  handleDecoyHit(t,ageMs){
    t.hit=true;
    this.targets.delete(t.id);
    if(this.renderer) this.renderer.removeTarget(t);

    this.score=Math.max(0,this.score-60);
    this.combo=0;
    this.playerHp=clamp(this.playerHp-10,0,100);
    this.bombHits++;
    this.loseFeverOnMiss();

    if(this.renderer){
      this.renderer.spawnHitEffect(t,{
        decoy:true,
        grade:'bad',
        score:-60
      });
    }

    this.setFeedback('bomb');

    playSfx('hit', {
      group:'bomb',
      intensity:1.0,
      baseVolume:0.85,
      baseRate:0.95,
      pitchSpread:0.1
    });

    const ratio = this.bossHpMax>0 ? this.bossHp/this.bossHpMax : 1;
    let phase = 1;
    if(ratio <= 0.33) phase = 3;
    else if(ratio <= 0.66) phase = 2;

    this.hitLogs.push({
      event_type: 'bomb',
      ts: (performance.now()-this._startTime)/1000,
      target_id: t.id,
      decoy: true,
      bossFace: !!t.bossFace,
      grade: 'bomb',
      age_ms: ageMs,
      diff: this.diff,
      boss_id: this.currentBoss?.id || 0,
      boss_phase: phase,
      fever_on: this.feverOn ? 1 : 0,
      score_delta: -60,
      combo_after: this.combo,
      player_hp_after: this.playerHp
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

    if(t.decoy){
      this.targets.delete(t.id);
      if(this.renderer) this.renderer.removeTarget(t);
      return;
    }

    this.targets.delete(t.id);
    if(this.renderer) this.renderer.removeTarget(t);

    this.miss++;
    this.combo=0;
    this.playerHp=clamp(this.playerHp-this.config.playerDamageOnMiss,0,100);
    this.loseFeverOnMiss();

    if(this.renderer){
      this.renderer.spawnHitEffect(t,{ miss:true, score:0 });
    }

    this.setFeedback('miss');

    playSfx('hit', {
      group:'miss',
      intensity:0.6,
      baseVolume:0.7,
      baseRate:0.9,
      pitchSpread:0.05
    });

    const ratio = this.bossHpMax>0 ? this.bossHp/this.bossHpMax : 1;
    let phase = 1;
    if(ratio <= 0.33) phase = 3;
    else if(ratio <= 0.66) phase = 2;

    this.hitLogs.push({
      event_type: 'miss',
      ts: (performance.now()-this._startTime)/1000,
      target_id: t.id,
      decoy:false,
      bossFace:false,
      grade:'miss',
      age_ms:null,
      diff:this.diff,
      boss_id:this.currentBoss?.id || 0,
      boss_phase:phase,
      fever_on:this.feverOn?1:0,
      score_delta:0,
      combo_after:this.combo,
      player_hp_after:this.playerHp
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

  /* ------------------ CSV ------------------ */

  downloadCsv(){
    if(this.mode!=='research'){
      alert('การดาวน์โหลด CSV ใช้ในโหมดวิจัยเท่านั้น');
      return;
    }
    if(!this.hitLogs.length){
      alert('ยังไม่มีข้อมูลรอบเล่นสำหรับบันทึก');
      return;
    }

    const header = [
      'participant','group','note',
      'difficulty',
      'event_type',
      'timestamp_s',
      'target_id',
      'boss_id',
      'boss_phase',
      'is_decoy',
      'is_bossface',
      'grade',
      'age_ms',
      'fever_on',
      'score_delta',
      'combo_after',
      'player_hp_after'
    ];

    const rows = [header.join(',')];

    for(const log of this.hitLogs){
      rows.push([
        JSON.stringify(this.researchMeta.participant || ''),
        JSON.stringify(this.researchMeta.group || ''),
        JSON.stringify(this.researchMeta.note || ''),
        this.diff,
        log.event_type || '',
        (log.ts!=null ? log.ts.toFixed(3) : ''),
        log.target_id ?? '',
        log.boss_id ?? '',
        log.boss_phase ?? '',
        log.decoy ? 1 : 0,
        log.bossFace ? 1 : 0,
        log.grade || '',
        (log.age_ms!=null ? log.age_ms.toFixed(1) : ''),
        log.fever_on ?? 0,
        log.score_delta ?? '',
        log.combo_after ?? '',
        log.player_hp_after ?? ''
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
