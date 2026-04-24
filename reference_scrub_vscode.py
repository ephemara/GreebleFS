#!/usr/bin/env python3
from __future__ import annotations

import sys

import reference_scrub


if __name__ == "__main__":
    raise SystemExit(reference_scrub.main(["--repo", "vscode", *sys.argv[1:]]))
