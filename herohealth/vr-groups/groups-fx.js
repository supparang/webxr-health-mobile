(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const FX = {
    panic(on){
      DOC.documentElement.classList.toggle('panic', !!on);
    },
    stunFlash(){
      DOC.documentElement.classList.add('stunflash');
      setTimeout(()=>DOC.documentElement.classList.remove('stunflash'), 240);
    },
    swapFlash(){
      DOC.documentElement.classList.add('swapflash');
      setTimeout(()=>DOC.documentElement.classList.remove('swapflash'), 240);
    },
    afterimage(xpx, ypx, emoji){
      // uses CSS .fg-afterimage / .fg-afterimage-inner
      const mk = (cls, dy, dur)=>{
        const wrap = DOC.createElement('div');
        wrap.className = 'fg-afterimage ' + cls;
        const inner = DOC.createElement('div');
        inner.className = 'fg-afterimage-inner';
        inner.textContent = emoji || '✨';
        inner.style.setProperty('--x', (xpx||0) + 'px');
        inner.style.setProperty('--y', (ypx||0) + 'px');
        wrap.appendChild(inner);
        DOC.body.appendChild(wrap);
        setTimeout(()=>{ try{ wrap.remove(); }catch{} }, dur);
      };
      mk('a1', 0, 260);
      mk('a2', 0, 320);
    }
  };

  NS.FX = NS.FX || FX;
})(window);