import json
import sys

from rapidocr import RapidOCR


def main():
    image = sys.stdin.buffer.read()
    result = RapidOCR()(image)
    lines = list(result.txts or [])
    scores = [float(value) for value in result.scores] if result.scores is not None else []
    confidence = round(100 * sum(scores) / len(scores)) if scores else 0
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps({"text": "\n".join(lines), "confidence": confidence, "engine": "rapidocr"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
