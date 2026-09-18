"""Загрузка объёмных эмодзи Fluent Emoji (Microsoft, лицензия MIT).

Зачем именно они. Системный эмодзи рисуется шрифтом и выглядит на каждой
машине по-своему: на рендере в облаке получится не то, что в студии. Плоские
значки из набора Lucide отвечают за действие — нажать, отправить, посмотреть,
— а эмодзи отвечает за предмет разговора: время, деньги, мозг, огонь. Это
разные роли, и смешивать их в одном значке нельзя.

Набор Microsoft подходит по трём причинам: лицензия MIT (можно класть в
шаблон), объёмная отрисовка вместо плоской заливки, единый стиль на все
символы. Качаем только то, что перечислено ниже, — не весь репозиторий: он
весит больше гигабайта.

    python scripts/get-emoji.py              # базовый набор
    python scripts/get-emoji.py --add Rocket "Money bag"
"""
import argparse
import json
import re
from pathlib import Path
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / "public" / "emoji"
REPO = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main"
LICENSE_URL = "https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE"

# Базовый набор под ролики про контент: предмет разговора, а не действие.
BASE = [
    "Alarm clock", "Calendar", "Hourglass done", "Chart increasing", "Eyes",
    "Red heart", "Speech balloon", "Rocket", "Money bag", "Brain", "Fire",
    "Light bulb", "Check mark button", "Cross mark", "Warning",
    "Magnifying glass tilted left", "Gear", "Bell", "Clapper board",
    "Microphone", "Thumbs up", "Party popper",
]


def slug(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()


def download(name, folder):
    """Пробуем обычный путь и вариант с тоном кожи — в наборе есть оба."""
    base = slug(name)
    variants = (f"assets/{name}/3D/{base}_3d.png",
                f"assets/{name}/Default/3D/{base}_3d.png",
                f"assets/{name}/Default/3D/{base}_3d_default.png")
    for path in variants:
        try:
            data = fetch(f"{REPO}/{path.replace(' ', '%20')}")
        except urllib.error.HTTPError:
            continue
        if not data.startswith(b"\x89PNG"):
            continue
        target = folder / f"{base}.png"
        target.write_bytes(data)
        return {"name": name, "file": target.name, "bytes": len(data), "source": f"{REPO}/{path}"}
    return None


def main():
    ap = argparse.ArgumentParser(description="Скачать объёмные эмодзи в public/emoji")
    ap.add_argument("--add", nargs="*", default=[], help="Имена символов из набора, например Rocket")
    ap.add_argument("--only", action="store_true", help="Скачать только указанные в --add")
    args = ap.parse_args()

    names = list(args.add) if args.only else BASE + [n for n in args.add if n not in BASE]
    FOLDER.mkdir(parents=True, exist_ok=True)
    listing = FOLDER / "sources.json"
    known = {item["name"]: item for item in json.loads(listing.read_text(encoding="utf-8-sig"))} if listing.exists() else {}

    added, missing = 0, []
    for name in names:
        if name in known and (FOLDER / known[name]["file"]).is_file():
            continue
        print(f"   {name}", flush=True)
        item = download(name, FOLDER)
        if item:
            known[name] = item
            added += 1
        else:
            missing.append(name)

    items = sorted(known.values(), key=lambda x: x["name"])
    listing.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (FOLDER / "SOURCES.md").write_text(
        "# Объёмные эмодзи\n\n"
        "Набор Fluent Emoji, Microsoft Corporation. Лицензия MIT, текст: "
        f"{LICENSE_URL}\n\n"
        "Файлы скачаны скриптом `scripts/get-emoji.py` из официального репозитория. "
        "Каждая строка ниже — символ, файл и адрес, откуда он взят.\n\n"
        "| Символ | Файл | Источник |\n|---|---|---|\n"
        + "\n".join(f"| {i['name']} | `{i['file']}` | {i['source']} |" for i in items)
        + "\n",
        encoding="utf-8",
    )
    total = sum(i["bytes"] for i in items)
    print(f"ГОТОВО: {len(items)} символов, {total // 1024} КБ, добавлено {added}", flush=True)
    if missing:
        print("Не найдены: " + ", ".join(missing), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ЗАГРУЗКА НЕ ВЫПОЛНЕНА: {error}", file=sys.stderr)
        sys.exit(1)
