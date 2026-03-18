#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
GoodJunk Intervention Auditor
PATCH v20260318a-GJI-AUDIT

Usage:
  python audit_goodjunk_intervention.py
  python audit_goodjunk_intervention.py /path/to/goodjunk-intervention

Checks:
- canonical files exist
- broken relative refs in html/js/css
- old legacy reference to game/teacher-panel.html
- redirect file exists and looks correct
- index.html clear context uses clearAllData
- goodjunk-vr.html has patched module routing script
- quick flow files present
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable, List, Tuple, Dict, Set


TEXT_EXTS = {
    ".html", ".js", ".mjs", ".cjs", ".css", ".json", ".md", ".txt", ".yaml", ".yml"
}

REF_PATTERNS = [
    # HTML
    re.compile(r'''(?:src|href)\s*=\s*["']([^"']+)["']''', re.IGNORECASE),
    # JS strings inside new URL/buildUrl/import/fetch
    re.compile(r'''import\s+[^;]*?\sfrom\s+["']([^"']+)["']'''),
    re.compile(r'''import\s*\(\s*["']([^"']+)["']\s*\)'''),
    re.compile(r'''new\s+URL\(\s*["']([^"']+)["']\s*,'''),
    re.compile(r'''fetch\(\s*["']([^"']+)["']'''),
    re.compile(r'''location\.href\s*=\s*["']([^"']+)["']'''),
    re.compile(r'''buildUrl\(\s*["']([^"']+)["']'''),
    # CSS
    re.compile(r'''url\(\s*["']?([^"')]+)["']?\s*\)''', re.IGNORECASE),
]

CANONICAL_FILES = [
    "index.html",
    "launcher/teacher-panel.html",
    "launcher/student-launcher.html",
    "launcher/launcher.js",
    "launcher/launcher.css",
    "game/goodjunk-vr.html",
    "game/goodjunk.safe.js",
    "game/teacher-panel.html",  # redirect file now
    "assessments/assessment.js",
    "assessments/assessment.css",
    "assessments/pre-knowledge.html",
    "assessments/pre-behavior.html",
    "assessments/post-knowledge.html",
    "assessments/post-behavior.html",
    "assessments/post-choice.html",
    "assessments/completion.html",
    "parent/parent-questionnaire.html",
    "parent/parent-summary.html",
    "followup/short-followup.html",
    "followup/weekly-check.html",
    "research/config.js",
    "research/localstore.js",
    "research/schema.js",
]

IGNORE_PREFIXES = (
    "http://",
    "https://",
    "mailto:",
    "tel:",
    "data:",
    "blob:",
    "#",
    "javascript:",
)

ROUTE_KEYS = {
    "STUDENT_LAUNCHER",
    "TEACHER_PANEL",
    "GAME",
    "GAME_SUMMARY",
    "PRE_KNOWLEDGE",
    "PRE_BEHAVIOR",
    "POST_KNOWLEDGE",
    "POST_BEHAVIOR",
    "POST_CHOICE",
    "COMPLETION",
    "SHORT_FOLLOWUP",
    "WEEKLY_CHECK",
    "PARENT_FORM",
    "PARENT_SUMMARY",
}


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="ignore")


def is_text_file(path: Path) -> bool:
    return path.suffix.lower() in TEXT_EXTS


def normalize_ref(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return raw
    # strip query/hash
    raw = raw.split("#", 1)[0]
    raw = raw.split("?", 1)[0]
    return raw.strip()


def looks_like_local_ref(ref: str) -> bool:
    if not ref:
      return False
    if ref in ROUTE_KEYS:
        return False
    if ref.startswith(IGNORE_PREFIXES):
        return False
    return True


def resolve_local_ref(file_path: Path, ref: str, root: Path) -> Path | None:
    ref = normalize_ref(ref)
    if not looks_like_local_ref(ref):
        return None

    # absolute from project root
    if ref.startswith("/"):
        return (root / ref.lstrip("/")).resolve()

    return (file_path.parent / ref).resolve()


def iter_text_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if path.is_file() and is_text_file(path):
            yield path


def collect_refs(path: Path) -> List[str]:
    text = read_text(path)
    refs: List[str] = []
    for pattern in REF_PATTERNS:
        refs.extend(pattern.findall(text))
    return refs


def rel(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root)).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


def banner(title: str) -> None:
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


def main() -> int:
    if len(sys.argv) > 1:
        root = Path(sys.argv[1]).resolve()
    else:
        root = Path.cwd().resolve()

    if root.is_file():
        root = root.parent

    banner("GOODJUNK INTERVENTION AUDIT")
    print(f"Root: {root}")

    if not root.exists():
        print("ERROR: root path not found")
        return 2

    errors: List[str] = []
    warnings: List[str] = []
    infos: List[str] = []

    # 1) canonical files
    banner("1) CANONICAL FILES")
    for item in CANONICAL_FILES:
        p = root / item
        if p.exists():
            print(f"[OK]  {item}")
        else:
            print(f"[MISS] {item}")
            errors.append(f"Missing canonical file: {item}")

    # 2) broken refs
    banner("2) BROKEN LOCAL REFERENCES")
    broken_count = 0
    checked_count = 0
    for file_path in iter_text_files(root):
        refs = collect_refs(file_path)
        seen: Set[str] = set()
        for raw_ref in refs:
            ref = normalize_ref(raw_ref)
            if not looks_like_local_ref(ref):
                continue
            if ref in seen:
                continue
            seen.add(ref)

            target = resolve_local_ref(file_path, ref, root)
            if target is None:
                continue

            checked_count += 1

            # buildUrl('POST_KNOWLEDGE') etc. already filtered by route keys
            # For local refs, ensure target exists
            if not target.exists():
                broken_count += 1
                msg = f"{rel(file_path, root)} -> {ref}  [missing: {rel(target, root) if target.is_absolute() else target}]"
                print(f"[BROKEN] {msg}")
                errors.append(f"Broken reference: {msg}")

    if broken_count == 0:
        print(f"[OK] No broken local refs found across {checked_count} checked refs.")

    # 3) old legacy reference scan
    banner("3) LEGACY REFERENCE SCAN")
    legacy_hits = []
    for file_path in iter_text_files(root):
        txt = read_text(file_path)
        if "game/teacher-panel.html" in txt or "./teacher-panel.html" in txt or "../game/teacher-panel.html" in txt:
            legacy_hits.append(file_path)

    if not legacy_hits:
        print("[OK] No legacy teacher-panel references found.")
    else:
        for file_path in legacy_hits:
            rp = rel(file_path, root)
            # allow redirect file itself
            if rp == "game/teacher-panel.html":
                print(f"[INFO] redirect stub exists at {rp}")
                continue
            print(f"[LEGACY] {rp}")
            warnings.append(f"Legacy teacher-panel reference found in {rp}")

    # 4) redirect file content
    banner("4) REDIRECT FILE CHECK")
    redirect_file = root / "game/teacher-panel.html"
    if redirect_file.exists():
        txt = read_text(redirect_file)
        ok_a = "../launcher/teacher-panel.html" in txt
        ok_b = "location.replace" in txt or 'http-equiv="refresh"' in txt
        if ok_a and ok_b:
            print("[OK] game/teacher-panel.html looks like a redirect stub.")
        else:
            print("[WARN] game/teacher-panel.html exists but content does not look like redirect stub.")
            warnings.append("game/teacher-panel.html exists but does not look like redirect stub")
    else:
        print("[WARN] game/teacher-panel.html redirect file not found.")
        warnings.append("Missing redirect file game/teacher-panel.html")

    # 5) index clear context
    banner("5) INDEX CLEAR CONTEXT CHECK")
    index_file = root / "index.html"
    if index_file.exists():
        txt = read_text(index_file)
        has_clear_all_import = "clearAllData" in txt
        has_clear_session = "clearSessionData" in txt
        if has_clear_all_import:
            print("[OK] index.html appears to use clearAllData().")
        elif has_clear_session:
            print("[WARN] index.html still appears to use clearSessionData().")
            warnings.append("index.html still references clearSessionData instead of clearAllData")
        else:
            print("[WARN] Could not confirm clear context implementation in index.html.")
            warnings.append("Could not confirm index.html clear context implementation")
    else:
        print("[WARN] index.html missing, skipped.")
        warnings.append("index.html missing")

    # 6) goodjunk-vr shell check
    banner("6) GAME SHELL CHECK")
    game_file = root / "game/goodjunk-vr.html"
    if game_file.exists():
        txt = read_text(game_file)
        checks = {
            "has goodjunk.safe.js module": 'goodjunk.safe.js' in txt,
            "has vr-ui.js": 'vr-ui.js' in txt,
            "has btnPostKnowledge": 'btnPostKnowledge' in txt,
            "has parent summary button": 'btnParentSummary' in txt,
            "has module import localstore/config": "type=\"module\"" in txt or "type='module'" in txt,
        }
        for label, ok in checks.items():
            print(f"[{'OK' if ok else 'WARN'}] {label}")
            if not ok:
                warnings.append(f"game/goodjunk-vr.html missing expected marker: {label}")

        if "buildUrl('POST_KNOWLEDGE'" in txt or 'buildUrl("POST_KNOWLEDGE"' in txt:
            print("[OK] goodjunk-vr.html appears to route Post-Knowledge through buildUrl().")
        else:
            print("[WARN] Could not confirm patched Post-Knowledge routing in goodjunk-vr.html.")
            warnings.append("Could not confirm Post-Knowledge routing in goodjunk-vr.html")
    else:
        print("[WARN] game/goodjunk-vr.html missing.")
        warnings.append("game/goodjunk-vr.html missing")

    # 7) config routes check
    banner("7) CONFIG ROUTES CHECK")
    config_file = root / "research/config.js"
    if config_file.exists():
        txt = read_text(config_file)
        missing_routes = [rk for rk in ROUTE_KEYS if rk not in txt]
        if not missing_routes:
            print("[OK] All expected route keys appear in research/config.js")
        else:
            for rk in missing_routes:
                print(f"[MISS] route key {rk}")
                errors.append(f"Missing route key in config.js: {rk}")
    else:
        print("[WARN] research/config.js missing.")
        warnings.append("research/config.js missing")

    # 8) localstore clearAllData check
    banner("8) LOCALSTORE CHECK")
    localstore_file = root / "research/localstore.js"
    if localstore_file.exists():
        txt = read_text(localstore_file)
        if "export function clearAllData()" in txt:
            print("[OK] clearAllData() exists in localstore.js")
        else:
            print("[WARN] clearAllData() not found in localstore.js")
            warnings.append("clearAllData() not found in localstore.js")
    else:
        print("[WARN] research/localstore.js missing.")
        warnings.append("research/localstore.js missing")

    # 9) quick flow presence
    banner("9) QUICK FLOW PRESENCE")
    flow_files = [
        "launcher/teacher-panel.html",
        "launcher/student-launcher.html",
        "assessments/pre-knowledge.html",
        "assessments/pre-behavior.html",
        "game/goodjunk-vr.html",
        "assessments/post-knowledge.html",
        "assessments/post-behavior.html",
        "assessments/post-choice.html",
        "assessments/completion.html",
        "parent/parent-questionnaire.html",
        "parent/parent-summary.html",
        "followup/short-followup.html",
        "followup/weekly-check.html",
    ]
    for item in flow_files:
        p = root / item
        print(f"[{'OK' if p.exists() else 'MISS'}] {item}")
        if not p.exists():
            errors.append(f"Missing flow file: {item}")

    # summary
    banner("SUMMARY")
    print(f"Errors  : {len(errors)}")
    print(f"Warnings: {len(warnings)}")
    print(f"Info    : {len(infos)}")

    if errors:
        print("\nERROR LIST")
        for e in errors:
            print(f"- {e}")

    if warnings:
        print("\nWARNING LIST")
        for w in warnings:
            print(f"- {w}")

    if not errors and not warnings:
        print("\nAll major checks passed. GoodJunk Intervention looks consistent.")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())