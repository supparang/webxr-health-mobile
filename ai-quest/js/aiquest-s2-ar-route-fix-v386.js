/* AI Quest S2 AR Route Fix v3.8.6
   S2 AR practice engine starts on ?session=s2&ar=agent.
   Older entry/click scripts may still send ar=hand. Normalize it before S2 engine loads.
*/
(() => {
  "use strict";
  const q = new URLSearchParams(location.search);
  const session = String(q.get("session") || "").toLowerCase();
  const ar = String(q.get("ar") || "").toLowerCase();
  if (session === "s2" && (ar === "hand" || ar === "s2" || ar === "practice")) {
    q.set("ar", "agent");
    q.set("from", q.get("from") || "s2");
    q.set("v", "20260629-s2route386");
    location.replace(location.pathname + "?" + q.toString() + location.hash);
    return;
  }
  console.log("[AIQuest S2 AR] route normalized", { session, ar });
})();
