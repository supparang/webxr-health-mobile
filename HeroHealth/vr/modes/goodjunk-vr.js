import { MiniQuest } from '../miniquest.js';
// modes/goodjunk-vr.js

function byId(id){ return document.getElementById(id); }
function setText(el, v){ if(!el) return; el.setAttribute('value', v); }
function fillBar(bar, fullW, pct, left=-0.9, h=0.08){
  if(!bar) return; const p=Math.max(0,Math.min(1,pct||0)); const w=fullW*p;
  bar.setAttribute('geometry',`primitive: plane; width: ${w}; height: ${h}`);
  bar.setAttribute('position',`${left+(w/2)} 0 0.02`);
}
function rand(a,b){ return a + Math.random()*(b-a); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }


const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐'];

const SPAWN_MS_BASE=800, SPAWN_MS_MIN=350, ITEM_LIFE_MS=1500;

AFRAME.registerComponent('game-manager', {
  schema:{ goal:{default:'auto'}, duration:{default:60} },
  init(){
    this.scene=this.el.sceneEl; this.spawnZone=byId('spawnZone');
    this.hud={tTime:byId('tTime'), tScore:byId('tScore'), tCombo:byId('tCombo'), tStat:byId('tStat'), tQ1:byId('tQ1'), tQ2:byId('tQ2'), tQ3:byId('tQ3'),
               tMission:byId('tMission'), missionFill:byId('missionFill'), tStreak:byId('tStreak'), feverFill:byId('feverFill')};
    this.ui={startBtn:byId('startBtn'), restartBtn:byId('restartBtn'), resultPanel:byId('resultPanel'),
              tResultTitle:byId('tResultTitle'), tResultBody:byId('tResultBody')};
    this.audio={bgm:byId('bgm'),pop:byId('sndPop'),boo:byId('sndBoo'),ok:byId('sndOk'),win:byId('sndWin'),fvr:byId('sndFvr')};

    this.goal=this._goal(); this.timeLeft=this.data.duration; this.score=0; this.combo=1; this.maxCombo=1;
    this.hits={good:0,junk:0}; this.streak=0; this.fever={pct:0,active:false,timer:null};
    this.running=false;

    this._onStart=()=>this.start(); this._onRestart=()=>this.start();
    this.ui.startBtn?.addEventListener('click',this._onStart);
    this.ui.restartBtn?.addEventListener('click',this._onRestart);
    this.ui.startBtn?.classList.add('clickable'); this.ui.restartBtn?.classList.add('clickable');
    this.mq = new MiniQuest({tQ1:byId('tQ1'),tQ2:byId('tQ2'),tQ3:byId('tQ3')}, this.audio);
    this._updateHUD('READY');
  },
  remove(){ this.ui.startBtn?.removeEventListener('click',this._onStart); this.ui.restartBtn?.removeEventListener('click',this._onRestart); this._clear(); },
  _goal(){ const q=parseInt((new URL(location.href)).searchParams.get('goal')||'',10); if([30,40,50].includes(q))return q; return 40; },
  _updateHUD(stat){ setText(this.hud.tTime,`เวลา: ${this.timeLeft}s`); setText(this.hud.tScore,`คะแนน: ${this.score}`);
    setText(this.hud.tCombo,`คอมโบ: x${this.combo}`); if(stat) setText(this.hud.tStat,stat);
    setText(this.hud.tMission,`ภารกิจ: ${this.hits.good}/${this.goal}`);
    fillBar(this.hud.missionFill,1.8,this.hits.good/this.goal);
    setText(this.hud.tStreak,`Streak: ${this.streak}`);
    fillBar(this.hud.feverFill,0.9,(this.fever.pct|0)/100,-0.45,0.06);
  },
  _stars(){ let b=1; if(this.score>=300)b=3; if(this.score>=450)b=4; if(this.score>=600)b=5; if(this.hits.good>=this.goal)b+=1; if(this.maxCombo>=12)b+=1; return Math.max(1,Math.min(5,b)); },
  _play(id){ try{ this.audio[id]?.components?.sound?.playSound(); }catch{} },
  _stop(id){ try{ this.audio[id]?.components?.sound?.stopSound(); }catch{} },
  _clear(){ clearTimeout(this.spawnT); clearInterval(this.tickT); clearTimeout(this.fever.timer);
            this.spawnT=this.tickT=this.fever.timer=null; },
  start(){ this._clear(); this.ui.resultPanel?.setAttribute('visible','false');
    this.timeLeft=this.data.duration; this.score=0; this.combo=1; this.maxCombo=1;
    this.hits={good:0,junk:0}; this.streak=0; this.fever={pct:0,active:false,timer:null};
    this.running=true; this._updateHUD('PLAY'); this._stop('bgm'); this._play('bgm'); this.mq.start(this.goal);
    this._spawnLoop();
    this.tickT=setInterval(()=>{ if(!this.running)return; this.timeLeft--; if(!this.fever.active) this._fever(-6);
      this._updateHUD(); this.mq.second(); if(this.timeLeft<=0) this.end(); },1000);
  },
  end(){ if(!this.running)return; this.running=false; this._clear(); this._stop('bgm');
    this.scene.querySelectorAll('.target').forEach(e=>e.remove());
    const s=this._stars(), cleared=this.hits.good>=this.goal;
    setText(this.ui.tResultTitle,'RESULT');
    setText(this.ui.tResultBody,`${cleared?'ผ่านภารกิจ':'ยังไม่ผ่าน'}\nคะแนน ${this.score}\nดาว ${'★'.repeat(s)}${'☆'.repeat(5-s)}\nดี ${this.hits.good} | ขยะ ${this.hits.junk}\nคอมโบสูงสุด x${this.maxCombo}`);
    this.ui.resultPanel?.setAttribute('visible','true'); this._play(cleared?'win':'ok');
    this._updateHUD(cleared?'MISSION CLEAR':'TIME UP');
  },
  _spawnLoop(){ if(!this.running)return; const elapsed=this.data.duration-this.timeLeft;
    const t=Math.max(SPAWN_MS_MIN, SPAWN_MS_BASE - elapsed*12); this._spawnOne(); this.spawnT=setTimeout(()=>this._spawnLoop(),t); },
  _spawnOne(){ if(!this.running)return; const roll=Math.random(); let char,kind;
    if(roll<0.05){ char=GOLD[0]; kind='gold'; } else if(roll<0.65){ char=pick(GOOD); kind='good'; } else { char=pick(JUNK); kind='junk'; }
    const e=document.createElement('a-entity'); e.classList.add('target','clickable',kind);
    e.setAttribute('emoji-sprite',`char: ${char}; width: 0.36; height: 0.36; glow: ${kind!=='junk'}`);
    e.setAttribute('position',`${rand(-0.8,0.8)} ${rand(-0.2,0.6)} -2`);
    e.addEventListener('click',()=>this._hit(kind,e)); setTimeout(()=>e.remove(), ITEM_LIFE_MS);
    this.spawnZone.appendChild(e);
  },
  _hit(kind,e){ if(kind==='good' || kind==='gold'){ this.hits.good++; this.score+= (kind==='gold'?100:10)*this.combo; this.combo=Math.min(999,this.combo+1);
      this.maxCombo=Math.max(this.maxCombo,this.combo); this.streak++; this._fever(+14); this._play('pop'); }
    else { this.hits.junk++; this.combo=1; this.streak=0; this._play('boo'); }
    this._updateHUD(); this.mq.good({score:this.score, combo:this.combo, streak:this.streak, missionGood:this.hits.good}); this.mission && this.mq.mission(this.hits.good); setTimeout(()=>e.remove(), 40);
  },
  _fever(delta){ if(this.fever.active && delta>0) return; this.fever.pct=Math.max(0,Math.min(100,this.fever.pct+delta));
    if(this.fever.pct>=100 && !this.fever.active){ this.fever.active=true; this._play('fvr'); this.mq.fever();
      clearTimeout(this.fever.timer); this.fever.timer=setTimeout(()=>{ this.fever.active=false; this.fever.pct=0; this._updateHUD(); },6000); }
  }
});
