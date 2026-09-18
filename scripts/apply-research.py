"""Bring researched material into an existing composition.

The import script never touches the network: research is done by an agent with
web search, which writes research.json next to the project. This script is the
mechanical half — it downloads what the agent approved, records where every file
came from, and rebuilds the composition with the new scenes.

    python scripts/apply-research.py fetch   Video-20260917-222756-75b9
    python scripts/apply-research.py rebuild Video-20260917-222756-75b9
"""

import argparse
import hashlib
import json
import mimetypes
import re
import subprocess
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECTS = ROOT / "public" / "projects"
MAX_BYTES = 40 * 1024 * 1024
# import-video.py кладёт материал сцены на таймлайн только в этих форматах.
SCENE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov"}

# Форматы, которые вообще можно скачивать.
ALLOWED = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
}

RESEARCH_EXAMPLE = {
    "assets": [
        {
            "name": "brand-logo",
            "url": "https://example.com/press/logo.svg",
            "source": "https://example.com/brand",
            "license": "official brand kit, allowed for editorial use",
            "checked": "2026-09-17",
        }
    ]
}


def folder_for(project_id):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", project_id):
        raise ValueError("Invalid project id")
    folder = PROJECTS / project_id
    if not folder.is_dir():
        sys.exit(f"Проект не найден: {folder}")
    return folder


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch(project_id):
    folder = folder_for(project_id)
    research = folder / "research.json"
    if not research.exists():
        save_json(research, RESEARCH_EXAMPLE)
        sys.exit(
            f"Создан шаблон {research}.\n"
            "Заполните его результатами исследования и запустите команду снова.\n"
            "Каждому ассету нужны url, source (страница, где он опубликован), "
            "license и дата проверки."
        )

    assets = load_json(research).get("assets", [])
    if not assets:
        sys.exit("В research.json нет ни одного ассета.")

    out_dir = folder / "assets"
    out_dir.mkdir(exist_ok=True)
    record_path = folder / "assets.json"
    record = load_json(record_path) if record_path.exists() else []
    known = {item["url"]: item for item in record}

    for asset in assets:
        name, url = asset.get("name"), asset.get("url", "")
        # Разрешение на использование фиксирует человек или агент-исследователь,
        # поэтому без него файл не скачиваем.
        missing = [k for k in ("name", "url", "source", "license", "checked") if not asset.get(k)]
        if missing:
            print(f"пропуск {name or url}: не заполнено {', '.join(missing)}")
            continue
        if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
            print(f"пропуск {name}: имя должно содержать только буквы, цифры, _ или -")
            continue
        try:
            date.fromisoformat(asset["checked"])
        except (ValueError, TypeError):
            print(f"пропуск {name}: неверная дата проверки")
            continue
        if not url.startswith("https://"):
            print(f"пропуск {name}: разрешён только https")
            continue
        if url in known:
            print(f"уже скачан: {name} -> {known[url]['file']}")
            continue

        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                ctype = (response.headers.get_content_type() or "").lower()
                if ctype not in ALLOWED:
                    print(f"пропуск {name}: тип {ctype or 'неизвестен'} не поддерживается")
                    continue
                data = response.read(MAX_BYTES + 1)
        except Exception as error:
            print(f"пропуск {name}: {error}")
            continue

        if len(data) > MAX_BYTES:
            print(f"пропуск {name}: файл больше {MAX_BYTES // 1024 // 1024} МБ")
            continue

        suffix = ALLOWED[ctype] or mimetypes.guess_extension(ctype) or ""
        target = out_dir / f"{name}{suffix}"
        target.write_bytes(data)
        entry = {
            "name": name,
            # file — для staticFile() в компонентах, path — для scenes.json,
            # который резолвит путь в файловой системе.
            "file": f"projects/{project_id}/assets/{target.name}",
            "path": str(target),
            "sceneReady": suffix in SCENE_SUFFIXES,
            "url": url,
            "source": asset["source"],
            "license": asset["license"],
            "checked": asset["checked"],
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
        record.append(entry)
        known[url] = entry
        print(f"скачан {name} -> {entry['file']} ({len(data) // 1024} КБ)")

    save_json(record_path, record)
    print(f"\nПровенанс записан в {record_path}")
    print("В scenes.json подставляйте поле path — путь в файловой системе.")
    print("SVG сценой быть не может: его подключают в компоненте через staticFile(file).")


def rebuild(project_id, scenes_arg):
    folder = folder_for(project_id)
    source = next((folder / n for n in ("source.mp4", "clip.mp4") if (folder / n).exists()), None)
    if source is None:
        sys.exit(f"В {folder} нет исходника source.mp4 или clip.mp4")

    scenes = Path(scenes_arg) if scenes_arg else folder / "scenes.json"
    if not scenes.exists():
        sys.exit(
            f"Не найден {scenes}.\n"
            'Формат: [{"start": 3.0, "end": 6.0, "asset": "<поле path из assets.json>"}]\n'
            "Таймкоды — по смонтированной дорожке, уже без пауз.\n"
            "Материалом сцены может быть PNG, JPG, WebP, MP4 или MOV, но не SVG."
        )

    # Повторяем ту же нарезку, что уже принята в этом ролике: правки сцен не
    # должны заново двигать склейки и субтитры.
    kept = load_json(folder / "edit-map.json")["kept"]
    keep_file = folder / "keep-rebuild.json"
    save_json(keep_file, [[part["sourceStart"], part["sourceEnd"]] for part in kept])

    command = [
        sys.executable,
        str(ROOT / "scripts" / "import-video.py"),
        str(source),
        "--transcript", str(folder / "words-original.json"),
        "--keep", str(keep_file),
        "--scenes", str(scenes),
    ]
    print("Пересборка:", " ".join(command))
    # Импорт всегда создаёт отдельную композицию, поэтому текущая версия
    # с ручными правками остаётся нетронутой.
    raise SystemExit(subprocess.call(command))


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    fetch_parser = sub.add_parser("fetch", help="Скачать ассеты из research.json в папку проекта")
    fetch_parser.add_argument("project")

    rebuild_parser = sub.add_parser("rebuild", help="Пересобрать композицию со scenes.json")
    rebuild_parser.add_argument("project")
    rebuild_parser.add_argument("--scenes", help="Путь к scenes.json, по умолчанию берётся из папки проекта")

    args = parser.parse_args()
    if args.command == "fetch":
        fetch(args.project)
    else:
        rebuild(args.project, args.scenes)


if __name__ == "__main__":
    main()
