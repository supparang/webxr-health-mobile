
window.Story = (function(){
  const state = { mode:'quick', chapter:1, difficulty:'normal', hiit:false };
  function open(){ const ov=document.getElementById('storyOverlay'); ov && (ov.style.display='flex'); }
  function close(){ const ov=document.getElementById('storyOverlay'); ov && (ov.style.display='none'); }
  function applySelection(sel){ Object.assign(state, sel||{}); window.APP = window.APP || {}; APP.story = state; close(); const startBtn=document.getElementById('startBtn'); if(startBtn){ startBtn.click(); } }
  return { open, close, applySelection, state };
})();
