// === core/hud.js (production HUD: top bar, mini-quest, fever flame, result-full, coach-say bridge) ===
'use strict';

export class HUD {
  constructor(){
    ensureStyle(); // inject keyframes

    // ---- root ----
    this.root = document.getElementById('hud');
    if(!this.root){
      this.root = document.createElement('div');
      this.root.id = 'hud';
      this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2000;';
      document.body.appendChild(this.root);
    }

    // ---- top bar ----
    this.top = document.createElement('div');
    this.top.style.cssText = 'position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
    this.top.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center">'+
        '<span id="hudMode"  style="padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e">—</span>'+
        '<span id="hudDiff"  style="padding:4px 8px;border-radius:10px;background:#102b52;color:#e6f5ff;border:1px solid #1b4b8a">—</span>'+
        '<span id="hudTime"  style="padding:4px 8px;border-radius:10px;background:#0a1f3d;color:#c9e7ff;border:1px solid #123863;min-width:72px;text-align:center">—</span>'+
      '</div>'+
      '<div style="display:flex;gap:8px;align-items:center">'+
        '<span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#bbf7d0;border:1px solid #134064">Score: <b id="hudScore">0</b></span>'+
        '<span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#fde68a;border:1px solid #134064">Combo: <b id="hudCombo">0</b></span>'+
      '</div>';
    this.root.appendChild(this.top);

    this.$mode  = this.top.querySelector('#hudMode');
    this.$diff  = this.top.querySelector('#hudDiff');
    this.$time  = this.top.querySelector('#hudTime');
    this.$score = this.top.querySelector('#hudScore');
    this.$combo = this.top.querySelector('#hudCombo');

    // ---- fever bar ----
    this.powerWrap = document.getElementById('powerBarWrap');
    if(!this.powerWrap){
      this.powerWrap = document.createElement('div');
      this.powerWrap.id = 'powerBarWrap';
      this.powerWrap.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:18;width:min(420px,94vw);pointer-events:none';
      this.powerWrap.innerHTML =
        '<div id="powerBar" style="position:relative;height:16px;border-radius:999px;background:#0a1931;border:1px solid #0f2a54;overflow:hidden">'+
          '<div id="powerFill" style="position:absolute;inset:0;width:100%"></div>'+
        '</div>';
      document.body.appendChild(this.powerWrap);
    }
    this.$powerFill = this.powerWrap.querySelector('#powerFill');

    // ---- big number ----
    this.big = document.createElement('div');
    this.big.style.cssText = 'position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);font:900 92px ui-rounded,system-ui;color:#fef3c7;text-shadow:0 8px 40px rgba(0,0,0,.6);pointer-events:none;opacity:0;transition:opacity .2s,transform .2s;z-index:7000';
    this.root.appendChild(this.big);

    // ---- quest chips ----
    this.chips = document.createElement('div');
    this.chips.id = 'questChips';
    this.chips.style.cssText = 'position:fixed;left:12px;bottom:78px;display:flex;flex-wrap:wrap;gap:6px;max-width:92vw;pointer-events:none';
    this.root.appendChild(this.chips);

    // ---- mini-quest (ทีละอัน) ----
    this.miniQuest = document.createElement('div');
    this.miniQuest.id = 'miniQuest';
    Object.assign(this.miniQuest.style,{
      position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',
      background:'#0e1930cc',padding:'8px 14px',borderRadius:'12px',
      font:'700 17px ui-rounded',color:'#ffe19f',zIndex:2600,
      textShadow:'0 0 6px rgba(255,200,0,.6)',opacity:'0',
      transition:'opacity .3s'
    });
    document.body.appendChild(this.miniQuest);

    // ---- result modal ----
    this.result = document.createElement('div');
    this.result.id = 'resultModal';
    this.result.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;z-index:2002';
    this.result.innerHTML =
      '<div style="width:min(600px,94vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:18px;color:#e6f2ff">'+
        '<h3 id="resTitle" style="margin:0 0 6px;font:900 22px ui-rounded">Result</h3>'+
        '<p  id="resDesc"  style="margin:0 0 10px;color:#cfe7ff;white-space:pre-line">—</p>'+
        '<div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"></div>'+
        '<div id="resExtra" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>'+
        '<div style="display:flex;gap:8px;justify-content:flex-end">'+
          '<button id="resHome"  style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button>'+
          '<button id="resRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button>'+
        '</div>'+
      '</div>';
    this.root.appendChild(this.result);
    this.$resTitle=this.result.querySelector('#resTitle');
    this.$resDesc=this.result.querySelector('#resDesc');
    this.$resStats=this.result.querySelector('#resStats');
    this.$resExtra=this.result.querySelector('#resExtra');
    this.onHome=null; this.onRetry=null;
    this.result.querySelector('#resHome').onclick=()=>this.onHome&&this.onHome();
    this.result.querySelector('#resRetry').onclick=()=>this.onRetry&&this.onRetry();

    // ---- expose Coach bridge ----
    window.__HHA_HUD_API={ say:(msg)=>this.toast(msg) };
  }

  // ---------- Top HUD ----------
  setTop({mode,diff}={}){ if(mode!=null)this.$mode.textContent=String(mode); if(diff!=null)this.$diff.textContent=String(diff); }
  setTimer(sec){ this.$time.textContent=Math.max(0,Math.round(sec))+'s'; }
  updateHUD(score,combo){ this.$score.textContent=String(score|0); this.$combo.textContent=String(combo|0); }

  // ---------- Mini Quest ----------
  showMiniQuest(text){
    this.miniQuest.textContent=text;
    this.miniQuest.style.color='#ffe19f';
    this.miniQuest.style.opacity='1';
  }
  showMiniQuestComplete(text){
    this.miniQuest.textContent=`✅ สำเร็จ: ${text}`;
    this.miniQuest.style.color='#9eff9e';
    setTimeout(()=>{ this.miniQuest.style.opacity='0'; },1000);
  }

  // ---------- Fever visuals ----------
  showFever(on){
    if(on){
      document.body.classList.add('fever-on');
      this.$powerFill.innerHTML =
        '<div class="fire" style="position:absolute;left:0;top:0;bottom:0;width:100%;'+
        'background:radial-gradient(30px 24px at 20% 110%,rgba(255,200,0,.9),rgba(255,130,0,.65)55%,rgba(255,80,0,0)70%),'+
        'radial-gradient(26px 20px at 45% 110%,rgba(255,210,80,.85),rgba(255,120,0,.55)55%,rgba(255,80,0,0)70%),'+
        'radial-gradient(34px 26px at 70% 110%,rgba(255,190,40,.9),rgba(255,110,0,.55)55%,rgba(255,80,0,0)70%),'+
        'linear-gradient(0deg,rgba(255,140,0,.65),rgba(255,100,0,.25));mix-blend-mode:screen;animation:fireRise .9s ease-in-out infinite"></div>';
    } else {
      document.body.classList.remove('fever-on');
      this.$powerFill.innerHTML='';
    }
  }
  resetBars(){ this.$powerFill.innerHTML=''; }

  // ---------- Floating + Big ----------
  showFloatingText(x,y,text){
    const el=document.createElement('div');
    el.textContent=String(text);
    el.style.cssText=`position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);
      font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;
      pointer-events:none;z-index:6900;opacity:1;transition:all .72s ease-out;`;
    document.body.appendChild(el);
    requestAnimationFrame(()=>{el.style.top=(y-36)+'px'; el.style.opacity='0';});
    setTimeout(()=>{try{el.remove();}catch{};},720);
  }
  showBig(text){
    this.big.textContent=String(text||'');
    this.big.style.opacity='1';
    this.big.style.transform='translate(-50%,-50%) scale(1)';
    setTimeout(()=>{this.big.style.opacity='0'; this.big.style.transform='translate(-50%,-50%) scale(.9)';},380);
  }

  // ---------- Result ----------
  showResult({title='Result',desc='—',stats=[],extra=[]}={}){
    const frag1=document.createDocumentFragment(),frag2=document.createDocumentFragment();
    for(const s of stats){
      const b=document.createElement('div');
      b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38';
      b.textContent=String(s); frag1.appendChild(b);
    }
    for(const s of extra){
      const b=document.createElement('div');
      b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #2a3e6a;background:#0c233f;color:#bfe0ff';
      b.textContent=String(s); frag2.appendChild(b);
    }
    this.$resTitle.textContent=String(title);
    this.$resDesc.textContent=String(desc);
    this.$resStats.innerHTML=''; this.$resStats.appendChild(frag1);
    this.$resExtra.innerHTML=''; this.$resExtra.appendChild(frag2);
    this.result.style.display='flex';
  }
  hideResult(){ this.result.style.display='none'; }

  // ---------- Toast ----------
  toast(text){
    let t=document.getElementById('toast');
    if(!t){
      t=document.createElement('div');
      t.id='toast';
      t.className='toast';
      t.style.cssText='position:fixed;left:50%;top:68px;transform:translateX(-50%);background:#0e1930;border:1px solid #214064;color:#e8f3ff;padding:8px 12px;border-radius:10px;opacity:0;transition:opacity .3s;z-index:10040';
      document.body.appendChild(t);
    }
    t.textContent=String(text);
    t.style.opacity='1';
    setTimeout(()=>{t.style.opacity='0';},1200);
  }
}

/* ---------- Local style injection ---------- */
function ensureStyle(){
  if(document.getElementById('hud-style'))return;
  const s=document.createElement('style'); s.id='hud-style';
  s.textContent=`
  @keyframes fireRise {
    0%   { transform:translateY(6%); opacity:.85; }
    50%  { transform:translateY(-6%); opacity:1; }
    100% { transform:translateY(6%); opacity:.85; }
  }
  body.fever-on #powerBar {
    box-shadow:0 0 16px rgba(255,140,0,.25) inset,0 0 18px rgba(255,120,0,.25);
  }`;
  document.head.appendChild(s);
}
