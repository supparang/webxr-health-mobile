// === /HeroHealth/vr/ui-fever.js (fixed with setFlame) ===
export function ensureFeverGauge() {
  destroyFeverGauge();
  const wrap = document.createElement('div');
  wrap.id = 'feverWrap';
  wrap.setAttribute('data-hha-ui','');
  Object.assign(wrap.style,{
    position:'fixed',left:'50%',top:'12px',transform:'translateX(-50%)',
    width:'min(520px,86vw)',zIndex:'910',color:'#fefce8',
    background:'#0f172acc',border:'1px solid #f59e0b66',borderRadius:'12px',
    padding:'8px 12px',backdropFilter:'blur(6px)',fontWeight:'800',pointerEvents:'none'
  });
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span>🔥 Fever</span><span id="feverLbl">Inactive</span>
    </div>
    <div style="height:12px;margin-top:6px;background:#0b1222;border:1px solid #f59e0b33;border-radius:999px;overflow:hidden">
      <div id="feverFill" style="height:100%;width:0;background:linear-gradient(90deg,#fcd34d,#f59e0b)"></div>
    </div>`;
  document.body.appendChild(wrap);

  // 🔥 flame overlay (ไฟลุก)
  const flame = document.createElement('div');
  flame.id = 'feverFlame';
  Object.assign(flame.style,{
    position:'fixed',inset:'0',pointerEvents:'none',zIndex:905,display:'none',
    background:'radial-gradient(1200px 600px at 50% 110%, rgba(245,158,11,.28), rgba(239,68,68,.22) 40%, transparent 70%)'
  });
  const style = document.createElement('style');
  style.textContent = `
    @keyframes flamePulse{0%{filter:brightness(1)}50%{filter:brightness(1.25)}100%{filter:brightness(1)}}
    #feverFlame{animation:flamePulse 1.1s ease-in-out infinite;}
  `;
  document.head.appendChild(style);
  document.body.appendChild(flame);
}

export function destroyFeverGauge(){
  ['feverWrap','feverFlame'].forEach(id=>{
    const el=document.getElementById(id); if(el) try{el.remove();}catch{}
  });
}

export function setFeverGauge(val){
  const f=document.getElementById('feverFill'),
        l=document.getElementById('feverLbl');
  if(!f||!l) return;
  const pct=Math.max(0,Math.min(100,Math.round(val)));
  f.style.width=pct+'%';
  let zone='Inactive';
  if(pct>0 && pct<100) zone='Charging';
  if(pct>=100) zone='🔥 Active!';
  l.textContent=zone;
  f.style.background=(zone==='🔥 Active!')
    ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
    : 'linear-gradient(90deg,#fcd34d,#f59e0b)';
}

// ✅ ฟังก์ชันที่หายไป
export function setFlame(on){
  const el=document.getElementById('feverFlame'); if(!el) return;
  el.style.display = on ? 'block' : 'none';
}

export function feverBurstScreen(){
  for(let i=0;i<26;i++){
    const p=document.createElement('div');
    Object.assign(p.style,{
      position:'fixed',left:'50%',top:'60px',width:'6px',height:'6px',borderRadius:'999px',
      background:(Math.random()<.5?'#f59e0b':'#ef4444'),opacity:'0.95',zIndex:999,
      transform:'translate(-50%,-50%)',transition:'all .8s ease',pointerEvents:'none'
    });
    document.body.appendChild(p);
    const ang=Math.random()*Math.PI*2, r=80+Math.random()*180;
    const tx=window.innerWidth/2 + Math.cos(ang)*r;
    const ty=60 + Math.sin(ang)*r;
    setTimeout(()=>{ p.style.left=tx+'px'; p.style.top=ty+'px'; p.style.opacity='0'; },20);
    setTimeout(()=>{ try{p.remove();}catch{} },820);
  }
}

export default { ensureFeverGauge, destroyFeverGauge, setFeverGauge, setFlame, feverBurstScreen };
