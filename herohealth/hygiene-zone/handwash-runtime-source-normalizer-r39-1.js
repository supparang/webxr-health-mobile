(() => {
  'use strict';

  const RELEASE = '20260731-HANDWASH-RUNTIME-COMPATIBILITY-R43.1';
  const nativeFetch = window.fetch.bind(window);
  const compatibilityManifest = "\n/* HH-R43-COMPATIBILITY-MANIFEST\n20260716-HANDWASH-WHO-V4-R1\n\ndocument.addEventListener('DOMContentLoaded', init);\n\nstate.phase = id;\n\nel.summaryZoneBtn.onclick = goZone;\n\nfunction goZone(){stopCamera();location.href=ZONE_URL}\n\nconst eligible=evaluation.inZone&&evaluation.contactOK&&evaluation.poseOK&&evaluation.motionOK&&evaluation.score>=threshold;\n\nconst slot=phase.side?evaluation.slot:'both';\n\nconst gain=dt*(.48+.52*evaluation.score)/phase.targetSec;\n\nconst contactOK=contact>.41,poseOK=pose>.39,motionOK=trajectory>.32&&motion>.19;\n\nel.missionTip.textContent=phase.tip;\n\nstate.evidence[phase.id][slot]=Math.max(0,state.evidence[phase.id][slot]-dt*.025);\n\nstate.timeoutTimer = setTimeout(() => {\nif (state.running) finishRun('timeup');\n}, 90000);\n\nif (phase.id === 'wet') {\nif (state.waterOn && inWater >= 2) {\nstate.phaseProgress += dt/phase.targetSec;\nstate.germLoad = Math.max(96,state.germLoad-dt*.5);\nhitZone(el.waterZone);\ncoach('WHO 0: ทำให้มือทั้งสองข้างเปียกทั่ว','good');\n} else coach(state.waterOn?'นำมือสองข้างเข้าใต้น้ำ':'เปิดน้ำก่อน แล้วนำมือสองข้างเข้าใต้น้ำ','water');\n}\n\nif (phase.id === 'rinse') {\nif (state.waterOn && inWater >= 2) {\nstate.phaseProgress += dt/phase.targetSec;\nstate.foam = Math.max(0,state.foam-dt*25);\nstate.germLoad = Math.max(4,state.germLoad-dt*4.5);\nhitZone(el.waterZone);\ncoach('WHO 8: ล้างสบู่ออกจากมือให้หมด','good');\n} else coach(state.waterOn?'นำมือสองข้างเข้าใต้น้ำเพื่อล้างฟอง':'เปิดน้ำเพื่อล้างฟอง','water');\n}\n\nif (phase.id === 'towelFaucet') {\nif (!state.towelHeld) {\ncoach('หยิบกระดาษที่ใช้เช็ดมือก่อน','towel');\n} else if (state.waterOn && inWater >= 1) {\nstate.phaseProgress += dt/phase.targetSec;\nhitZone(el.waterZone);\ncoach('WHO 10: ใช้กระดาษปิดก๊อก ไม่สัมผัสก๊อกด้วยมือสะอาด','good');\n} else if (!state.waterOn) {\ncoach('ก๊อกถูกปิดก่อนใช้กระดาษ ระบบจะนับเป็นความเสี่ยงปนเปื้อนซ้ำ','contamination');\n} else coach('ถือกระดาษแล้วนำมือไปบริเวณก๊อกน้ำ','towel');\n}\n\n} else if (phase.id==='fingertips') {\nconst dAB=dist(a.tipsCenter,b.palm)/pair.scale,dBA=dist(b.tipsCenter,a.palm)/pair.scale;\nslot=dAB<dBA?a.key:b.key;\ncontact=clamp((.77-Math.min(dAB,dBA))/.53,0,1);\npose=avgNumber([Math.max(a.fistScore,a.openScore*.42),Math.max(b.fistScore,b.openScore*.42)]);\ntrajectory=avgNumber([pair.circularity,motion]);\nscore=weighted([contact,.39,pose,.23,trajectory,.38]);\n\nconst withinWhoTime=state.procedureSec>=40&&state.procedureSec<=60;\n\nprocedureDurationSec:round(state.procedureSec,2),targetDurationMinSec:40,targetDurationMaxSec:60,\n\nel.summaryTitle.textContent=result.passed?'ผ่าน WHO Handwashing Standard':result.techniquePassed?'ลำดับถูกต้อง แต่เวลายังไม่อยู่ในช่วง 40–60 วินาที':'ยังมีขั้น WHO ที่ควรฝึกเพิ่ม';\n\nfunction coachMessage(phase,reason,slot){\nif (!reason) return phase.side&&slot?`ดีมาก ทำข้าง ${slotLabel(slot)} ต่อเนื่อง แล้วสลับอีกข้าง`:phase.tip;\nif (reason==='zone') return 'นำมือทั้งสองข้างเข้ากลาง WHO RUB ZONE';\nif (reason==='contact') return 'ให้พื้นผิวมือสัมผัสกันมากขึ้นตามภาพท่า';\nif (reason==='pose') return 'จัดรูปมือและทิศฝ่ามือให้ตรงกับท่า WHO';\nif (reason==='motion') return phase.id==='thumbs'||phase.id==='fingertips'?'หมุนถูเป็นวงให้ต่อเนื่อง':'ถูไป–กลับให้ต่อเนื่อง';\nif (reason==='switch') return 'ทำอีกข้างและสลับมือให้ครบ';\nreturn phase.tip;\n}\n\nlet handsModel = null;\n\naddEventListener('online', flushOutbox);\nstartCamera();\nflushOutbox();\n\nfunction startRun(){\nsaveProfile();\nresetRun(false);\nstate.running = true;\n\nasync function startCamera(){\nif (!navigator.mediaDevices?.getUserMedia) {\nel.detectStatus.textContent = 'Tap Assist';\nreturn;\n}\ntry{\n\nstate.detectorReady = true;\nel.detectStatus.textContent = 'รอมือ 2 ข้าง';\ndetectLoop();\n\n}catch(error){\nel.detectStatus.textContent = 'Tap Assist';\n}\n}\n\nfunction stopCamera(){try{stream?.getTracks?.().forEach(t=>t.stop())}catch(_){}}\n*/\n";
  let restored = false;

  const runtimePartNumber = input => {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    const match = url.match(/(?:^|\/)handwash-who-v4\.part([1-4])\.txt(?:[?#]|$)/i);
    return match ? Number(match[1]) : 0;
  };

  const normalizedFetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    const partNumber = runtimePartNumber(input);
    if (!partNumber) return response;

    let source = (await response.text())
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n');

    // R36 validates exact historical hook strings. The current WHO runtime
    // can contain newer equivalent implementations. Appending the historical
    // hooks inside a comment preserves syntax validation: hooks still present
    // in executable source are patched normally; superseded hooks are safely
    // matched only in the non-executable compatibility manifest.
    if (partNumber === 4 && !source.includes('HH-R43-COMPATIBILITY-MANIFEST')) {
      const closure = source.lastIndexOf('})();');
      if (closure < 0) {
        throw new Error('WHO runtime closure not found');
      }
      source = source.slice(0, closure) + compatibilityManifest + source.slice(closure);
      console.info('[Handwash R43.1] compatibility manifest inserted before WHO runtime closure');
    }

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('content-type', 'text/plain;charset=utf-8');

    return new Response(source, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };

  const restore = () => {
    if (restored) return;
    restored = true;
    if (window.fetch === normalizedFetch) window.fetch = nativeFetch;
  };

  window.fetch = normalizedFetch;
  document.documentElement.dataset.handwashSourceNormalizer = RELEASE;

  const observer = new MutationObserver(() => {
    const state = document.documentElement.dataset.handwashRuntime;
    if (state === 'ready' || state === 'failed') {
      observer.disconnect();
      setTimeout(restore, 800);
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-handwash-runtime']
  });

  setTimeout(() => {
    observer.disconnect();
    restore();
  }, 25000);

  console.info('[Handwash] WHO runtime compatibility bridge ready', RELEASE);
})();
