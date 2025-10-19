export class FloatingFX {
  constructor(engine){
    this.engine=engine;
    this.layer=document.createElement('div');
    this.layer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:5;font-family:var(--fontEN),var(--fontTH)';
    document.body.appendChild(this.layer);
  }
  spawnScreenText(x,y,html,kind='info'){
    const el=document.createElement('div'); el.innerHTML=html;
    const st=el.style; st.position='absolute'; st.left=x+'px'; st.top=y+'px'; st.transform='translate(-50%,-30%)';
    st.padding='4px 8px'; st.borderRadius='10px'; st.border='1px solid rgba(0,255,255,.6)'; st.background='rgba(0,0,0,.35)';
    st.color='#cfffff'; st.textShadow='0 0 12px rgba(0,255,255,.45)'; st.transition='all .6s ease';
    if(kind==='good'){ st.borderColor='rgba(0,255,180,.7)'; st.color='#dbfff1'; }
    if(kind==='bad'){ st.borderColor='rgba(255,60,60,.7)'; st.color='#ffdddd'; }
    if(kind==='fever'){ st.borderColor='rgba(255,0,200,.8)'; st.color='#ffd6ff'; st.boxShadow='0 0 14px rgba(255,0,200,.35) inset'; }
    this.layer.appendChild(el);
    requestAnimationFrame(()=>{ st.transform='translate(-50%,-120%) scale(1.05)'; st.opacity='0'; });
    setTimeout(()=>el.remove(), 800);
  }
  spawn3D(obj, text, kind='good'){
    const v=obj.position.clone(); obj.parent.localToWorld(v); v.project(this.engine.camera);
    const x=(v.x*0.5+0.5)*innerWidth, y=(-v.y*0.5+0.5)*innerHeight;
    this.spawnScreenText(x,y, text, kind);
  }
}