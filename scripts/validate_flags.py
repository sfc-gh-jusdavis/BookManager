#!/usr/bin/env python3
"""Pre-commit validator for feature flags.

Three checks:
  A) Every useFeatureFlag('xxx') call references a key registered in
     bkmng-next/lib/flags.ts AND backend/app/feature_flags/registry.py.
  B) Newly-added route/page/panel files include a useFeatureFlag(...) call.
     Bypass with `// @flag-exempt: <reason>` near the top of the file.
  C) New flag entries in lib/flags.ts must have default_enabled: false.
     Existing flags can be edited freely (rollout = flip default true).

Exit 0 = pass, non-zero = block commit.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TS_REGISTRY = REPO / "bkmng-next" / "lib" / "flags.ts"
PY_REGISTRY = REPO / "backend" / "app" / "feature_flags" / "registry.py"
FRONTEND_DIR = REPO / "bkmng-next"

USE_FLAG_RE = re.compile(r"useFeatureFlag\(\s*['\"]([a-zA-Z0-9_]+)['\"]")
TS_KEY_RE = re.compile(r"^\s*([a-z][a-zA-Z0-9_]*)\s*:\s*\{", re.MULTILINE)
PY_KEY_RE = re.compile(r"^\s*['\"]([a-zA-Z0-9_]+)['\"]\s*:\s*\{", re.MULTILINE)
EXEMPT_RE = re.compile(r"@flag-exempt", re.IGNORECASE)


def fail(msg: str) -> None:
    print(f"\033[31mFAIL: {msg}\033[0m", file=sys.stderr)


def warn(msg: str) -> None:
    print(f"\033[33mWARN: {msg}\033[0m", file=sys.stderr)


def load_keys_ts() -> set[str]:
    if not TS_REGISTRY.exists():
        return set()
    text = TS_REGISTRY.read_text()
    body_match = re.search(r"FEATURE_FLAGS\s*=\s*\{(.*?)\}\s*as\s*const", text, re.DOTALL)
    body = body_match.group(1) if body_match else text
    return set(TS_KEY_RE.findall(body))


def load_keys_py() -> set[str]:
    if not PY_REGISTRY.exists():
        return set()
    text = PY_REGISTRY.read_text()
    body_match = re.search(r"FEATURE_FLAGS[^=]*=\s*\{(.*?)\n\}\s*$", text, re.DOTALL | re.MULTILINE)
    body = body_match.group(1) if body_match else text
    return set(PY_KEY_RE.findall(body))


def staged_files() -> tuple[list[Path], list[Path]]:
    """Return (added_files, modified_files) staged for commit."""
    try:
        added = subprocess.check_output(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=A"], cwd=REPO
        ).decode().splitlines()
        modified = subprocess.check_output(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=M"], cwd=REPO
        ).decode().splitlines()
    except subprocess.CalledProcessError:
        return [], []
    return [REPO / f for f in added], [REPO / f for f in modified]


def check_a_unregistered_keys() -> int:
    """Every useFeatureFlag('xxx') key must be in BOTH registries."""
    ts_keys = load_keys_ts()
    py_keys = load_keys_py()

    parity_failed = ts_keys.symmetric_difference(py_keys)
    if parity_failed:
        fail(f"Registry parity broken (TS vs Python): {sorted(parity_failed)}")
        return 1

    failures = 0
    for tsx in FRONTEND_DIR.rglob("*.tsx"):
        if "node_modules" in tsx.parts or ".next" in tsx.parts:
            continue
        try:
            text = tsx.read_text(errors="ignore")
        except OSError:
            continue
        for m in USE_FLAG_RE.finditer(text):
            key = m.group(1)
            if key not in ts_keys:
                fail(f"{tsx.relative_to(REPO)}: useFeatureFlag('{key}') not in registry")
                failures += 1
    return 0 if failures == 0 else 1


def check_b_new_components_have_flags(added: list[Path]) -> int:
    """Newly-added pages and major panels must include useFeatureFlag(."""
    failures = 0
    for path in added:
        if not path.exists():
            continue
        rel = path.relative_to(REPO)
        s = str(rel)
        is_route = s.startswith("bkmng-next/app/") and s.endswith("/page.tsx")
        is_component = (
            s.startswith("bkmng-next/components/")
            and s.endswith(".tsx")
            and "/ui/" not in s  # primitives in components/ui/ are exempt
        )
        if not (is_route or is_component):
            continue
        text = path.read_text(errors="ignore")
        if EXEMPT_RE.search(text):
            continue
        if "useFeatureFlag" not in text:
            fail(
                f"{rel}: new {'route' if is_route else 'component'} has no useFeatureFlag(...) call. "
                f"Add a flag entry to bkmng-next/lib/flags.ts and gate the render, "
                f"or add `// @flag-exempt: <reason>` if this is genuinely flag-irrelevant "
                f"(utility, type-only, etc)."
            )
            failures += 1
    return 0 if failures == 0 else 1


def check_c_new_flags_jusdavis_only(added: list[Path], modified: list[Path]) -> int:
    """New flag entries must default_enabled:false."""
    if TS_REGISTRY not in [*added, *modified]:
        return 0
    try:
        diff = subprocess.check_output(
            ["git", "diff", "--cached", "-U0", str(TS_REGISTRY.relative_to(REPO))],
            cwd=REPO,
        ).decode()
    except subprocess.CalledProcessError:
        return 0

    # Parse the new file fully and identify which keys are NEW (not in HEAD version).
    try:
        head_text = subprocess.check_output(
            ["git", "show", f"HEAD:{TS_REGISTRY.relative_to(REPO)}"], cwd=REPO,
            stderr=subprocess.DEVNULL,
        ).decode()
        head_keys = set(TS_KEY_RE.findall(head_text))
    except subprocess.CalledProcessError:
        head_keys = set()

    new_text = TS_REGISTRY.read_text()
    new_keys = load_keys_ts()
    # Initial seed commit: if the registry file is being added (didn't exist on HEAD),
    # treat all keys as pre-existing. Otherwise the seed commit can never pass —
    # every key would be "new" and forced to default_enabled:false.
    if TS_REGISTRY in added:
        head_keys = new_keys
    added_keys = new_keys - head_keys
    if not added_keys:
        return 0

    failures = 0
    for key in sorted(added_keys):
        # Find the entry block for `key` and check its body
        entry_re = re.compile(
            rf"\b{re.escape(key)}\s*:\s*\{{(.*?)\n\s*\}}", re.DOTALL,
        )
        m = entry_re.search(new_text)
        if not m:
            continue
        body = m.group(1)
        if re.search(r"default_enabled\s*:\s*true", body, re.IGNORECASE):
            fail(f"new flag '{key}' has default_enabled: true. New flags must default to false.")
            failures += 1
    return 0 if failures == 0 else 1


def main() -> int:
    added, modified = staged_files()
    rc = 0
    rc |= check_a_unregistered_keys()
    rc |= check_b_new_components_have_flags(added)
    rc |= check_c_new_flags_jusdavis_only(added, modified)
    if rc == 0:
        print("feature-flag validator: ok")
    return rc


if __name__ == "__main__":
    sys.exit(main())
