import { Interactive, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { at, beat, css, drift, enter, spin } from "./motion";
import { ActionButton, Eye, Heart, Send, StepCaption, Upload } from "./ui";
import { accent, palette } from "./tokens";

// «Знаете ли вы, что есть особое время, когда нужно публиковать контент, чтобы
// обмануть алгоритм и получить больше просмотров?»
//
// Сутки кольцом, внутри них — окно публикации, к концу реплики рост охвата.
// Подписей нет: слова в этот момент звучат голосом и стоят в субтитрах, а
// вторая копия того же текста на экране просто съедает кадр. Цифр тоже нет —
// настоящих у сцены не было, а нарисованные читаются как данные.
//
// Синим горит только то, о чём идёт речь прямо сейчас: сначала окно суток,
// потом кнопка, потом кривая. Два акцентных пятна одновременно уводят взгляд.

const RADIUS = 178;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const WINDOW_FROM = 20;
const WINDOW_TO = 67;
const WINDOW_MID = ((WINDOW_FROM + WINDOW_TO) / 2 - 90) * (Math.PI / 180);
const TURN = 100;     // кадров на полный оборот стрелки
const RING_TOP = 165; // кольцо стоит по центру блока, пока кривой ещё нет

const RING_IN = 0;
const WINDOW_IN = 26;
const PUBLISH_IN = 53;
const CURVE_IN = 102;
const REACTION_IN = 138;

const REACTIONS = [
  { icon: Eye, tone: "accent" as const, filled: false },
  { icon: Heart, tone: "like" as const, filled: true },
  { icon: Send, tone: "accent" as const, filled: false },
];

export const BestTimeScene = ({ light = false }: { light?: boolean }) => {
  const frame = useCurrentFrame();
  const c = palette(light);

  const ring = enter(frame, RING_IN, 22);
  const hand = -90 + spin(frame, TURN);
  const handDeg = (((hand + 90) % 360) + 360) % 360;
  const inside = handDeg > WINDOW_FROM && handDeg < WINDOW_TO;
  const windowArc = at(frame, WINDOW_IN, WINDOW_IN + 26);
  const glow = windowArc * (inside ? 1 : 0.5);
  const curve = at(frame, CURVE_IN, CURVE_IN + 52);
  // Когда снизу приходит кривая, кольцо уходит вверх и уменьшается: в кадре
  // всегда есть движение, и оба объекта помещаются без наложения.
  const lift = at(frame, CURVE_IN, CURVE_IN + 34, 0, -150);
  const shrink = at(frame, CURVE_IN, CURVE_IN + 34, 1, 0.8);
  const publish = enter(frame, PUBLISH_IN, 16);

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: "Inter", color: c.text }}>
      <Sequence from={RING_IN} durationInFrames={40}>
        <Audio src={staticFile("soft-move.wav")} volume={0.3} />
      </Sequence>
      <Sequence from={37} durationInFrames={20}>
        <Audio src={staticFile("soft-tick.wav")} volume={0.42} />
      </Sequence>
      <Sequence from={CURVE_IN} durationInFrames={40}>
        <Audio src={staticFile("soft-move.wav")} volume={0.28} />
      </Sequence>

      <Interactive.Div
        name="Сутки • кольцо и стрелка"
        style={{
          position: "absolute",
          left: 209,
          top: RING_TOP,
          width: 470,
          height: 470,
          ...css(ring),
          scale: String(ring.scale * shrink),
          translate: `0px ${lift + drift(frame, 150, 5)}px`,
        }}
      >
        <svg width="470" height="470" viewBox="0 0 470 470">
          <circle cx="235" cy="235" r={RADIUS} fill="none" stroke={c.line} strokeWidth="16" />
          {/* Деления медленно поворачиваются: кольцо живёт, пока идёт стрелка. */}
          <g transform={`rotate(${spin(frame, 1400)} 235 235)`}>
            {Array.from({ length: 24 }, (_, i) => {
              const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
              const inner = RADIUS - 28;
              const hour = i % 6 === 0;
              return (
                <line
                  key={i}
                  x1={235 + Math.cos(angle) * inner}
                  y1={235 + Math.sin(angle) * inner}
                  x2={235 + Math.cos(angle) * (inner - (hour ? 20 : 10))}
                  y2={235 + Math.sin(angle) * (inner - (hour ? 20 : 10))}
                  stroke={hour ? c.textSoft : c.textMuted}
                  strokeWidth={hour ? 4 : 2}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
          <circle
            cx="235"
            cy="235"
            r={RADIUS}
            fill="none"
            stroke={accent}
            strokeWidth={16 + glow * 8}
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE * ((WINDOW_TO - WINDOW_FROM) / 360) * windowArc} ${CIRCUMFERENCE}`}
            strokeDashoffset={-CIRCUMFERENCE * (WINDOW_FROM / 360)}
            transform="rotate(-90 235 235)"
            opacity={0.45 + glow * 0.55}
          />
          <line
            x1="235"
            y1="235"
            x2={235 + Math.cos((hand * Math.PI) / 180) * (RADIUS - 46)}
            y2={235 + Math.sin((hand * Math.PI) / 180) * (RADIUS - 46)}
            stroke={c.text}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle cx="235" cy="235" r="12" fill={c.text} />
        </svg>
      </Interactive.Div>

      <Interactive.Div
        name="Кнопка публикации • на окне суток"
        style={{
          position: "absolute",
          left: 444 + Math.cos(WINDOW_MID) * (RADIUS + 82) - 56,
          top: RING_TOP + 235 + Math.sin(WINDOW_MID) * (RADIUS + 82) - 56,
          ...css(publish),
          scale: String(publish.scale * shrink * beat(frame, 137, 16, 0.16)),
          translate: `${drift(frame, 120, 5)}px ${lift + drift(frame, 96, 5, 0.3)}px`,
        }}
      >
        <ActionButton icon={Upload} size={112} tone="accent" light={light} />
      </Interactive.Div>

      <Interactive.Div
        name="Рост охвата • кривая"
        style={{
          position: "absolute",
          left: 64,
          top: 462,
          width: 760,
          height: 200,
          opacity: at(frame, CURVE_IN, CURVE_IN + 14),
          scale: String(0.88 + at(frame, CURVE_IN, CURVE_IN + 26) * 0.12),
        }}
      >
        <svg width="760" height="200" viewBox="0 0 760 200">
          <line x1="0" y1="188" x2="760" y2="188" stroke={c.line} strokeWidth="3" />
          <path
            d="M0 178 C 200 174, 348 156, 454 116 S 642 30, 752 12"
            fill="none"
            stroke={accent}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="960"
            strokeDashoffset={960 * (1 - curve)}
          />
          <circle
            cx={curvePoint(curve).x}
            cy={curvePoint(curve).y}
            r={15 + drift(frame, 34, 2.5)}
            fill={accent}
            opacity={curve > 0.04 ? 1 : 0}
          />
        </svg>
      </Interactive.Div>

      <Interactive.Div
        name="Реакции • кнопки"
        style={{ position: "absolute", left: 0, top: 664, width: 888, display: "flex", justifyContent: "center", gap: 34 }}
      >
        {REACTIONS.map((reaction, i) => {
          const start = REACTION_IN + i * 9;
          const state = enter(frame, start, 14);
          const active = frame >= start + 10;
          return (
            <div
              key={i}
              style={{
                ...css(state),
                scale: String(state.scale * beat(frame, start + 10, 14, 0.18)),
                translate: `0px ${drift(frame, 100, 5, i * 0.25)}px`,
              }}
            >
              <ActionButton
                icon={reaction.icon}
                size={112}
                light={light}
                tone={active ? reaction.tone : "neutral"}
                filled={active && reaction.filled}
              />
            </div>
          );
        })}
      </Interactive.Div>

      <Interactive.Div
        name="Подпись окна"
        style={{ position: "absolute", left: 0, top: 790, width: 888, opacity: at(frame, REACTION_IN + 24, REACTION_IN + 40) }}
      >
        <StepCaption light={light}>охват растёт, когда публикация попала в окно</StepCaption>
      </Interactive.Div>
    </div>
  );
};

/** Точка на кривой охвата — чтобы маркер ехал по линии, а не рядом с ней. */
function curvePoint(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  return { x: clamped * 752, y: 178 - Math.pow(clamped, 1.7) * 166 };
}
