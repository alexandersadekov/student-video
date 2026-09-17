"""Local, non-destructive import. Every run creates an independent editable composition."""
import argparse
import datetime
import html
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import uuid
import importlib.util

ROOT = Path(__file__).resolve().parents[1]


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def run(args):
    p = subprocess.run([str(x) for x in args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode:
        raise RuntimeError(p.stderr[-6000:])
    return p


def merge(intervals):
    result = []
    for a, b in sorted(intervals):
        if b <= a:
            continue
        if result and a <= result[-1][1] + 0.001:
            result[-1][1] = max(result[-1][1], b)
        else:
            result.append([a, b])
    return result


def plan_cuts(duration, words, silence, cfg):
    # Silence detection proposes deletions; transcript words always protect their boundaries.
    opening = max(0, words[0]["start"] - cfg["openingPaddingSeconds"])
    ending = min(duration, words[-1]["end"] + cfg["paddingSeconds"])
    silence = merge(silence)
    keep, cursor = [], opening
    for a, b in silence:
        a, b = max(opening, a + cfg["paddingSeconds"]), min(ending, b - cfg["paddingSeconds"])
        if b > a:
            if a > cursor:
                keep.append([cursor, a])
            cursor = max(cursor, b)
    if cursor < ending:
        keep.append([cursor, ending])
    keep += [[max(opening, w["start"] - cfg["paddingSeconds"]), min(ending, w["end"] + cfg["paddingSeconds"])] for w in words]
    keep = merge(keep)
    # Preserve short sounds rather than deleting potentially meaningful speech.
    for interval in keep:
        if interval[1] - interval[0] < cfg["minimumKeepSeconds"]:
            interval[1] = min(ending, interval[0] + cfg["minimumKeepSeconds"])
    return merge(keep)


def main():
    ap = argparse.ArgumentParser(description="Import a video into an independent Remotion composition")
    ap.add_argument("video", type=Path)
    ap.add_argument("--transcript", type=Path, help="Reuse word-level JSON: [{start,end,word}]")
    ap.add_argument("--keep", type=Path, help="Manual source intervals [[start,end],...]; restores or changes cuts")
    ap.add_argument("--scenes", type=Path, help="Visual scenes in edited timeline: [{start,end,asset}]")
    ap.add_argument("--fresh", action="store_true", help="Ignore an exact-source reviewed preset and regenerate the draft")
    ap.add_argument("--model-dir", default=str(ROOT / ".models"))
    ap.add_argument("--ffmpeg", default=os.environ.get("FFMPEG", "ffmpeg"))
    ap.add_argument("--ffprobe", default=os.environ.get("FFPROBE", "ffprobe"))
    args = ap.parse_args()
    src = args.video.resolve()
    if not src.is_file():
        raise RuntimeError(f"Video not found: {src}")
    if not args.fresh and not args.keep and not args.scenes and not args.transcript:
        spec = importlib.util.spec_from_file_location('approved_preset', ROOT / 'scripts/approved-preset.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if module.try_restore(ROOT, src):
            return
    cfg = json.loads((ROOT / "editing-profile.json").read_text(encoding="utf-8-sig"))
    meta = json.loads(run([args.ffprobe, "-v", "error", "-show_streams", "-show_format", "-of", "json", src]).stdout)
    video = next(s for s in meta["streams"] if s["codec_type"] == "video")
    if not any(s["codec_type"] == "audio" for s in meta["streams"]):
        raise RuntimeError("No audio stream. Import requires speech; source unchanged.")
    n, d = video["avg_frame_rate"].split("/")
    fps = float(n) / float(d)
    if not 1 <= fps <= 120:
        raise RuntimeError("Unsupported frame rate")
    duration = float(meta["format"]["duration"])
    ident = "Video-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:4]
    folder = ROOT / "public" / "projects" / ident
    folder.mkdir(parents=True)
    save(folder / "profile.json", cfg)
    print("1/5 Copying source; original remains unchanged", flush=True)
    source = folder / ("source" + src.suffix.lower())
    shutil.copy2(src, source)
    run([args.ffmpeg, "-y", "-v", "error", "-i", source, "-vn", "-ac", "1", "-ar", "16000", folder / "speech.wav"])
    print("2/5 Transcribing locally (first run downloads the model)", flush=True)
    if args.transcript:
        words = json.loads(args.transcript.read_text(encoding="utf-8-sig"))
    else:
        from faster_whisper import WhisperModel
        model = WhisperModel(cfg["model"], device="cpu", compute_type="int8", download_root=args.model_dir)
        segments, _ = model.transcribe(str(folder / "speech.wav"), language=cfg["language"], word_timestamps=True, vad_filter=True)
        words = [{"start": w.start, "end": w.end, "word": w.word.strip(), "probability": w.probability} for seg in segments for w in (seg.words or [])]
    words = sorted([w for w in words if w["word"].strip() and 0 <= w["start"] < w["end"] <= duration + 0.1], key=lambda w: w["start"])
    if not words:
        raise RuntimeError("No speech recognized. Nothing replaced; inspect source audio.")
    save(folder / "words-original.json", words)
    print("3/5 Finding pauses and protecting spoken words", flush=True)
    detected = run([args.ffmpeg, "-hide_banner", "-i", folder / "speech.wav", "-af", f"silencedetect=noise={cfg['silenceDb']}dB:d={cfg['minimumSilenceSeconds']}", "-f", "null", "-"]).stderr
    silences, start = [], None
    for kind, value in re.findall(r"silence_(start|end):\s*([\d.]+)", detected):
        if kind == "start":
            start = float(value)
        elif start is not None:
            silences.append([start, float(value)])
            start = None
    if start is not None:
        silences.append([start, duration])
    keeps = plan_cuts(duration, words, silences, cfg)
    if args.keep:
        keeps = json.loads(args.keep.read_text(encoding="utf-8-sig"))
        if not keeps or any(len(x) != 2 or not 0 <= x[0] < x[1] <= duration for x in keeps):
            raise RuntimeError("Invalid keep intervals")
    # Quantize once to video frames; audio and captions use the same edit map.
    keeps = merge([[math.floor(a * fps) / fps, min(duration, math.ceil(b * fps) / fps)] for a, b in keeps])
    edits, total = [], 0
    for a, b in keeps:
        frames = max(1, round((b - a) * fps))
        edits.append({"sourceStart": a, "sourceEnd": b, "timelineFrame": total, "frames": frames})
        total += frames
    removed, cursor = [], 0
    for a, b in keeps:
        if a > cursor:
            removed.append({"start": cursor, "end": a, "reason": "opening/ending or silence candidate; review required"})
        cursor = b
    if cursor < duration:
        removed.append({"start": cursor, "end": duration, "reason": "trailing material; review required"})
    save(folder / "edit-map.json", {"kept": edits, "removed": removed, "original": str(src), "fps": fps})
    mapped = []
    for w in words:
        e = next((e for e in edits if w["start"] < e["sourceEnd"] and w["end"] > e["sourceStart"]), None)
        if e:
            offset = e["timelineFrame"] / fps - e["sourceStart"]
            mapped.append({**w, "start": max(w["start"], e["sourceStart"]) + offset, "end": min(w["end"], e["sourceEnd"]) + offset})
    captions, group = [], []
    for i, w in enumerate(mapped):
        group.append(w)
        gap = i == len(mapped) - 1 or mapped[i + 1]["start"] - w["end"] > 0.25
        next_glue = i + 1 < len(mapped) and mapped[i+1]["word"].lower() in {"за", "на", "в", "к", "с", "со", "о", "об", "про", "для", "из", "от", "до", "по"}
        if len(group) >= cfg["captionWords"] or gap or (len(group) == 1 and next_glue) or re.search(r"[.!?,:;]$", w["word"]):
            captions.append({"text": " ".join(x["word"] for x in group), "startMs": round(group[0]["start"] * 1000), "endMs": round(w["end"] * 1000), "timestampMs": None, "confidence": None})
            group = []
    save(folder / "captions.json", captions)
    print("4/5 Building editable camera/audio/subtitle clips", flush=True)
    run([args.ffmpeg, "-y", "-v", "error", "-i", source, "-vn", "-ar", "48000", "-ac", "2", *(["-af", cfg["voiceFilter"]] if cfg["processVoice"] else []), folder / "voice.wav"])
    # Smooth cut boundaries in the retained audio without shifting the video timeline.
    audio_filters = []
    for i, e in enumerate(edits):
        a, b = e["sourceStart"], e["sourceEnd"]
        fade = min(0.004, (b-a)/4)
        audio_filters.append(f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,afade=t=in:d={fade},afade=t=out:st={b-a-fade}:d={fade}[a{i}]")
    audio_filters.append("".join(f"[a{i}]" for i in range(len(edits))) + f"concat=n={len(edits)}:v=0:a=1[out]")
    run([args.ffmpeg, "-y", "-v", "error", "-i", folder / "voice.wav", "-filter_complex", ";".join(audio_filters), "-map", "[out]", folder / "voice-edited.wav"])
    prefix = f"projects/{ident}/"
    scenes = json.loads(args.scenes.read_text(encoding="utf-8-sig")) if args.scenes else []
    previous_end = 0
    for i, scene in enumerate(sorted(scenes, key=lambda s: s['start'])):
        if not previous_end <= scene['start'] < scene['end'] <= total / fps:
            raise RuntimeError("Visual scenes overlap or exceed edited duration")
        previous_end = scene['end']
        asset = Path(scene['asset']).resolve()
        if not asset.is_file() or asset.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mov'):
            raise RuntimeError(f"Unsupported or missing scene asset: {asset}")
        filename = f'visual-{i}{asset.suffix.lower()}'
        shutil.copy2(asset, folder / filename)
        scene['publicAsset'] = prefix + filename
    split_expression = ' || '.join(f'(frame>={round(s["start"]*fps)} && frame<{round(s["end"]*fps)})' for s in scenes) or 'false'
    lines = ["import {AbsoluteFill, Interactive, Sequence, staticFile, interpolate, Easing, useCurrentFrame, getRemotionEnvironment} from 'remotion';", "import {Video, Audio} from '@remotion/media';", "import {ProjectGuides} from '../ProjectGuides';", *( ["import {Img} from 'remotion';"] if any(s['publicAsset'].lower().endswith(('.png','.jpg','.jpeg','.webp')) for s in scenes) else []), "export const ImportedVideo = ({showGuides=true,fullScreenExplanation=false,lightTheme=false,colorGrade=true}:{showGuides?:boolean;fullScreenExplanation?:boolean;lightTheme?:boolean;colorGrade?:boolean}) => {", "const frame=useCurrentFrame();", f"const active={split_expression}; const split=active&&!fullScreenExplanation;", "return <AbsoluteFill showInTimeline={false} style={{background:'#111',fontFamily:'Inter'}}>", f'<Sequence name="Субтитры • раскрыть" durationInFrames={{{total}}} style={{{{zIndex:2}}}}>']
    for caption_index, c in enumerate(captions):
        a = max(0, round(c["startMs"] * fps / 1000)); b = min(total, max(a + 1, round(c["endMs"] * fps / 1000)))
        if caption_index == 0 and a <= math.ceil(fps * 0.12):
            a = 0
        text = html.escape(c["text"])
        lines.append(f'<Interactive.Div name="{text}" from={{{a}}} durationInFrames={{{b-a}}} style={{{{position:"absolute",left:"50%",top:active&&fullScreenExplanation?1420:split?960:{cfg["captionY"]},translate:"-50% -50%",width:"max-content",maxWidth:850,fontFamily:{json.dumps(cfg["captionFont"])},fontSize:{cfg["captionSize"]},lineHeight:1.1,color:"white",textAlign:"center",background:"rgba(0,0,0,.88)",padding:"20px",borderRadius:24}}}}>{text}</Interactive.Div>')
    lines += ['</Sequence>']
    for i, scene in enumerate(scenes):
        a, b = round(scene['start']*fps), round(scene['end']*fps)
        tag = 'Video' if scene['publicAsset'].endswith(('.mp4','.mov')) else 'Img'
        muted = ' muted' if tag == 'Video' else ''
        lines += [f'<Sequence name="Объяснение {i+1} • визуализация" from={{{a}}} durationInFrames={{{b-a}}} style={{{{zIndex:1}}}}>', '<div style={{position:"absolute",width:1080,height:fullScreenExplanation?1920:960,background:lightTheme?"#f6f7f9":"#0c1118"}}>', f'<Interactive.Div name="Материал {i+1} • масштаб и ключи" durationInFrames={{{b-a}}} style={{{{position:"absolute",left:96,top:fullScreenExplanation?560:254,width:888,height:fullScreenExplanation?800:660,scale:1,translate:"0px 0px",opacity:1}}}}>', f'<{tag} src={{staticFile({json.dumps(scene["publicAsset"])})}}{muted} style={{{{width:"100%",height:"100%",objectFit:"contain"}}}}/>', '</Interactive.Div></div></Sequence>']
    lines += ['<div style={{position:"absolute",top:split?960:0,left:0,width:1080,height:split?960:1920,opacity:active&&fullScreenExplanation?0:1,overflow:"hidden"}}>', f'<Interactive.Div name="Камера • общий масштаб и положение" durationInFrames={{{total}}} style={{{{position:"absolute",inset:0,scale:interpolate(frame,[0,{max(1, round(cfg["openingZoomSeconds"]*fps))}],[{cfg.get("cameraScale",1)},{cfg.get("cameraScale",1)*cfg["openingZoom"]}],{{easing:Easing.bezier(.16,1,.3,1),extrapolateLeft:"clamp",extrapolateRight:"clamp"}}),translate:"0px {cfg.get("cameraOffsetY",0)}px"}}}}>']
    for i, e in enumerate(edits):
        lines.append(f'<Video name="Видео {i+1} • исходник {e["sourceStart"]:.2f}с" src={{staticFile({json.dumps(prefix+source.name)})}} from={{{e["timelineFrame"]}}} trimBefore={{{round(e["sourceStart"]*fps)}}} durationInFrames={{{e["frames"]}}} muted objectFit="cover" style={{{{position:"absolute",inset:0,width:1080,height:"100%",objectFit:"cover",objectPosition:"50% 50%",filter:colorGrade?"contrast(1.035) saturate(1.04) brightness(1.015)":"none"}}}}/>')
    lines.append('</Interactive.Div></div>')
    for i, e in enumerate(edits):
        lines.append(f'<Audio name="Голос {i+1}" src={{staticFile({json.dumps(prefix+"voice-edited.wav")})}} from={{{e["timelineFrame"]}}} trimBefore={{{e["timelineFrame"]}}} durationInFrames={{{e["frames"]}}} volume={{1}}/>')
    lines += [f'<Sequence name="Направляющие • НЕ ЭКСПОРТ" durationInFrames={{{total}}} style={{{{zIndex:20,pointerEvents:"none"}}}}>{{showGuides && !getRemotionEnvironment().isRendering ? <ProjectGuides opacity={{{cfg["guideOpacity"]}}}/> : null}}</Sequence>', '</AbsoluteFill>;', '};']
    generated = ROOT / "src" / "generated"
    generated.mkdir(exist_ok=True)
    (generated / f"{ident}.tsx").write_text("\n".join(lines), encoding="utf-8")
    entries_file = generated / "registry.json"
    entries = json.loads(entries_file.read_text()) if entries_file.exists() else []
    flag_keys = ("fullScreenExplanation", "lightTheme", "colorGrade")
    entries.append({"id": ident, "duration": total, "fps": fps,
                    "props": {k: bool(cfg.get(k, k == "colorGrade")) for k in flag_keys}})
    save(entries_file, entries)
    registry = ["import {Composition} from 'remotion';"]
    registry += [f"import {{ImportedVideo as Video{i}}} from './{e['id']}';" for i, e in enumerate(entries)]
    registry += ['export const ImportedCompositions=()=> <>']
    for i, e in enumerate(entries):
        props = e.get("props", {})
        flags = ",".join(f"{k}:{str(bool(props.get(k, k == 'colorGrade'))).lower()}" for k in flag_keys)
        registry.append(f'<Composition id="{e["id"]}" component={{Video{i}}} durationInFrames={{{e["duration"]}}} fps={{{e["fps"]}}} width={{1080}} height={{1920}} defaultProps={{{{showGuides:true,{flags}}}}}/>')
    registry.append('</>;')
    (generated / "Registry.tsx").write_text(chr(10).join(registry), encoding="utf-8")
    # Separate authored nodes and lines are necessary for Studio's source editing.
    run([shutil.which("node") or "node", ROOT / "node_modules/prettier/bin/prettier.cjs", "--write", generated / f"{ident}.tsx", generated / "Registry.tsx"])
    report = {"composition": ident, "reviewRequired": ["Проверить первое слово и вдохи", "Прослушать каждую склейку", "Проверить текст и смысловые пары субтитров", "Настроить кадрирование и уровень глаз", "Отметить дубли вручную: автоматическое смысловое удаление выключено", "Для объяснений указать таймкод и материал: скриншот, запись экрана или схема. До этого камера с акцентом, без выдуманных карточек."], "captions": captions, "removed": removed, "visualScenes": scenes}
    save(folder / "review.json", report)
    transcript = " ".join(c["text"] for c in captions)
    scene_lines = "\n".join(
        f"- {scene['start']:.2f}–{scene['end']:.2f} с: {scene.get('asset', 'материал не указан')}"
        for scene in scenes
    ) or "- Визуальные сцены ещё не размечены. Сначала предложить таймкоды и требуемые материалы."
    research_request = f"""# Задание на интернет-исследование

Композиция: `{ident}`  
Дата создания: {datetime.date.today().isoformat()}  

## Транскрипт

{transcript}

## Размеченные сцены

{scene_lines}

## Режиссура по контексту

Прочитать motion-direction.json. Для каждой сцены составить план: фраза → задача зрителя → объект → действие → результат. Указать временные этапы и звуковые акценты. Не переносить сцены пилота на новый сюжет. Выбирать светлый/тёмный фон по смыслу; сохранять сетку и подсветку центра.

## Что должен сделать ИИ с доступом к интернету

1. Разбить речь на проверяемые утверждения, компании, продукты и процессы.
2. Для каждого утверждения найти актуальный первичный источник: официальную документацию, бренд-кит, сайт компании, нормативный документ или оригинальное исследование. Вторичные источники использовать только для поиска первичного.
3. Для процесса подтвердить вход, шаги, результат и ограничения. Не придумывать экран сервиса, функцию, цифру или последовательность.
4. Для компании скачать логотип только из официального бренд-кита/медиа-страницы. Сохранить исходную ссылку, дату доступа и условия использования. Не генерировать похожий логотип.
5. Предложить визуализацию по таймкодам: реальный интерфейс/материал → схема → эмодзи как короткий смысловой маркер. Не дублировать субтитры карточками.
6. Записать результат в `SOURCES.md` рядом с этим файлом. Каждому факту и каждому ассету должна соответствовать ссылка. Отдельно отметить предположения и недостающие материалы.

## Формат SOURCES.md

| Таймкод | Утверждение/объект | Что показываем | Первичный источник | Дата проверки | Статус/ограничения |
|---|---|---|---|---|---|

После исследования обновить `scenes.json`, но не скачивать и не использовать чужие материалы без проверки лицензии/разрешённого использования.
"""
    (folder / "RESEARCH_REQUEST.md").write_text(research_request, encoding="utf-8")
    (folder / "SOURCES.md").write_text(
        "# Источники для монтажа\n\n| Таймкод | Утверждение/объект | Что показываем | Первичный источник | Дата проверки | Статус/ограничения |\n|---|---|---|---|---|---|\n",
        encoding="utf-8",
    )
    print(f"5/5 READY: {ident}\nOpen http://localhost:3000/{ident}\nReview: {folder / 'review.json'}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"IMPORT FAILED: {error}", file=sys.stderr)
        sys.exit(1)
