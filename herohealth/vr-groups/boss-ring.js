/* === /herohealth/vr-groups/boss-ring.css ===
PACK 48: boss HP ring driven by --hp (0..1)
*/

.fg-boss{
  --hp: 1;
}

/* ring becomes a conic gradient progress */
.fg-boss::after{
  /* override previous boss pulse ring to show hp */
  inset:-10px;
  border: none;
  background:
    conic-gradient(
      rgba(34,211,238,.0) 0turn,
      rgba(34,211,238,.0) calc(var(--hp)*1turn),
      rgba(2,6,23,.0)     calc(var(--hp)*1turn),
      rgba(2,6,23,.0)     1turn
    );
  -webkit-mask: radial-gradient(circle at 50% 50%, transparent 62%, #000 64%);
          mask: radial-gradient(circle at 50% 50%, transparent 62%, #000 64%);
  opacity: .95;
  filter: drop-shadow(0 0 14px rgba(34,211,238,.22));
  animation: ringSpinSlow 1.8s linear infinite;
}

@keyframes ringSpinSlow{
  to{ transform: rotate(360deg); }
}

/* low hp heartbeat */
.fg-boss.boss-low{
  box-shadow: 0 0 0 2px rgba(245,158,11,.18), var(--glow);
  border-color: rgba(245,158,11,.70);
  animation: bossHeart 520ms ease-in-out infinite;
}
@keyframes bossHeart{
  0%,100%{ transform: translate(-50%,-50%) scale(var(--s,1)); }
  50%{ transform: translate(-50%,-50%) scale(calc(var(--s,1)*1.06)); }
}