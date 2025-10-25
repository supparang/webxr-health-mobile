body { margin:0; overflow:hidden; font-family:sans-serif; }
#hud {
  position:fixed; top:10px; left:10px;
  background:rgba(255,255,255,0.7);
  padding:8px 12px; border-radius:8px;
}
#feverBarWrap {
  width:120px; height:8px; background:#ddd; border-radius:4px;
  margin-top:4px;
}
#feverBar {
  height:8px; background:#ff7b00; border-radius:4px; width:0%;
  transition:width 0.2s linear;
}
