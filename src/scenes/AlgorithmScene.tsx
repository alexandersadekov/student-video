import { Interactive, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { at, beat, css, drift, enter } from "./motion";
import {
  ActionButton,
  Eye,
  Heart,
  MessageCircle,
  Panel,
  Play,
  Pointer,
  PrimaryButton,
  Send,
  StepCaption,
  Upload,
} from "./ui";
import { accent, palette, radius, stroke, type as typo } from "./tokens";

// «Значит, после того как мы загружаем контент, алгоритм наблюдает, как люди
// реагируют на нашу публикацию.»
//
// Порядок кадра повторяет порядок фразы: сначала само действие — курсор
// нажимает кнопку загрузки, — и только потом то, что из него следует. Раньше
// публикация просто «появлялась», и глагол «загружаем» оставался без картинки:
// зритель слышал действие, а видел результат.
//
// Это схема механики, а не снимок приложения: чужой интерфейс и логотип имеют
// свою лицензию и в шаблон не входят.

const PUBLISH_IN = 4;
const POINTER_IN = 14;
const PRESS_AT = 30;
const SEND_AT = 40;
const NODE_IN = 55;
const VIEWERS_IN = 79;
const SIGNAL_IN = 95;
const SPREAD_IN = 137;

const VIEWERS = [
  { icon: Heart, tone: "like" as const, filled: true },
  { icon: MessageCircle, tone: "accent" as const, filled: false },
  { icon: Send, tone: "accent" as const, filled: false },
  { icon: Heart, tone: "like" as const, filled: true },
  { icon: MessageCircle, tone: "accent" as const, filled: false },
];

const NODE_X = 444;

export const AlgorithmScene = ({ light = false }: { light?: boolean }) => {
  const frame = useCurrentFrame();
  const c = palette(light);

  const panel = enter(frame, PUBLISH_IN, 20);
  const pointer = enter(frame, POINTER_IN, 14);
  const pressed = frame >= PRESS_AT && frame < PRESS_AT + 10;
  const sent = at(frame, SEND_AT, SEND_AT + 26);
  const node = enter(frame, NODE_IN, 18);
  const spread = at(frame, SPREAD_IN, SPREAD_IN + 34);

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: "Inter", color: c.text }}>
      <Sequence from={PUBLISH_IN} durationInFrames={40}>
        <Audio src={staticFile("soft-move.wav")} volume={0.3} />
      </Sequence>
      <Sequence from={PRESS_AT} durationInFrames={20}>
        <Audio src={staticFile("soft-tick.wav")} volume={0.5} />
      </Sequence>
      <Sequence from={SIGNAL_IN} durationInFrames={40}>
        <Audio src={staticFile("soft-move.wav")} volume={0.26} />
      </Sequence>

      {/* Шаг 1. Загрузка: карточка публикации и настоящее нажатие кнопки. */}
      <Interactive.Div
        name="Шаг 1 • загрузка контента"
        style={{
          position: "absolute",
          left: 244,
          top: 10,
          width: 400,
          ...css(panel),
          scale: String(panel.scale * (1 - sent * 0.42)),
          translate: `0px ${sent * -120 + drift(frame, 130, 4)}px`,
          opacity: panel.opacity * (1 - sent * 0.5),
        }}
      >
        <Panel light={light} width={400}>
          <div
            style={{
              height: 176,
              margin: 18,
              borderRadius: radius.small,
              background: c.surface,
              border: `1px solid ${c.line}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={62} color={c.textMuted} strokeWidth={stroke} />
          </div>
          <div style={{ padding: "0 18px 20px" }}>
            <PrimaryButton icon={Upload} style={{ scale: String(beat(frame, PRESS_AT, 14, 0.08)) }}>
              опубликовать
            </PrimaryButton>
          </div>
        </Panel>
      </Interactive.Div>

      <Interactive.Div
        name="Курсор • нажатие"
        style={{
          position: "absolute",
          left: 486,
          top: 286,
          ...css(pointer),
          opacity: pointer.opacity * (1 - sent),
          translate: `${at(frame, POINTER_IN, PRESS_AT, 120, 0)}px ${at(frame, POINTER_IN, PRESS_AT, 90, 0) + (pressed ? 5 : 0)}px`,
        }}
      >
        <Pointer pressed={pressed} light={light} />
      </Interactive.Div>

      <Interactive.Div
        name="Подпись шага"
        style={{ position: "absolute", left: 244, top: 372, width: 400, opacity: panel.opacity * (1 - sent) }}
      >
        <StepCaption light={light}>шаг 1 — публикация</StepCaption>
      </Interactive.Div>

      {/* Шаг 2. Зрители: те же кнопки, что и в любой ленте. */}
      <Interactive.Div
        name="Шаг 2 • зрители реагируют"
        style={{ position: "absolute", left: 0, top: 288, width: 888, display: "flex", justifyContent: "center", gap: 24 }}
      >
        {VIEWERS.map((viewer, i) => {
          const start = VIEWERS_IN + i * 6;
          const state = enter(frame, start, 14);
          const tap = start + 16;
          const active = frame >= tap;
          return (
            <div
              key={i}
              style={{
                ...css(state),
                scale: String(state.scale * beat(frame, tap, 16, 0.18)),
                translate: `0px ${drift(frame, 110, 5, i * 0.2)}px`,
              }}
            >
              <ActionButton
                icon={viewer.icon}
                size={124}
                light={light}
                tone={active ? viewer.tone : "neutral"}
                filled={active && viewer.filled}
              />
            </div>
          );
        })}
      </Interactive.Div>

      <Interactive.Div name="Сигналы реакции • путь к алгоритму" style={{ position: "absolute", left: 0, top: 428, width: 888, height: 190 }}>
        <svg width="888" height="190" viewBox="0 0 888 190">
          {VIEWERS.map((_, i) => {
            const x = 114 + i * 154;
            const progress = at(frame, SIGNAL_IN + i * 7, SIGNAL_IN + 46 + i * 7);
            return (
              <g key={i}>
                <path
                  d={`M${x} 4 C ${x} 92, ${NODE_X} 92, ${NODE_X} 178`}
                  fill="none"
                  stroke={`${accent}44`}
                  strokeWidth="3"
                  strokeDasharray="420"
                  strokeDashoffset={420 * (1 - progress)}
                />
                <circle
                  cx={x + (NODE_X - x) * progress}
                  cy={4 + 174 * progress * progress}
                  r={8 + drift(frame, 28, 1.5, i * 0.3)}
                  fill={accent}
                  opacity={progress > 0.04 && progress < 0.99 ? 1 : 0}
                />
              </g>
            );
          })}
        </svg>
      </Interactive.Div>

      {/* Шаг 3. Алгоритм — единственный узел, который иконкой не объясняется,
          поэтому у него есть подпись. У остальных её нет намеренно. */}
      <Interactive.Div
        name="Шаг 3 • алгоритм"
        style={{
          position: "absolute",
          left: 264,
          top: 616,
          width: 360,
          height: 122,
          background: c.surface,
          border: `1px solid ${spread > 0.1 ? `${accent}99` : c.line}`,
          borderRadius: radius.panel,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          ...css(node),
          scale: String(node.scale * beat(frame, SIGNAL_IN + 46, 20, 0.09) * (1 + spread * 0.04)),
        }}
      >
        <div style={{ display: "flex", scale: String(1 + drift(frame, 46, 0.06)) }}>
          <Eye size={46} color={accent} strokeWidth={stroke} />
        </div>
        <span style={{ ...typo.title, color: c.text }}>алгоритм</span>
      </Interactive.Div>

      {/* «Показывается на…» — фраза в записи обрывается, поэтому и здесь только
          расширение охвата, без дорисованного вывода. */}
      <Interactive.Div
        name="Показ дальше • расширение охвата"
        style={{ position: "absolute", left: 0, top: 754, width: 888, display: "flex", justifyContent: "center", gap: 18, opacity: spread }}
      >
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const on = at(frame, SPREAD_IN + i * 5, SPREAD_IN + 16 + i * 5);
          return (
            <div
              key={i}
              style={{
                width: 20,
                height: 20,
                borderRadius: radius.round,
                background: accent,
                opacity: 0.22 + 0.78 * on,
                scale: String(0.6 + 0.4 * on + drift(frame, 40, 0.06, i * 0.25)),
              }}
            />
          );
        })}
      </Interactive.Div>
    </div>
  );
};
