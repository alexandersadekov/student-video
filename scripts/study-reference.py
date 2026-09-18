"""Разбор чужого ролика на приёмы: кадры, текст и заготовка конспекта.

Зачем. Насмотренность в проект не приходит сама: агент рисует то, что умеет,
и получается дёшево. Чтобы этого не было, нужен разбор — не «красиво», а
почему именно так: какая фраза звучит, что в этот момент в кадре, каким
движением оно появилось и что это даёт зрителю.

Скрипт делает механическую часть: раскладывает видео на кадры, собирает
контактные листы (их удобно смотреть целиком), снимает текст с таймкодами и
готовит шаблон конспекта. Выводы пишет человек или агент — руками, глядя на
листы. Скачанное остаётся в references/<имя>/ и в шаблон не попадает:
чужой ролик — чужая собственность, мы храним из него только выводы.

    python scripts/study-reference.py <видео> --name pronin-system
"""
import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def run(args):
    p = subprocess.run([str(x) for x in args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode:
        raise RuntimeError(p.stderr[-4000:])
    return p


def frames(video, folder, fps, width, ffmpeg):
    """Кадры с постоянным шагом: по ним видно, как объект приходит и уходит."""
    shots = folder / "frames"
    shots.mkdir(parents=True, exist_ok=True)
    run([ffmpeg, "-y", "-v", "error", "-i", video, "-vf", f"fps={fps},scale={width}:-2", shots / "f%03d.jpg"])
    return sorted(shots.glob("f*.jpg"))


def sheets(folder, fps, width, ffmpeg, columns=6, rows=4):
    """Контактные листы: страница кадров одной картинкой, как раскадровка."""
    run([ffmpeg, "-y", "-v", "error", "-i", folder / "frames" / "f%03d.jpg",
         "-vf", f"tile={columns}x{rows}:padding=6:margin=6:color=#101216", "-frames:v", "20",
         folder / "sheet-%02d.jpg"])
    made = sorted(folder.glob("sheet-*.jpg"))
    seconds_per_sheet = columns * rows / fps
    return made, seconds_per_sheet


def speech(video, folder, language, model_name, model_dir, ffmpeg):
    """Текст с таймкодами: реплика — это половина ответа на вопрос «почему так»."""
    wav = folder / "audio.wav"
    run([ffmpeg, "-y", "-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", wav])
    from faster_whisper import WhisperModel

    model = WhisperModel(model_name, device="cpu", compute_type="int8", download_root=model_dir)
    segments, _ = model.transcribe(str(wav), language=language, vad_filter=True)
    return [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segments]


def outline(name, source, lines, made, seconds_per_sheet):
    rows = "\n".join(f"| {s['start']:.2f}–{s['end']:.2f} | {s['text']} |  |  |  |" for s in lines)
    pages = "\n".join(
        f"- `{p.name}` — примерно {i * seconds_per_sheet:.0f}–{(i + 1) * seconds_per_sheet:.0f} с"
        for i, p in enumerate(made)
    )
    return f"""# Разбор референса: {name}

Источник: `{source}`
Разобрано: {datetime.date.today().isoformat()}

Файлы кадров лежат рядом и в репозиторий не попадают. В шаблон уходит только
эта страница — выводы, а не чужой материал.

## Контактные листы

{pages}

## Реплика → кадр

Заполняется по листам. «Приём» — что именно сделано с объектом (появление,
накопление, подмена, смена темы). «Зачем» — какую работу это делает для
зрителя. Если ответа на «зачем» нет, приём в проект не берём.

| Таймкод | Реплика | Что в кадре | Приём | Зачем |
|---|---|---|---|---|
{rows}

## Что забираем в проект

- Правило:
- Куда: `MONTAGE_RULES.md` / `src/scenes/tokens.ts` / `src/scenes/motion.ts`

## Что не забираем

- Приём:
- Почему: (чужой логотип, чужой интерфейс, не подходит нише, требует материала,
  которого у нас нет)
"""


def main():
    ap = argparse.ArgumentParser(description="Разложить референс на кадры, текст и конспект")
    ap.add_argument("video", type=Path)
    ap.add_argument("--name", help="Имя разбора; по умолчанию — имя файла")
    ap.add_argument("--fps", type=float, default=2, help="Кадров в секунду для раскадровки")
    ap.add_argument("--width", type=int, default=360)
    ap.add_argument("--language", default="ru")
    ap.add_argument("--model", default="small")
    ap.add_argument("--model-dir", default=str(ROOT / ".models"))
    ap.add_argument("--no-speech", action="store_true", help="Только кадры, без распознавания")
    ap.add_argument("--ffmpeg", default=os.environ.get("FFMPEG", "ffmpeg"))
    args = ap.parse_args()

    video = args.video.resolve()
    if not video.is_file():
        raise RuntimeError(f"Видео не найдено: {video}")
    name = args.name or video.stem
    folder = ROOT / "references" / name
    if folder.exists():
        shutil.rmtree(folder / "frames", ignore_errors=True)
    folder.mkdir(parents=True, exist_ok=True)

    print("1/3 Раскадровка", flush=True)
    made_frames = frames(video, folder, args.fps, args.width, args.ffmpeg)
    made_sheets, seconds_per_sheet = sheets(folder, args.fps, args.width, args.ffmpeg)
    print(f"   кадров {len(made_frames)}, листов {len(made_sheets)}", flush=True)

    lines = []
    if not args.no_speech:
        print("2/3 Распознавание речи", flush=True)
        lines = speech(video, folder, args.language, args.model, args.model_dir, args.ffmpeg)
        (folder / "transcript.json").write_text(json.dumps(lines, ensure_ascii=False, indent=2), encoding="utf-8")

    print("3/3 Конспект", flush=True)
    page = ROOT / "references" / f"{name}.md"
    if page.exists():
        print(f"   {page.name} уже есть, не переписываю", flush=True)
    else:
        page.write_text(outline(name, video.name, lines, made_sheets, seconds_per_sheet), encoding="utf-8")
    print(f"ГОТОВО: {page}\nЛисты: {folder}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"РАЗБОР НЕ ВЫПОЛНЕН: {error}", file=sys.stderr)
        sys.exit(1)
