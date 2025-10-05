Fitness Adventure VR — Beat Map Editor + Multi-song Player
===========================================================

Files:
- editor.html           (Web-based Beat Map Editor: drag-and-drop, BPM/bars, snap, preview/metronome, import/export JSON)
- index.html + player.js (Game player with BPM sync, metronome preview button, multiple songs + custom upload)
- assets/
  - metronome.wav       (click track)
  - song_easy.wav, song_normal.wav, song_hard.wav (placeholder tones for demo)
  - beatmap_easy.json, beatmap_normal.json, beatmap_hard.json

How to run:
1) Serve this folder with a local web server (WebXR needs origin):
   python -m http.server
2) Open editor.html to author a beat map (drag events onto timeline) → Export JSON.
3) Open index.html → select your beat map + choose a song (or upload your file) → Start.

Beat Map JSON format:
{
  "title": "Name",
  "duration": 60,
  "bpm": 120,
  "events": [{"t": 2.00, "type": "punchL"}, ...]
}
types: punchL, punchR, duck, handsUp

BPM Sync Tips:
- duration should match the playable segment of your song.
- t is absolute seconds from song start (index.html starts bgm at t=0).
- For visual authoring on bars/beats, use editor.html (set BPM, Bars, Beats/Bar, Snap).
