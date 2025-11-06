// HeroHealth/modes/goodjunk.safe.js  (SMOKE TEST)
export async function boot({host}) {
  const scene = document.querySelector('a-scene');
  const box = document.createElement('a-box');
  box.setAttribute('color','#22c55e');
  box.setAttribute('position','0 1.2 -1.2');
  box.classList.add('clickable');
  (host || scene).appendChild(box);
}
