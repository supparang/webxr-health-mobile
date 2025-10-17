<!-- core/exo-i18n.js -->
<script>
/* EXO_I18N — minimal i18n helper (TH/EN) with packs per module.
   Priority of lang: URL ?lang= → EXO_SETTINGS.lang → localStorage → browser → 'th'
*/
(function(global){
  const LS_KEY = 'exo.lang';
  const urlLang = new URLSearchParams(location.search).get('lang');
  const settingsLang = (global.EXO_SETTINGS && global.EXO_SETTINGS.get && global.EXO_SETTINGS.get()?.lang) || null;

  const detectBrowser = () => {
    const n = (navigator.language || '').toLowerCase();
    if (n.startsWith('th')) return 'th';
    return 'en';
  };

  let current = (urlLang || settingsLang || localStorage.getItem(LS_KEY) || detectBrowser() || 'th').toLowerCase();
  if (!['th','en'].includes(current)) current = 'th';

  const packs = {
    // ====== common UI ======
    common: {
      th: {
        hub:'กลับ Hub', restart:'เริ่มใหม่', paused:'พักเกม', result:'ผลลัพธ์', score:'คะแนน',
        maxCombo:'คอมโบสูงสุด', accuracy:'ความแม่นยำ', notes:'จำนวนโน้ต', bpm:'BPM', diff:'ระดับ',
        music:'เพลง', opponent:'คู่แข่ง', oppScore:'คะแนนคู่แข่ง', oppStatus:'สถานะคู่แข่ง',
        finished:'จบแล้ว', pending:'รอผล...', youWin:'YOU WIN', youLose:'YOU LOSE', tie:'TIE',
        askName:'ชื่อสำหรับ Leaderboard (เว้นว่างเพื่อข้าม):', sent:'✓ ส่งคะแนนขึ้น Leaderboard แล้ว',
        vs:'โหมดดวล'
      },
      en: {
        hub:'Hub', restart:'Restart', paused:'Paused', result:'Result', score:'Score',
        maxCombo:'Max Combo', accuracy:'Accuracy', notes:'Notes', bpm:'BPM', diff:'Difficulty',
        music:'Music', opponent:'Opponent', oppScore:'Opponent Score', oppStatus:'Opponent Status',
        finished:'Finished', pending:'Pending…', youWin:'YOU WIN', youLose:'YOU LOSE', tie:'TIE',
        askName:'Name for Leaderboard (leave blank to skip):', sent:'✓ Submitted to Leaderboard',
        vs:'VS Mode'
      }
    },

    // ====== game-specific ======
    combat: {
      th: {
        title:'EXO — Combat Reflex',
        goal:'ตีเป้าสีน้ำเงินให้ตรงเส้น Hit Line · อย่าตี Decoy (สีแดง)',
        ctrl:'<ul style="text-align:left;margin:0 auto;max-width:260px"><li>มือถือ/เดสก์ท็อป: แตะซ้าย/ขวา</li><li>คีย์บอร์ด: ←/A และ →/D</li><li>VR: Trigger ซ้าย/ขวา</li></ul>',
        scoreTip:'ใกล้เส้นยิ่งได้คะแนนมาก · ตี decoy จะถูกหักคะแนนและคอมโบตก',
        hitRate:'ความแม่นยำ',
      },
      en: {
        title:'EXO — Combat Reflex',
        goal:'Hit blue targets on the Hit Line · Avoid red decoys',
        ctrl:'<ul style="text-align:left;margin:0 auto;max-width:260px"><li>Mobile/Desktop: Tap Left/Right</li><li>Keyboard: ←/A and →/D</li><li>VR: Left/Right Trigger</li></ul>',
        scoreTip:'Closer to the line = higher score · Hitting decoys penalizes score & combo',
        hitRate:'Hit Rate',
      }
    },

    rhythm: {
      th: {
        title:'EXO — Rhythm Sync',
        goal:'ตีตามจังหวะ BPM ให้โน้ตชนเส้นพอดี · Hold ต้องกดค้างจนจบแท่ง',
        ctrl:'<ul style="text-align:left;margin:0 auto;max-width:260px"><li>มือถือ: แตะซ้าย/ขวา</li><li>คีย์บอร์ด: ←/A และ →/D</li><li>VR: Trigger ซ้าย/ขวา</li></ul>',
        scoreTip:'PERFECT/GOOD/OKAY/MISS ตามความตรงเวลา · คอมโบสูงยิ่งได้คะแนนมาก',
        hitHint:'ตีให้ตรงเส้น ↓',
        perfect:'Perfect', good:'Good', okay:'Okay', miss:'Miss'
      },
      en: {
        title:'EXO — Rhythm Sync',
        goal:'Hit notes on the line; hold notes must be held to the end',
        ctrl:'<ul style="text-align:left;margin:0 auto;max-width:260px"><li>Mobile: Tap Left/Right</li><li>Keyboard: ←/A and →/D</li><li>VR: Left/Right Trigger</li></ul>',
        scoreTip:'PERFECT/GOOD/OKAY/MISS by timing · Higher combo → higher score',
        hitHint:'Hit on the line ↓',
        perfect:'Perfect', good:'Good', okay:'Okay', miss:'Miss'
      }
    },

    dash: {
      th: {
        title:'EXO — Mobility Dash',
        goal:'สลับเลนซ้าย/ขวาเพื่อหลบกล่องสีแดงที่พุ่งเข้ามา',
        ctrl:'<ul style="text-align:left;margin:0 auto;max-width:260px"><li>มือถือ/เดสก์ท็อป: แตะซ้าย/ขวา</li><li>คีย์บอร์ด: ←/A และ →/D</li><li>VR: Trigger ซ้าย/ขวา</li></ul>',
        scoreTip:'หลบสำเร็จได้คะแนน × คอมโบ • ชนจะถูกหักคะแนนและคอมโบตก',
        avoided:'หลบสำเร็จ', hit:'ชน'
      },
      en: {
        title:'EXO — Mobility Dash',
        goal:'Switch lanes (L/R) to avoid incoming red boxes.',
        ctrl:'<ul style="text-align:left;margin:0 auto;max-width:260px"><li>Mobile/Desktop: Tap Left/Right</li><li>Keyboard: ←/A and →/D</li><li>VR: Left/Right Trigger</li></ul>',
        scoreTip:'Avoid = score × combo • Hit = penalty & combo reset',
        avoided:'Avoided', hit:'Hit'
      }
    },

    power: {
      th: {
        title:'EXO — Power Control',
        goal:'ย่อ (Hold) / ยืน (Release) ให้ถูกตอนวงแหวนถึงเส้น',
        ctrl:'<ul style="text-align:left;max-width:260px;margin:auto"><li>กดค้าง = ย่อ (Squat)</li><li>ปล่อย = ยืน (Stand)</li><li>คีย์บอร์ด: Space/↓ เพื่อย่อ</li></ul>',
        scoreTip:'ผ่านถูกท่า = คะแนน + คอมโบ · ผิดท่า = หักคะแนน',
        pass:'ผ่าน', fail:'พลาด'
      },
      en: {
        title:'EXO — Power Control',
        goal:'Hold (Squat) / Release (Stand) so the ring passes the line in the correct pose.',
        ctrl:'<ul style="text-align:left;max-width:260px;margin:auto"><li>Hold = Squat</li><li>Release = Stand</li><li>Keyboard: Space/ArrowDown to squat</li></ul>',
        scoreTip:'Correct pose = score + combo · Wrong pose = penalty',
        pass:'Pass', fail:'Fail'
      }
    }
  };

  const get = () => current;
  const set = (lang) => {
    if (!['th','en'].includes(lang)) return;
    current = lang;
    localStorage.setItem(LS_KEY, lang);
    if (global.EXO_SETTINGS && EXO_SETTINGS.set) {
      const s = EXO_SETTINGS.get() || {};
      EXO_SETTINGS.set({...s, lang});
    }
    // auto rebind DOM
    bindDom();
  };

  // t(module,key, fallback?)
  const t = (mod, key, fb='') => {
    const modPack = packs[mod] && packs[mod][current];
    if (modPack && key in modPack) return modPack[key];
    const com = packs.common && packs.common[current];
    if (com && key in com) return com[key];
    return fb || key;
  };

  // scoped: const rt = EXO_I18N.scope('rhythm'); rt('title')
  const scope = (mod) => (key, fb) => t(mod, key, fb);

  // data-i18n binding: <span data-i18n="common.result"></span>
  const bindDom = () => {
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const path = el.getAttribute('data-i18n'); // module.key
      const [mod,key] = path.split('.');
      if (mod && key) el.textContent = t(mod,key, el.textContent || '');
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el=>{
      const path = el.getAttribute('data-i18n-html');
      const [mod,key] = path.split('.');
      if (mod && key) el.innerHTML = t(mod,key, el.innerHTML || '');
    });
  };

  // allow add/merge packs at runtime
  const addPack = (mod, lang, obj) => {
    packs[mod] = packs[mod] || {th:{}, en:{}};
    packs[mod][lang] = {...packs[mod][lang], ...obj};
  };

  // expose
  global.EXO_I18N = { get, set, t, scope, bindDom, addPack, packs };

  // initial DOM bind after DOM ready
  if (document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', bindDom);
  } else {
    bindDom();
  }

  // make lang from URL immediate if provided
  if (urlLang && urlLang!==current) set(urlLang);

})(window);
</script>
