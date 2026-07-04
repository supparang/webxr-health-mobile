# Boss Evidence Router Patch

Add the following two branches inside the existing `doPost(e)` function in `EAP_Code.gs`, after the `submit_event` branch and before the fallback `Unknown action` response:

```javascript
if (action === 'submit_evidence') {
  return out_(submitEvidence_(payload));
}

if (action === 'submit_speaking_audio') {
  return out_(submitSpeakingAudio_(payload));
}
```

This retains one shared router while enabling direct B1–B5 Speaking evidence compatibility and the consent-based audio upload handler defined in `EAP_EvidenceReview.gs`.
