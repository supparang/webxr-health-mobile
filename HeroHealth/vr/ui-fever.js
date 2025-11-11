// === vr/ui-fever.js — แถบ Fever Bar (VR/DOM overlay) ===
export function ensureFeverGauge() {
  destroyFeverGauge();
  const wrap = document.createElement('div');
  wrap.id = 'feverWrap';
  wrap.setAttribute('data-hha-ui','');
  Object.assign(wrap.style,{
    position:'fixed',left:'50%',top:'16px',transform:'translateX(-50%)',
    width:'min(520px,86vw)',zIndex:'910',color:'#fefce8',
    background:'#0f172acc',border:'1px solid #f59e0b66',borderRadius:'12px',
    padding:'8px 12px',backdropFilter:'blur(6px)',fontWeight:'800'
  });
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span>🔥 Fever</span><span id="feverLbl">Inactive</span>
    </div>
    <div style="height:12px;margin-top:6px;background:#0b1222;border:1px solid #f59e0b33;border-radius:999px;overflow:hidden">
      <div id="feverFill" style="height:100%;width:0;background:linear-gradient(90deg,#f59e0b,#ef4444)"></div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

export function destroyFeverGauge() {
  const el=document.getElementById('feverWrap');
  if(el) try{el.remove();}catch{}
}

export function setFeverGauge(val) {
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

// เอฟเฟกต์เล็กเวลาเข้า Fever
export function feverBurstScreen(){
  for(let i=0;i<24;i++){
    const p=document.createElement('div');
    Object.assign(p.style,{
      position:'fixed',left:(Math.random()*100)+'%',top:(Math.random()*100)+'%',
      width:'6px',height:'6px',borderRadius:'999px',
      background:(Math.random()<.5?'#f59e0b':'#ef4444'),opacity:'0.9',zIndex:999,
      transition:'all .8s ease'
    });
    document.body.appendChild(p);
    const tx=Math.random()*window.innerWidth, ty=Math.random()*window.innerHeight;
    setTimeout(()=>{p.style.left=tx+'px';p.style.top=ty+'px';p.style.opacity='0';},20);
    setTimeout(()=>{try{p.remove();}catch{}},800);
  }
}

export default { ensureFeverGauge, destroyFeverGauge, setFeverGauge, feverBurstScreen };
