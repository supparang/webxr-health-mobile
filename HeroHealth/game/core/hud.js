// === Hero Health Academy — HUD v3.1 ===
// Smart Power Timers + Shield Segment + Glow Animations
// Compatible with PowerUpSystem v3 (x2, freeze, sweep, shield)

export class HUD {
  constructor() {
    this.$wrap = document.getElementById('hudWrap') || this._ensureWrap();
    this.$score = document.getElementById('score');
    this.$combo = document.getElementById('combo');
    this.$time = document.getElementById('time');
    this.$feverBar = document.getElementById('feverBar');

    this.$powerBar = document.getElementById('powerBar');
    this._ensurePowerBar();
    this._ensurePowerbarStyles();

    this.$toast = document.getElementById('toast') || this._ensureToast();
    this._applyLayerFixes();
  }

  /* -------------------- Basic Info -------------------- */
  setScore(v){ if(this.$score) this.$score.textContent = v|0; }
  setCombo(v){ if(this.$combo) this.$combo.textContent = v; }
  setTime(v){ if(this.$time) this.$time.textContent = v|0; }
  setFeverProgress(p){ if(this.$feverBar) this.$feverBar.style.width = (p*100)+'%'; }

  /* -------------------- Power-Up HUD -------------------- */
  setPowerTimers(timers){
    const wrap = this.$powerBar; if(!wrap) return;
    const DEF = {
      x2:     { icon:'⚡', name:'x2',     grad:'linear-gradient(90deg,#ffd54a,#ff8a00)', glow:'#ffb300' },
      freeze: { icon:'❄️', name:'Freeze', grad:'linear-gradient(90deg,#66e0ff,#4fc3f7)', glow:'#4fc3f7' },
      sweep:  { icon:'🧲', name:'Magnet', grad:'linear-gradient(90deg,#9effa8,#7fffd4)', glow:'#00ffa6' },
      shield: { icon:'🛡', name:'Shield', grad:'linear-gradient(90deg,#a3b8ff,#9f8cff)', glow:'#8e84ff' }
    };

    Object.keys(DEF).forEach(k=>{
      const seg = wrap.querySelector(`.pseg[data-k="${k}"]`) || this._mkPseg(k, DEF[k].icon, DEF[k].name);
      const v = Math.max(0, Number(timers?.[k]||0));
      const fill = seg.querySelector('.barfill');
      const ttxt = seg.querySelector('.ptime');
      fill.style.width = (v*10)+'%';
      fill.style.background = DEF[k].grad;
      ttxt.textContent = v>0 ? `${v|0}s` : '';

      if(v>0){
        seg.classList.add('active');
        seg.style.opacity = '1';
        if(v<=3) seg.classList.add('low'); else seg.classList.remove('low');
      } else {
        seg.classList.remove('active','low');
        seg.style.opacity = '.55';
        fill.style.width = '0%';
      }
    });
  }

  /* -------------------- Internals -------------------- */
  _ensureWrap(){
    const el=document.createElement('section');
    el.id='hudWrap';
    Object.assign(el.style,{position:'fixed',top:'50px',left:0,right:0,display:'flex',
      flexDirection:'column',alignItems:'center',zIndex:95,pointerEvents:'none'});
    document.body.appendChild(el);
    return el;
  }

  _ensurePowerBar(){
    if(!this.$powerBar){
      const bar=document.createElement('div');
      bar.id='powerBar';
      Object.assign(bar.style,{display:'flex',gap:'8px',alignItems:'center',
        background:'rgba(16,32,56,.72)',border:'1px solid #1a2c47b0',
        padding:'6px 8px',borderRadius:'999px'});
      this.$wrap.appendChild(bar);
      this.$powerBar=bar;
    }
    const kinds=[['x2','⚡','x2'],['freeze','❄️','Freeze'],['sweep','🧲','Magnet'],['shield','🛡','Shield']];
    kinds.forEach(([k,ico,name])=>{
      if(!this.$powerBar.querySelector(`.pseg[data-k="${k}"]`))
        this._mkPseg(k,ico,name);
    });
  }

  _mkPseg(k,icon,name){
    const seg=document.createElement('div');
    seg.className='pseg';
    seg.dataset.k=k;
    Object.assign(seg.style,{display:'inline-flex',alignItems:'center',gap:'6px',
      padding:'6px 8px',borderRadius:'999px',border:'1px solid #19304e',
      background:'#0f213a',position:'relative',overflow:'hidden',opacity:'.55'});

    const ico=document.createElement('span');
    ico.className='picon';
    ico.textContent=icon; Object.assign(ico.style,{fontSize:'14px'});
    const lbl=document.createElement('span');
    lbl.className='plbl'; lbl.textContent=name;
    Object.assign(lbl.style,{font:'800 12px ui-rounded',opacity:.9});
    const meter=document.createElement('i');
    meter.className='bar';
    Object.assign(meter.style,{position:'relative',height:'8px',width:'78px',
      borderRadius:'999px',background:'rgba(255,255,255,.08)'});
    const fill=document.createElement('b');
    fill.className='barfill';
    Object.assign(fill.style,{position:'absolute',left:0,top:0,bottom:0,width:'0%',
      borderRadius:'999px',transition:'width .25s ease'});
    meter.appendChild(fill);
    const t=document.createElement('em');
    t.className='ptime'; Object.assign(t.style,{font:'800 11px ui-rounded',opacity:.85});
    seg.append(ico,lbl,meter,t);
    this.$powerBar.appendChild(seg);
    return seg;
  }

  _ensurePowerbarStyles(){
    if(document.getElementById('hud-powerbar-css')) return;
    const css=document.createElement('style');
    css.id='hud-powerbar-css';
    css.textContent=`
      @keyframes hhaPulse {0%,100%{box-shadow:0 0 0 0 rgba(55,227,198,.0)}
        50%{box-shadow:0 0 0 6px rgba(55,227,198,.14)}}
      #powerBar .pseg.active {animation:hhaPulse 1.2s ease-in-out infinite;border-color:#2dd4bf80;}
      #powerBar .pseg[data-k="shield"].active {
        border-color:#a3b8ffb0;
        animation:hhaShieldGlow 1.4s ease-in-out infinite;
      }
      @keyframes hhaShieldGlow {
        0%,100%{box-shadow:0 0 6px 0 rgba(164,180,255,0.0);}
        50%{box-shadow:0 0 12px 4px rgba(164,180,255,0.45);}
      }
      #powerBar .pseg.low .bar {background:rgba(255,160,122,.18)!important;}
    `;
    document.head.appendChild(css);
  }

  _ensureToast(){
    const t=document.createElement('div');
    t.id='toast';
    Object.assign(t.style,{display:'none',position:'fixed',bottom:'40px',left:'50%',
      transform:'translateX(-50%)',background:'rgba(0,0,0,.7)',color:'#fff',
      padding:'8px 14px',borderRadius:'8px',font:'600 14px ui-rounded'});
    document.body.appendChild(t);
    return t;
  }

  _applyLayerFixes(){
    if(this.$wrap) this.$wrap.style.pointerEvents='none';
    if(this.$powerBar) this.$powerBar.style.pointerEvents='auto';
  }

  toast(text,ms=1200){
    if(!this.$toast) return;
    this.$toast.textContent=String(text);
    this.$toast.style.display='block';
    this.$toast.classList.remove('show');
    void this.$toast.offsetHeight;
    this.$toast.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT=setTimeout(()=>this.$toast.style.display='none',ms);
  }
}
