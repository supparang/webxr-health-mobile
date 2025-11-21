// === fitness/js/engine.js — Shadow Breaker core (2025-11-21 DOM edition) ===
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
    // views (ในหน้านี้ใช้ view-play / view-result เป็นหลัก)
    this.viewPlay   = document.getElementById('view-play');
    this.viewResult = document.getElementById('view-result');

    // HUD main
    this.statMode    = $('#stat-mode');
    this.statDiff    = $('#stat-diff');
    this.statScore   = $('#stat-score');
    this.statHp      = $('#stat-hp');
    this.statCombo   = $('#stat-combo');
    this.statPerfect = $('#stat-perfect');
    this.statMiss    = $('#stat-miss');
    this.statTime    = $('#stat-time');

    // Fever
    this.feverWrap   = document.querySelector('.sb-fever-wrap');
    this.feverFill   = $('#fever-fill');
    this.feverStatus = $('#fever-status');

    // Boss HUD / portrait
    this.bossName          = $('#boss-name');
    this.bossFill          = $('#boss-fill');
    this.bossPortrait      = document.getElementById('boss-portrait');
    this.bossPortraitEmoji = $('#boss-portrait-emoji');

    // Boss intro overlay
    this.bossIntro      = document.getElementById('boss-intro');
    this.bossIntroEmoji = $('#boss-intro-emoji');
    this.bossIntroName  = $('#boss-intro-name');
    this.bossIntroTitle = $('#boss-intro-title');
    this.bossIntroDesc  = $('#boss-intro-desc');

    // result view
    this.resMode       = $('#res-mode');
    this.resDiff       = $('#res-diff');
    this.resEndReason  = $('#res-endreason');
    this.resScore      = $('#res-score');
    this.resMaxCombo   = $('#res-maxcombo');
    this.resMiss       = $('#res-miss');
    this.resAccuracy   = $('#res-accuracy');
    this.resTotalHits  = $('#res-totalhits');
    this.resParticipant= $('#res-participant');

    // DOM-target layer
    this.targetLayer = document.getElementById('target-layer');
    this.renderer = null;
    if (this.targetLayer) {
      this.renderer = new DomRenderer(this, this.targetLayer, { sizePx: 96 });
    }

    this.resetState();
    this.wireUI();
  }

  resetState() {
    this.mode = 'normal';
    this.diff = 'normal';
    this.config = DIFF_CONFIG.normal;

    this.running  = false;
    this.ended    = false;
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
    this._nextId = 1;

    this.fever   = 0;
    this.feverOn = false;
    this._feverTimeout = null;

    this.bossIndex   = 0;
    this.currentBoss = BOSSES[0];
    this.bossHpMax   = this.hpForBoss(0);
    this.bossHp      = this.bossHpMax;

    this.researchMeta = { participant:'-', group:'-', note:'-' };
    this.hitLogs = [];
  }

  hpForBoss(idx){
    const base=this.config.baseBossHp;
    return Math.round(base*(1+idx*0.15));
  }

  wireUI() {
    // ปุ่มเริ่มในโหมดปกติ
    const btnStartNormal = document.querySelector('[data-action="start-normal"]');
    if (btnStartNormal) {
      btnStartNormal.addEventListener('click', () => {
        this.mode = 'normal';
        this.startFromMenu();
      });
    }

    // ปุ่มเริ่มโหมดวิจัย
    const btnStartResearch = document.querySelector('[data-action="start-research"]');
    if (btnStartResearch) {
      btnStartResearch.addEventListener('click', () => {
        this.mode = 'research';
        const id    = (document.getElementById('research-id')    || {}).value || '-';
        const group = (document.getElementById('research-group') || {}).value || '-';
        const note  = (document.getElementById('research-note')  || {}).value || '-';
        this.researchMeta = { participant:id, group, note };
        this.startFromMenu();
      });
    }

    // ปุ่มหยุดก่อนเวลา
    const btnStopEarly = document.querySelector('[data-action="stop-early"]');
    if (btnStopEarly) {
      btnStopEarly.addEventListener('click', () => {
        this.stopGame('หยุดก่อนเวลา');
      });
    }

    // ปุ่ม result
    const btnResultBack = document.querySelector('[data-action="back-to-menu"]');
    const btnPlayAgain  = document.querySelector('[data-action="play-again"]');
    const btnDownload   = document.querySelector('[data-action="download-csv"]');

    if (btnResultBack) {
      btnResultBack.addEventListener('click', () => {
        // กลับหน้าเมนู (หน้าเดียวกัน) แค่ซ่อน result
        this.viewResult.classList.add('hidden');
        this.viewPlay.classList.remove('hidden');
        this.resetState();
        this.updateHUD();
        this.updateBossHUD();
        this.updateFeverHUD();
      });
    }

    if (btnPlayAgain) {
      btnPlayAgain.addEventListener('click', () => {
        this.resetState();
        this.startFromMenu(true);
      });
    }

    if (btnDownload) {
      btnDownload.addEventListener('click', () => this.downloadCsv());
    }

    if (this.bossIntro) {
      this.bossIntro.addEventListener('pointerdown', () => {
        this.hideBossIntro();
      });
    }
  }

  /* ------------------ FLOW ------------------ */

  startFromMenu(useSameDiff=false){
    if (!useSameDiff){
      const sel=document.getElementById('difficulty');
      this.diff=(sel && sel.value) || 'normal';
    }

    this.config = DIFF_CONFIG[this.diff] || DIFF_CONFIG.normal;
    this.resetState();
    this.config = DIFF_CONFIG[this.diff] || DIFF_CONFIG.normal;

    this.currentBoss = BOSSES[this.bossIndex];
    this.bossHpMax   = this.hpForBoss(this.bossIndex);
    this.bossHp      = this.bossHpMax;

    if (this.renderer) {
      this.renderer.sizePx = this.config.sizePx;
    }

    this.statMode.textContent = this.mode === 'research' ? 'Research' : 'Normal';
    this.statDiff.textContent = this.diff;

    this.updateHUD();
    this.updateBossHUD();
    this.updateFeverHUD();

    this.viewPlay.classList.remove('hidden');
    this.viewResult.classList.add('hidden');

    this.showBossIntro(this.currentBoss, {
      first:true,
      onDone: () => this.beginGameLoop()
    });
  }

  beginGameLoop(){
    if (this.running) return;

    this.running   = true;
    this.ended     = false;
    this.timeLeft  = GAME_DURATION;
    this._startTime= performance.now();

    if (this.renderer) this.renderer.clear();
    this.targets.clear();

    if (this._spawnTimer) clearInterval(this._spawnTimer);
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

    if (this._spawnTimer) clearInterval(this._spawnTimer);
    this._spawnTimer=null;
    if (this._loopHandle) cancelAnimationFrame(this._loopHandle);
    this._loopHandle=null;
    if (this._feverTimeout) clearTimeout(this._feverTimeout);
    this._feverTimeout=null;

    if (this.renderer) this.renderer.clear();
    this.targets.clear();

    const totalShots = this.hitCount + this.miss;
    const accuracy   = totalShots>0 ? (this.hitCount/totalShots)*100 : 0;

    this.resMode.textContent      = this.mode==='research'?'วิจัย':'ปกติ';
    this.resDiff.textContent      = this.diff;
    this.resEndReason.textContent = reason || '-';
    this.resScore.textContent     = String(this.score);
    this.resMaxCombo.textContent  = String(this.maxCombo);
    this.resMiss.textContent      = String(this.miss);
    this.resAccuracy.textContent  = accuracy.toFixed(1)+' %';
    this.resTotalHits.textContent = String(this.hitCount);
    this.resParticipant.textContent = this.researchMeta.participant || '-';

    this.viewPlay.classList.add('hidden');
    this.viewResult.classList.remove('hidden');

    document.querySelector('.sb-wrap')?.classList.add('sb-finished');
  }

  /* ------------------ BOSS ------------------ */

  updateBossHUD(){
    const boss=this.currentBoss;
    if(!boss) return;

    const wrap = document.querySelector('.sb-wrap');
    if (wrap) wrap.setAttribute('data-boss', String(this.bossIndex));

    if (this.bossName) {
      this.bossName.textContent = `Boss ${boss.id}/4 — ${boss.name}`;
    }
    if (this.bossPortraitEmoji) {
      this.bossPortraitEmoji.textContent = boss.emoji;
    }

    const ratio=clamp(this.bossHp/this.bossHpMax,0,1);
    if (this.bossFill) {
      this.bossFill.style.transform = `scaleX(${ratio})`;
    }

    if (this.bossPortrait) {
      if (ratio <= 0.25) this.bossPortrait.classList.add('sb-shake');
      else              this.bossPortrait.classList.remove('sb-shake');
    }
  }

  showBossIntro(boss,opts={}){
    if(!boss || !this.bossIntro) {
      this.beginGameLoop();
      return;
    }
    this.bossIntroEmoji.textContent = boss.emoji;
    this.bossIntroName.textContent  = boss.name;
    this.bossIntroTitle.textContent = boss.title;
    this.bossIntroDesc.textContent  = boss.desc;

    this.bossIntro.classList.remove('hidden');
    this._introActive = true;
    this._introOnDone = opts.onDone || null;
    safePlay('sfx-boss');
  }

  hideBossIntro(){
    if (!this._introActive || !this.bossIntro) return;
    this._introActive = false;
    this.bossIntro.classList.add('hidden');
    if (this._introOnDone) {
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
    if (this.feverFill) {
      this.feverFill.style.transform=`scaleX(${ratio})`;
    }
    if (this.feverStatus) {
      if(this.feverOn){
        this.feverStatus.textContent='FEVER!!';
        this.feverStatus.classList.add('on');
      } else {
        this.feverStatus.classList.remove('on');
        this.feverStatus.textContent = (ratio>=1)?'READY':'FEVER';
      }
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
    if (this._feverTimeout) clearTimeout(this._feverTimeout);
    this._feverTimeout = setTimeout(()=>{
      this.feverOn=false;
      this.fever=40;
      this.updateFeverHUD();
    },7000);
  }

  /* ------------------ TARGETS ------------------ */

  spawnTarget(){
    if (!this.running) return;

    // lazy attach renderer
    if (!this.renderer || !this.renderer.host) {
      if (this.targetLayer) {
        this.renderer = new DomRenderer(this, this.targetLayer, {
          sizePx: this.config.sizePx || 96
        });
      } else {
        return;
      }
    }

    const id    = this._nextId++;
    const decoy = Math.random() < this.config.decoyRate;

    const bossEmoji = (this.currentBoss && this.currentBoss.emoji) || '🥊';
    const useBossFace = !decoy && Math.random() < 0.18; // 18% ของ good target
    const emoji = decoy ? '💣' : (useBossFace ? bossEmoji : '🥊');

    const now   = performance.now();

    const t = {
      id,
      emoji,
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
    if (this.statScore)   this.statScore.textContent   = String(this.score);
    if (this.statHp)      this.statHp.textContent      = String(this.playerHp);
    if (this.statCombo)   this.statCombo.textContent   = String(this.combo);
    if (this.statPerfect) this.statPerfect.textContent = String(this.perfect);
    if (this.statMiss)    this.statMiss.textContent    = String(this.miss);
  }

  /* ------------------ CSV (โหมดวิจัย) ------------------ */

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