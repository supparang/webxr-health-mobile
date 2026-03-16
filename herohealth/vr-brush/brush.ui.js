// /herohealth/vr-brush/brush.ui.js
// HOTFIX v20260316c-BRUSH-UI-UNFREEZE

export function createBrushUI(ctx){
  const {
    byId,
    arenaCore,
    brushCursor,
    cleanFill,
    bossHpWrap,
    bossHpFill,
    bossHpText,
    hintBadgeEl,
    nowDoTextEl,
    coachTextEl,
    coachBoxEl,
    nowDoBoxEl,
    ZONES,
    S,
    currentModeCfg,
    totalCleanPct,
    zoneCleanPct,
    calcZoneStars,
    zoneDirectionText,
    humanZoneInstruction
  } = ctx;

  function setText(id, value){
    const el = byId(id);
    if(el) el.textContent = value ?? '';
  }

  function setHtml(id, value){
    const el = byId(id);
    if(el) el.innerHTML = value ?? '';
  }

  function setNowDoText(text){
    if(nowDoTextEl) nowDoTextEl.textContent = text || '';
    if(nowDoBoxEl){
      nowDoBoxEl.classList.remove('active');
      void nowDoBoxEl.offsetWidth;
      nowDoBoxEl.classList.add('active');
    }
  }

  function setCoachText(text, tone='mid'){
    if(coachTextEl){
      coachTextEl.textContent = text || '';
      coachTextEl.classList.remove('good','mid','warn');
      coachTextEl.classList.add(tone || 'mid');
    }
    if(coachBoxEl){
      coachBoxEl.classList.remove('active');
      void coachBoxEl.offsetWidth;
      coachBoxEl.classList.add('active');
    }
    S.coachMsg = text || '';
    S.coachUntil = performance.now() + 2400;
  }

  function updateBrushCursor(ev){
    if(!arenaCore || !brushCursor || !ev) return;
    const r = arenaCore.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    brushCursor.style.left = x + 'px';
    brushCursor.style.top = y + 'px';
    brushCursor.style.opacity = '1';
  }

  function hideBrushCursor(){
    if(brushCursor) brushCursor.style.opacity = '0';
  }

  function updateDirBadge(idx, dx, dy, directionScore){
    const el = byId('dirBadge');
    if(!el) return;

    el.classList.remove('dirGood','dirWarn');

    const txt = zoneDirectionText(idx);
    const icon = ZONES[idx]?.dir === 'horizontal' ? '↔' : '↕';
    const sc = typeof directionScore === 'function' ? directionScore(idx, dx, dy) : 1;

    if(sc >= 1.25){
      el.classList.add('dirGood');
      el.textContent = `${icon} ${txt} ✓`;
    } else if(sc < 0.9){
      el.classList.add('dirWarn');
      el.textContent = `${icon} ${txt} !`;
    } else {
      el.textContent = `${icon} ${txt}`;
    }
  }

  function resetDirBadge(activeZoneIdx){
    const dirBadge = byId('dirBadge');
    if(!dirBadge) return;
    dirBadge.classList.remove('dirGood','dirWarn');
    const icon = ZONES[activeZoneIdx]?.dir === 'horizontal' ? '↔' : '↕';
    dirBadge.textContent = `${icon} ${zoneDirectionText(activeZoneIdx)}`;
  }

  function refreshHeaderStats(){
    S.clean = typeof totalCleanPct === 'function' ? totalCleanPct() : 0;

    if(cleanFill) cleanFill.style.width = `${S.clean}%`;

    setText('statClean', `${S.clean}%`);
    setText('statScore', String(Math.round(S.score || 0)));
    setText('statCombo', String(S.combo || 0));
    setText('statMiss', String(S.miss || 0));
    setText('statTime', S.mode === 'learn' ? '∞' : String(Math.ceil(S.timeLeft || 0)));

    if(S.bossStarted && !S.bossCompleted){
      setText(
        'statBoss',
        `${Math.max(0, Math.ceil(S.bossHP || 0))}/${Math.max(0, Math.ceil(S.bossMaxHP || 0))}`
      );
    } else {
      setText('statBoss', '—');
    }

    if(bossHpWrap && bossHpFill && bossHpText){
      if(S.bossStarted && !S.bossCompleted){
        bossHpWrap.style.display = 'grid';
        const pct = (S.bossMaxHP || 0) > 0
          ? Math.max(0, Math.min(100, ((S.bossHP || 0) / S.bossMaxHP) * 100))
          : 0;
        bossHpFill.style.width = `${pct}%`;
        bossHpText.textContent = `${Math.max(0, Math.ceil(S.bossHP || 0))}/${Math.max(0, Math.ceil(S.bossMaxHP || 0))}`;
      } else {
        bossHpWrap.style.display = 'none';
      }
    }

    const phaseText = S.phase === 'boss'
      ? `บอส P${S.bossPhase || 1}`
      : (S.phase === 'polish' ? 'เก็บรายละเอียด' : 'เรียนรู้');

    setText('pillPhase', phaseText);
    setText('pillMode', currentModeCfg()?.label || 'Learn');

    const active = S.zoneState?.[S.activeZoneIdx];
    setText('pillZone', active ? active.label : '—');
  }

  function refreshZoneCards(){
    if(!Array.isArray(S.zoneState)) return;

    S.zoneState.forEach((zs, idx)=>{
      const activeNow = idx === S.activeZoneIdx;
      const pct = typeof zoneCleanPct === 'function' ? zoneCleanPct(zs) : 0;

      if(zs?.el){
        zs.el.classList.toggle('active', !!activeNow && !S.finished);
        zs.el.classList.toggle('completed', !!zs.completed);
        zs.el.style.zIndex = activeNow ? '20' : '16';
      }

      const item = byId(`zoneItem_${zs.id}`);
      if(item){
        item.classList.toggle('active', !!activeNow && !S.finished);
        item.classList.toggle('completed', !!zs.completed);
      }

      const fill = byId(`zoneFill_${zs.id}`);
      const pctEl = byId(`zonePct_${zs.id}`);
      if(fill) fill.style.width = `${pct}%`;
      if(pctEl) pctEl.textContent = `${pct}%`;

      const starsEl = byId(`zoneStars_${zs.id}`);
      const noteEl = byId(`zoneNote_${zs.id}`);
      const ms = S.zoneMastery?.[idx];

      if(ms && typeof calcZoneStars === 'function'){
        calcZoneStars(S.zoneState, S.zoneMastery, idx, currentModeCfg().cleanTarget);
      }

      if(starsEl && ms){
        starsEl.textContent = `${'★'.repeat(ms.totalStar || 0)}${'☆'.repeat(3 - (ms.totalStar || 0))}`;
        starsEl.classList.toggle('starGood', (ms.totalStar || 0) >= 2);
      }

      if(noteEl){
        noteEl.classList.remove('noteGood','noteMid','noteWarn');

        if(zs.completed){
          const star = ms?.totalStar || 0;
          noteEl.textContent =
            star >= 3 ? 'ยอดเยี่ยม' :
            star === 2 ? 'ดีมาก' :
            star === 1 ? 'ผ่านแล้ว' : 'ลองอีกนิด';

          if(star >= 3) noteEl.classList.add('noteGood');
          else if(star === 2) noteEl.classList.add('noteMid');
          else noteEl.classList.add('noteWarn');
        } else {
          noteEl.textContent = activeNow ? 'กำลังเล่น' : 'ยังไม่จบ';
        }
      }
    });
  }

  function refreshInstructionArea(active){
    const zLabel = active ? active.label : '—';
    const target = currentModeCfg()?.cleanTarget ?? 85;

    if(!S.bossStarted){
      if(S.mode === 'learn'){
        setHtml(
          'instruction',
          `ตอนนี้ให้ถู <b>${zLabel}</b>
           <span class="sub" id="instructionSub">ถูในกรอบสีฟ้าบนรูปฟันตรงกลาง</span>`
        );
        setText('questText', `ฝึกทีละโซนให้คุ้นมือ • เป้าหมายโซนละ ${target}%`);
      } else if(S.mode === 'practice'){
        setHtml(
          'instruction',
          `ตอนนี้ให้ถู <b>${zLabel}</b>
           <span class="sub" id="instructionSub">ถูในกรอบสีฟ้าบนรูปฟันตรงกลาง</span>`
        );
        setText('questText', `ทำความสะอาดทีละโซนให้เกิน ${target}% แล้วจะเจอบอสหินปูน`);
      } else {
        setHtml(
          'instruction',
          `รีบถู <b>${zLabel}</b>
           <span class="sub" id="instructionSub">ถูให้เร็ว แม่น และถูกทิศ</span>`
        );
        setText('questText', `โหมดท้าทาย: แต่ละโซนต้องเกิน ${target}% แล้วไปสู้บอส`);
      }
      return;
    }

    if(!S.bossCompleted){
      let sub = 'แตะเร็วอย่างแม่นยำเพื่อลด HP บอส';
      if(S.bossMode === 'laserWarn') sub = 'เตรียมหยุดแปรง';
      else if(S.bossMode === 'laserLive') sub = 'เลเซอร์ทำงาน: ห้ามแตะ';
      else if(S.bossMode === 'shockWait') sub = 'แตะให้ตรงจังหวะวงแหวน';
      else if(S.bossMode === 'decoy') sub = 'อย่าแตะโซนปลอม';

      setHtml(
        'instruction',
        `บอสหินปูนอยู่ที่ <b>${zLabel}</b>
         <span class="sub" id="instructionSub">${sub}</span>`
      );

      setHtml(
        'questText',
        `ลด HP บอสให้เหลือ 0 • ตอนนี้ HP ${Math.max(0, Math.ceil(S.bossHP || 0))}<br>
         Shock Perfect: <b>${S.quest?.perfectShock || 0}/3</b> ${S.quest?.donePerfectShock ? '✅' : ''} •
         Survive Laser: <b>${S.quest?.laserSurvive || 0}/2</b> ${S.quest?.doneLaserSurvive ? '✅' : ''} •
         Avoid Decoy: <b>${S.quest?.decoyAvoid || 0}/2</b> ${S.quest?.doneDecoyAvoid ? '✅' : ''}`
      );
      return;
    }

    setHtml(
      'instruction',
      `ฟันสะอาดแล้ว! เก็บรายละเอียดหรือจบเกมได้
       <span class="sub" id="instructionSub">กด Finish เพื่อดูสรุปผล</span>`
    );

    setHtml(
      'questText',
      `บอสถูกกำจัดแล้ว • คุณสามารถกด Finish ได้<br>
       Quest: Shock ${S.quest?.donePerfectShock ? '✅' : '⬜'} •
       Laser ${S.quest?.doneLaserSurvive ? '✅' : '⬜'} •
       Decoy ${S.quest?.doneDecoyAvoid ? '✅' : '⬜'}`
    );
  }

  function refreshHintArea(active){
    if(!hintBadgeEl) return;

    if(!S.bossStarted){
      if(S.mode === 'learn'){
        hintBadgeEl.textContent = '👆 ถูในกรอบสีฟ้า';
        setNowDoText(`${humanZoneInstruction(active ? active.label : 'โซนนี้')} ในกรอบสีฟ้า`);
      } else if(S.mode === 'practice'){
        hintBadgeEl.textContent = '👆 ถูในกรอบสีฟ้า';
        setNowDoText(`${humanZoneInstruction(active ? active.label : 'โซนนี้')} โดย${zoneDirectionText(S.activeZoneIdx)}`);
      } else {
        hintBadgeEl.textContent = '⚡ ถูให้เร็วและถูกทิศ';
        setNowDoText(`${humanZoneInstruction(active ? active.label : 'โซนนี้')} ให้เร็วและแม่น`);
      }
      return;
    }

    if(!S.bossCompleted){
      if(S.bossMode === 'laserWarn'){
        hintBadgeEl.textContent = '🚫 เตรียมหยุดแปรง';
        setNowDoText('หยุดก่อน เลเซอร์กำลังมา');
      } else if(S.bossMode === 'laserLive'){
        hintBadgeEl.textContent = '🚫 ห้ามแตะตอนนี้';
        setNowDoText('ห้ามแตะตอนเลเซอร์ทำงาน');
      } else if(S.bossMode === 'shockWait'){
        hintBadgeEl.textContent = '⚡ แตะตามวงแหวน';
        setNowDoText('แตะให้ตรงจังหวะวงแหวน');
      } else if(S.bossMode === 'decoy'){
        hintBadgeEl.textContent = '🪞 อย่าแตะโซนหลอก';
        setNowDoText('แตะเฉพาะโซนจริง');
      } else {
        hintBadgeEl.textContent = `🦠 โจมตีบอสที่ ${active ? active.label : 'โซนปัจจุบัน'}`;
        setNowDoText(`สู้บอสที่ ${active ? active.label : 'โซนปัจจุบัน'}`);
      }
      return;
    }

    hintBadgeEl.textContent = '✨ เก็บคะแนนเพิ่มหรือกด Finish';
    setNowDoText('กด Finish เพื่อดูสรุปผล');
  }

  function refreshSkillButtons(){
    const uvReady = performance.now() >= (S.uvCdUntil || 0);
    const polishReady = performance.now() >= (S.polishCdUntil || 0);

    const btnUV = byId('btnUV');
    const btnPolish = byId('btnPolish');
    const btnStartBoss = byId('btnStartBoss');
    const btnModeLearn = byId('btnModeLearn');
    const btnModePractice = byId('btnModePractice');
    const btnModeChallenge = byId('btnModeChallenge');

    if(btnUV){
      btnUV.classList.toggle('disabled', !uvReady || !currentModeCfg().uv);
      btnUV.disabled = !uvReady || !currentModeCfg().uv;
    }

    if(btnPolish){
      btnPolish.classList.toggle('disabled', !polishReady || !currentModeCfg().polish);
      btnPolish.disabled = !polishReady || !currentModeCfg().polish;
    }

    if(btnStartBoss){
      btnStartBoss.classList.toggle('disabled', !currentModeCfg().boss);
      btnStartBoss.disabled = !currentModeCfg().boss;
    }

    if(btnModeLearn) btnModeLearn.classList.toggle('modeActive', S.mode === 'learn');
    if(btnModePractice) btnModePractice.classList.toggle('modeActive', S.mode === 'practice');
    if(btnModeChallenge) btnModeChallenge.classList.toggle('modeActive', S.mode === 'challenge');
  }

  function refreshZoneFallbackVisual(activeIdx){
    if(!Array.isArray(S.zoneState)) return;
    S.zoneState.forEach((zs, idx)=>{
      if(!zs?.el) return;
      if(idx === activeIdx && !S.finished){
        zs.el.classList.add('active');
        zs.el.style.opacity = '1';
      }
    });
  }

  function refreshZoneUI(){
    const active = S.zoneState?.[S.activeZoneIdx] || null;

    refreshHeaderStats();
    refreshZoneCards();
    refreshInstructionArea(active);
    refreshHintArea(active);
    refreshSkillButtons();
    refreshZoneFallbackVisual(S.activeZoneIdx);
  }

  return {
    setText,
    setHtml,
    setNowDoText,
    setCoachText,
    updateBrushCursor,
    hideBrushCursor,
    updateDirBadge,
    resetDirBadge,
    refreshZoneUI
  };
}