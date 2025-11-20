// ---------- Boss intro overlay ----------
function showBossIntro(next, opts){
  opts = opts || {};
  const mode   = opts.mode || 'first';   // 'first' | 'next' | 'final'
  const intro  = $('#boss-intro');
  if (!intro) {
    if (next) next();
    return;
  }

  const boss  = BOSSES[game.bossIndex];
  const emoji = $('#boss-intro-emoji');
  const name  = $('#boss-intro-name');
  const title = $('#boss-intro-title');
  const desc  = $('#boss-intro-desc');
  const label = intro.querySelector('.boss-intro-label');

  // เปลี่ยนข้อความ label ตามโหมด
  let labelText = 'BOSS APPEARS';
  if (mode === 'next')  labelText = 'NEXT BOSS';
  if (mode === 'final') labelText = 'FINAL BOSS';

  if (emoji) emoji.textContent = boss.emoji;
  if (name)  name.textContent  = boss.name;
  if (title) title.textContent = boss.title || '';
  if (desc)  desc.textContent  = boss.desc  || '';
  if (label) label.textContent = labelText;

  intro.classList.remove('hidden');
  requestAnimationFrame(() => intro.classList.add('boss-intro-show'));

  const autoMs = opts.autoMs || 2000;
  let closed = false;
  function closeIntro(){
    if (closed) return;
    closed = true;
    intro.classList.remove('boss-intro-show');
    setTimeout(() => intro.classList.add('hidden'), 180);
    if (next) next();
  }

  intro.addEventListener('click', closeIntro, { once: true });
  setTimeout(closeIntro, autoMs);
}