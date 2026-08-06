(async function () {
  "use strict";

  const SOURCE = "./sentence-city-ar-v4.js?v=20260806-scar4";
  const TEST_VERSION = "2026-08-06-SENTENCE-CITY-AR-FIRST-MISSION-TEST-V1";

  try {
    const response = await fetch(SOURCE, { cache: "no-store" });
    if (!response.ok) throw new Error(`AR_SOURCE_${response.status}`);

    let source = await response.text();
    source = source
      .replace('const VERSION = "2026-08-06-SENTENCE-CITY-AR-HAND-V4";', `const VERSION = "${TEST_VERSION}";`)
      .replace('const SPECIAL_INDEXES = Object.freeze([2, 5, 8]);', 'const SPECIAL_INDEXES = Object.freeze([0, 4, 8]);');

    if (!source.includes('Object.freeze([0, 4, 8])')) {
      throw new Error("AR_TEST_INDEX_PATCH_FAILED");
    }

    const blob = new Blob([source], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const script = document.createElement("script");
    script.src = url;
    script.dataset.version = TEST_VERSION;
    script.onload = () => URL.revokeObjectURL(url);
    script.onerror = () => {
      URL.revokeObjectURL(url);
      throw new Error("AR_TEST_SCRIPT_LOAD_FAILED");
    };
    document.body.appendChild(script);

    window.SENTENCE_CITY_AR_TEST_LOADER = Object.freeze({
      version: TEST_VERSION,
      specialMissionIndexes: [1, 5, 9],
      source: SOURCE
    });
  } catch (error) {
    console.error("Sentence City AR test loader failed", error);
    const banner = document.createElement("div");
    banner.style.cssText = "position:fixed;z-index:9999;left:12px;right:12px;bottom:12px;padding:12px;border-radius:14px;background:#7f1d1d;color:white;font:700 14px system-ui;text-align:center";
    banner.textContent = `AR Test Loader Error: ${String(error?.message || error)}`;
    document.body.appendChild(banner);
  }
}());
