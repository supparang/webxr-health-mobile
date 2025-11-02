// === core/hud.js (production HUD: top bar, big-number, fever flame, result-full + coach say API) ===
'use strict';

export class HUD {
  constructor(){
    this.root = document.getElementById('hud');
    if(!this.root){
      this.root = document.createElement('div');
      this.root.id = 'hud';
      this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2000;';
      document.body.appendChild(this.root);
    }

    // Top
    this.top = document.createElement('div');
    this.top.style.cssText = 'position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
    this.top.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center">'+
        '<span id="hudMode"  style="padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e;pointer-events:auto">—</span>'+
        '<span id="hudDiff"  style="padding:4px 8px;border-radius:10px;background:#102b52;color:#e6f5ff;border:1px solid #1b4b8a;pointer-events:auto">—</span>'+
        '<span id="hudTime"  style="padding:4px 8px;border-radius:10px;background:#0a1f3d;color:#c9e7ff;border:1px solid #123863;min-width:64px;text-align:center;pointer-events:auto">—</span>'+
      '</div>'+
      '<div style="display:flex;gap:8px;align-items:center">'+
        '<span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#bbf7d0;border:1px solid #134064;pointer-events:auto">Score: <b id="hudScore">0</b></span>'+
        '<span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#fde68a;border:1px solid #134064;pointer-events:auto">Combo: <b id="hudCombo">0</b></span>'+
      '</div>';
    this.root.appendChild(this.top);
    this.$mode=this.top.querySelector('#hudMode'); this.$diff=this.top.querySelector('#hudDiff');
    this.$time=this.top.querySelector('#hudTime'); this.$score=this.top.querySelector('#hudScore'); this.$combo=this.top.querySelector('#hudCombo');

    // Fever bar (bottom-left)
    this.powerWrap = document.getElementById('powerBarWrap');
    if(!this.powerWrap){
      this.powerWrap=document.createElement('div');
      this.powerWrap.id='powerBarWrap';
      this.powerWrap.style.cssText='position:fixed;left:12px;bottom:12px;z-index:18;width:min(380px,92vw);pointer-events:none';
      this.powerWrap.innerHTML = '<div id="powerBar" style="position:relative;height:14px;border-radius:999px;background:#0a1931;border:1px solid #0f2a54;overflow:hidden"><div id="powerFill" style="position:absolute;inset:0;width:100%"></div></div>';
      document.body.appendChild(this.powerWrap);
    }
    this.$powerFill = this.powerWrap.querySelector('#powerFill');

    // Big number (center)
    this.big = document.createElement('div');
    this.big.style.cssText='position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);font:900 80px ui-rounded,system-ui;color:#fef3c7;text-shadow:0 8px 40px rgba(0,0,0,.6);pointer-events:none;opacity:0;transition:opacity .2s, transform .2s;z-index:2100';
    this.big.textContent='';
    this.root.appendChild(this.big);

    // Coach bubble (for Coach.say via HUD API)
    this.coachBox = document.getElementById('coachBox');
    if(!this.coachBox){
      this.coachBox = document.createElement('div');
      this.coachBox.id = 'coachBox';
      this.coachBox.style.cssText = 'position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001';
      document.body.appendChild(this.coachBox);
    }

    // Quest chips
    this.chips = document.createElement('div');
    this.chips.id='questChips';
    this.chips.style.cssText='position:fixed;left:12px;bottom:78px;display:flex;flex-wrap:wrap;gap:6px;max-width:92vw;pointer-events:none';
    this.root.appendChild(this.chips);

    // Result
    this.result = document.createElement('div');
    this.result.id='resultModal';
    this.result.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;z-index:2002';
    this.result.innerHTML=
      '<div style="width:min(560px,94vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">'+
        '<h3 id="resTitle" style="margin:0 0 6px;font:900 20px ui-rounded">Result</h3>'+
        '<p  id="resDesc"  style="margin:0 0 10px;color:#cfe7ff;white-space:pre-line">—</p>'+
        '<div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>'+
        '<div id="resExtra" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>'+
        '<div style="display:flex;gap:8px;justify-content:flex-end">'+
          '<button id="resHome"  style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button>'+
          '<button id="resRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button>'+
        '</div>'+
      '</div>';
    this.root.appendChild(this.result);
    this.$resTitle=this.result.querySelector('#resTitle'); this.$resDesc=this.result.querySelector('#resDesc');
    this.$resStats=this.result.querySelector('#resStats'); this.$resExtra=this.result.querySelector('#resExtra');
    this.onHome=null; this.onRetry=null;
    this.result.querySelector('#resHome').onclick = ()=>this.onHome && this.onHome();
    this.result.querySelector('#resRetry').onclick= ()=>this.onRetry && this.onRetry();

    // Expose HUD API for Coach
    window.__HHA_HUD_API = { say: (t)=>this.say(t) };
  }

  // Coach bubble through HUD
  say(text){
    const el = this.coachBox;
    if(!el) return;
    el.textContent = String(text||'');
    el.style.display = 'block';
    clearTimeout(this._coachHideTO);
    this._coachHideTO = setTimeout(()=>{ el.style.display='none'; }, 1200);
  }

  setTop({mode,diff}={}){ if(mode!=null) this.$mode.textContent=String(mode); if(diff!=null) this.$diff.textContent=String(diff); }
  setTimer(sec){ this.$time.textContent = Math.max(0,Math.round(sec))+'s'; }
  updateHUD(score,combo){ this.$score.textContent=String(score|0); this.$combo.textContent=String(combo|0); }

  setQuestChips(list=[]){
    const frag=document.createDocumentFragment();
    for(const m of list){
      const pct=m.need>0?Math.min(100,Math.round((m.progress/m.need)*100)):0;
      const d=document.createElement('div');
      d.style.cssText='pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:2px solid '+(m.active?'#22d3ee':'#16325d')+';background:'+(m.done?'#0f2e1f':m.fail?'#361515':'#0d1a31')+';color:#e6f2ff;';
      d.innerHTML =
        '<span style="font-size:16px">'+(m.icon||'⭐')+'</span>'+
        '<span style="font:700 12.5px ui-rounded">'+(m.label||m.key)+'</span>'+
        '<span style="font:700 12px;color:#a7f3d0;margin-left:6px">'+(m.progress||0)+'/'+(m.need||0)+'</span>'+
        '<i style="height:6px;width:120px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px"><b style="display:block;height:100%;width:'+pct+'%;background:'+(m.done?(m.fail?'#ef4444':'#22c55e'):'#22d3ee')+'"></b></i>';
      frag.appendChild(d);
    }
    this.chips.innerHTML=''; this.chips.appendChild(frag);
  }

  showFever(on){
    if(on){
      this.$powerFill.innerHTML =
        '<div class="fire" style="position:absolute;left:0;top:0;bottom:0;width:100%;'+
        'background:radial-gradient(30px 24px at 20% 110%,rgba(255,200,0,.9),rgba(255,130,0,.65)55%,rgba(255,80,0,0)70%),'+
        'radial-gradient(26px 20px at 45% 110%,rgba(255,210,80,.85),rgba(255,120,0,.55)55%,rgba(255,80,0,0)70%),'+
        'radial-gradient(34px 26px at 70% 110%,rgba(255,190,40,.9),rgba(255,110,0,.55)55%,rgba(255,80,0,0)70%),'+
        'linear-gradient(0deg,rgba(255,140,0,.65),rgba(255,100,0,.25));mix-blend-mode:screen;animation:fireRise .9s ease-in-out infinite"></div>';
    } else {
      this.$powerFill.innerHTML='';
    }
  }

  showFloatingText(x,y,text){
    const el=document.createElement('div');
    el.textContent=String(text);
    el.style.cssText='position:fixed;left:'+(x|0)+'px;top:'+(y|0)+'px;transform:translate(-50%,-50%);font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:2100;opacity:1;transition:all .72s ease-out;';
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.top=(y-36)+'px'; el.style.opacity='0'; });
    setTimeout(()=>{ try{el.remove();}catch{}; },720);
  }

  showBig(text){
    this.big.textContent=String(text||'');
    this.big.style.opacity='1';
    this.big.style.transform='translate(-50%,-50%) scale(1)';
    setTimeout(()=>{ this.big.style.opacity='0'; this.big.style.transform='translate(-50%,-50%) scale(.9)'; }, 350);
  }

  showResult({title='Result',desc='—',stats=[],extra=[]}={}){
    const frag1=document.createDocumentFragment(), frag2=document.createDocumentFragment();
    for(const s of stats){ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38'; b.textContent=String(s); frag1.appendChild(b); }
    for(const s of extra){ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #2a3e6a;background:#0c233f;color:#bfe0ff'; b.textContent=String(s); frag2.appendChild(b); }
    this.$resTitle.textContent = String(title);
    this.$resDesc.textContent  = String(desc);
    this.$resStats.innerHTML=''; this.$resStats.appendChild(frag1);
    this.$resExtra.innerHTML=''; this.$resExtra.appendChild(frag2);
    this.result.style.display='flex';
  }
  hideResult(){ this.result.style.display='none'; }

  toast(text){
    let t=document.getElementById('toast');
    if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; t.style.cssText='position:fixed;left:50%;top:68px;transform:translateX(-50%);background:#0e1930;border:1px solid #214064;color:#e8f3ff;padding:8px 12px;border-radius:10px;opacity:0;transition:opacity .3s;z-index:10040'; document.body.appendChild(t); }
    t.textContent=String(text); t.style.opacity='1'; setTimeout(()=>{ t.style.opacity='0'; },1200);
  }
}
