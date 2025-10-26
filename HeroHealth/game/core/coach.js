// game/core/coach.js
export class Coach{
  constructor({lang='TH'}={}){ this.lang=lang; this.lastSay=0; }
  setLang(l){ this.lang=l; }

  t(key){
    const TH={
      start:'เริ่มกัน! เก็บของดีให้ไว 💪',
      fever:'ไฟติดแล้ว เก็บยับ!',
      near:'อีกนิดเดียว สู้ต่อ!',
      failStreak:'ไม่เป็นไร ตั้งสติก่อนนะ',
      quest:'ภารกิจย่อยใกล้เสร็จแล้ว!',
      questDone:'เยี่ยม! เควสสำเร็จ 🏁',
      combo10:'คอมโบแรงมาก!',
      endGood:'สุดยอดมาก!',
      endOk:'ดีใช้ได้!'
    };
    const EN={
      start:'Go! Grab the good stuff 💪',
      fever:'FEVER on, go!',
      near:'Almost there, keep it up!',
      failStreak:'Shake it off!',
      quest:'Mini-quest almost done!',
      questDone:'Nice! Quest complete 🏁',
      combo10:'Great combo!',
      endGood:'Awesome!',
      endOk:'Nice run!'
    };
    return (this.lang==='EN'?EN:TH)[key];
  }

  say(hud,text){ if(Date.now()-this.lastSay<450) return; hud?.say?.(text); this.lastSay=Date.now(); }
  onStart(hud){ this.say(hud,this.t('start')); }
  onFever(hud){ this.say(hud,this.t('fever')); }
  onNearEnd(hud){ this.say(hud,this.t('near')); }
  onFailStreak(hud){ this.say(hud,this.t('failStreak')); }
  onQuestPush(hud){ this.say(hud,this.t('quest')); }
  onQuestDone(hud){ this.say(hud,this.t('questDone')); }
  onCombo10(hud){ this.say(hud,this.t('combo10')); }
  onEnd(hud,score){ this.say(hud, score>=200?this.t('endGood'):this.t('endOk')); }
}
