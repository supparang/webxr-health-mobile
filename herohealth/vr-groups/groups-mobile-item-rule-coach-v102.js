// === /herohealth/vr-groups/groups-mobile-item-rule-coach-v102.js ===
// HeroHealth Groups Mobile — v10.2 Item Rule Coach
// Purpose:
// - Make item rules obvious for children.
// - Shows short, friendly cue for Food / Golden / Power / Decoy.
// - Safe add-on: visual coach only, does not change scoring logic.
// PATCH v20260515-GROUPS-MOBILE-V102-ITEM-RULE-COACH

(function () {
  'use strict';

  const VERSION = 'v10.2-mobile-item-rule-coach-20260515';

  if (window.__HHA_GROUPS_MOBILE_RULE_COACH_V102__) return;
  window.__HHA_GROUPS_MOBILE_RULE_COACH_V102__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    lastSig: '',
    lastKind: '',
    lastTipAt: 0,
    poll: null
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function api() {
    return WIN.HHA_GROUPS_MOBILE_V9 || null;
  }

  function getState() {
    try {
      const a = api();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function currentItem() {
    const s = getState();
    return s && s.current ? s.current : null;
  }

  function injectStyle() {
    if ($('groups-mobile-v102-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-mobile-v102-style';
    style.textContent = `
      .v102-rule-chip{
        position:absolute;
        left:50%;
        top:calc(170px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:88;
        width:min(430px,calc(100vw - 24px));
        border-radius:999px;
        padding:10px 14px;
        text-align:center;
        background:rgba(255,255,255,.94);
        box-shadow:0 16px 44px rgba(35,81,107,.18);
        color:#244e68;
        font-size:clamp(15px,4.4vw,22px);
        line-height:1.14;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .v102-rule-chip.show{
        animation:v102RulePop .92s ease both;
      }

      @keyframes v102RulePop{
        0%{opacity:0; transform:translateX(-50%) translateY(10px) scale(.88);}
        18%{opacity:1; transform:translateX(-50%) translateY(0) scale(1.04);}
        74%{opacity:1; transform:translateX(-50%) translateY(-2px) scale(1);}
        100%{opacity:0; transform:translateX(-50%) translateY(-16px) scale(.96);}
      }

      .v102-live-hint{
        position:absolute;
        left:50%;
        bottom:calc(190px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:87;
        width:min(520px,calc(100vw - 24px));
        border-radius:22px;
        padding:9px 12px;
        background:rgba(255,255,255,.88);
        color:#426f87;
        box-shadow:0 12px 30px rgba(35,81,107,.13);
        font-size:clamp(13px,3.6vw,18px);
        line-height:1.22;
        font-weight:950;
        text-align:center;
        pointer-events:none;
      }

      body.v102-kind-decoy .v102-live-hint{
        background:rgba(255,240,240,.92);
        color:#9b3d3d;
      }

      body.v102-kind-power .v102-live-hint{
        background:rgba(232,248,255,.94);
        color:#245c78;
      }

      body.v102-kind-golden .v102-live-hint{
        background:rgba(255,249,217,.94);
        color:#806000;
      }

      body.v102-kind-food .v102-live-hint{
        background:rgba(245,255,241,.92);
        color:#31724b;
      }

      body.v102-kind-power .food.power{
        animation:
          floatFood 1.1s ease-in-out infinite alternate,
          v102PowerPulse .48s ease-in-out infinite alternate !important;
      }

      body.v102-kind-decoy .food.decoy{
        animation:
          floatFood 1.1s ease-in-out infinite alternate,
          v102DecoyWarn .34s ease-in-out infinite alternate !important;
      }

      body.v102-kind-golden .food.golden{
        animation:
          floatFood 1.1s ease-in-out infinite alternate,
          v102GoldenPulse .50s ease-in-out infinite alternate !important;
      }

      @keyframes v102PowerPulse{
        from{box-shadow:0 0 0 8px rgba(97,187,255,.15),0 22px 54px rgba(35,81,107,.2);}
        to{box-shadow:0 0 0 18px rgba(97,187,255,.25),0 28px 70px rgba(35,81,107,.24);}
      }

      @keyframes v102DecoyWarn{
        from{filter:brightness(1); transform:scale(1) rotate(-2deg);}
        to{filter:brightness(1.08); transform:scale(1.06) rotate(2deg);}
      }

      @keyframes v102GoldenPulse{
        from{box-shadow:0 0 0 8px rgba(255,217,102,.16),0 22px 54px rgba(35,81,107,.2);}
        to{box-shadow:0 0 0 18px rgba(255,217,102,.28),0 28px 70px rgba(35,81,107,.24);}
      }

      @media (max-height:700px){
        .v102-rule-chip{
          top:calc(150px + env(safe-area-inset-top,0px));
          padding:8px 12px;
          font-size:clamp(14px,4vw,19px);
        }

        .v102-live-hint{
          bottom:calc(166px + env(safe-area-inset-bottom,0px));
          padding:7px 10px;
          font-size:clamp(12px,3.4vw,16px);
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureUi() {
    const game = $('game');
    if (!game) return;

    if (!$('v102RuleChip')) {
      const chip = DOC.createElement('div');
      chip.id = 'v102RuleChip';
      chip.className = 'v102-rule-chip';
      chip.textContent = 'ดูโจทย์แล้วแตะประตูที่ถูก';
      game.appendChild(chip);
    }

    if (!$('v102LiveHint')) {
      const hint = DOC.createElement('div');
      hint.id = 'v102LiveHint';
      hint.className = 'v102-live-hint';
      hint.textContent = 'อาหารปกติ: แตะประตูหมู่ที่ถูกด้านล่าง';
      game.appendChild(hint);
    }
  }

  function ruleFor(item) {
    if (!item) {
      return {
        kind: 'none',
        chip: 'เตรียมตัว!',
        hint: 'ดู item ที่ตกลงมา แล้วทำตามคำใบ้',
        prompt: null
      };
    }

    if (item.kind === 'power') {
      const label = item.power === 'shield'
        ? 'Shield'
        : item.power === 'slow'
          ? 'Slow Time'
          : 'Power-up';

      return {
        kind: 'power',
        chip: `${item.icon} แตะที่ ${label} เพื่อเก็บพลัง`,
        hint: `${item.icon} Power-up: แตะที่ตัวพลังได้เลย หรือแตะประตูใดก็ได้`,
        prompt: `
          <div>
            Power-up ${item.icon} ${label}
            <small>แตะที่ ${item.icon} โดยตรงเพื่อเก็บพลัง</small>
          </div>
        `
      };
    }

    if (item.kind === 'decoy') {
      return {
        kind: 'decoy',
        chip: `🚫 ตัวหลอก อย่าแตะ!`,
        hint: `${item.icon} ตัวหลอก: ห้ามแตะ / ปล่อยให้ผ่านไป`,
        prompt: `
          <div>
            🚫 หลบ ${item.icon} ${item.label || 'ตัวหลอก'}
            <small>อย่าแตะประตู รอให้ผ่านไปจะได้คะแนนหลบ</small>
          </div>
        `
      };
    }

    if (item.kind === 'golden') {
      const gid = item.group && item.group.id ? item.group.id : '?';
      const glabel = item.group && item.group.label ? item.group.label : 'หมู่ที่ถูก';

      return {
        kind: 'golden',
        chip: `⭐ Golden! ส่งเข้าหมู่ ${gid}`,
        hint: `⭐ Golden Food: แตะประตูหมู่ ${gid} ${glabel}`,
        prompt: `
          <div>
            ⭐ Golden Food ${item.icon}
            <small>แตะประตูหมู่ ${gid} ${glabel}</small>
          </div>
        `
      };
    }

    const gid = item.group && item.group.id ? item.group.id : '?';
    const glabel = item.group && item.group.label ? item.group.label : 'หมู่ที่ถูก';

    return {
      kind: 'food',
      chip: `${item.icon} แตะประตูหมู่ ${gid}`,
      hint: `อาหารปกติ: แตะประตูหมู่ ${gid} ${glabel}`,
      prompt: `
        <div>
          เลือก ${item.icon} แล้วส่งเข้าประตูหมู่ ${gid}
          <small>${glabel}</small>
        </div>
      `
    };
  }

  function showChip(text) {
    const chip = $('v102RuleChip');
    if (!chip) return;

    chip.textContent = text;
    chip.classList.remove('show');
    void chip.offsetWidth;
    chip.classList.add('show');
  }

  function setBodyKind(kind) {
    DOC.body.classList.remove(
      'v102-kind-food',
      'v102-kind-golden',
      'v102-kind-power',
      'v102-kind-decoy'
    );

    if (kind && kind !== 'none') {
      DOC.body.classList.add(`v102-kind-${kind}`);
    }
  }

  function maybeUpdatePrompt(rule) {
    const prompt = $('prompt');
    if (!prompt || !rule || !rule.prompt) return;

    /*
      Do not fight the core too aggressively.
      Only refresh prompt for high-confusion item types every poll.
    */
    if (rule.kind === 'power' || rule.kind === 'decoy' || rule.kind === 'golden') {
      if (prompt.innerHTML !== rule.prompt) {
        prompt.innerHTML = rule.prompt;
      }
    }
  }

  function signature(item) {
    if (!item) return 'none';
    return [
      item.kind,
      item.icon,
      item.power || '',
      item.group && item.group.key || ''
    ].join('|');
  }

  function poll() {
    const s = getState();

    if (!s || s.mode !== 'game' || s.ended) {
      setBodyKind('');
      return;
    }

    const item = currentItem();
    const sig = signature(item);
    const rule = ruleFor(item);

    ensureUi();

    const hint = $('v102LiveHint');
    if (hint) hint.textContent = rule.hint;

    setBodyKind(rule.kind);
    maybeUpdatePrompt(rule);

    if (sig !== state.lastSig) {
      state.lastSig = sig;
      state.lastKind = rule.kind;
      showChip(rule.chip);
    }
  }

  function expose() {
    WIN.HHA_GROUPS_MOBILE_V102_RULE_COACH = {
      version: VERSION,
      getState: function () {
        return {
          version: VERSION,
          lastSig: state.lastSig,
          lastKind: state.lastKind,
          current: currentItem()
        };
      }
    };
  }

  function install() {
    injectStyle();
    ensureUi();
    expose();

    state.poll = setInterval(poll, 160);

    console.info('[Groups Mobile v10.2] item rule coach installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
