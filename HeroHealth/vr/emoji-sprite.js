// === vr/emoji-sprite.js ===
export const Emoji = {
  create({type='GOOD', size=0.6}){
    const map = {
      GOOD:['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'],
      JUNK:['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'],
      STAR:['⭐'],
      DIAMOND:['💎']
    };
    const pool = map[type]||map.GOOD;
    const char = pool[Math.floor(Math.random()*pool.length)];

    const el = document.createElement('a-entity');
    el.setAttribute('text', {value: char, align:'center', width: size*3, color:'#fff'});
    const back = document.createElement('a-entity');
    back.setAttribute('text', {value: char, align:'center', width: size*3, color:'#000'});
    back.setAttribute('position','0 -0.005 -0.005');
    el.appendChild(back);
    return el;
  }
};
