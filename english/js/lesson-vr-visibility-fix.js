// === /english/js/lesson-vr-visibility-fix.js ===
// PATCH v20260424a-LESSON-VR-VISIBILITY-FIX
// Fix: VR lesson panel too dark / invisible in S1-S15

(function () {
  'use strict';

  const PATCH = 'v20260424a-LESSON-VR-VISIBILITY-FIX';
  console.log('[LessonVRFix]', PATCH);

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function getParams() {
    const q = new URLSearchParams(location.search);
    return {
      s: q.get('s') || q.get('sid') || q.get('session') || q.get('unit') || '1',
      mode: q.get('mode') || '',
      view: q.get('view') || '',
      run: q.get('run') || ''
    };
  }

  function normalizeSessionId(v) {
    const raw = String(v || '1').trim().toUpperCase();
    if (raw.startsWith('S')) return raw;
    const n = Math.max(1, Math.min(15, parseInt(raw, 10) || 1));
    return `S${n}`;
  }

  const LESSON_TITLES = {
    S1: 'Self-Introduction in Tech',
    S2: 'Academic Background and Projects',
    S3: 'Tech Jobs and Roles',
    S4: 'Daily Workplace Communication',
    S5: 'Emails and Chat',
    S6: 'Meetings',
    S7: 'Explaining a System',
    S8: 'Describing Problems and Bugs',
    S9: 'Team Collaboration / Stand-up',
    S10: 'Client Communication',
    S11: 'Data and AI Communication',
    S12: 'CV / Portfolio Language',
    S13: 'Job Interview',
    S14: 'Project Pitch',
    S15: 'Capstone Career Mission'
  };

  function currentLessonText() {
    const p = getParams();
    const sid = normalizeSessionId(p.s);
    const title = LESSON_TITLES[sid] || LESSON_TITLES.S1;

    let mission = 'Read, listen, speak, and answer the mission.';
    let prompt = 'SYSTEM: Type two simple AI words.\nYOU:';

    try {
      if (window.LESSON_DATA) {
        const data =
          window.LESSON_DATA[sid] ||
          window.LESSON_DATA[sid.toLowerCase()] ||
          window.LESSON_DATA[parseInt(sid.replace('S', ''), 10)];

        if (data) {
          mission =
            data.objective ||
            data.objectives ||
            data.goal ||
            data.mission ||
            data.title ||
            mission;

          const q =
            data.prompt ||
            data.question ||
            data.challenge ||
            data.task ||
            data.writingPrompt ||
            data.speakingPrompt;

          if (q) prompt = String(q);
        }
      }
    } catch (err) {
      console.warn('[LessonVRFix] LESSON_DATA read skipped', err);
    }

    return {
      sid,
      title,
      mission: Array.isArray(mission) ? mission.join(' ') : String(mission),
      prompt: String(prompt)
    };
  }

  function ensureScene() {
    let scene = $('a-scene');
    if (scene) return scene;

    scene = document.createElement('a-scene');
    scene.setAttribute('embedded', '');
    scene.setAttribute('vr-mode-ui', 'enabled: true');
    scene.setAttribute('renderer', 'antialias: true; colorManagement: true; physicallyCorrectLights: false');
    document.body.appendChild(scene);
    return scene;
  }

  function ensureCamera(scene) {
    let rig = $('#lessonVrRig', scene);
    if (!rig) {
      rig = document.createElement('a-entity');
      rig.id = 'lessonVrRig';
      rig.setAttribute('position', '0 1.6 0');
      scene.appendChild(rig);
    }

    let cam = $('#lessonVrCamera', scene) || $('[camera]', scene);
    if (!cam) {
      cam = document.createElement('a-entity');
      cam.id = 'lessonVrCamera';
      cam.setAttribute('camera', 'active: true');
      cam.setAttribute('look-controls', 'pointerLockEnabled: false; magicWindowTrackingEnabled: true');
      cam.setAttribute('wasd-controls', 'enabled: false');
      cam.setAttribute('position', '0 0 0');
      rig.appendChild(cam);
    } else if (!cam.id) {
      cam.id = 'lessonVrCamera';
    }

    return cam;
  }

  function setAttrSafe(el, name, value) {
    try {
      el.setAttribute(name, value);
    } catch (e) {}
  }

  function brightenExistingScene(scene) {
    // Background brighter but still VR style
    setAttrSafe(scene, 'background', 'color: #081827');
    setAttrSafe(scene, 'fog', 'type: linear; color: #081827; near: 12; far: 60');

    // Make old black planes less invisible
    $all('a-plane, [geometry]', scene).forEach((el) => {
      const id = (el.id || '').toLowerCase();
      const cls = (el.className || '').toString().toLowerCase();
      const role = `${id} ${cls}`;

      if (
        role.includes('panel') ||
        role.includes('card') ||
        role.includes('board') ||
        role.includes('question') ||
        role.includes('prompt') ||
        role.includes('mission')
      ) {
        setAttrSafe(el, 'material', 'color: #f8fbff; opacity: 0.96; transparent: true; side: double');
      }
    });

    // Force A-Frame text to be readable
    $all('a-text, [text]', scene).forEach((el) => {
      const textAttr = el.getAttribute('text');
      if (textAttr !== null) {
        try {
          el.setAttribute('text', {
            ...(typeof textAttr === 'object' ? textAttr : {}),
            color: '#ffffff',
            shader: 'msdf',
            negate: false,
            align: 'left',
            anchor: 'center',
            baseline: 'center',
            wrapCount: 34,
            width: 3.3
          });
        } catch (e) {
          setAttrSafe(el, 'text', 'color: #ffffff; align: left; anchor: center; baseline: center; wrapCount: 34; width: 3.3');
        }
      }
    });
  }

  function addLights(scene) {
    if (!$('#lessonVrAmbient', scene)) {
      const amb = document.createElement('a-entity');
      amb.id = 'lessonVrAmbient';
      amb.setAttribute('light', 'type: ambient; color: #ffffff; intensity: 0.9');
      scene.appendChild(amb);
    }

    if (!$('#lessonVrKeyLight', scene)) {
      const key = document.createElement('a-entity');
      key.id = 'lessonVrKeyLight';
      key.setAttribute('position', '0 4 2');
      key.setAttribute('light', 'type: directional; color: #ffffff; intensity: 1.15');
      scene.appendChild(key);
    }

    if (!$('#lessonVrFaceLight', scene)) {
      const face = document.createElement('a-entity');
      face.id = 'lessonVrFaceLight';
      face.setAttribute('position', '0 2.1 1.3');
      face.setAttribute('light', 'type: point; color: #dff7ff; intensity: 1.4; distance: 8');
      scene.appendChild(face);
    }
  }

  function createReadableBoard(scene, camera) {
    const data = currentLessonText();

    let board = $('#lessonVrReadableBoard', scene);
    if (board) {
      const title = $('#lessonVrTitle', board);
      const mission = $('#lessonVrMission', board);
      const prompt = $('#lessonVrPrompt', board);

      if (title) title.setAttribute('value', `${data.sid} • ${data.title}`);
      if (mission) mission.setAttribute('value', data.mission);
      if (prompt) prompt.setAttribute('value', data.prompt);

      return board;
    }

    board = document.createElement('a-entity');
    board.id = 'lessonVrReadableBoard';
    board.setAttribute('position', '0 1.65 -2.25');
    board.setAttribute('rotation', '0 0 0');

    const bg = document.createElement('a-plane');
    bg.id = 'lessonVrBoardBg';
    bg.setAttribute('width', '3.65');
    bg.setAttribute('height', '2.05');
    bg.setAttribute(
      'material',
      'color: #f8fbff; opacity: 0.98; transparent: true; side: double; shader: flat'
    );
    bg.setAttribute('position', '0 0 0');
    board.appendChild(bg);

    const header = document.createElement('a-plane');
    header.id = 'lessonVrHeaderBg';
    header.setAttribute('width', '3.65');
    header.setAttribute('height', '0.42');
    header.setAttribute('position', '0 0.82 0.01');
    header.setAttribute('material', 'color: #1d4ed8; opacity: 1; shader: flat');
    board.appendChild(header);

    const title = document.createElement('a-text');
    title.id = 'lessonVrTitle';
    title.setAttribute('value', `${data.sid} • ${data.title}`);
    title.setAttribute('position', '-1.68 0.82 0.035');
    title.setAttribute('align', 'left');
    title.setAttribute('anchor', 'left');
    title.setAttribute('baseline', 'center');
    title.setAttribute('color', '#ffffff');
    title.setAttribute('width', '3.25');
    title.setAttribute('wrap-count', '34');
    title.setAttribute('font', 'https://cdn.aframe.io/fonts/Roboto-msdf.json');
    title.setAttribute('negate', 'false');
    board.appendChild(title);

    const missionLabel = document.createElement('a-text');
    missionLabel.id = 'lessonVrMissionLabel';
    missionLabel.setAttribute('value', 'MISSION');
    missionLabel.setAttribute('position', '-1.68 0.42 0.035');
    missionLabel.setAttribute('align', 'left');
    missionLabel.setAttribute('anchor', 'left');
    missionLabel.setAttribute('baseline', 'center');
    missionLabel.setAttribute('color', '#0f766e');
    missionLabel.setAttribute('width', '2.8');
    missionLabel.setAttribute('font', 'https://cdn.aframe.io/fonts/Roboto-msdf.json');
    missionLabel.setAttribute('negate', 'false');
    board.appendChild(missionLabel);

    const mission = document.createElement('a-text');
    mission.id = 'lessonVrMission';
    mission.setAttribute('value', data.mission);
    mission.setAttribute('position', '-1.68 0.18 0.035');
    mission.setAttribute('align', 'left');
    mission.setAttribute('anchor', 'left');
    mission.setAttribute('baseline', 'top');
    mission.setAttribute('color', '#123047');
    mission.setAttribute('width', '3.25');
    mission.setAttribute('wrap-count', '38');
    mission.setAttribute('font', 'https://cdn.aframe.io/fonts/Roboto-msdf.json');
    mission.setAttribute('negate', 'false');
    board.appendChild(mission);

    const promptBox = document.createElement('a-plane');
    promptBox.id = 'lessonVrPromptBox';
    promptBox.setAttribute('width', '3.25');
    promptBox.setAttribute('height', '0.7');
    promptBox.setAttribute('position', '0 -0.56 0.02');
    promptBox.setAttribute('material', 'color: #e0f2fe; opacity: 1; shader: flat');
    board.appendChild(promptBox);

    const prompt = document.createElement('a-text');
    prompt.id = 'lessonVrPrompt';
    prompt.setAttribute('value', data.prompt);
    prompt.setAttribute('position', '-1.52 -0.31 0.045');
    prompt.setAttribute('align', 'left');
    prompt.setAttribute('anchor', 'left');
    prompt.setAttribute('baseline', 'top');
    prompt.setAttribute('color', '#0f172a');
    prompt.setAttribute('width', '3.0');
    prompt.setAttribute('wrap-count', '36');
    prompt.setAttribute('font', 'https://cdn.aframe.io/fonts/Roboto-msdf.json');
    prompt.setAttribute('negate', 'false');
    board.appendChild(prompt);

    const hint = document.createElement('a-text');
    hint.id = 'lessonVrHint';
    hint.setAttribute('value', 'Look at the card. Answer on the main screen or use voice/speech task when available.');
    hint.setAttribute('position', '-1.68 -0.92 0.035');
    hint.setAttribute('align', 'left');
    hint.setAttribute('anchor', 'left');
    hint.setAttribute('baseline', 'center');
    hint.setAttribute('color', '#475569');
    hint.setAttribute('width', '3.25');
    hint.setAttribute('wrap-count', '45');
    hint.setAttribute('font', 'https://cdn.aframe.io/fonts/Roboto-msdf.json');
    hint.setAttribute('negate', 'false');
    board.appendChild(hint);

    scene.appendChild(board);

    // If camera exists, keep board in front of the learner
    try {
      board.setAttribute('look-at', '#lessonVrCamera');
    } catch (e) {}

    return board;
  }

  function addBottomControls(scene) {
    if ($('#lessonVrControlBar', scene)) return;

    const bar = document.createElement('a-entity');
    bar.id = 'lessonVrControlBar';
    bar.setAttribute('position', '0 0.35 -2.2');

    const bg = document.createElement('a-plane');
    bg.setAttribute('width', '2.85');
    bg.setAttribute('height', '0.28');
    bg.setAttribute('material', 'color: #0f172a; opacity: 0.86; transparent: true; shader: flat');
    bg.setAttribute('position', '0 0 0');
    bar.appendChild(bg);

    const text = document.createElement('a-text');
    text.setAttribute('value', 'VR Lesson Ready  •  S1-S15 visibility fixed');
    text.setAttribute('position', '-1.25 0 0.03');
    text.setAttribute('align', 'left');
    text.setAttribute('anchor', 'left');
    text.setAttribute('baseline', 'center');
    text.setAttribute('color', '#ffffff');
    text.setAttribute('width', '2.5');
    text.setAttribute('wrap-count', '36');
    text.setAttribute('font', 'https://cdn.aframe.io/fonts/Roboto-msdf.json');
    text.setAttribute('negate', 'false');
    bar.appendChild(text);

    scene.appendChild(bar);
  }

  function patchHtmlOverlayToo() {
    const styleId = 'lesson-vr-visibility-fix-css';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      html, body {
        background: #071827 !important;
      }

      .vr-panel,
      .lesson-vr-panel,
      .lesson-panel,
      .mission-panel,
      .prompt-panel,
      #vrPanel,
      #lessonPanel,
      #missionPanel {
        background: rgba(248, 251, 255, .96) !important;
        color: #102033 !important;
        border: 2px solid rgba(125, 211, 252, .85) !important;
        box-shadow: 0 16px 48px rgba(0,0,0,.28) !important;
        text-shadow: none !important;
      }

      .vr-panel *,
      .lesson-vr-panel *,
      .lesson-panel *,
      .mission-panel *,
      .prompt-panel *,
      #vrPanel *,
      #lessonPanel *,
      #missionPanel * {
        color: #102033 !important;
        text-shadow: none !important;
      }

      canvas.a-canvas {
        background: #071827 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    patchHtmlOverlayToo();

    const scene = ensureScene();

    const doPatch = () => {
      const camera = ensureCamera(scene);
      addLights(scene);
      brightenExistingScene(scene);
      createReadableBoard(scene, camera);
      addBottomControls(scene);
    };

    doPatch();

    if (scene.hasLoaded) {
      doPatch();
    } else {
      scene.addEventListener('loaded', doPatch, { once: true });
    }

    setTimeout(doPatch, 700);
    setTimeout(doPatch, 1800);
    setTimeout(doPatch, 3500);

    window.LESSON_VR_VISIBILITY_FIX = {
      version: PATCH,
      refresh: doPatch
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
