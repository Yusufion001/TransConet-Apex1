#!/data/data/com.termux/files/usr/bin/bash
set -u

echo "===== TRANSCONET ZOD COVERAGE AUDIT ====="
echo

find src -type f -name '*.routes.ts' | sort | while read -r file; do
  endpoints=$(grep -nE 'router\.(post|put|patch)\(' "$file" || true)

  [ -z "$endpoints" ] && continue

  echo "===== $file ====="

  while IFS= read -r line; do
    lineno="${line%%:*}"
    text="${line#*:}"

    echo "[$lineno] $text"

    start=$((lineno > 8 ? lineno - 8 : 1))
    end=$((lineno + 35))

    context=$(sed -n "${start},${end}p" "$file")

    if echo "$context" | grep -qE 'validate\(|\.parse\(|\.safeParse\('; then
      echo "  ZOD: FOUND"
    else
      echo "  ZOD: MISSING/NOT DETECTED"
    fi

    echo
  done <<< "$endpoints"
done

echo "===== END ZOD AUDIT ====="
