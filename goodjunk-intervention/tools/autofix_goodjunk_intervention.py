#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
GoodJunk Intervention Auto-Fix
PATCH v20260318a-GJI-AUTOFIX

Usage:
  python tools/autofix_goodjunk_intervention.py .
  python tools/autofix_goodjunk_intervention.py . --write
  python tools/autofix_goodjunk_intervention.py . --write --no-backup

What it fixes conservatively:
1) Legacy references to game/teacher-panel.html
   -> rewrites to relative launcher/teacher-panel.html
2) index.html clear context:
   clearSessionData -> clearAllData
3) Ensures game/teacher-panel.html exists as redirect stub
4) Prints summary of what changed

Notes:
- Default is DRY-RUN (no file modified)
- Use --write to apply changes
- Keeps .bak backups unless --no-backup
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import List, Tuple


TEXT_EXTS = {
    ".html", ".js", ".mjs", ".cjs", ".css", ".json", ".md", ".txt", ".yaml", ".yml"
}

LEGACY_PATH_RE = re.compile(
    r"""(?P<quote>["'])"""
    r"""(?P<path>"""
    r"""(?:\./teacher-panel\.html)"""
    r"""|(?:\.\./game/teacher-panel\.html)"""
    r"""|(?:game/teacher-panel\.html)"""
    r"""|(?:/goodjunk-intervention/game/teacher-panel\.html)"""
    r""")"""
    r"""(?P=quote)"""
)

INDEX_IMPORT_RE = re.compile(
    r"""import\s*\{\s*([^}]*)\s*\}\s*from\s*['"]\./research/localstore\.js['"]\s*;?"""
)

REDIRECT_STUB = """<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="0; url=../launcher/teacher-panel.html" />
</head>
<body>
  <script>
    (function(){
      const target = new URL('../launcher/teacher-panel.html', location.href);
      const src = new URL(location.href);
      src.searchParams.forEach((v,k)=> target.searchParams.set(k,v));
      location.replace(target.toString());
    })();
  </script>
</body>
</html>
"""

SKIP_FILES = {
    "game/teacher-panel.html",  # redirect file handled separately
}


def is_text_file(path: Path) -> bool:
    return path.suffix.lower() in TEXT_EXTS


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="ignore")


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def relpath_for_display(path: Path, root: Path) -> str:
    return str(path.relative_to(root)).replace("\\", "/")


def relative_ref(from_file: Path, to_file: Path) -> str:
    rel = Path(
        Path(
            __import__("os").path.relpath(to_file, start=from_file.parent)
        )
    )
    s = str(rel).replace("\\", "/")
    if not s.startswith("."):
        s = f"./{s}"
    return s


def patch_legacy_teacher_panel_refs(text: str, file_path: Path, root: Path) -> Tuple[str, int]:
    launcher_target = root / "launcher" / "teacher-panel.html"
    if not launcher_target.exists():
        return text, 0

    count = 0

    def repl(match: re.Match) -> str:
        nonlocal count
        quote = match.group("quote")
        new_ref = relative_ref(file_path, launcher_target)
        count += 1
        return f"{quote}{new_ref}{quote}"

    return LEGACY_PATH_RE.sub(repl, text), count


def patch_index_clear_context(text: str) -> Tuple[str, int]:
    changes = 0

    # Fix import from localstore.js
    def import_repl(match: re.Match) -> str:
        nonlocal changes
        names = [x.strip() for x in match.group(1).split(",") if x.strip()]
        if "clearSessionData" in names:
            names = ["clearAllData" if n == "clearSessionData" else n for n in names]
            changes += 1
        elif "clearAllData" not in names:
            return match.group(0)

        uniq = []
        for n in names:
            if n not in uniq:
                uniq.append(n)
        return f"import {{ {', '.join(uniq)} }} from './research/localstore.js';"

    new_text = INDEX_IMPORT_RE.sub(import_repl, text)

    # Fix direct calls
    if "clearSessionData();" in new_text:
      new_text = new_text.replace("clearSessionData();", "clearAllData();")
      changes += 1

    if "clearSessionData()" in new_text and "clearAllData()" not in new_text:
      new_text = new_text.replace("clearSessionData()", "clearAllData()")
      changes += 1

    return new_text, changes


def ensure_redirect_stub(root: Path, write: bool, backup: bool) -> List[str]:
    messages: List[str] = []
    path = root / "game" / "teacher-panel.html"
    path.parent.mkdir(parents=True, exist_ok=True)

    current = read_text(path) if path.exists() else ""
    looks_ok = ("../launcher/teacher-panel.html" in current and "location.replace" in current)

    if looks_ok:
        messages.append("[OK] redirect stub already valid: game/teacher-panel.html")
        return messages

    if write:
        if path.exists() and backup:
            bak = path.with_suffix(path.suffix + ".bak")
            write_text(bak, current)
            messages.append(f"[BACKUP] {bak}")
        write_text(path, REDIRECT_STUB)
        messages.append("[WRITE] game/teacher-panel.html redirect stub updated")
    else:
        messages.append("[DRY] would update redirect stub: game/teacher-panel.html")

    return messages


def maybe_backup(path: Path, original: str, backup: bool) -> None:
    if not backup:
        return
    bak = path.with_suffix(path.suffix + ".bak")
    if bak.exists():
        return
    write_text(bak, original)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--write", action="store_true", help="apply changes")
    parser.add_argument("--no-backup", action="store_true", help="do not create .bak backups")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    write = args.write
    backup = not args.no_backup

    if not root.exists():
        print(f"ERROR: root not found: {root}")
        return 2

    print("=" * 78)
    print("GOODJUNK INTERVENTION AUTO-FIX")
    print("=" * 78)
    print(f"Root   : {root}")
    print(f"Mode   : {'WRITE' if write else 'DRY-RUN'}")
    print(f"Backup : {'ON' if backup else 'OFF'}")
    print()

    changed_files: List[str] = []
    total_changes = 0

    for path in root.rglob("*"):
        if not path.is_file() or not is_text_file(path):
            continue

        rp = relpath_for_display(path, root)
        if rp in SKIP_FILES:
            continue

        original = read_text(path)
        patched = original
        file_changes = 0

        # 1) legacy teacher-panel refs
        patched, c1 = patch_legacy_teacher_panel_refs(patched, path, root)
        file_changes += c1

        # 2) index clear context fix
        if rp == "index.html":
            patched, c2 = patch_index_clear_context(patched)
            file_changes += c2

        if patched != original:
            total_changes += file_changes
            changed_files.append(rp)

            if write:
                maybe_backup(path, original, backup)
                write_text(path, patched)
                print(f"[WRITE] {rp}  ({file_changes} change(s))")
            else:
                print(f"[DRY]   {rp}  ({file_changes} change(s))")

    # 3) redirect stub
    for msg in ensure_redirect_stub(root, write=write, backup=backup):
        print(msg)

    print()
    print("=" * 78)
    print("SUMMARY")
    print("=" * 78)
    print(f"Changed files : {len(changed_files)}")
    print(f"Total changes : {total_changes}")

    if changed_files:
        print("\nFILES")
        for rp in changed_files:
            print(f"- {rp}")

    if not changed_files:
        print("\nNo conservative fixes needed.")

    print()
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())