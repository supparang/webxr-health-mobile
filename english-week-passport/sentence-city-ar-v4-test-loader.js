(async function () {
  "use strict";

  const SOURCE = "./sentence-city-ar-v4.js?v=20260806-scar4";
  const TEST_VERSION = "2026-08-06-SENTENCE-CITY-AR-ONLY-V4-1";

  try {
    const response = await fetch(SOURCE, { cache: "no-store" });
    if (!response.ok) throw new Error(`AR_SOURCE_${response.status}`);

    let source = await response.text();
    source = source
      .replace('const VERSION = "2026-08-06-SENTENCE-CITY-AR-HAND-V4";', `const VERSION = "${TEST_VERSION}";`)
      .replace('const SPECIAL_INDEXES = Object.freeze([2, 5, 8]);', 'const SPECIAL_INDEXES = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);')
      .replace('3 AR Hand Missions', '10 AR Hand Missions')
      .replace(/\/3 ภารกิจ/g, '/10 ภารกิจ')
      .replace(/SPECIAL \$\{SPECIAL_INDEXES\.indexOf\(Number\(state\.index\)\) \+ 1\}\/3/g, 'AR ONLY ${Number(state.index) + 1}/10')
      .replace('<button id="sentenceArTouch" class="sentence-ar-btn touch" type="button">Use Touch Instead</button>', '')
      .replace('document.getElementById("sentenceArTouch")?.addEventListener("click", () => fallbackToTouch("ผู้เล่นเลือกโหมดสัมผัส"));', '')
      .replace('• Touch fallback พร้อมเสมอ', '• AR Hand Control ทุกภารกิจ')
      .replace('Touch fallback ${metrics.fallbackMissions.length} ภารกิจ', 'AR-only mode');

    source = source.replace(
      /function fallbackToTouch\(reason\) \{[\s\S]*?\n  \}\n\n  function finishPreviousMission/,
      `function fallbackToTouch(reason) {
    stopAr("ar_retry_required");
    runtime.fallback = false;
    const panel = document.getElementById("sentenceArPanel");
    panel?.classList.remove("running", "fallback");
    statusText("AR Hand Detect ยังไม่พร้อม", \`${'${reason || ""}'} กรุณาตรวจสิทธิ์กล้อง แสง และกด Start AR อีกครั้ง\`);
    const startButton = document.getElementById("sentenceArStart");
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = false;
      startButton.textContent = "Retry AR Hand Mode";
    }
    pushEvent("ar_retry_required", { reason: reason || "unknown" });
  }

  function finishPreviousMission`
    );

    if (!source.includes('Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])')) {
      throw new Error("AR_ONLY_INDEX_PATCH_FAILED");
    }
    if (source.includes('Use Touch Instead')) {
      throw new Error("AR_ONLY_TOUCH_BUTTON_PATCH_FAILED");
    }

    const blob = new Blob([source], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const script = document.createElement("script");
    script.src = url;
    script.dataset.version = TEST_VERSION;
    script.onload = () => URL.revokeObjectURL(url);
    script.onerror = () => {
      URL.revokeObjectURL(url);
      throw new Error("AR_ONLY_SCRIPT_LOAD_FAILED");
    };
    document.body.appendChild(script);

    window.SENTENCE_CITY_AR_TEST_LOADER = Object.freeze({
      version: TEST_VERSION,
      mode: "ar-only",
      specialMissionIndexes: [1,2,3,4,5,6,7,8,9,10],
      source: SOURCE
    });
  } catch (error) {
    console.error("Sentence City AR-only loader failed", error);
    const banner = document.createElement("div");
    banner.style.cssText = "position:fixed;z-index:9999;left:12px;right:12px;bottom:12px;padding:12px;border-radius:14px;background:#7f1d1d;color:white;font:700 14px system-ui;text-align:center";
    banner.textContent = `AR-only Loader Error: ${String(error?.message || error)}`;
    document.body.appendChild(banner);
  }
}());
