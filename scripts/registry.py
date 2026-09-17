"""Единая точка регистрации импортированных композиций.

src/generated/Registry.tsx собирается из registry.json, а src/Root.tsx подключает
готовый <ImportedCompositions/>. Раньше каждый скрипт дописывал Root.tsx сам, и
запись реестра существовала в двух копиях; теперь оба импорта зовут add_entry.
"""

import json

FLAG_KEYS = ("fullScreenExplanation", "lightTheme", "colorGrade")


def add_entry(root, ident, duration, fps, cfg=None):
    """Добавляет композицию в реестр и перегенерирует Registry.tsx.

    cfg — словарь настроек (обычно editing-profile.json); из него берутся флаги
    стиля, которые станут defaultProps композиции.
    """
    cfg = cfg or {}
    generated = root / "src" / "generated"
    generated.mkdir(parents=True, exist_ok=True)

    entries_file = generated / "registry.json"
    entries = json.loads(entries_file.read_text(encoding="utf-8-sig")) if entries_file.exists() else []
    entries.append({
        "id": ident,
        "duration": duration,
        "fps": fps,
        "props": {key: bool(cfg.get(key, key == "colorGrade")) for key in FLAG_KEYS},
    })
    entries_file.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = ["import {Composition} from 'remotion';"]
    lines += [f"import {{ImportedVideo as Video{i}}} from './{e['id']}';" for i, e in enumerate(entries)]
    lines.append("export const ImportedCompositions=()=> <>")
    for i, entry in enumerate(entries):
        props = entry.get("props", {})
        flags = ",".join(
            f"{key}:{str(bool(props.get(key, key == 'colorGrade'))).lower()}" for key in FLAG_KEYS
        )
        lines.append(
            f'<Composition id="{entry["id"]}" component={{Video{i}}}'
            f' durationInFrames={{{entry["duration"]}}} fps={{{entry["fps"]}}}'
            f' width={{1080}} height={{1920}}'
            f' defaultProps={{{{showGuides:true,{flags}}}}}/>'
        )
    lines.append("</>;")
    (generated / "Registry.tsx").write_text(chr(10).join(lines), encoding="utf-8")
    return generated / "Registry.tsx"
