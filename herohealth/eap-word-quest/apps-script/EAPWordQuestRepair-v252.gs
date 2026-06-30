/* =========================================================
   EAP Word Quest • Deprecated Repair Stub
   File: /herohealth/eap-word-quest/apps-script/EAPWordQuestRepair-v252.gs

   Do not use the former v252 quarantine/removal repair for the confirmed
   KK / 12 and KP / 50 test ledger. It could leave the dashboard empty until
   history was manually recovered.

   Use instead:
   /herohealth/eap-word-quest/apps-script/EAPWordQuestRepair-v253.gs

   Run:
   1) inspectEapWordQuestConfirmedKK12KP50Repair()
   2) applyEapWordQuestConfirmedKK12KP50Repair()
========================================================= */

function eapWordQuestRepairUnsafeV243Backfill() {
  throw new Error('Deprecated repair. Use EAPWordQuestRepair-v253.gs: inspectEapWordQuestConfirmedKK12KP50Repair(), then applyEapWordQuestConfirmedKK12KP50Repair().');
}
