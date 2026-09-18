"""Local, non-destructive import. Every run creates an independent editable composition."""
import argparse
import array
import operator
from registry import add_entry
import datetime
import difflib
import html
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
RATE = 16000                       # шаг разбора звука: та же частота, что у распознавания

# Пороги монтажа. Значения здесь — запасные: рабочие берутся из
# editing-profile.json, а профили старых проектов остаются читаемыми.
DEFAULTS = {
    "levelWindowSeconds": 0.02,
    "levelHopSeconds": 0.01,
    "edgeExtendSeconds": 0.5,
    "innerSilenceSeconds": 0.13,
    "leadPadSeconds": 0.05,
    "tailPadSeconds": 0.06,
    "openingPaddingSeconds": 0.05,
    "endingPaddingSeconds": 0.14,
    "minimumSpeechSeconds": 0.12,
    "maxWordSeconds": 0.9,
    "secondsPerLetter": 0.13,
    "wordOverheadSeconds": 0.25,
    "wordDurationTolerance": 2.0,
    "retakeSilenceSeconds": 0.18,
    "minimumRetakeSeconds": 0.5,
    "minimumCutSeconds": 0.05,
    "maxLettersPerSecond": 25,
    "mouthNoiseSeconds": 0.35,
    "mouthNoiseBelowSpeechDb": 18,
    "mouthNoiseZcr": 0.28,
    "dropDuplicateTakes": True,
    "deadAirSeconds": 0.3,
}


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


def transcribe_span(model, wav, start, end, cfg, ffmpeg, prompt=None):
    """Распознаёт один отрезок отдельно и возвращает слова в шкале исходника.

    prompt — то, что модель уже расслышала на этом месте при общем проходе.
    Без подсказки короткий кусок уходит в фантазию: «я расскажу» превращается
    в «я скажу», а то и в слово, которого в записи нет вовсе.
    """
    with tempfile.TemporaryDirectory() as tmp:
        piece = Path(tmp) / "span.wav"
        run([ffmpeg, "-y", "-v", "error", "-ss", str(start), "-to", str(end), "-i", wav, piece])
        # vad_filter здесь выключен намеренно: отрезок уже отобран по громкости,
        # а VAD на коротком куске глотает как раз то, ради чего мы его слушаем.
        segments, _ = model.transcribe(str(piece), language=cfg["language"], word_timestamps=True,
                                       vad_filter=False, initial_prompt=prompt)
        found = []
        for seg in segments:
            for w in (seg.words or []):
                text = w.word.strip()
                if text and w.end > w.start:
                    found.append({"start": round(start + w.start, 2), "end": round(start + w.end, 2),
                                  "word": text, "probability": w.probability, "recovered": True})
    return found


def transcription_score(found, seconds, cfg):
    """Сколько речи реально разобрано на отрезке — в буквах, а не в секундах.

    По занятому времени сравнивать нельзя: у обрезанного варианта уцелевшие
    слова растягиваются на всю дыру и дают то же «покрытие», что и полный
    разбор. Слишком плотный текст — наоборот, признак выдумки: столько букв
    за секунду не выговорить.
    """
    letters = sum(len(re.sub(r"[^\w]", "", w["word"])) for w in found)
    return 0 if seconds > 0 and letters / seconds > cfg["maxLettersPerSecond"] else letters


def best_transcription(model, wav, a, b, cfg, ffmpeg, prompt):
    """Слушает отрезок дважды — с подсказкой и без неё — и берёт полный вариант.

    Подсказка чинит написание («я скажу» → «я расскажу»), но на повторе фразы
    заставляет модель проглотить уже «сказанное»: кусок возвращается обрезанным.
    Поэтому сравниваем разборы между собой; при равенстве берём подсказанный —
    у него точнее орфография и язык.
    """
    plain = transcribe_span(model, wav, a, b, cfg, ffmpeg)
    if not prompt:
        return plain
    hinted = transcribe_span(model, wav, a, b, cfg, ffmpeg, prompt)
    return hinted if transcription_score(hinted, b - a, cfg) >= transcription_score(plain, b - a, cfg) else plain


def split_phrases(words, cfg):
    """Делит речь на реплики: по знаку конца предложения и по паузе.

    Только пауза склеивает разные мысли в одну реплику — дубль тогда тонет
    в соседнем предложении и перестаёт быть похожим сам на себя.
    """
    phrases, current = [], []
    for prev, w in zip([None] + list(words), words):
        gap = prev is not None and w["start"] - prev["end"] > cfg["phraseGapSeconds"]
        sentence_end = prev is not None and prev["word"].rstrip().endswith((".", "?", "!", "…"))
        if current and (gap or sentence_end):
            phrases.append(current)
            current = []
        current.append(w)
    if current:
        phrases.append(current)
    return phrases


def pcm_levels(wav, ffmpeg, window, hop):
    """Огибающая громкости по собственным окнам.

    astats в ffmpeg считает кадрами по 1024 отсчёта — на 16 кГц это 64 мс, и
    паузу в 0.15 с такой сеткой не разглядеть. Поэтому читаем звук числами и
    меряем сами: окно 20 мс с шагом 10 мс видит и короткий призвук, и провал
    внутри слова.
    """
    raw = subprocess.run([str(ffmpeg), "-v", "error", "-i", str(wav), "-f", "s16le",
                          "-ac", "1", "-ar", str(RATE), "-"], capture_output=True).stdout
    samples = array.array("h")
    samples.frombytes(raw[: len(raw) // 2 * 2])
    block = max(1, int(RATE * hop))
    span = max(1, round(window / hop))
    energies, crossings = [], []
    for i in range(0, len(samples) - block + 1, block):
        chunk = samples[i:i + block]
        energies.append(sum(map(operator.mul, chunk, chunk)) / block)
        # Переходы через ноль: у гласной их мало, у щелчка и причмокивания много.
        crossings.append(sum(1 for k in range(1, block) if (chunk[k - 1] >= 0) != (chunk[k] >= 0)) / (block - 1))
    times, levels, zcr = [], [], []
    for i in range(max(0, len(energies) - span + 1)):
        mean = sum(energies[i:i + span]) / span
        times.append(round(i * hop + window / 2, 4))
        levels.append(-120.0 if mean <= 1 else round(20 * math.log10(math.sqrt(mean) / 32768.0), 2))
        zcr.append(round(sum(crossings[i:i + span]) / span, 3))
    return times, levels, zcr


class Level:
    """Доступ к огибающей по времени: где звук, где его нет."""

    def __init__(self, times, levels, zcr, threshold, hop):
        self.levels = levels
        self.zcr = zcr
        self.threshold = threshold
        self.hop = hop
        self.start = times[0] if times else 0.0
        self.count = len(levels)

    def index(self, t):
        return min(self.count - 1, max(0, int(round((t - self.start) / self.hop))))

    def time(self, i):
        return round(self.start + i * self.hop, 4)

    def loud(self, i):
        return 0 <= i < self.count and self.levels[i] >= self.threshold

    def looks_like_speech(self, a, b, speech_db, cfg):
        """Речь ли это вообще, или мокрый призвук рта на стыке фраз.

        Уровнем одним такое не отличить: причмокивание громче тишины и живёт
        внутри фразы. Но у него нет голоса — сигнал шумовой, переходов через
        ноль втрое больше, чем у гласной, и он тише речи на два десятка
        децибел. Длинный участок так не судим: там может быть тихий шёпот.
        """
        window = [i for i in range(self.index(a), self.index(b) + 1) if self.loud(i)]
        if not window or b - a > cfg["mouthNoiseSeconds"]:
            return True
        peak = max(self.levels[i] for i in window)
        middle = sorted(self.zcr[i] for i in window)[len(window) // 2]
        return not (peak < speech_db - cfg["mouthNoiseBelowSpeechDb"] and middle > cfg["mouthNoiseZcr"])


def speech_bounds(level, a, b, cfg):
    """Границы фразы по звуку, а не по таймингам модели.

    Тайминги слов сдвинуты относительно записи, и дорисованный к ним запас
    оборачивается тишиной в начале куска. Поэтому внутрь ужимаем до первого
    звука, а наружу добираем только то, что звучит непрерывно: у глухой
    согласной в начале и в конце слова уровень ниже порога.
    """
    first, last = level.index(a), level.index(b)
    i = first
    while i <= last and not level.loud(i):
        i += 1
    if i > last:
        return None
    j = last
    while j > i and not level.loud(j):
        j -= 1
    # Добираем весь непрерывный звук, а не фиксированный запас: тайминги слов
    # обрываются раньше записи, и «Инстаграм» на слух ещё звучит, когда модель
    # слово уже закончила. Разрывать сплошной звук нельзя — на склейке щелчок.
    reach = max(0, int(cfg["edgeExtendSeconds"] / level.hop))
    steps = 0
    while steps < reach and level.loud(i - 1):
        i -= 1
        steps += 1
    steps = 0
    while steps < reach and level.loud(j + 1):
        j += 1
        steps += 1
    return [level.time(i), level.time(j + 1)]


def split_inner_silence(level, a, b, cfg):
    """Делит интервал по провалам громкости внутри него.

    Пауза между фразами видна и без этого, а провал внутри реплики раньше
    оставался: интервал строился от первого слова до последнего целиком.
    """
    parts, start, quiet = [], None, None
    for i in range(level.index(a), level.index(b) + 1):
        if level.loud(i):
            if quiet is not None and (i - quiet) * level.hop >= cfg["innerSilenceSeconds"] and start is not None:
                parts.append([start, level.time(quiet)])
                start = None
            quiet = None
            if start is None:
                start = level.time(i)
        elif quiet is None:
            quiet = i
    if start is not None:
        parts.append([start, level.time(quiet) if quiet is not None else b])
    return [p for p in parts if p[1] > p[0]]


def silence_runs(level, a, b, minimum):
    """Провалы громкости внутри интервала длиннее заданного."""
    runs, quiet = [], None
    for i in range(level.index(a), level.index(b) + 1):
        if level.loud(i):
            if quiet is not None and (i - quiet) * level.hop >= minimum:
                runs.append([level.time(quiet), level.time(i)])
            quiet = None
        elif quiet is None:
            quiet = i
    if quiet is not None and (level.index(b) + 1 - quiet) * level.hop >= minimum:
        runs.append([level.time(quiet), b])
    return runs


def glued_words(words, level, cfg):
    """Слова, в которые проход по всему файлу склеил соседний дубль.

    Одной длительности мало: растянутым бывает и обычное протяжное «я». Признак
    склейки — что внутри слова есть пауза: живое слово молчания не содержит.
    """
    suspects = []
    for w in words:
        if w["end"] - w["start"] <= cfg["maxWordSeconds"]:
            continue
        if silence_runs(level, w["start"], w["end"], cfg["retakeSilenceSeconds"]):
            suspects.append(w)
    return suspects


def retake_pieces(level, a, b, cfg):
    """Делит реплику на заходы по паузам, годным для перезахода.

    Куски короче минимального не распознаются отдельно: на обрывке в две доли
    секунды модель придумывает слова, которых в записи нет.
    """
    edges = [float(a)] + [t for run in silence_runs(level, a, b, cfg["retakeSilenceSeconds"]) for t in run] + [float(b)]
    raw = [[edges[i], edges[i + 1]] for i in range(0, len(edges) - 1, 2)]
    pieces = []
    for piece_a, piece_b in raw:
        if pieces and pieces[-1][1] - pieces[-1][0] < cfg["minimumRetakeSeconds"]:
            pieces[-1][1] = piece_b
        else:
            pieces.append([piece_a, piece_b])
    if len(pieces) > 1 and pieces[-1][1] - pieces[-1][0] < cfg["minimumRetakeSeconds"]:
        pieces[-2][1] = pieces.pop()[1]
    return pieces


def reexamine_phrases(model, wav, words, level, cfg, ffmpeg):
    """Переслушивает реплики со склеенными словами заход за заходом.

    Целиком такой участок модель слышит как одно длинное слово; разбитый по
    паузам, он распознаётся как то, чем является, — два захода на одну фразу.
    """
    clarified = []
    for suspect in glued_words(words, level, cfg):
        phrase = next((p for p in split_phrases(words, cfg)
                       if p[0]["start"] <= suspect["start"] and suspect["end"] <= p[-1]["end"]), None)
        if not phrase:
            continue
        a, b = phrase[0]["start"], phrase[-1]["end"]
        pieces = retake_pieces(level, a, b, cfg)
        if len(pieces) < 2:
            continue
        found = []
        for piece_a, piece_b in pieces:
            found += best_transcription(model, wav, max(0.0, piece_a - 0.05), piece_b + 0.05, cfg, ffmpeg,
                                        " ".join(w["word"] for w in phrase))
        if not found:
            continue
        words = sorted([w for w in words if w["end"] <= a or w["start"] >= b] + found, key=lambda w: w["start"])
        clarified.append({"start": round(a, 2), "end": round(b, 2), "pieces": len(pieces),
                          "was": suspect["word"], "text": " ".join(w["word"] for w in found)})
    return words, clarified


def rate_takes(phrases, cfg):
    """Из повторных заходов на фразу оставляем один — самый полный.

    Раньше дубли только отмечались, и человек вырезал их руками. Но оборванный
    заход монтажу не нужен никогда: держим последний завершённый вариант,
    остальные уносим в отчёт, чтобы их можно было вернуть через --keep.
    """

    def plain(phrase):
        return [re.sub(r"[^\w]", "", w["word"].lower()) for w in phrase]

    def norm(phrase):
        return " ".join(x for x in plain(phrase) if x)

    dropped, pairs = set(), []
    for i, a in enumerate(phrases):
        if i in dropped:
            continue
        for j in range(i + 1, min(len(phrases), i + 1 + cfg["duplicateLookahead"])):
            if j in dropped:
                continue
            b = phrases[j]
            text_a, text_b = norm(a), norm(b)
            if len(text_a) < 8 or len(text_b) < 8:
                continue
            ratio = difflib.SequenceMatcher(None, text_a, text_b).ratio()
            prefix = 0
            for x, y in zip(plain(a), plain(b)):
                if x != y or not x:
                    break
                prefix += 1
            if ratio < cfg["duplicateSimilarity"] and prefix < cfg["duplicatePrefixWords"]:
                continue
            loser = i if len(b) >= len(a) else j
            pairs.append({"similarity": round(ratio, 2), "sameOpeningWords": prefix,
                          "removed": "first" if loser == i else "second",
                          "first": {"start": round(a[0]["start"], 2), "end": round(a[-1]["end"], 2), "text": text_a},
                          "second": {"start": round(b[0]["start"], 2), "end": round(b[-1]["end"], 2), "text": text_b}})
            if cfg["dropDuplicateTakes"]:
                dropped.add(loser)
            if loser == i:
                break
    return dropped, pairs


def plan_cuts(duration, phrases, dropped, keep_unknown, level, speech_db, cfg):
    """Оставляем звучащую речь; тишина и призвуки уходят.

    Порядок такой: берём границы каждой уцелевшей реплики по звуку, режем
    провалы внутри неё, добавляем одинаковый небольшой запас с краёв. Запас
    никогда не выходит за пределы существующей тишины, поэтому склейка не
    создаёт паузы длиннее той, что была в записи.
    """
    keep = []
    for i, phrase in enumerate(phrases):
        if i in dropped:
            continue
        bounds = speech_bounds(level, phrase[0]["start"], phrase[-1]["end"], cfg)
        if bounds:
            keep += split_inner_silence(level, bounds[0], bounds[1], cfg)
    keep += [[max(0.0, a), min(duration, b)] for a, b in keep_unknown]
    keep = merge(keep)
    padded = []
    for i, (a, b) in enumerate(keep):
        lead = cfg["openingPaddingSeconds"] if i == 0 else cfg["leadPadSeconds"]
        tail = cfg["endingPaddingSeconds"] if i == len(keep) - 1 else cfg["tailPadSeconds"]
        previous = padded[-1][1] if padded else 0.0
        following = keep[i + 1][0] if i + 1 < len(keep) else duration
        padded.append([max(previous, a - lead, 0.0), min(following, b + tail, duration)])
    keep, joined = merge(padded), []
    for span in keep:
        if joined and span[0] - joined[-1][1] < cfg["minimumCutSeconds"]:
            joined[-1][1] = span[1]
        else:
            joined.append(span)
    keep = joined
    return [span for span in keep
            if span[1] - span[0] >= cfg["minimumSpeechSeconds"]
            and level.looks_like_speech(span[0], span[1], speech_db, cfg)]


def adaptive_threshold(levels, cfg):
    """Порог тишины из самой записи, а не одно число на все видео.

    Фиксированные -35 dBFS подходят не каждой записи: у тихого микрофона они
    срезают концы слов, у громкого оставляют призвуки рта. Берём фон и уровень
    речи этого файла и ставим порог между ними, ближе к фону.
    """
    usable = sorted(x for x in levels if x > -119)
    if len(usable) < 20:
        return float(cfg["silenceDb"]), None

    def percentile(p):
        return usable[min(len(usable) - 1, max(0, int(len(usable) * p / 100)))]

    floor, speech = percentile(10), percentile(90)
    threshold = floor + (speech - floor) * cfg["silenceThresholdRatio"]
    # Никогда не подбираемся к уровню речи и не опускаемся в самый фон.
    threshold = min(max(threshold, floor + 6), speech - 10)
    return round(threshold, 1), {"noiseFloorDb": round(floor, 1), "speechDb": round(speech, 1)}


def silence_from_envelope(times, levels, threshold, minimum_seconds, duration):
    """Промежутки, где уровень держится ниже порога дольше минимальной паузы."""
    spans, start = [], None
    for i, (t, level) in enumerate(zip(times, levels)):
        if level < threshold:
            if start is None:
                start = t
        elif start is not None:
            if t - start >= minimum_seconds:
                spans.append([start, t])
            start = None
    if start is not None and duration - start >= minimum_seconds:
        spans.append([start, duration])
    return spans


def dead_air(keeps, times, levels, threshold, cfg):
    """Проверка уже собранной нарезки: не остался ли внутри кусков провал.

    Считаем по исходным координатам оставленных интервалов — если там есть
    тишина длиннее допустимой, значит вырезано не всё.
    """
    found = []
    for a, b in keeps:
        window = [(t, l) for t, l in zip(times, levels) if a <= t < b]
        start = None
        for t, level in window:
            if level < threshold:
                if start is None:
                    start = t
            elif start is not None:
                if t - start >= cfg["deadAirSeconds"]:
                    found.append([round(start, 2), round(t, 2)])
                start = None
        if start is not None and b - start >= cfg["deadAirSeconds"]:
            found.append([round(start, 2), round(b, 2)])
    return found


def loud_spans(a, b, silence):
    """Части интервала [a, b], которые silencedetect не признал тишиной."""
    spans, cursor = [], a
    for s, e in merge(silence):
        if e <= a or s >= b:
            continue
        if s > cursor:
            spans.append([cursor, min(s, b)])
        cursor = max(cursor, e)
    if cursor < b:
        spans.append([cursor, b])
    return [x for x in spans if x[1] - x[0] > 0.01]


def speech_gaps(duration, words, silence, cfg):
    """Промежутки без распознанных слов, в которых звук громче тишины.

    Это либо речь, которую модель пропустила, либо призвуки рта на стыках фраз.
    Различаем по длительности: короткое — призвук, длинное — кандидат в речь.
    """
    edges = [0.0] + [w["end"] for w in words]
    starts = [w["start"] for w in words] + [duration]
    gaps = []
    for prev_end, next_start in zip(edges, starts):
        if next_start - prev_end < cfg["recoverMissedSpeechSeconds"]:
            continue
        spans = loud_spans(prev_end, next_start, silence)
        audible = sum(b - a for a, b in spans)
        if audible >= cfg["unrecognizedKeepSeconds"]:
            gaps.append({"start": round(prev_end, 2), "end": round(next_start, 2),
                         "audibleSeconds": round(audible, 2),
                         "spans": [[round(a, 2), round(b, 2)] for a, b in spans]})
    return gaps


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
    # Профили, записанные прошлыми версиями, читаются дальше: недостающие ключи
    # берём из значений по умолчанию, а не падаем на KeyError.
    cfg = {**DEFAULTS, **json.loads((ROOT / "editing-profile.json").read_text(encoding="utf-8-sig"))}
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
    model = None
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
    times, levels, zcr = pcm_levels(folder / "speech.wav", args.ffmpeg, cfg["levelWindowSeconds"], cfg["levelHopSeconds"])
    if cfg["silenceThresholdMode"] == "fixed":
        threshold, measured = float(cfg["silenceDb"]), None
    else:
        threshold, measured = adaptive_threshold(levels, cfg)
    level = Level(times, levels, zcr, threshold, cfg["levelHopSeconds"])
    speech_level = (measured or {}).get("speechDb", threshold + 30)
    silences = silence_from_envelope(times, levels, threshold, cfg["minimumSilenceSeconds"], duration)
    spoken = [l for t, l in zip(times, levels) if any(w["start"] <= t <= w["end"] for w in words)]
    audio_report = {"silenceThresholdDb": threshold, "mode": cfg["silenceThresholdMode"],
                    "speechWindowsBelowThresholdPct": round(100 * sum(1 for x in spoken if x < threshold) / max(1, len(spoken)), 1),
                    **(measured or {})}
    print(f"   порог тишины {threshold} dB (фон {audio_report.get('noiseFloorDb', '?')}, речь {audio_report.get('speechDb', '?')})", flush=True)
    # Модель может целиком пропустить фразу при проходе по всему файлу — особенно
    # повтор уже сказанного. Такой участок остаётся без субтитров, но звучит, и
    # прежняя логика держала его в монтаже как «не тишину». Проходим по громким
    # промежуткам отдельным запросом: короткий отрывок распознаётся надёжнее.
    gaps = speech_gaps(duration, words, silences, cfg)
    recovered, unrecognized = [], []
    if gaps and not args.transcript:
        for gap in gaps:
            before = " ".join(w["word"] for w in words if w["end"] <= gap["start"])[-200:]
            found = best_transcription(model, folder / "speech.wav", gap["start"], gap["end"], cfg, args.ffmpeg, before)
            if found:
                words += found
                recovered.append({**gap, "text": " ".join(w["word"] for w in found)})
            else:
                unrecognized.append(gap)
        if recovered:
            words = sorted(words, key=lambda w: w["start"])
            save(folder / "words-original.json", words)
            print(f"   восстановлено пропущенных фрагментов речи: {len(recovered)}", flush=True)
    else:
        unrecognized = gaps
    # Нераспознанное оставляем в монтаже: вырезать можно только то, в чём уверены.
    keep_unknown = [span for gap in unrecognized for span in gap["spans"]
                    if span[1] - span[0] >= cfg["unrecognizedKeepSeconds"]]
    # Второй источник ошибок — не пропуск, а склейка: два захода на фразу
    # приходят одним растянутым словом. Такие реплики переслушиваем по кускам.
    clarified = []
    if not args.transcript:
        words, clarified = reexamine_phrases(model, folder / "speech.wav", words, level, cfg, args.ffmpeg)
        if clarified:
            save(folder / "words-original.json", words)
            print(f"   переслушано склеенных реплик: {len(clarified)}", flush=True)
    phrases = split_phrases(words, cfg)
    dropped, duplicates = rate_takes(phrases, cfg)
    if dropped:
        print(f"   убрано повторных заходов на фразу: {len(dropped)}", flush=True)
    keeps = plan_cuts(duration, phrases, dropped, keep_unknown, level, speech_level, cfg)
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
        # Сцена — либо готовый материал, либо анимация проекта из src/scenes.
        # Второе нужно, чтобы расстановку графики можно было описать файлом,
        # а не править сгенерированную композицию руками.
        if scene.get('component'):
            name = scene['component']
            if not re.fullmatch(r'[A-Z][A-Za-z0-9]*', name) or not (ROOT / 'src' / 'scenes' / f'{name}.tsx').is_file():
                raise RuntimeError(f"Unknown scene component: {name}")
            continue
        asset = Path(scene['asset']).resolve()
        if not asset.is_file() or asset.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mov'):
            raise RuntimeError(f"Unsupported or missing scene asset: {asset}")
        filename = f'visual-{i}{asset.suffix.lower()}'
        shutil.copy2(asset, folder / filename)
        scene['publicAsset'] = prefix + filename
    split_expression = ' || '.join(f'(frame>={round(s["start"]*fps)} && frame<{round(s["end"]*fps)})' for s in scenes) or 'false'
    lines = ["import {AbsoluteFill, Interactive, Sequence, staticFile, interpolate, Easing, useCurrentFrame, getRemotionEnvironment} from 'remotion';", "import {Video, Audio} from '@remotion/media';", "import {ProjectGuides} from '../ProjectGuides';", *( ["import {Img} from 'remotion';"] if any(s.get('publicAsset','').lower().endswith(('.png','.jpg','.jpeg','.webp')) for s in scenes) else []), *(["import {Backdrop} from '../scenes/Backdrop';"] if scenes else []), *[f"import {{{name}}} from '../scenes/{name}';" for name in sorted({s['component'] for s in scenes if s.get('component')})], "export const ImportedVideo = ({showGuides=true,fullScreenExplanation=false,lightTheme=false,colorGrade=true}:{showGuides?:boolean;fullScreenExplanation?:boolean;lightTheme?:boolean;colorGrade?:boolean}) => {", "const frame=useCurrentFrame();", f"const active={split_expression}; const split=active&&!fullScreenExplanation;", "return <AbsoluteFill showInTimeline={false} style={{background:'#111',fontFamily:'Inter'}}>", f'<Sequence name="Субтитры • раскрыть" durationInFrames={{{total}}} style={{{{zIndex:2}}}}>']
    for caption_index, c in enumerate(captions):
        a = max(0, round(c["startMs"] * fps / 1000)); b = min(total, max(a + 1, round(c["endMs"] * fps / 1000)))
        if caption_index == 0 and a <= math.ceil(fps * 0.12):
            a = 0
        text = html.escape(c["text"])
        lines.append(f'<Interactive.Div name="{text}" from={{{a}}} durationInFrames={{{b-a}}} style={{{{position:"absolute",left:"50%",top:active&&fullScreenExplanation?1420:split?960:{cfg["captionY"]},translate:"-50% -50%",width:"max-content",maxWidth:850,fontFamily:{json.dumps(cfg["captionFont"])},fontSize:{cfg["captionSize"]},lineHeight:1.1,color:"white",textAlign:"center",background:"rgba(0,0,0,.88)",padding:"20px",borderRadius:24}}}}>{text}</Interactive.Div>')
    lines += ['</Sequence>']
    for i, scene in enumerate(scenes):
        a, b = round(scene['start']*fps), round(scene['end']*fps)
        if scene.get('component'):
            body = f'<{scene["component"]}/>'
        else:
            tag = 'Video' if scene['publicAsset'].endswith(('.mp4','.mov')) else 'Img'
            muted = ' muted' if tag == 'Video' else ''
            body = f'<{tag} src={{staticFile({json.dumps(scene["publicAsset"])})}}{muted} style={{{{width:"100%",height:"100%",objectFit:"contain"}}}}/>'
        lines += [f'<Sequence name="Объяснение {i+1} • визуализация" from={{{a}}} durationInFrames={{{b-a}}} style={{{{zIndex:1}}}}>', '<div style={{position:"absolute",width:1080,height:fullScreenExplanation?1920:960,overflow:"hidden"}}>', '<Backdrop light={lightTheme}/>', f'<Interactive.Div name="Материал {i+1} • масштаб и ключи" durationInFrames={{{b-a}}} style={{{{position:"absolute",left:96,top:fullScreenExplanation?460:254,width:888,height:fullScreenExplanation?800:660,scale:1,translate:"0px 0px",opacity:1}}}}>', body, '</Interactive.Div></div></Sequence>']
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
    registry_file = add_entry(ROOT, ident, total, fps, cfg)
    # Separate authored nodes and lines are necessary for Studio's source editing.
    run([shutil.which("node") or "node", ROOT / "node_modules/prettier/bin/prettier.cjs", "--write", generated / f"{ident}.tsx", registry_file])
    report = {"composition": ident, "reviewRequired": ["Проверить первое слово и вдохи", "Прослушать каждую склейку", "Проверить текст и смысловые пары субтитров", "Настроить кадрирование и уровень глаз", "Проверить убранные дубли в duplicateTakes: вернуть нужный вариант можно через --keep", "Для объяснений указать таймкод и материал: скриншот, запись экрана или схема. До этого камера с акцентом, без выдуманных карточек."], "captions": captions, "removed": removed, "visualScenes": scenes, "recoveredSpeech": recovered, "clarifiedPhrases": clarified, "unrecognizedLoud": unrecognized, "duplicateTakes": duplicates, "audio": audio_report, "deadAir": dead_air(keeps, times, levels, threshold, cfg)}
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
