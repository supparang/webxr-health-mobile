# EAP Hero Cloud-First Router Patch v132

Use this patch in the existing Apps Script project that serves:

```text
https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec
```

## Required files in Apps Script

Add or update these files in the same Apps Script project:

1. `SharedWebAppRouter.gs`
2. `EAP_SheetV132.gs`
3. `EAP_CloudResume_v132.gs`
4. existing evidence / audio / Word Quest files

## doGet(e) route required

Place this near the top of `doGet(e)`, before the default `eapHeroDoGet_(e)` branch:

```javascript
if (
  action === 'player_resume' ||
  action === 'eap_player_resume'
) {
  return eapRouterJson_(
    eapPlayerResume_(e.parameter || {}),
    callback
  );
}
```

Also keep the v132 health/setup routes:

```javascript
if (
  action === 'eap_sheet_v132_health' ||
  action === 'sheet_v132_health'
) {
  return eapRouterJson_(eapSheetV132Health_(), callback);
}

if (
  action === 'eap_sheet_v132_headers' ||
  action === 'sheet_v132_headers'
) {
  return eapRouterJson_(eapSheetV132Headers_(), callback);
}

if (
  action === 'eap_sheet_v132_setup' ||
  action === 'setup_eap_sheet_v132' ||
  action === 'setup_sheet_v132'
) {
  return eapRouterJson_(eapSheetV132Setup_(), callback);
}
```

## doPost(e) requirement

Before forwarding to the old EAP Hero receiver, mirror payloads into v132 tabs:

```javascript
if (eapSheetV132ShouldMirror_(action, payload)) {
  eapSheetV132MirrorSafe_(payload);
}
```

## Deploy steps

1. Save all files.
2. Run `SETUP_EAP_SHEET_V132()` once.
3. Deploy → Manage deployments → Edit.
4. Version → New version.
5. Deploy.
6. Test:

```text
/exec?action=eap_sheet_v132_health
/exec?action=player_resume&studentId=65010001&studentName=Test&section=122&callback=cb
```

## Expected behavior

- Student enters studentId + section on any device.
- `player_resume` reads Sheet rows by studentId + section.
- Game restores only Cloud/Sheet verified records.
- Sequential unlock uses only verified records, not local-only progress.
- LocalStorage is a cache only, not the source of truth.
