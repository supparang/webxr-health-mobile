export class FloatingFX{ constructor(engine){ this.engine=engine; }
  spawn3D(obj,html,kind){
    const d=document.createElement('div');
    d.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font-weight:700;color:'+(kind==='bad'?'#ff6':'#6f6')+';text-shadow:0 0 8px rgba(0,0,0,.6)';
    d.innerHTML=html; document.body.appendChild(d);
    setTimeout(()=>{ d.style.transition='all .4s'; d.style.opacity='0'; d.style.top='40%'; },40);
    setTimeout(()=>d.remove(),700);
  }
}