#!/bin/bash
# Витягує текст зі скриншота в буфері обміну.
#
# Навіщо. Коли асистент не може відкрити зображення, скриншот стає глухим
# кутом: людина бачить помилку на екрані, а переказувати її словами довго й
# із втратами. Цей скрипт читає картинку з буфера й віддає текст, який уже
# можна вставити в переписку або обробити далі.
#
# Використання:
#   ./scripts/ocr-clipboard.sh              — текст із буфера
#   ./scripts/ocr-clipboard.sh знімок.png   — текст із файлу
#
# Працює на системному Vision (macOS), нічого не встановлює й нікуди не шле:
# зображення не покидає машину.
set -euo pipefail

IMG="${1:-}"
TMP=""

if [ -z "$IMG" ]; then
  TMP="$(mktemp -t ocr-clip).png"
  osascript >/dev/null <<APPLESCRIPT || { echo "У буфері немає зображення." >&2; exit 1; }
set d to (the clipboard as «class PNGf»)
set f to open for access POSIX file "$TMP" with write permission
set eof f to 0
write d to f
close access f
APPLESCRIPT
  IMG="$TMP"
fi

[ -f "$IMG" ] || { echo "Немає файлу: $IMG" >&2; exit 1; }

SWIFT="$(mktemp -t ocr).swift"
cat > "$SWIFT" <<'SWIFTSRC'
import Foundation
import Vision
import AppKit

let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("Не вдалося прочитати зображення.\n".data(using: .utf8)!)
    exit(1)
}
let req = VNRecognizeTextRequest()
req.recognitionLevel = .accurate
req.recognitionLanguages = ["uk-UA", "en-US"]
req.usesLanguageCorrection = true
try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])

// Рядки сортуємо згори вниз: Vision віддає їх у довільному порядку, і без
// сортування текст приїжджає перемішаним.
var lines: [(Double, String)] = []
for obs in (req.results ?? []) {
    if let top = obs.topCandidates(1).first {
        lines.append((1 - Double(obs.boundingBox.origin.y), top.string))
    }
}
for (_, text) in lines.sorted(by: { $0.0 < $1.0 }) { print(text) }
SWIFTSRC

swift "$SWIFT" "$IMG"
rm -f "$SWIFT"
[ -n "$TMP" ] && rm -f "$TMP" || true
