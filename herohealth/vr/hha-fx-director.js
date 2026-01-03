(function(){
  if (window.__HHA_FX_READY) return;
  window.__HHA_FX_READY = true;

  document.addEventListener('hha:judge', e=>{
    const d = e.detail||{};
    if (!window.Particles) return;

    if (d.type === 'good') {
      Particles.burst(d.x||innerWidth/2, d.y||innerHeight/2);
      document.body.classList.add('fx-hit-good');
      setTimeout(()=>document.body.classList.remove('fx-hit-good'),180);
    }

    if (d.type === 'bad') {
      document.body.classList.add('fx-hit-bad');
      setTimeout(()=>document.body.classList.remove('fx-hit-bad'),220);
    }
  });

  document.addEventListener('hha:score', e=>{
    const d = e.detail||{};
    Particles?.popText(d.x||innerWidth/2, d.y||innerHeight/2, `+${d.score}`, 'score');
  });
})();