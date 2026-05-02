// === /herohealth/hydration-vr/hydration-evaluate-variety.js ===
// PATCH v20260502-HYDRATION-EVAL-VARIETY-V1
// ✅ แก้ปัญหา Post-game Evaluate ซ้ำทุกครั้ง
// ✅ มี question bank หลายชุด
// ✅ เลือกคำถามตาม mode / water / miss / shield / block / combo
// ✅ กันคำถามซ้ำด้วย localStorage
// ✅ บันทึก choice + reason + score
// ✅ ใช้แทนคำถาม hardcode Plan A/B/C เดิม

'use strict';

(function HydrationEvaluateVariety(){
  const VERSION = '20260502-HYDRATION-EVAL-VARIETY-V1';
  const RECENT_KEY = 'HHA_HYDRATION_EVAL_RECENT_V1';
  const SAVED_KEY = 'HHA_HYDRATION_EVAL_LAST_V1';

  const $ = (s, r = document) => r.querySelector(s);

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, m => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[m]));
  }

  function qs(name, fallback = ''){
    try{
      return new URL(location.href).searchParams.get(name) ?? fallback;
    }catch(e){
      return fallback;
    }
  }

  function numText(id, fallback = 0){
    const el = document.getElementById(id);
    if(!el) return fallback;
    const raw = String(el.textContent || '').replace(/[,%]/g, '');
    const m = raw.match(/-?\d+(\.\d+)?/);
    if(!m) return fallback;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : fallback;
  }

  function text(id, fallback = ''){
    const el = document.getElementById(id);
    return el ? String(el.textContent || '').trim() : fallback;
  }

  function getStats(){
    const modeState = window.HHA_HYDRATION_MODE_STATE || {};
    const modeStats = modeState.stats || {};

    return {
      mode: qs('mode', modeState.mode || 'solo'),
      role: qs('role', modeState.role || ''),
      view: qs('view', 'mobile'),
      diff: qs('diff', 'normal'),
      time: Number(qs('time', 80)) || 80,
      score: Number(modeStats.score ?? numText('uiScore', 0)),
      water: Number(modeStats.water ?? numText('uiWater', 0)),
      miss: Number(modeStats.miss ?? numText('uiMiss', 0)),
      expire: Number(modeStats.expire ?? numText('uiExpire', 0)),
      block: Number(modeStats.block ?? numText('uiBlock', 0)),
      combo: Number(modeStats.combo ?? numText('uiCombo', 0)),
      shield: Number(modeStats.shield ?? numText('uiShield', 0)),
      grade: String(modeStats.grade ?? text('uiGrade', 'D'))
    };
  }

  const QUESTION_BANK = [
    {
      id: 'recovery_after_exercise_interval',
      tags: ['solo','duet','coop','lowWater','normal'],
      title: 'หลังเล่นเสร็จ ควรชดเชยน้ำแบบไหนดี?',
      subtitle: 'เลือกแผนที่เหมาะที่สุดหลังจบกิจกรรม',
      options: [
        {
          id: 'rush_big',
          title: 'Plan A: ดื่มรวดเดียวเยอะ ๆ',
          desc: 'ดื่มประมาณ 600–800 ml ทันที',
          score: 45,
          ok: false,
          feedback: [
            'ดื่มรวดเดียวเยอะเกินไป อาจทำให้จุกหรือไม่สบายท้อง',
            'เหมาะน้อยกว่าการแบ่งดื่มเป็นช่วง ๆ'
          ]
        },
        {
          id: 'small_interval',
          title: 'Plan B: แบ่งดื่มเป็นช่วง',
          desc: 'ดื่ม 150–250 ml ทุก 15–20 นาที รวม 3–4 ครั้ง',
          score: 92,
          ok: true,
          feedback: [
            'เหมาะสมมาก เพราะช่วยให้ร่างกายค่อย ๆ ปรับสมดุล',
            'ลดโอกาสจุกหรือดื่มมากเกินไปในเวลาสั้น',
            'เหมาะกับการชดเชยหลังออกแรงและยังควบคุมระดับน้ำได้ต่อเนื่อง'
          ]
        },
        {
          id: 'wait_tired',
          title: 'Plan C: รอให้หายเหนื่อยก่อน',
          desc: 'ยังไม่ดื่มทันที รอ 30–60 นาทีแล้วค่อยเริ่มดื่ม',
          score: 35,
          ok: false,
          feedback: [
            'รอนานเกินไป โดยเฉพาะถ้าร่างกายเสียเหงื่อแล้ว',
            'ควรเริ่มจิบน้ำทีละน้อยหลังพักสั้น ๆ'
          ]
        }
      ]
    },

    {
      id: 'low_water_next_action',
      tags: ['solo','race','lowWater','highMiss'],
      title: 'ถ้ารอบนี้ Water ต่ำ ควรปรับรอบหน้าอย่างไร?',
      subtitle: 'เลือกแผนที่ช่วยลดความเสี่ยงขาดน้ำ',
      options: [
        {
          id: 'focus_only_score',
          title: 'Plan A: เน้นคะแนนก่อน',
          desc: 'พยายามกดให้เร็วที่สุด แม้จะพลาดบ้าง',
          score: 40,
          ok: false,
          feedback: [
            'ถ้า Water ต่ำ การรีบกดเพื่อเอาคะแนนอย่างเดียวจะทำให้พลาดง่าย',
            'ควรเน้นความแม่นและเก็บน้ำดีให้ต่อเนื่องก่อน'
          ]
        },
        {
          id: 'slow_correct_water',
          title: 'Plan B: ลดความเร็ว แต่เลือกน้ำให้แม่น',
          desc: 'เก็บน้ำดีให้ต่อเนื่อง ใช้ Shield เมื่อมีภัย',
          score: 90,
          ok: true,
          feedback: [
            'เหมาะสม เพราะ Water ต่ำต้องเพิ่มความแม่นก่อน',
            'การลด Miss ช่วยให้ระดับน้ำไม่ตกเร็ว',
            'การใช้ Shield ช่วยลดความเสี่ยงช่วง Storm'
          ]
        },
        {
          id: 'avoid_all_threat',
          title: 'Plan C: ไม่แตะอะไรเลยถ้าไม่มั่นใจ',
          desc: 'รอเฉพาะน้ำที่อยู่ใกล้มาก ๆ เท่านั้น',
          score: 55,
          ok: false,
          feedback: [
            'ปลอดภัยขึ้นเล็กน้อย แต่เก็บน้ำไม่พออาจทำให้ Water ไม่ถึงเป้า',
            'ควรเลือกแตะน้ำดีที่มั่นใจ และฝึกจังหวะให้ดีขึ้น'
          ]
        }
      ]
    },

    {
      id: 'high_miss_strategy',
      tags: ['solo','race','battle','highMiss'],
      title: 'ถ้ารอบนี้ Miss เยอะ ควรแก้ยังไง?',
      subtitle: 'เลือกวิธีลดการแตะผิดในรอบต่อไป',
      options: [
        {
          id: 'tap_faster',
          title: 'Plan A: แตะให้เร็วขึ้นอีก',
          desc: 'รีบแตะทุกอย่างที่เห็นก่อนหายไป',
          score: 25,
          ok: false,
          feedback: [
            'ถ้า Miss เยอะ การแตะเร็วขึ้นมักทำให้พลาดมากกว่าเดิม',
            'ควรลดความเร็วและเลือกเป้าหมายให้ชัด'
          ]
        },
        {
          id: 'scan_before_tap',
          title: 'Plan B: มองก่อนแตะ',
          desc: 'เช็กว่าเป็นน้ำดี/โล่ก่อน แล้วค่อยแตะ',
          score: 94,
          ok: true,
          feedback: [
            'เหมาะมาก เพราะช่วยลด Miss โดยตรง',
            'การมองก่อนแตะช่วยให้คอมโบต่อเนื่องขึ้น',
            'เหมาะกับช่วง Storm ที่มีของหลอกมากขึ้น'
          ]
        },
        {
          id: 'only_shield',
          title: 'Plan C: เก็บแต่ Shield',
          desc: 'ไม่เน้นน้ำดี เน้นป้องกันอย่างเดียว',
          score: 50,
          ok: false,
          feedback: [
            'Shield ช่วยได้ แต่ถ้าไม่เก็บน้ำดี Water จะไม่ขึ้น',
            'ควรผสมระหว่างเก็บน้ำดีและเก็บ Shield'
          ]
        }
      ]
    },

    {
      id: 'shield_usage',
      tags: ['solo','duet','battle','coop','lowBlock'],
      title: 'ถ้ามี Shield ควรใช้คิดแบบไหน?',
      subtitle: 'เลือกแนวทางป้องกันภัยที่เหมาะที่สุด',
      options: [
        {
          id: 'ignore_shield',
          title: 'Plan A: ไม่ต้องสนใจ Shield',
          desc: 'เน้นเก็บน้ำอย่างเดียวก็พอ',
          score: 35,
          ok: false,
          feedback: [
            'Shield สำคัญมากในช่วง Storm หรือ Boss',
            'ถ้าไม่เก็บ Shield อาจเสีย Water จากภัยคุกคามได้ง่าย'
          ]
        },
        {
          id: 'save_for_threat',
          title: 'Plan B: เก็บ Shield ไว้กันภัย',
          desc: 'ใช้ Shield เพื่อบล็อกสายฟ้า/พายุในช่วงเสี่ยง',
          score: 91,
          ok: true,
          feedback: [
            'เหมาะสม เพราะ Shield ช่วยกันความเสียหายได้',
            'การมี Shield ทำให้เล่นช่วงยากได้ปลอดภัยขึ้น',
            'เหมาะกับ Battle และ Coop ที่มีพายุหรือ Crisis'
          ]
        },
        {
          id: 'use_all_now',
          title: 'Plan C: ใช้ Shield ทันทีทุกครั้ง',
          desc: 'มี Shield เมื่อไรก็ใช้ทันที',
          score: 58,
          ok: false,
          feedback: [
            'ใช้ทันทีอาจทำให้ไม่มี Shield ตอนเกิดภัยจริง',
            'ควรเก็บไว้ใช้ในช่วงที่มีสายฟ้า/พายุมากกว่า'
          ]
        }
      ]
    },

    {
      id: 'race_finish_plan',
      tags: ['race'],
      title: 'Race รอบหน้า ควรเล่นแบบไหนให้เข้าเส้นชัยไวขึ้น?',
      subtitle: 'เลือกกลยุทธ์สำหรับโหมดแข่งเติมน้ำ',
      options: [
        {
          id: 'boost_with_control',
          title: 'Plan A: เก็บ Boost แต่ยังคุม Miss',
          desc: 'เก็บน้ำดี + Boost และหลีกเลี่ยงของหลอก',
          score: 93,
          ok: true,
          feedback: [
            'เหมาะมากกับ Race เพราะต้องเร็วแต่ยังต้องแม่น',
            'Boost ช่วยเร่งเข้าเส้นชัย แต่ Miss จะทำให้เสียจังหวะ',
            'เล่นแบบเร็วและคุมความเสี่ยงดีที่สุด'
          ]
        },
        {
          id: 'slow_safe_only',
          title: 'Plan B: เล่นช้ามากเพื่อไม่ให้พลาด',
          desc: 'รอเฉพาะเป้าหมายง่าย ๆ',
          score: 60,
          ok: false,
          feedback: [
            'ปลอดภัยขึ้นแต่ Race ต้องแข่งกับเวลา',
            'ควรเก็บ Boost และเลือกน้ำดีที่มั่นใจควบคู่กัน'
          ]
        },
        {
          id: 'tap_everything',
          title: 'Plan C: แตะทุกอย่างเพื่อเร่งคะแนน',
          desc: 'เน้นความเร็วมากที่สุด',
          score: 30,
          ok: false,
          feedback: [
            'เสี่ยง Miss สูงมาก',
            'ถ้าแตะของผิดบ่อย อาจเสีย Water และเสียเวลา'
          ]
        }
      ]
    },

    {
      id: 'battle_unlock_attack',
      tags: ['battle'],
      title: 'Battle จะปลดล็อกสกิลโจมตีได้ดีที่สุดอย่างไร?',
      subtitle: 'เลือกวิธีเล่นเพื่อเปิดใช้ Storm Attack',
      options: [
        {
          id: 'combo_mission_first',
          title: 'Plan A: ทำ Mission เพื่อปลดล็อก Attack',
          desc: 'เก็บน้ำดีต่อเนื่อง ทำ Combo และบล็อกภัยให้ครบเงื่อนไข',
          score: 95,
          ok: true,
          feedback: [
            'ถูกต้อง เพราะ Battle ควรโจมตีได้หลังทำภารกิจสำเร็จ',
            'Combo และ Block ช่วยปลดล็อกสกิลอย่างยุติธรรม',
            'ทำให้การโจมตีมีจังหวะ ไม่ใช่กดมั่ว'
          ]
        },
        {
          id: 'attack_first',
          title: 'Plan B: กดโจมตีทันทีตั้งแต่ต้น',
          desc: 'ไม่ต้องรอ Mission',
          score: 25,
          ok: false,
          feedback: [
            'ไม่เหมาะ เพราะจะทำให้ Battle ไม่ยุติธรรม',
            'ควรให้ผู้เล่นทำ Mission สำเร็จก่อนจึงโจมตีได้'
          ]
        },
        {
          id: 'defense_only',
          title: 'Plan C: ป้องกันอย่างเดียว',
          desc: 'ไม่ต้องปลดล็อกโจมตี',
          score: 62,
          ok: false,
          feedback: [
            'ป้องกันสำคัญ แต่ Battle ต้องมีจังหวะสวนกลับด้วย',
            'ควรใช้ Shield แล้วหาทางปลดล็อก Counter หรือ Storm'
          ]
        }
      ]
    },

    {
      id: 'coop_team_tank',
      tags: ['coop'],
      title: 'Coop ถ้า Team Tank เริ่มต่ำ ทีมควรทำอะไร?',
      subtitle: 'เลือกแผนกู้ถังน้ำรวมของทีม',
      options: [
        {
          id: 'everyone_collect',
          title: 'Plan A: ทุกคนเก็บน้ำอย่างเดียว',
          desc: 'ไม่ต้องแบ่งหน้าที่',
          score: 55,
          ok: false,
          feedback: [
            'ช่วยเพิ่มน้ำได้ แต่ถ้าไม่มีคนป้องกัน ทีมอาจโดนภัยจน Tank ลดอีก',
            'Coop ควรแบ่งหน้าที่ให้ชัด'
          ]
        },
        {
          id: 'role_balance',
          title: 'Plan B: แบ่งหน้าที่ตาม Role',
          desc: 'Collector เติมน้ำ, Guardian กันภัย, Cleaner เคลียร์ของหลอก, Booster ช่วยทีม',
          score: 96,
          ok: true,
          feedback: [
            'เหมาะที่สุด เพราะ Coop ต้องใช้ teamwork',
            'การแบ่งหน้าที่ช่วยให้ Team Tank ฟื้นได้เร็วและปลอดภัย',
            'ช่วยผ่าน Crisis ได้ดีกว่าทุกคนทำเหมือนกัน'
          ]
        },
        {
          id: 'wait_crisis',
          title: 'Plan C: รอให้เข้าช่วง Crisis ก่อน',
          desc: 'ค่อยช่วยกันตอนระบบเตือน',
          score: 32,
          ok: false,
          feedback: [
            'รอจน Crisis อาจสายเกินไป',
            'ควรช่วยกันเติม Tank ตั้งแต่เริ่มต่ำกว่า 50%'
          ]
        }
      ]
    },

    {
      id: 'duet_role_sync',
      tags: ['duet'],
      title: 'Duet จะทำให้ทีมเล่นดีขึ้นได้อย่างไร?',
      subtitle: 'เลือกวิธีประสานงานของคู่หู',
      options: [
        {
          id: 'same_action',
          title: 'Plan A: ทั้งสองคนทำเหมือนกัน',
          desc: 'ต่างคนต่างเก็บน้ำให้มากที่สุด',
          score: 55,
          ok: false,
          feedback: [
            'ทำได้ แต่ยังไม่ใช้จุดเด่นของ Duet',
            'Duet ควรแบ่งหน้าที่เพื่อให้ทีมสมดุลกว่า'
          ]
        },
        {
          id: 'split_roles',
          title: 'Plan B: แบ่งหน้าที่ Collector / Guardian',
          desc: 'คนหนึ่งเก็บน้ำ อีกคนเก็บ Shield และบล็อกภัย',
          score: 94,
          ok: true,
          feedback: [
            'เหมาะมาก เพราะ Duet ต้องช่วยกันแบบคู่หู',
            'Collector เพิ่ม Water ส่วน Guardian ลดความเสี่ยง',
            'ทำให้ Team Sync สูงขึ้น'
          ]
        },
        {
          id: 'one_player_carry',
          title: 'Plan C: ให้คนเก่งเล่นหลักคนเดียว',
          desc: 'อีกคนช่วยเท่าที่ทำได้',
          score: 30,
          ok: false,
          feedback: [
            'ไม่เหมาะกับ Duet เพราะลดการมีส่วนร่วมของคู่หู',
            'ควรให้ทั้งสองคนมีภารกิจชัดเจน'
          ]
        }
      ]
    },

    {
      id: 'real_life_school_day',
      tags: ['solo','race','duet','normal'],
      title: 'ถ้าพรุ่งนี้มีเรียน/กิจกรรมทั้งวัน ควรเตรียมน้ำอย่างไร?',
      subtitle: 'เลือกแผนที่นำไปใช้จริงได้ง่ายที่สุด',
      options: [
        {
          id: 'bring_bottle_interval',
          title: 'Plan A: พกขวดน้ำและตั้งช่วงดื่ม',
          desc: 'จิบเป็นช่วง เช่น หลังเข้าเรียน / หลังพัก / หลังทำกิจกรรม',
          score: 93,
          ok: true,
          feedback: [
            'เหมาะสม เพราะนำไปใช้จริงได้ง่าย',
            'การจิบเป็นช่วงช่วยรักษาระดับน้ำต่อเนื่อง',
            'พกขวดน้ำช่วยลดการลืมดื่ม'
          ]
        },
        {
          id: 'drink_only_thirsty',
          title: 'Plan B: ดื่มเฉพาะตอนกระหาย',
          desc: 'รอให้หิวน้ำก่อนค่อยดื่ม',
          score: 48,
          ok: false,
          feedback: [
            'การรอให้กระหายอาจช้าไปสำหรับบางกิจกรรม',
            'ควรจิบน้ำเป็นช่วงก่อนจะกระหายมาก'
          ]
        },
        {
          id: 'drink_at_home_only',
          title: 'Plan C: ดื่มเยอะ ๆ ก่อนออกจากบ้าน',
          desc: 'แล้วระหว่างวันไม่ต้องดื่มมาก',
          score: 42,
          ok: false,
          feedback: [
            'ดื่มก่อนออกจากบ้านอย่างเดียวไม่พอสำหรับทั้งวัน',
            'ควรมีน้ำติดตัวและจิบระหว่างวัน'
          ]
        }
      ]
    }
  ];

  function getRecent(){
    try{
      const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      return [];
    }
  }

  function pushRecent(id){
    const recent = getRecent().filter(x => x !== id);
    recent.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 6)));
  }

  function questionScore(q, stats){
    let score = 0;
    const tags = q.tags || [];

    if(tags.includes(stats.mode)) score += 50;
    if(tags.includes('normal')) score += 4;

    if(stats.water < 55 && tags.includes('lowWater')) score += 35;
    if(stats.miss >= 5 && tags.includes('highMiss')) score += 35;
    if(stats.block <= 1 && tags.includes('lowBlock')) score += 24;

    if(stats.mode === 'battle' && tags.includes('battle')) score += 60;
    if(stats.mode === 'coop' && tags.includes('coop')) score += 60;
    if(stats.mode === 'race' && tags.includes('race')) score += 60;
    if(stats.mode === 'duet' && tags.includes('duet')) score += 60;

    return score;
  }

  function chooseQuestion(stats){
    const recent = getRecent();

    const ranked = QUESTION_BANK
      .map(q => {
        const penalty = recent.includes(q.id) ? 999 : 0;
        return {
          q,
          score: questionScore(q, stats) - penalty + Math.random() * 8
        };
      })
      .sort((a, b) => b.score - a.score);

    let pick = ranked[0]?.q || QUESTION_BANK[0];

    if(!pick || recent.includes(pick.id)){
      const fallback = QUESTION_BANK.find(q => !recent.includes(q.id)) || QUESTION_BANK[0];
      pick = fallback;
    }

    return pick;
  }

  function shuffleOptions(options, seedText){
    const arr = [...options];
    let seed = 0;
    for(let i = 0; i < seedText.length; i++){
      seed = ((seed << 5) - seed + seedText.charCodeAt(i)) | 0;
    }
    seed = Math.abs(seed || Date.now());

    for(let i = arr.length - 1; i > 0; i--){
      seed = (seed * 9301 + 49297) % 233280;
      const j = seed % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function ensureStyle(){
    if(document.getElementById('hydrEvalVarietyStyle')) return;

    const style = document.createElement('style');
    style.id = 'hydrEvalVarietyStyle';
    style.textContent = `
      .hydr-eval-panel{
        display:grid;
        gap:12px;
        margin-top:12px;
        padding:14px;
        border-radius:24px;
        border:1px solid rgba(103,232,249,.24);
        background:linear-gradient(180deg,rgba(7,18,38,.72),rgba(12,24,52,.70));
      }

      .hydr-eval-head{
        display:grid;
        gap:4px;
      }

      .hydr-eval-title{
        font-size:22px;
        font-weight:1100;
        line-height:1.15;
      }

      .hydr-eval-sub{
        color:#bfdbfe;
        font-size:13px;
        line-height:1.4;
      }

      .hydr-eval-meta{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .hydr-eval-chip{
        padding:7px 9px;
        border-radius:999px;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.10);
        color:#e0f2fe;
        font-size:11px;
        font-weight:1000;
      }

      .hydr-eval-options{
        display:grid;
        gap:10px;
      }

      .hydr-eval-option{
        width:100%;
        text-align:left;
        padding:14px;
        border-radius:20px;
        border:1px solid rgba(255,255,255,.13);
        background:rgba(255,255,255,.06);
        color:#eff7ff;
        cursor:pointer;
        display:grid;
        gap:5px;
      }

      .hydr-eval-option:hover{
        border-color:rgba(103,232,249,.42);
        background:rgba(103,232,249,.10);
      }

      .hydr-eval-option.active{
        border-color:#22d3ee;
        background:rgba(34,211,238,.14);
        box-shadow:0 0 0 3px rgba(34,211,238,.16);
      }

      .hydr-eval-option .name{
        font-size:16px;
        font-weight:1100;
      }

      .hydr-eval-option .desc{
        color:#cfe8ff;
        font-size:13px;
        line-height:1.35;
      }

      .hydr-eval-feedback{
        display:none;
        padding:12px;
        border-radius:20px;
        background:rgba(16,185,129,.10);
        border:1px solid rgba(16,185,129,.34);
        color:#effff7;
        line-height:1.45;
        font-size:14px;
      }

      .hydr-eval-feedback.show{
        display:block;
      }

      .hydr-eval-feedback.bad{
        background:rgba(251,191,36,.10);
        border-color:rgba(251,191,36,.32);
      }

      .hydr-eval-reason-wrap{
        display:grid;
        gap:6px;
      }

      .hydr-eval-reason-wrap label{
        color:#bfdbfe;
        font-size:12px;
        font-weight:1000;
      }

      .hydr-eval-reason{
        width:100%;
        min-height:92px;
        resize:vertical;
        padding:12px;
        border-radius:18px;
        border:1px solid rgba(103,232,249,.28);
        background:rgba(7,18,38,.48);
        color:#eff7ff;
        outline:none;
        font:inherit;
      }

      .hydr-eval-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }

      .hydr-eval-btn{
        min-height:42px;
        padding:10px 14px;
        border-radius:15px;
        border:0;
        cursor:pointer;
        color:#fff;
        font-weight:1100;
        background:linear-gradient(180deg,#22d3ee,#2563eb);
      }

      .hydr-eval-btn.secondary{
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.12);
      }

      .hydr-eval-btn.good{
        background:linear-gradient(180deg,#34d399,#059669);
      }

      .hydr-eval-saved{
        display:none;
        padding:10px 12px;
        border-radius:16px;
        background:rgba(52,211,153,.13);
        border:1px solid rgba(52,211,153,.32);
        color:#dcfce7;
        font-weight:1000;
      }

      .hydr-eval-saved.show{
        display:block;
      }

      @media (max-width:640px){
        .hydr-eval-actions,
        .hydr-eval-btn{
          width:100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function hideOldStaticEvaluate(){
    const candidates = Array.from(document.querySelectorAll('section, div, article'))
      .filter(el => {
        if(el.id === 'hydrEvalPanel') return false;
        const t = String(el.textContent || '');
        return t.includes('Post-game Evaluate') && t.includes('Plan A') && t.includes('Plan B');
      });

    candidates.forEach(el => {
      if(el.closest('#hydrEvalPanel')) return;
      const box = el.closest('.panel, .end-copy, .overlay-card > div') || el;
      if(box && box.id !== 'hydrEvalPanel'){
        box.style.display = 'none';
        box.setAttribute('data-hydr-old-eval-hidden', '1');
      }
    });
  }

  function mountEvaluate(){
    ensureStyle();
    hideOldStaticEvaluate();

    const end = document.getElementById('end');
    if(!end) return;

    const visible = end.getAttribute('aria-hidden') === 'false';
    if(!visible) return;

    const card = $('#end .overlay-card') || end;
    if(!card) return;

    if(document.getElementById('hydrEvalPanel')) return;

    const stats = getStats();
    const q = chooseQuestion(stats);
    const options = shuffleOptions(q.options, `${q.id}-${Date.now()}-${stats.score}-${stats.water}`);

    const panel = document.createElement('section');
    panel.id = 'hydrEvalPanel';
    panel.className = 'hydr-eval-panel';
    panel.dataset.questionId = q.id;
    panel.innerHTML = `
      <div class="hydr-eval-head">
        <div class="hydr-eval-title">🧠 Post-game Evaluate</div>
        <div class="hydr-eval-sub">${esc(q.title)}<br>${esc(q.subtitle)}</div>
      </div>

      <div class="hydr-eval-meta">
        <div class="hydr-eval-chip">Mode: ${esc(stats.mode)}</div>
        <div class="hydr-eval-chip">Water: ${esc(stats.water)}%</div>
        <div class="hydr-eval-chip">Miss: ${esc(stats.miss)}</div>
        <div class="hydr-eval-chip">Combo: ${esc(stats.combo)}</div>
      </div>

      <div class="hydr-eval-options">
        ${options.map(opt => `
          <button class="hydr-eval-option" type="button" data-choice="${esc(opt.id)}">
            <div class="name">${esc(opt.title)}</div>
            <div class="desc">${esc(opt.desc)}</div>
          </button>
        `).join('')}
      </div>

      <div class="hydr-eval-feedback" id="hydrEvalFeedback"></div>

      <div class="hydr-eval-reason-wrap">
        <label for="hydrEvalReason">เหตุผลที่เลือกแผนนี้ *</label>
        <textarea
          id="hydrEvalReason"
          class="hydr-eval-reason"
          placeholder="เช่น รอบนี้ Miss เยอะ / Water ต่ำ / อยากเก็บ Shield ให้มากขึ้น / แผนนี้ทำได้จริง"
        ></textarea>
      </div>

      <div class="hydr-eval-actions">
        <button class="hydr-eval-btn good" id="hydrEvalSave" type="button">บันทึกคำตอบ</button>
        <button class="hydr-eval-btn secondary" id="hydrEvalSkip" type="button">ข้าม</button>
        <button class="hydr-eval-btn secondary" id="hydrEvalNew" type="button">เปลี่ยนคำถาม</button>
      </div>

      <div class="hydr-eval-saved" id="hydrEvalSaved">✅ บันทึกคำตอบแล้ว</div>
    `;

    const actions = card.querySelector('.overlay-actions');
    if(actions){
      card.insertBefore(panel, actions);
    }else{
      card.appendChild(panel);
    }

    bindPanel(panel, q, options, stats);
  }

  function bindPanel(panel, q, options, stats){
    let selected = null;

    panel.addEventListener('click', ev => {
      const choiceBtn = ev.target.closest('[data-choice]');
      if(choiceBtn){
        const choiceId = choiceBtn.getAttribute('data-choice');
        selected = options.find(o => o.id === choiceId) || null;

        panel.querySelectorAll('.hydr-eval-option').forEach(b => b.classList.remove('active'));
        choiceBtn.classList.add('active');

        showFeedback(selected);
      }

      if(ev.target.id === 'hydrEvalSave'){
        saveAnswer(q, selected, stats);
      }

      if(ev.target.id === 'hydrEvalSkip'){
        panel.remove();
        pushRecent(q.id);
      }

      if(ev.target.id === 'hydrEvalNew'){
        panel.remove();
        pushRecent(q.id);
        setTimeout(mountEvaluate, 50);
      }
    });
  }

  function showFeedback(choice){
    const fb = document.getElementById('hydrEvalFeedback');
    if(!fb || !choice) return;

    fb.className = `hydr-eval-feedback show ${choice.ok ? '' : 'bad'}`;
    fb.innerHTML = `
      <strong>${choice.ok ? '✅ เหมาะสม' : '⚠️ ยังไม่เหมาะที่สุด'}</strong><br>
      คะแนนความเหมาะสม: <strong>${esc(choice.score)}/100</strong>
      <br><br>
      <strong>เหตุผล:</strong>
      <ul style="margin:6px 0 0 18px;padding:0;">
        ${(choice.feedback || []).map(x => `<li>${esc(x)}</li>`).join('')}
      </ul>
    `;
  }

  function saveAnswer(q, choice, stats){
    const saved = document.getElementById('hydrEvalSaved');
    const reason = String(document.getElementById('hydrEvalReason')?.value || '').trim();

    if(!choice){
      alert('กรุณาเลือกแผนก่อนบันทึก');
      return;
    }

    if(reason.length < 3){
      alert('กรุณาเขียนเหตุผลสั้น ๆ ก่อนบันทึก');
      return;
    }

    const payload = {
      version: VERSION,
      savedAt: new Date().toISOString(),
      questionId: q.id,
      questionTitle: q.title,
      choiceId: choice.id,
      choiceTitle: choice.title,
      choiceScore: choice.score,
      choiceCorrect: !!choice.ok,
      reason,
      stats,
      url: location.href
    };

    try{
      localStorage.setItem(SAVED_KEY, JSON.stringify(payload));
    }catch(e){}

    pushRecent(q.id);

    window.dispatchEvent(new CustomEvent('hha:hydration:evaluate-saved', {
      detail: payload
    }));

    // ถ้า logger หลักมีฟังก์ชันรับ event ภายนอก สามารถไปต่อได้จาก event นี้
    // window.addEventListener('hha:hydration:evaluate-saved', e => sendToCloud(e.detail));

    if(saved){
      saved.classList.add('show');
      saved.textContent = `✅ บันทึกแล้ว: ${choice.title} • ${choice.score}/100`;
    }
  }

  function watchEnd(){
    setInterval(() => {
      mountEvaluate();

      const end = document.getElementById('end');
      if(end && end.getAttribute('aria-hidden') !== 'false'){
        const p = document.getElementById('hydrEvalPanel');
        if(p) p.remove();
      }
    }, 500);
  }

  function init(){
    ensureStyle();
    watchEnd();

    window.HHAHydrationEvaluate = {
      version: VERSION,
      mount: mountEvaluate,
      getStats,
      chooseQuestion,
      bank: QUESTION_BANK
    };

    console.info('[hydration-evaluate-variety] ready', VERSION);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }
})();
