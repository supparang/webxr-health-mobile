// --- particle.js ---
export function playHitParticle(parent, x, y, emoji='💥'){
  const el = document.createElement('div');
  el.className = 'hitParticle';
  el.textContent = emoji;
  el.style.left = x+'px';
  el.style.top  = y+'px';
  parent.appendChild(el);
  setTimeout(()=> el.remove(), 500);
}