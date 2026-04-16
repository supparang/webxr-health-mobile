(function () {
  const STYLE_ID = 'lesson-mobile-fix-style-v1';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #question-card{
        position:fixed;
        left:12px; right:12px;
        top:max(72px, calc(env(safe-area-inset-top, 0px) + 56px));
        z-index:9998;
        display:none;
        padding:12px 14px;
        border-radius:18px;
        background:rgba(4,12,28,.86);
        border:2px solid rgba(0,229,255,.45);
        box-shadow:0 8px 24px rgba(0,0,0,.35);
        color:#fff;
        backdrop-filter: blur(6px);
      }
      #question-card-title{
        font-size:12px;
        font-weight:900;
        letter-spacing:.08em;
        color:#7bedff;
        margin-bottom:6px;
        text-transform:uppercase;
      }
      #question-card-body{
        font-size:18px;
        line-height:1.35;
        font-weight:700;
        white-space:pre-wrap;
        word-break:break-word;
      }
      #mic-permission-wrap{
        position:fixed;
        left:12px; right:12px;
        bottom:max(184px, calc(env(safe-area-inset-bottom, 0px) + 130px));
        z-index:9998;
        display:none;
        gap:8px;
        align-items:center;
        justify-content:center;
        flex-wrap:wrap;
        padding:10px 12px;
        border-radius:16px;
        background:rgba(4,12,28,.84);
        border:1px solid rgba(123,237,255,.30);
      }
      #btn-mic-permission{
        appearance:none;
        border:none;
        border-radius:14px;
        padding:12px 16px;
        font-size:16px;
        font-weight:900;
        color:#04121c;
        background:#7bedff;
        box-shadow:0 6px 18px rgba(123,237,255,.25);
      }
      #mic-status{
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:10px 12px;
        border-radius:999px;
        font-size:14px;
        font-weight:900;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.16);
        color:#fff;
      }
      #mic-status[data-state="ready"]{ color:#2ed573; border-color:rgba(46,213,115,.4); }
      #mic-status[data-state="blocked"],
      #mic-status[data-state="prompt"]{ color:#f1c40f; border-color:rgba(241,196,15,.4); }
      #mic-status[data-state="denied"]{ color:#ff6b81; border-color:rgba(255,107,129,.4); }
      #mic-status[data-state="unsupported"]{ color:#b2bec3; border-color:rgba(178,190,195,.35); }

      #choice-buttons{
        position:fixed !important;
        left:12px; right:12px;
        bottom:max(108px, calc(env(safe-area-inset-bottom, 0px) + 78px));
        z-index:9999;
        display:none;
        grid-template-columns:repeat(1, minmax(0, 1fr));
        gap:10px;
      }
      #choice-buttons .btn-action{
        min-height:72px;
        white-space:normal;
        line-height:1.25;
        font-size:18px;
        font-weight:900;
        border-radius:18px;
        padding:12px 14px;
      }

      #btn-return{
        position:fixed !important;
        left:12px; right:12px;
        bottom:max(16px, calc(env(safe-area-inset-bottom, 0px) + 8px));
        z-index:9999;
      }

      #btn-next{
        position:fixed !important;
        left:12px; right:12px;
        bottom:max(86px, calc(env(safe-area-inset-bottom, 0px) + 76px));
        z-index:9999;
      }

      #timer{
        position:fixed !important;
        left:50%;
        transform:translateX(-50%);
        bottom:max(232px, calc(env(safe-area-inset-bottom, 0px) + 180px));
        z-index:9999;
        font-size:34px !important;
        font-weight:900;
        text-shadow:0 3px 14px rgba(0,0,0,.55);
      }

      #btn-speak, #btn-play-audio, #write-input, #btn-submit-write{
        position:fixed !important;
        left:12px; right:12px;
        z-index:9999;
      }
      #btn-speak, #btn-play-audio{
        bottom:max(108px, calc(env(safe-area-inset-bottom, 0px) + 78px));
      }
      #write-input{
        bottom:max(188px, calc(env(safe-area-inset-bottom, 0px) + 150px));
      }
      #btn-submit-write{
        bottom:max(108px, calc(env(safe-area-inset-bottom, 0px) + 78px));
      }

      #game-over-ui{
        position:fixed !important;
        left:12px; right:12px;
        bottom:max(176px, calc(env(safe-area-inset-bottom, 0px) + 138px));
        z-index:10000;
      }

      #feedback{
        position:fixed !important;
        left:12px; right:12px;
        bottom:max(250px, calc(env(safe-area-inset-bottom, 0px) + 214px));
        z-index:9998;
        text-align:center;
        text-shadow:0 2px 8px rgba(0,0,0,.55);
      }

      #question-diff-badge{
        position:fixed !important;
        right:12px;
        top:max(16px, calc(env(safe-area-inset-top, 0px) + 8px));
        z-index:10000;
        margin:0 !important;
      }

      #ui-title, #ui-desc{
        position:relative;
        z-index:1;
      }

      @media (min-width: 760px){
        #question-card, #mic-permission-wrap, #choice-buttons, #btn-return, #btn-next, #btn-speak, #btn-play-audio, #write-input, #btn-submit-write, #game-over-ui, #feedback{
          left:50%;
          right:auto;
          width:min(720px, calc(100vw - 24px));
          transform:translateX(-50%);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function injectUi() {
    if (!document.getElementById('question-card')) {
      const card = document.createElement('div');
      card.id = 'question-card';
      card.innerHTML = '<div id="question-card-title">MISSION</div><div id="question-card-body"></div>';
      document.body.appendChild(card);
    }
    if (!document.getElementById('mic-permission-wrap')) {
      const wrap = document.createElement('div');
      wrap.id = 'mic-permission-wrap';
      wrap.innerHTML = `
        <button id="btn-mic-permission" type="button">ขออนุญาตไมค์อัตโนมัติ</button>
        <div id="mic-status" data-state="prompt">🎤 BLOCKED</div>
      `;
      document.body.appendChild(wrap);
    }
  }

  function getAttrValue(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    return el.getAttribute('value') || el.textContent || '';
  }

  function isVisibleEntity(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    const v = el.getAttribute('visible');
    if (typeof v === 'string') return v !== 'false';
    return !!v;
  }

  function cleanQuestionText(text) {
    return String(text || '')
      .replace(/^SYSTEM ALERT:\s*/i, '')
      .replace(/^MISSION:\s*/i, '')
      .replace(/^Say:\s*/i, 'พูดว่า: ')
      .replace(/^TERMINAL:\s*/i, '')
      .trim();
  }

  function setQuestionCard(title, body) {
    const card = document.getElementById('question-card');
    const t = document.getElementById('question-card-title');
    const b = document.getElementById('question-card-body');
    if (!card || !t || !b) return;
    if (!body) {
      card.style.display = 'none';
      return;
    }
    t.textContent = title || 'MISSION';
    b.textContent = body;
    card.style.display = 'block';
  }

  function setChoiceButtonLabels(scenePrefix) {
    const wrap = document.getElementById('choice-buttons');
    if (!wrap) return;
    const buttons = wrap.querySelectorAll('button');
    if (buttons.length < 3) return;

    const ids = [
      `${scenePrefix}-choice-a`,
      `${scenePrefix}-choice-b`,
      `${scenePrefix}-choice-c`,
    ];
    ids.forEach((id, idx) => {
      const raw = getAttrValue(id);
      if (!raw) return;
      const cleaned = raw.replace(/^[A-C]:\s*/i, '').trim();
      const letter = String.fromCharCode(65 + idx);
      buttons[idx].textContent = `${letter}. ${cleaned}`;
    });
    wrap.style.display = 'grid';
  }

  function hideChoiceButtonsIfGameDoesNotNeed() {
    const wrap = document.getElementById('choice-buttons');
    if (!wrap) return;
    if (!isVisibleEntity('mission-reading-scene') && !isVisibleEntity('mission-listening-scene')) {
      if (wrap.style.display && wrap.style.display !== 'none') wrap.style.display = 'none';
    }
  }

  function syncMissionOverlay() {
    if (isVisibleEntity('mission-speaking-scene')) {
      setQuestionCard('SPEAKING', cleanQuestionText(getAttrValue('speaking-prompt')));
    } else if (isVisibleEntity('mission-reading-scene')) {
      setQuestionCard('READING', cleanQuestionText(getAttrValue('reading-question')));
      setChoiceButtonLabels('reading');
    } else if (isVisibleEntity('mission-listening-scene')) {
      const prompt = cleanQuestionText(getAttrValue('listening-prompt')) || 'กดฟังเสียง แล้วเลือกคำตอบด้านล่าง';
      setQuestionCard('LISTENING', prompt);
      setChoiceButtonLabels('listening');
    } else if (isVisibleEntity('mission-writing-scene')) {
      setQuestionCard('WRITING', cleanQuestionText(getAttrValue('writing-prompt')));
    } else {
      setQuestionCard('', '');
    }
    hideChoiceButtonsIfGameDoesNotNeed();
    syncMicUi();
  }

  let micState = 'prompt';

  function setMicStatus(stateText, label) {
    const status = document.getElementById('mic-status');
    if (!status) return;
    micState = stateText;
    status.dataset.state = stateText;
    const emoji = stateText === 'ready' ? '🎤 READY'
      : stateText === 'denied' ? '🎤 DENIED'
      : stateText === 'unsupported' ? '🎤 UNSUPPORTED'
      : '🎤 BLOCKED';
    status.textContent = label || emoji;
  }

  async function checkMicPermission() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicStatus('unsupported');
      return 'unsupported';
    }
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' });
        const map = {
          granted: ['ready', '🎤 READY'],
          denied: ['denied', '🎤 DENIED'],
          prompt: ['prompt', '🎤 BLOCKED'],
        };
        const picked = map[result.state] || ['prompt', '🎤 BLOCKED'];
        setMicStatus(picked[0], picked[1]);
        result.onchange = () => checkMicPermission();
        return picked[0];
      }
    } catch (e) {}
    setMicStatus('prompt', '🎤 BLOCKED');
    return 'prompt';
  }

  async function requestMicPermission() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicStatus('unsupported');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicStatus('ready', '🎤 READY');
      return true;
    } catch (err) {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setMicStatus(denied ? 'denied' : 'prompt', denied ? '🎤 DENIED' : '🎤 BLOCKED');
      return false;
    }
  }

  function syncMicUi() {
    const wrap = document.getElementById('mic-permission-wrap');
    if (!wrap) return;
    const isSpeaking = isVisibleEntity('mission-speaking-scene');
    wrap.style.display = isSpeaking ? 'flex' : 'none';
  }

  function patchMicFlow() {
    const btn = document.getElementById('btn-mic-permission');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', async () => {
        await requestMicPermission();
      });
    }

    const originalStartRecognition = window.startRecognition;
    if (typeof originalStartRecognition === 'function' && !originalStartRecognition.__mobileMicWrapped) {
      const wrapped = async function (...args) {
        if (micState !== 'ready') {
          const ok = await requestMicPermission();
          if (!ok) return;
        }
        return originalStartRecognition.apply(this, args);
      };
      wrapped.__mobileMicWrapped = true;
      window.startRecognition = wrapped;
    }
  }

  function boot() {
    injectStyles();
    injectUi();
    checkMicPermission();
    syncMissionOverlay();
    patchMicFlow();

    const observer = new MutationObserver(() => {
      syncMissionOverlay();
      patchMicFlow();
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['value', 'visible', 'style', 'class']
    });

    setInterval(() => {
      syncMissionOverlay();
      patchMicFlow();
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.requestMicPermission = requestMicPermission;
  window.checkMicPermission = checkMicPermission;
})();
