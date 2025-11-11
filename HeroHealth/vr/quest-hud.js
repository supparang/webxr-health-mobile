// === vr/quest-hud.js ===
export function questTitle(deck){
  const cur = deck.getCurrent();
  const i = deck.currentIndex || 0;
  return `Quest ${Math.min(i+1,3)}/3 — ${cur ? cur.label : 'กำลังสุ่ม…'}`;
}
export function questHUDUpdate(deck){
  window.dispatchEvent(new CustomEvent('hha:quest', {
    detail: { text: questTitle(deck) }
  }));
}
export default { questTitle, questHUDUpdate };