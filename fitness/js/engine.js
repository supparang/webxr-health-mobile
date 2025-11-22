// === fitness/js/engine.js — Shadow Breaker core (2025-11-23, diff tuning) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';
import { spawnHitParticle } from './particle.js';

/* ------------------------------------------------------------------ */
/*  CONFIG                                                            */
/* ------------------------------------------------------------------ */

const DIFF_CONFIG = {
  easy: {
    gameDuration: 70,          // วินาที
    spawnInterval: 1050,       // ช้าสุด
    targetLifetime: 1600,      // อยู่บนจอนาน
    decoyRate: 0.10,
    baseBossHp: 70,
    playerDamageOnMiss: 3,
    feverGain: { perfect: 9, good: 6, bad: 3 },
    feverLossMiss: 8,
    sizePx: 150                // เป้าใหญ่มาก
  },
  normal: {
    gameDuration: 60,
    spawnInterval: 820,
    targetLifetime: 1200,
    decoyRate: 0.20,
    baseBossHp: 110,
    playerDamageOnMiss: 6,
    feverGain: { perfect: 7, good: 4, bad: 2 },
    feverLossMiss: 12,
    sizePx: 110
  },
  hard: {
    gameDuration: 50,
    spawnInterval: 520,        // ถี่ที่สุด (~2x easy)
    targetLifetime: 900,       // หายเร็ว
    decoyRate: 0.28,
    baseBossHp: 140,
    playerDamageOnMiss: 8,
    feverGain: { perfect: 6, good: 3, bad: 2 },
    feverLossMiss: 16,
    sizePx: 75                 // เป้าเล็กชัดเจน
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
    this.feedbackBubble  = $('#sb-feedback');

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

    // Target layer + renderer (lazy attach)
    this.targetLayer = $('#target-layer');
    this.renderer = null;
    this.diff    = 'normal';
    this.config  = DIFF_CONFIG.normal;

    if (this.targetLayer) {
      this.renderer = new DomRenderer(this, this.targetLayer, { sizePx: this.config.sizePx });
    }

    this.resetState();
    this.wireUI();
  }

  resetState() {
    this.running   = false;
    this.ended     = false;
    this.timeTotal = this.config.gameDuration || 60;
    this.timeLeft  = this.timeTotal;
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
    this.bossHpMax = this.hpForBoss(this.bossIndex);
    this.bossHp    = this.bossHpMax;

    this.researchMeta = { participant:'-', group:'-', note:'-' };
    this.hitLogs = [];

    if(this.wrap){
      this.wrap.dataset.boss = String(this.bossIndex);
      this.wrap.dataset.diff = this.diff;
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
      this.researchMeta = {
        participant: id || '-',
        group:       group || '-',
        note:        note || '-'
      };
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

    // ป้องกัน space scroll
    window.addEventListener('keydown', (ev) => {
      if (!this.running) return;
      if (ev.key === ' ') ev.preventDefault();
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

    if(this.renderer){
      this.renderer.sizePx = this.config.sizePx;
    }

    this.statMode.textContent = this.mode === 'research' ? 'Research' : 'Normal';
    this.statDiff.textContent = this.diff;

    this.updateHUD();
    this.updateBossHUD();
    this.updateFeverHUD();
    this.setFeedback('แตะหน้าจอเพื่อเริ่มต่อสู้กับบอสตัวแรก! 💪','');

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
    this.timeTotal = this.config.gameDuration || 60;
    this.timeLeft  = this.timeTotal;
    this._startTime = performance.now();

    if (this.renderer) this.renderer.clear();
    this.targets.clear();

    if(this.wrap){
      this.wrap.dataset.diff = this.diff;
    }

    this._spawnTimer && clearInterval(this._spawnTimer);
    this._spawnTimer = setInterval(()=>this.spawnTarget(), this.config.spawnInterval);

    const loop = (t)=>{
      if (!this.running) return;
      const elapsed = (t - this._startTime)/1000;
      this.timeLeft = clamp(this.timeTotal - elapsed, 0, this.timeTotal);
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

    // RT normal / decoy
    let rtNormal = [];
    let rtDecoy  = [];
    for(const h of this.hitLogs){
      if(h.decoy) rtDecoy.push(h.ageMs);
      else rtNormal.push(h.ageMs);
    }
    const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;

    this.resMode.textContent      = this.mode==='research'?'วิจัย':'ปกติ';
    this.resDiff.textContent      = this.diff;
    this.resEndReason.textContent = reason||'-';
    this.resScore.textContent     = String(this.score);
    this.resMaxCombo.textContent  = String(this.maxCombo);
    this.resMiss.textContent      = String(this.miss);
    this.resAccuracy.textContent  = accuracy.toFixed(1)+' %';
    this.resTotalHits.textContent = String(this.hitCount);
    this.resRtNormal.textContent  = rtNormal.length? (avg(rtNormal).toFixed(0)+' ms') : '-';
    this.resRtDecoy.textContent   = rtDecoy.length?  (avg(rtDecoy).toFixed(0)+' ms') : '-';
    this.resParticipant.textContent = this.researchMeta.participant || '-';

    this.showView('result');
  }

  /* ------------------ HUD / feedback ------------------ */

  updateHUD(){
    this.statHp.textContent      = Math.round(this.playerHp);
    this.statScore.textContent   = String(this.score);
    this.statCombo.textContent   = String(this.combo);
    this.statPerfect.textContent = String(this.perfect);
    this.statMiss.textContent    = String(this.miss);

    const hpRatio = clamp(this.playerHp/100,0,1);
    $('#hp-player-fill').style.transform = `scaleX(${hpRatio})`;
  }

  setFeedback(msg, tone){
    if(!this.feedbackBubble) return;
    this.feedbackBubble.textContent = msg;
    this.feedbackBubble.classList.remove('good','perfect','miss','bomb','heal');
    if(tone) this.feedbackBubble.classList.add(tone);
  }

  /* ------------------ BOSS ------------------ */

  updateBossHUD(){
    const boss=this.currentBoss;
    if(!boss) return;

    if (this.wrap) {
      this.wrap.dataset.boss = String(this.bossIndex);
    }

    this.bossName.textContent = `Boss ${boss.id}/4 — ${boss.name}`;
    this.bossPortraitEmoji.textContent = boss.emoji;
    this.bossPortraitName.textContent  = boss.name;
    this.bossPortraitHint.textContent  =
      `HP เหลือประมาณ ${Math.round((this.bossHp/this.bossHpMax)*100)}%`;

    const ratio=clamp(this.bossHp/this.bossHpMax,0,1);
    this.bossFill.style.transform = `scaleX(${ratio})`;
    this.hpBossVal.textContent    = Math.round(ratio*100) + '%';

    // เขย่าหน้าบอสถ้า HP ต่ำกว่า 25%
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

  onBossDefeated(){
    // heal เล็กน้อยทุกครั้งที่ชนะบอส
    const heal = 20;
    this.playerHp = clamp(this.playerHp + heal, 0, 100);
    this.updateHUD();
    this.setFeedback(`โค่น ${this.currentBoss.name} ได้! +${heal} HP 💧`, 'heal');

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
    this.setFeedback('เข้าโหมด FEVER! ตีให้ไม่พลาดเลย 🔥','perfect');
    this._feverTimeout && clearTimeout(this._feverTimeout);
    this._feverTimeout = setTimeout(()=>{
      this.feverOn=false;
      this.fever=40;
      this.updateFeverHUD();
      this.setFeedback('FEVER จบแล้ว ลองเก็บคอมโบต่อ 💪','good');
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

    // --- ตัดสินใจว่าตัวนี้เป็น bomb / boss-face / เป้าปกติ ---
    const hpRatio = this.bossHpMax > 0 ? this.bossHp / this.bossHpMax : 1;
    let bossFace = false;
    let decoy    = false;

    // ถ้า HP บอสเหลือน้อยกว่า 25% มีโอกาสให้เป็น "หน้าบอส" มาตี
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
      _onPtr:null,
      lastPos:null
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

    // ถ้าเป็น "หน้าบอส" → bonus
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

    // particle ตรงเป้า
    if(this.wrap && t._el){
      const hostRect = this.wrap.getBoundingClientRect();
      const r = t._el.getBoundingClientRect();
      const px = r.left - hostRect.left + r.width/2;
      const py = r.top  - hostRect.top  + r.height/2;
      const emo = t.bossFace ? this.currentBoss?.emoji || '💥'
                             : (grade==='perfect'?'⭐':'💥');
      spawnHitParticle(this.wrap, px, py, emo);
    }

    safePlay('sfx-hit');

    // feedback text
    if(t.bossFace){
      if(grade==='perfect') this.setFeedback('ตีโดนหน้าบอสเต็ม ๆ! ⭐','perfect');
      else this.setFeedback('โดนหน้าบอสแล้ว! ดีมาก 😀','good');
    }else if(grade==='perfect'){
      this.setFeedback('ตรงเป๊ะ! ⭐','perfect');
    }else if(grade==='good'){
      this.setFeedback('ใกล้แล้ว! 😀','good');
    }else{
      this.setFeedback('ได้คะแนน แต่ยังไม่เป๊ะ 😅','good');
    }

    this.hitLogs.push({
      ts:(performance.now()-this._startTime)/1000,
      id:t.id,
      decoy:false,
      bossFace: !!t.bossFace,
      grade,
      ageMs
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

    // กด bomb → หักคะแนน + ลด HP + reset combo แต่ไม่เพิ่ม miss
    this.score=Math.max(0,this.score-60);
    this.combo=0;
    this.playerHp=clamp(this.playerHp-10,0,100);
    this.loseFeverOnMiss();
    this.updateHUD();

    if(this.renderer){
      this.renderer.spawnHitEffect(t,{
        decoy:true,
        grade:'bad',
        score:-60
      });
    }

    if(this.wrap && t._el){
      const hostRect = this.wrap.getBoundingClientRect();
      const r = t._el.getBoundingClientRect();
      const px = r.left - hostRect.left + r.width/2;
      const py = r.top  - hostRect.top  + r.height/2;
      spawnHitParticle(this.wrap, px, py, '💣');
    }

    this.setFeedback('โดนระเบิด! -60 คะแนน -10 HP','bomb');

    this.hitLogs.push({
      ts:(performance.now()-this._startTime)/1000,
      id:t.id,
      decoy:true,
      bossFace:false,
      grade:'bomb',
      ageMs
    });
  }

  handleMiss(t){
    t.hit=true;
    this.targets.delete(t.id);
    if(this.renderer) this.renderer.removeTarget(t);

    this.miss++;
    this.combo=0;
    this.playerHp = clamp(this.playerHp - this.config.playerDamageOnMiss,0,100);
    this.loseFeverOnMiss();
    this.updateHUD();

    if(this.renderer){
      this.renderer.spawnHitEffect(t,{
        miss:true,
        grade:'miss',
        score:0
      });
    }

    if(this.wrap && t.lastPos){
      spawnHitParticle(this.wrap, t.lastPos.x, t.lastPos.y, '💢');
    }

    this.setFeedback('พลาดเป้า! ลองใหม่ 😅','miss');

    this.hitLogs.push({
      ts:(performance.now()-this._startTime)/1000,
      id:t.id,
      decoy:false,
      bossFace:false,
      grade:'miss',
      ageMs: t.lifetime
    });

    if(this.playerHp<=0){
      this.stopGame('พลังผู้เล่นหมด');
    }
  }

  /* ------------------ CSV export ------------------ */

  downloadCsv(){
    if(!this.hitLogs.length){
      alert('ยังไม่มีข้อมูล hit ในรอบนี้');
      return;
    }
    const header = [
      'ts(sec)','targetId','decoy','bossFace','grade','ageMs',
      'mode','diff','participant','group','note'
    ];
    const rows = [header.join(',')];

    for(const h of this.hitLogs){
      rows.push([
        h.ts.toFixed(3),
        h.id,
        h.decoy?1:0,
        h.bossFace?1:0,
        h.grade,
        Math.round(h.ageMs),
        this.mode||'normal',
        this.diff,
        this.researchMeta.participant||'-',
        this.researchMeta.group||'-',
        JSON.stringify(this.researchMeta.note||'-')
      ].join(','));
    }

    const blob = new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `shadow-breaker-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/* ------------------------------------------------------------------ */
/*  BOOT                                                              */
/* ------------------------------------------------------------------ */

window.addEventListener('DOMContentLoaded',()=>{
  new ShadowBreakerGame();
});
