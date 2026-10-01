(() => {
  "use strict";

  const host = document.getElementById("blindReviewApp");
  const REASON_CODES = [
    "MISSING_QR",
    "MISSING_IDENTITY",
    "MISSING_CHECKOUT",
    "MISSING_STAFF_VERIFICATION",
    "SHORT_DURATION",
    "DUPLICATE_SCAN",
    "TEMPORAL_CONFLICT",
    "STAFF_WITHOUT_CHECKIN",
    "OTHER",
  ];

  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
  const fmt = (value) => value
    ? new Date(value).toLocaleString("th-TH", { dateStyle:"medium", timeStyle:"short" })
    : "—";

  const hashParams = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
  let token = String(hashParams.get("token") || "").trim();
  // Remove the bearer token from browser history/address bar immediately.
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);

  async function publicApi(path, options = {}) {
    if (!token) throw new Error("BLIND_REVIEW_TOKEN_MISSING");
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    headers.set("Authorization", "BlindReview " + token);
    if (options.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...options, headers, credentials:"omit", cache:"no-store", redirect:"error" });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(data.error || ("HTTP_" + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function errorMessage(error) {
    const code = String(error?.message || error || "");
    const map = {
      BLIND_REVIEW_TOKEN_MISSING:"ลิงก์ไม่สมบูรณ์ กรุณาขอลิงก์ใหม่จากผู้ประสานงานวิจัย",
      BLIND_REVIEW_TOKEN_REQUIRED:"ไม่พบสิทธิ์การประเมิน",
      BLIND_REVIEW_LINK_INVALID:"ลิงก์นี้ไม่ถูกต้อง",
      BLIND_REVIEW_LINK_REVOKED:"ลิงก์นี้ถูกยกเลิกแล้ว",
      BLIND_REVIEW_LINK_EXPIRED:"ลิงก์นี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่",
      BLIND_REVIEW_ALREADY_SUBMITTED:"ลิงก์นี้ถูกใช้ส่งผลประเมินแล้ว",
      BLIND_REVIEW_BATCH_NOT_OPEN:"รอบการประเมินนี้ปิดแล้ว",
      GROUND_TRUTH_ALREADY_LOCKED:"Ground Truth ของรายการนี้ถูก Lock แล้ว",
      INDEPENDENCE_ATTESTATION_REQUIRED:"กรุณายืนยันว่าคุณประเมินอย่างอิสระก่อนส่งผล",
    };
    return map[code] || ("ไม่สามารถดำเนินการได้: " + code);
  }

  function evidenceBadge(label, value) {
    return '<span>' + esc(label) + ' <b>' + (value ? "✓" : "✕") + '</b></span>';
  }

  function renderSession(data) {
    const e = data.evidence || {};
    const a = data.activity || {};
    host.innerHTML =
      '<div class="panel">'+
        '<div class="alert info"><b>Blinded review</b><br>'+
          'หน้านี้ไม่แสดงชื่อ/รหัสบุคลากร, AI prediction, Rule Consistency หรือผลของผู้ประเมินคนอื่น</div>'+
        '<div class="alert warn"><b>Reviewer '+esc(data.reviewerSlot)+'</b> • ลิงก์ใช้ได้ครั้งเดียว • หมดอายุ '+esc(fmt(data.expiresAt))+'</div>'+
        '<h2>'+esc(a.title || "กิจกรรม")+'</h2>'+
        '<p class="muted">'+esc(a.category || "")+' • '+esc(fmt(a.startAt))+' → '+esc(fmt(a.endAt))+' • Case '+esc(data.caseRef || "")+'</p>'+
        '<h3>Raw Evidence</h3>'+
        '<div class="evidence-strip">'+
          evidenceBadge("QR", e.qrValid)+
          evidenceBadge("ตัวตน", e.identityVerified)+
          evidenceBadge("Check-in", e.checkinPresent)+
          evidenceBadge("Check-out", e.checkoutPresent)+
          evidenceBadge("Check-out QR", e.checkoutQrValid)+
          evidenceBadge("Reviewer", e.staffVerified)+
          evidenceBadge("ลายเซ็น", e.signatureVerified)+
          '<span>Scan <b>'+esc(e.scanAttempts ?? 0)+'</b></span>'+
        '</div>'+
        '<div class="grid cards" style="margin-top:14px">'+
          '<div class="card"><div class="muted">เวลาเข้า</div><b>'+esc(fmt(e.checkinAt))+'</b></div>'+
          '<div class="card"><div class="muted">เวลาออก</div><b>'+esc(fmt(e.checkoutAt))+'</b></div>'+
          '<div class="card"><div class="muted">เวลาตามกำหนด</div><b>'+esc(e.scheduledDurationMinutes ?? "—")+' นาที</b></div>'+
          '<div class="card"><div class="muted">เวลาเข้าร่วมจริง</div><b>'+esc(e.actualDurationMinutes ?? "—")+' นาที</b></div>'+
        '</div>'+
        '<hr><h3>Independent Label</h3>'+
        '<div class="field"><label>Final Target</label><select id="brTarget">'+
          '<option value="NO_REVIEW_REQUIRED">NO_REVIEW_REQUIRED</option>'+
          '<option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>'+
        '</select></div>'+
        '<h3>Reason Codes</h3>'+
        '<div class="policy">'+REASON_CODES.map((code) =>
          '<label class="check"><input type="checkbox" class="brReason" value="'+esc(code)+'"> '+esc(code)+'</label>'
        ).join("")+'</div>'+
        '<div class="field" style="margin-top:14px"><label>หมายเหตุ (ไม่บังคับ)</label>'+
          '<textarea id="brNotes" maxlength="2000" placeholder="บันทึกเหตุผลจากหลักฐานที่เห็น โดยไม่อ้างอิง AI หรือผลผู้ประเมินอื่น"></textarea></div>'+
        '<div class="alert info" style="margin-top:14px">'+
          '<label class="check"><input type="checkbox" id="brAttest"> '+
          'ฉันยืนยันว่าฉันเป็นผู้ประเมินคนจริง ประเมินรายการนี้ด้วยตนเองอย่างอิสระ และไม่ได้ใช้ลิงก์ของ Reviewer อีกคน</label>'+
        '</div>'+
        '<div class="actions"><button class="btn primary" id="brSubmit">ส่ง Independent Label</button></div>'+
        '<div id="brMsg"></div>'+
      '</div>';

    document.getElementById("brSubmit").onclick = async () => {
      const button = document.getElementById("brSubmit");
      const msg = document.getElementById("brMsg");
      const reasonCodes = [...document.querySelectorAll(".brReason:checked")].map((x) => x.value);
      const independenceAttested = Boolean(document.getElementById("brAttest").checked);
      if (!independenceAttested) {
        msg.innerHTML = '<div class="alert warn">กรุณายืนยันการประเมินอย่างอิสระก่อนส่งผล</div>';
        return;
      }
      if (!confirm("ยืนยันส่ง Independent Label? หลังส่งแล้วลิงก์นี้จะใช้ซ้ำหรือแก้ผลไม่ได้")) return;

      button.disabled = true;
      button.textContent = "กำลังส่ง…";
      try {
        const result = await publicApi("/api/public/blind-review/submit", {
          method:"POST",
          body:JSON.stringify({
            target:document.getElementById("brTarget").value,
            reasonCodes,
            notes:document.getElementById("brNotes").value.trim(),
            independenceAttested,
          }),
        });
        token = "";
        host.innerHTML =
          '<div class="panel"><div class="alert ok"><b>ส่ง Independent Label สำเร็จ</b><br>'+
          'ผลถูกบันทึกแบบ immutable แล้ว และลิงก์นี้ไม่สามารถใช้ซ้ำได้</div>'+
          '<p class="muted">คุณสามารถปิดหน้านี้ได้ ไม่ต้องเข้าสู่ระบบ ACTIVA-AI</p>'+
          (result.batchComplete
            ? '<div class="hint">ผู้ประเมินทั้งสองส่งผลแล้ว ระบบพร้อมให้ ADMIN ตรวจ Agreement/Adjudication</div>'
            : '<div class="hint">ระบบยังรอ Independent Reviewer อีกหนึ่งคน</div>')+
          '</div>';
      } catch (error) {
        msg.innerHTML = '<div class="alert bad">'+esc(errorMessage(error))+'</div>';
        button.disabled = false;
        button.textContent = "ส่ง Independent Label";
      }
    };
  }

  async function init() {
    if (!token) {
      host.innerHTML = '<div class="panel"><div class="alert bad">'+esc(errorMessage(new Error("BLIND_REVIEW_TOKEN_MISSING")))+'</div></div>';
      return;
    }
    try {
      const data = await publicApi("/api/public/blind-review/session");
      renderSession(data);
    } catch (error) {
      token = "";
      host.innerHTML = '<div class="panel"><div class="alert bad">'+esc(errorMessage(error))+'</div></div>';
    }
  }

  void init();
})();
