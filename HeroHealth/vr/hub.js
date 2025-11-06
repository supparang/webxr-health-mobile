// === vr/hub.js — HeroHealth VR Hub (Production) ===
import { Emoji } from './emoji-sprite.js';
import { Particles } from './particles.js';
import { Fever } from './fever.js';
import { SFX } from './sfx.js';
import { MissionDeck } from './mission.js';
import { Difficulty } from './difficulty.js';

export class GameHub{
  constructor(){
    this.scene = document.querySelector('a-scene');
    this.spawnZone = document.getElementById('spawnZone');
    this.fxLayer = document.getElementById('fxLayer');
    this.ui = {
      tMode:  document.getElementById('tMode'),
      tTime:  document.getElementById('tTime'),
      tScore: document.getElementById('tScore'),
      tCombo: document.getElementById('tCombo'),
      tFever: document.getElementById('tFever'),
      feverFill: document.getElementById('feverFill'),
      questTxt: document.getElementById('tQ'),
      modeMenu: document.getElementById('modeMenu'),
      startPanel: document.getElementById('startPanel'),
      startBtn: document.getElementById('startBtn'),
      startLbl: document.getElementById('startLbl'),
      resultPanel: document.getElementById('resultPanel'),
      tResultBody: document.getElementById('tResultBody'),
      restartBtn: document.getElementById('restartBtn'),
    };

    this.state = 'menu'; // menu | playing | result
    this.mode = '';
    this.goal = 40;
    this.duration = 60;
    this.timer = 0;
    this.left = 60;
    this.score = 0;
    this.combo = 1;
    this.goodHits = 0;
    this.star = 0;
    this.diamond = 0;

    this.diff = new Difficulty();
    this.sfx = new SFX();
    this.fever = new Fever(this.scene, this.ui);
    this.missions = new MissionDeck();

    // wire menu
    this.ui.modeMenu.querySelectorAll('.btn').forEach(b=>{
      b.addEventListener('click', ()=>{
        this.mode = b.getAttribute('data-mode');
        this.ui.tMode.setAttribute('value', 'โหมด: '+this.mode.toUpperCase());
        this.ui.startPanel.setAttribute('visible','true');
        this.ui.startLbl.setAttribute('value','เริ่มโหมด '+this.mode);
        this.ui.startBtn.setAttribute('color','#2e8b57');
        this.sfx.playCoach('mode_'+this.mode);
      });
    });

    this.ui.startBtn.addEventListener('click', ()=>{
      if(!this.mode) return;
      this.startGame();
    });
    this.ui.restartBtn.addEventListener('click', ()=>{
      this.backToHub();
    });

    // Force Start button (fallback)
    document.getElementById('forceStartBtn').addEventListener('click', ()=>{
      if(!this.mode){
        this.mode = 'goodjunk';
        this.ui.tMode.setAttribute('value', 'โหมด: GOODJUNK');
        this.ui.startPanel.setAttribute('visible','true');
        this.ui.startLbl.setAttribute('value','เริ่มโหมด '+this.mode);
        this.ui.startBtn.setAttribute('color','#2e8b57');
      }
      this.startGame();
    });
  }

  startGame(){
    // reset
    this.state='playing'; this.score=0; this.combo=1; this.goodHits=0;
    this.star=0; this.diamond=0; this.left=this.duration;
    this.ui.resultPanel.setAttribute('visible','false');
    this.ui.modeMenu.setAttribute('visible','false');
    this.ui.startPanel.setAttribute('visible','false');
    this.sfx.playCoach('start');
    this.fever.reset();

    // draw missions (3: easy/normal/hard)
    const deck = this.missions.draw3();
    this.activeMissions = deck;
    this.updateQuestText();

    // run timer
    clearInterval(this.timer);
    this.timer = setInterval(()=>{
      this.left--; if(this.left<=0){ this.endGame(); }
      this.ui.tTime.setAttribute('value', 'เวลา: '+this.left+'s');
    },1000);

    // spawn loop
    this.spawnLoop();
  }

  updateQuestText(idx=0){
    const labels = this.activeMissions.map((m,i)=>`${i===idx?'▶ ':''}${m.label}`);
    this.ui.questTxt.setAttribute('value', labels.join('  |  '));
  }

  endGame(){
    clearInterval(this.timer);
    this.state='result';
    const body = `Mode: ${this.mode}
Score: ${this.score}
Good: ${this.goodHits}/${this.goal}
⭐: ${this.star}   💎: ${this.diamond}
Fever: ${this.fever.count} times`;
    this.ui.tResultBody.setAttribute('value', body);
    this.ui.resultPanel.setAttribute('visible','true');
    this.ui.modeMenu.setAttribute('visible','true');
    this.sfx.playCoach('clear');
  }

  backToHub(){
    this.ui.resultPanel.setAttribute('visible','false');
    this.ui.modeMenu.setAttribute('visible','true');
    this.state='menu';
  }

  spawnLoop(){
    if(this.state!=='playing') return;
    // difficulty scale from missions (E/N/H equally)
    const weights = this.activeMissions.map(m=>m.level);
    const lvl = this.diff.resolve(weights); // 'easy'|'normal'|'hard'
    const cfg = this.diff.config[lvl];

    // pick type (GOOD/JUNK/STAR/DIAMOND)
    const r = Math.random();
    let type='GOOD';
    if(r<0.15) type='JUNK';
    else if(r<0.18) type='STAR';
    else if(r<0.20) type='DIAMOND';

    // spawn position (safe area)
    const xAbs=0.85, yMin=0.70, yMax=1.20;
    const x=(Math.random()*2-1)*xAbs;
    const y=yMin+Math.random()*(yMax-yMin);
    const z=-3.8;

    const emoji = Emoji.create({type, size: cfg.size});
    emoji.setAttribute('position', `${x} ${y} ${z}`);
    emoji.classList.add('target','clickable');

    // click logic
    emoji.addEventListener('click', ()=>{
      if(this.state!=='playing') return;
      if(emoji._dead) return; emoji._dead=true; emoji.remove();

      if(type==='GOOD'){
        this.goodHits++; this.score += (this.fever.active?20:10)*this.combo; this.combo++; this.fever.add(5);
        this.sfx.popGood(); Particles.burst(this.fxLayer, {x,y,z}, '#7CFC00');
      }else if(type==='JUNK'){
        this.combo=1; this.fever.add(-10); this.sfx.popBad(); Particles.smoke(this.fxLayer, {x,y,z});
      }else if(type==='STAR'){
        this.star++; this.score += (this.fever.active?100:50); this.combo++; this.fever.add(10);
        this.sfx.star(); Particles.spark(this.fxLayer, {x,y,z}, '#ffd54f');
      }else if(type==='DIAMOND'){
        this.diamond++; this.score += 200; this.fever.fill(); this.sfx.diamond(); Particles.spark(this.fxLayer, {x,y,z}, '#66e0ff');
      }

      // missions update
      this.missions.tick({
        good: type==='GOOD',
        junk: type==='JUNK',
        star: type==='STAR',
        diamond: type==='DIAMOND',
        combo: this.combo,
        score: this.score,
        feverActive: this.fever.active
      });
      const mi = this.missions.currentIndex;
      this.updateQuestText(mi);

      // goal check
      if(this.goodHits>=this.goal){ this.endGame(); }
      this.refreshHUD();
    });

    this.spawnZone.appendChild(emoji);

    // lifetime + next spawn
    fromNow(()=>{ try{emoji.remove();}catch(e){} }, cfg.life);
    fromNow(()=>this.spawnLoop(), cfg.rate);
  }

  refreshHUD(){
    this.ui.tScore.setAttribute('value', 'คะแนน: '+this.score);
    this.ui.tCombo.setAttribute('value', 'คอมโบ: x'+this.combo);
    const lv = Math.max(0, Math.min(100, this.fever.level));
    const w = 1.9 * (lv/100);
    this.ui.feverFill.setAttribute('geometry', {primitive:'plane', width: w, height: 0.08});
    this.ui.feverFill.setAttribute('position', `${-0.95 + w/2} 0 0.01`);
    this.ui.tFever.setAttribute('value', `Fever ${Math.round(lv)}%`);
    this.ui.tMode.setAttribute('value', 'โหมด: '+this.mode.toUpperCase());
  }
}

function fromNow(fn, t){ setTimeout(fn, t); }
