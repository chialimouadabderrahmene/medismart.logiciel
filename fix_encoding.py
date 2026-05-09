"""
Fix mojibake in all JS/JSX/CSS/Python source files.
Cause: UTF-8 content was read/stored as cp1256 (Arabic Windows encoding),
so the bytes 0xC3 0xA9 (é in UTF-8) appear as the cp1256 chars أ©, etc.
Fix: encode the mojibake chars back to cp1256 bytes, then decode as UTF-8.
"""
import os, sys, re

FILES = [
    r"src\App.jsx",
    r"src\App.css",
    r"backend\main.py",
]

def cp1256_to_utf8(bad):
    """Encode a cp1256-mojibake string back to utf-8 bytes then decode."""
    return bad.encode("cp1256").decode("utf-8")

# Build replacement table: bad (stored mojibake) -> correct UTF-8
# Each entry is a pair of raw byte sequences interpreted through cp1256 and utf-8
RAW_PAIRS = [
    # (cp1256-encoded bytes for the mojibake, correct UTF-8 codepoint)
    (b"\xc3\xa9", "\xe9"),   # é
    (b"\xc3\xa8", "\xe8"),   # è
    (b"\xc3\xa0", "\xe0"),   # à
    (b"\xc3\xa2", "\xe2"),   # â
    (b"\xc3\xae", "\xee"),   # î
    (b"\xc3\xbb", "\xfb"),   # û
    (b"\xc3\xb4", "\xf4"),   # ô
    (b"\xc3\xb9", "\xf9"),   # ù
    (b"\xc3\x89", "\xc9"),   # É
    (b"\xc3\x88", "\xc8"),   # È
    (b"\xc3\x80", "\xc0"),   # À
    (b"\xe2\x80\x94", "\u2014"),  # em dash
    (b"\xe2\x80\x99", "\u2019"),  # right single quote
    (b"\xe2\x80\x9c", "\u201c"),  # left double quote
    (b"\xe2\x80\x9d", "\u201d"),  # right double quote
    (b"\xe2\x9c\x93", "\u2713"),  # check mark
    (b"\xe2\x9c\x97", "\u2717"),  # cross mark
    (b"\xe2\x80\xa6", "\u2026"),  # ellipsis
]

KNOWN_REPLACEMENTS = [
    (b.decode("cp1256"), good)
    for b, good in RAW_PAIRS
]

ROOT = os.path.dirname(os.path.abspath(__file__))

total_files = 0
total_replacements = 0

for rel in FILES:
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        print(f"SKIP (not found): {rel}")
        continue

    with open(path, encoding="utf-8", errors="replace") as f:
        content = f.read()

    original = content
    count = 0
    for bad, good in KNOWN_REPLACEMENTS:
        n = content.count(bad)
        if n:
            content = content.replace(bad, good)
            count += n
            print(f"  {rel}: '{bad}' → '{good}' × {n}")

    if count:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        total_files += 1
        total_replacements += count
        print(f"  ✓ {rel}: {count} fix(es) applied")
    else:
        print(f"  — {rel}: clean")

print(f"\nDone: {total_replacements} replacements in {total_files} file(s)")
