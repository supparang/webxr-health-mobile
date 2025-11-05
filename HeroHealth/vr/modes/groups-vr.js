// modes/groups-vr.js

function byId(id){ return document.getElementById(id); }
function setText(el, v){ if(!el) return; el.setAttribute('value', v); }
function fillBar(bar, fullW, pct, left=-0.9, h=0.08){
  if(!bar) return; const p=Math.max(0,Math.min(1,pct||0)); const w=fullW*p;
  bar.setAttribute('geometry',`primitive: plane; width: ${w}; height: ${h}`);
  bar.setAttribute('position',`${left+(w/2)} 0 0.02`);
}
function rand(a,b){ return a + Math.random()*(b-a); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

const GROUPS = [
  {key:'veggies', label:'ผัก/ผลไม้', x:-0.9, color:'#3ddc84'},
  {key:'grains',  label:'ธัญพืช',     x:-0.3, color:'#ffd54f'},
  {key:'protein', label:'โปรตีน',     x: 0.3, color:'#7ea8ff'},
  {key:'dairy',   label:'นม',         x: 0.9, color:'#fff59d'}
];
const FOOD = [
  {name:'แอปเปิล',cat:'veggies'},{name:'กล้วย',cat:'veggies'},{name:'บรอกโคลี',cat:'veggies'},
  {name:'ข้าวสวย',cat:'grains'},{name:'โฮลวีต',cat:'grains'},{name:'โอ๊ต',cat:'grains'},
  {name:'ไก่อบ',cat:'protein'},{name:'ปลา',cat:'protein'},{name:'เต้าหู้',cat:'protein'},
  {name:'นมจืด',cat:'dairy'},{name:'โยเกิร์ต',cat:'dairy'}
];

AFRAME.registerComponent('game-manager', {
  schema:{ goal:{default:'auto'}, duration:{default:60} },
  init(){
    this.scene=this.el.sceneEl; this.spawnZone=byId('spawnZone');
    this.hud={tTime:byId('tTime'), tScore:byId('tScore'), tCombo:byId('tCombo'), tStat:byId('tStat'),
               tMission:byId('tMission'), missionFill:byId('missionFill'), tStreak:byId('tStreak'), feverFill:byId('feverFill')};
    this.ui={startBtn:byId('startBtn'), restartBtn:byId('restartBtn'), resultPanel:byId('resultPanel'),
              tResultTitle:byId('tResultTitle'), tResultBody:byId('tResultBody')};
    this.audio={bgm:byId('bgm'),pop:byId('sndPop'),boo:byId('sndBoo'),ok:byId('sndOk'),win:byId('sndWin'),fvr:byId('sndFvr')};

    this._buildBins();
    this.goal=this._goal(); this.timeLeft=this.data.duration; this.score=0; this.combo=1; this.maxCombo=1;
    this.hits={good:0,junk:0}; this.streak=0; this.fever={pct:0,active:false,timer:null}; this.running=false;

    this._onStart=()=>this.start(); this._onRestart=()=>this.start();
    this.ui.startBtn?.addEventListener('click',this._onStart); this.ui.restartBtn?.addEventListener('click',this._onRestart);
    this.ui.startBtn?.classList.add('clickable'); this.ui.restartBtn?.classList.add('clickable');
    this._updateHUD('READY');
  },
  remove(){ this.ui.startBtn?.removeEventListener('click',this._onStart); this.ui.restartBtn?.removeEventListener('click',this._onRestart); this._clear(); },
  _goal(){ const q=parseInt((new URL(location.href)).searchParams.get('goal')||'',10); if([30,40,50].includes(q))return q; return 40; },
  _buildBins(){
    GROUPS.forEach(g=>{
      const bin=document.createElement('a-entity');
      bin.setAttribute('position',`${g.x} 1.0 -2.3`);
      bin.setAttribute('geometry','primitive: box; width: 0.5; height: 0.3; depth: 0.3');
      bin.setAttribute('material',`color: ${g.color}; opacity: 0.18`);
      const txt=document.createElement('a-text'); txt.setAttribute('value',g.label); txt.setAttribute('align','center'); txt.setAttribute('color','#cfe'); txt.setAttribute('width','2'); txt.setAttribute('position','0 0.22 0.02');
      bin.appendChild(txt); this.scene.appendChild(bin);
    });
  },
  _updateHUD(stat){ setText(this.hud.tTime,`เวลา: ${this.timeLeft}s`); setText(this.hud.tScore,`คะแนน: ${this.score}`);
    setText(this.hud.tCombo,`คอมโบ: x${this.combo}`); if(stat) setText(this.hud.tStat,stat);
    setText(this.hud.tMission,`ภารกิจ: ${this.hits.good}/${this.goal}`);
    fillBar(this.hud.missionFill,1.8,this.hits.good/this.goal); setText(this.hud.tStreak,`Streak: ${this.streak}`);
    fillBar(this.hud.feverFill,0.9,(this.fever.pct|0)/100,-0.45,0.06);
  },
  _stars(){ let b=1; if(this.score>=300)b=3; if(this.score>=450)b=4; if(this.score>=600)b=5; if(this.hits.good>=this.goal)b+=1; if(this.maxCombo>=12)b+=1; return Math.max(1,Math.min(5,b)); },
  _play(id){ try{ this.audio[id]?.components?.sound?.playSound(); }catch{} },
  _stop(id){ try{ this.audio[id]?.components?.sound?.stopSound(); }catch{} },
  _clear(){ clearTimeout(this.spawnT); clearInterval(this.tickT); clearTimeout(this.fever.timer); this.spawnT=this.tickT=this.fever.timer=null; },
  start(){ this._clear(); this.ui.resultPanel?.setAttribute('visible','false');
    this.timeLeft=this.data.duration; this.score=0; this.combo=1; this.maxCombo=1; this.hits={good:0,junk:0}; this.streak=0; this.fever={pct:0,active:false,timer:null};
    this.running=true; this._updateHUD('PLAY'); this._stop('bgm'); this._play('bgm'); this._spawnLoop();
    this.tickT=setInterval(()=>{ if(!this.running)return; this.timeLeft--; if(!this.fever.active) this._fever(-6); this._updateHUD(); if(this.timeLeft<=0) this.end(); },1000);
  },
  end(){ if(!this.running)return; this.running=false; this._clear(); this._stop('bgm');
    this.scene.querySelectorAll('.food').forEach(e=>e.remove());
    const s=this._stars(), cleared=this.hits.good>=this.goal;
    setText(this.ui.tResultTitle,'RESULT'); setText(this.ui.tResultBody,`${cleared?'ผ่านภารกิจ':'ยังไม่ผ่าน'}\nคะแนน ${this.score}\nดาว ${'★'.repeat(s)}${'☆'.repeat(5-s)}\nจัดเข้ากลุ่มถูก ${this.hits.good} | ผิด ${this.hits.junk??0}\nคอมโบสูงสุด x${this.maxCombo}`);
    this.ui.resultPanel?.setAttribute('visible','true'); this._play(cleared?'win':'ok'); this._updateHUD(cleared?'MISSION CLEAR':'TIME UP');
  },
  _spawnLoop(){ if(!this.running)return; const elapsed=this.data.duration-this.timeLeft;
    const t=Math.max(380, 900 - elapsed*12); this._spawnOne(); this.spawnT=setTimeout(()=>this._spawnLoop(),t); },
  _spawnOne(){ if(!this.running)return; const item=pick(FOOD);
    const e=document.createElement('a-entity'); e.classList.add('food','clickable'); e.dataset.cat=item.cat;
    // ใช้อีโมจิแทนชื่อ (อย่างง่าย): map แบบหยาบ ๆ
    const EMO={ veggies:'🥦', grains:'🍚', protein:'🐟', dairy:'🥛' };
    e.setAttribute('emoji-sprite',`char: ${EMO[item.cat]||'🍎'}; width: 0.36; height: 0.36; glow: true`);
    e.setAttribute('position',`${rand(-0.8,0.8)} ${rand(-0.2,0.6)} -2`);
    e.addEventListener('click',()=>{ const targetX={ veggies:-0.9, grains:-0.3, protein:0.3, dairy:0.9 }[item.cat];
      e.setAttribute('animation__go',`property: position; to: ${targetX} 1.05 -2.15; dur: 180; easing: easeInCubic`);
      setTimeout(()=>this._score(e,true),190);
    });
    setTimeout(()=>e.remove(), 2200); this.spawnZone.appendChild(e);
  },
  _score(e,ok){ if(ok){ this.hits.good++; this.score+=10*this.combo; this.combo=Math.min(999,this.combo+1); this.maxCombo=Math.max(this.maxCombo,this.combo); this.streak++; this._fever(+14); this._play('pop'); }
    else { this.hits.junk=(this.hits.junk||0)+1; this.combo=1; this.streak=0; this._play('boo'); }
    this._updateHUD(); setTimeout(()=>e.remove(),40);
  },
  _fever(delta){ if(this.fever.active && delta>0) return; this.fever.pct=Math.max(0,Math.min(100,this.fever.pct+delta));
    if(this.fever.pct>=100 && !this.fever.active){ this.fever.active=true; this._play('fvr'); clearTimeout(this.fever.timer);
      this.fever.timer=setTimeout(()=>{ this.fever.active=false; this.fever.pct=0; this._updateHUD(); },6000); }
  }
});
