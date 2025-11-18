// fitness/js/sfx.js
'use strict';

const BASE = '../sfx/';  // วางไฟล์ใน fitness/sfx/*.mp3

const NAMES = ['tap','perfect','good','late','miss','fever'];
const cache = {};

for (const name of NAMES){
  try{
    const a = new Audio(BASE + name + '.mp3');
    a.preload = 'auto';
    cache[name] = a;
  }catch(e){}
}

export const SFX = {
  play(name){
    const a = cache[name];
    if (!a) return;
    try{
      a.currentTime = 0;
      a.play().catch(()=>{});
    }catch(e){}
  }
};