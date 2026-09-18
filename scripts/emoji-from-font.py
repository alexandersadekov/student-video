"""Свой набор эмодзи из цветного шрифта — например из Apple Color Emoji.

Зачем отдельный скрипт. Эмодзи Apple нельзя положить в шаблон: шрифт
лицензирован только для устройств Apple, и в публичном репозитории ему не
место. Но для своего ролика набор взять можно — со своего же Mac или iPhone.
Поэтому личные картинки живут отдельно: `public/emoji-local/` не попадает в
git, а сцены берут оттуда всё, что там нашлось, и падают обратно на набор из
`public/emoji/` для остального.

Где взять файл шрифта:
  macOS    /System/Library/Fonts/Apple Color Emoji.ttc
  iPhone   резервная копия, та же AppleColorEmoji.ttc
  иначе    публичная пересборка github.com/samuelngs/apple-emoji-ttf, релиз
           AppleColorEmoji-Linux.ttf — картинки до 96×96, этого хватает плашкам
           и строчным вставкам, но не крупному объекту во весь кадр

Лицензия MIT у такой пересборки покрывает её скрипты, а не рисунки: эмодзи
остаются собственностью Apple. Для своего ролика — решение автора, в шаблон
они не попадают.

Работает с растровыми цветными шрифтами (таблицы sbix у Apple и CBDT у Noto).
Segoe UI Emoji из Windows не подойдёт: он векторный (COLR), картинок внутри нет.

    python scripts/emoji-from-font.py "C:/шрифты/AppleColorEmoji.ttc"
    python scripts/emoji-from-font.py <шрифт> --clear
"""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SHIPPED = ROOT / "public" / "emoji"
LOCAL = ROOT / "public" / "emoji-local"
GENERATED = ROOT / "src" / "generated" / "emoji.ts"

# Имя файла в наборе → сам символ. Держим список явно: угадывать символ по
# имени нельзя, а молча пропустить не тот значок — хуже, чем не найти его.
CHARACTERS = {
    "alarm_clock": "\u23f0",
    "bell": "\U0001f514",
    "brain": "\U0001f9e0",
    "calendar": "\U0001f4c5",
    "chart_increasing": "\U0001f4c8",
    "check_mark_button": "\u2705",
    "clapper_board": "\U0001f3ac",
    "cross_mark": "\u274c",
    "eyes": "\U0001f440",
    "fire": "\U0001f525",
    "gear": "\u2699\ufe0f",
    "hourglass_done": "\u231b",
    "light_bulb": "\U0001f4a1",
    "magnifying_glass_tilted_left": "\U0001f50d",
    "microphone": "\U0001f3a4",
    "money_bag": "\U0001f4b0",
    "party_popper": "\U0001f389",
    "red_heart": "\u2764\ufe0f",
    "rocket": "\U0001f680",
    "speech_balloon": "\U0001f4ac",
    "thumbs_up": "\U0001f44d",
    "warning": "\u26a0\ufe0f",
}


def glyph_for(font, character):
    """Имя глифа по символу; вариационный селектор при неудаче отбрасываем."""
    tables = font["cmap"].tables
    for text in (character, character.replace("\ufe0f", "")):
        points = [ord(c) for c in text if c != "\ufe0f"]
        if len(points) != 1:
            continue
        for table in tables:
            name = table.cmap.get(points[0])
            if name:
                return name
    return None


def biggest_bitmap(font, name, depth=0):
    """Самая крупная картинка глифа: нам нужен размер под 1080×1920.

    В шрифте Apple часть символов не хранит свою картинку, а ссылается на
    другой глиф (graphicType == "dupe"). Такую ссылку проходим насквозь, иначе
    вместо половины набора получатся пустые файлы.
    """
    best = None
    if "sbix" in font:
        for size in sorted(font["sbix"].strikes):
            glyph = font["sbix"].strikes[size].glyphs.get(name)
            data = getattr(glyph, "imageData", None)
            if not data:
                continue
            if getattr(glyph, "graphicType", "") == "dupe" and depth < 3:
                found = biggest_bitmap(font, data.decode("ascii", "ignore").strip("\x00"), depth + 1)
                if found:
                    best = found
                continue
            if data.startswith(b"\x89PNG"):
                best = data
    if best is None and "CBDT" in font:
        for strike in font["CBDT"].strikeData:
            record = strike.get(name)
            data = getattr(record, "imageData", None)
            if data and data.startswith(b"\x89PNG"):
                best = data
    return best


def write_manifest(names):
    GENERATED.parent.mkdir(parents=True, exist_ok=True)
    GENERATED.write_text(
        "// Список личных эмодзи из public/emoji-local. Файл создаёт\n"
        "// scripts/emoji-from-font.py; вручную не правится.\n"
        "export const LOCAL_EMOJI: string[] = "
        + json.dumps(sorted(names), ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )


def main():
    ap = argparse.ArgumentParser(description="Вынуть эмодзи из цветного шрифта в public/emoji-local")
    ap.add_argument("font", type=Path, help="Файл .ttc или .ttf с цветными эмодзи")
    ap.add_argument("--index", type=int, default=0, help="Номер шрифта внутри .ttc")
    ap.add_argument("--clear", action="store_true", help="Убрать личный набор и вернуться к общему")
    args = ap.parse_args()

    if args.clear:
        for file in LOCAL.glob("*.png"):
            file.unlink()
        write_manifest([])
        print("Личный набор убран; сцены снова берут общий из public/emoji", flush=True)
        return

    if not args.font.is_file():
        raise RuntimeError(f"Шрифт не найден: {args.font}")
    from fontTools.ttLib import TTFont, TTCollection

    if args.font.suffix.lower() == ".ttc":
        fonts = TTCollection(str(args.font)).fonts
        # В коллекции Apple несколько начертаний; берём то, где лежат картинки,
        # а не первое подряд — иначе на верном файле получится пустой результат.
        picked = [f for f in fonts if "sbix" in f or "CBDT" in f]
        font = picked[0] if picked else fonts[args.index]
        print(f"   в файле {len(fonts)} шрифт(ов), с картинками — {len(picked)}", flush=True)
    else:
        font = TTFont(str(args.font))
    if "sbix" not in font and "CBDT" not in font:
        raise RuntimeError(
            "В этом шрифте нет растровых эмодзи, только векторные (таблица COLR). "
            "Segoe UI Emoji из Windows и свежий Noto Color Emoji именно такие. "
            "Нужен Apple Color Emoji с Mac или из резервной копии iPhone."
        )

    LOCAL.mkdir(parents=True, exist_ok=True)
    names = sorted({p.stem for p in SHIPPED.glob("*.png")} | set(CHARACTERS))
    taken, missing = [], []
    for name in names:
        character = CHARACTERS.get(name)
        glyph = glyph_for(font, character) if character else None
        data = biggest_bitmap(font, glyph) if glyph else None
        if not data:
            missing.append(name)
            continue
        (LOCAL / f"{name}.png").write_bytes(data)
        taken.append(name)

    write_manifest(taken)
    (LOCAL / "README.md").write_text(
        "# Личный набор эмодзи\n\n"
        f"Вынут из `{args.font.name}` скриптом `scripts/emoji-from-font.py`.\n\n"
        "Эта папка не попадает в git намеренно. Шрифты эмодзи Apple лицензированы\n"
        "только для устройств Apple: использовать их в своём ролике — ваше решение\n"
        "и ваша ответственность, а распространять вместе с шаблоном нельзя.\n\n"
        "Вернуться к общему набору: `python scripts/emoji-from-font.py <шрифт> --clear`.\n",
        encoding="utf-8",
    )
    size = sum((LOCAL / f"{n}.png").stat().st_size for n in taken)
    print(f"ГОТОВО: взято {len(taken)} символов, {size // 1024} КБ", flush=True)
    if missing:
        print("Не нашлись в шрифте: " + ", ".join(missing), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"НЕ ВЫПОЛНЕНО: {error}", file=sys.stderr)
        sys.exit(1)
