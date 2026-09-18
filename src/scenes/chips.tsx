import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { at, beat, css, drift, enter } from "./motion";
import { accent, palette, radius, type as typo } from "./tokens";
import { LOCAL_EMOJI } from "../generated/emoji";

// База плашек: из них собирается почти любая объяснительная сцена.
//
// Плашка — это одна мысль, свёрнутая в предмет: значок слева, короткое слово,
// под ней мелкая серая подпись, откуда это взялось или зачем нужно. Больше в
// ней ничего нет, и в этом весь смысл — зритель считывает её за долю секунды,
// не отвлекаясь от голоса.
//
// Разделение ролей строгое:
//   эмодзи   — предмет разговора: время, деньги, мозг, огонь;
//   значок   — действие: нажать, отправить, посмотреть (Lucide, см. ui.tsx);
//   подпись  — происхождение или роль, всегда мелкая и приглушённая.
// Плашка без подписи допустима. Подпись, повторяющая субтитр, — нет.

export const CHIP_HEIGHT = 72;

/**
 * Объёмный эмодзи. Имя — как у файла, без расширения.
 *
 * Сначала смотрим в личный набор `public/emoji-local`: туда кладут свои
 * картинки, например вынутые из шрифта Apple. Его в git нет, поэтому у всех
 * остальных берётся общий набор из `public/emoji`.
 */
export const Emoji = ({ name, size = 40 }: { name: string; size?: number }) => (
  <Img
    src={staticFile(LOCAL_EMOJI.includes(name) ? `emoji-local/${name}.png` : `emoji/${name}.png`)}
    style={{
      width: size,
      height: size,
      objectFit: "contain",
      display: "block",
      // Общая тень сажает символы на фон и связывает набор между собой: без
      // неё часть значков читается объёмными, а часть — наклейками.
      filter: `drop-shadow(0 ${Math.round(size * 0.07)}px ${Math.round(size * 0.13)}px rgba(0,0,0,.55))`,
    }}
  />
);

export type ChipTone = "neutral" | "accent" | "filled";

/** Плашка: значок или эмодзи слева, короткое слово справа. */
export const Chip = ({
  children,
  emoji,
  icon,
  tone = "neutral",
  light = false,
  style,
}: {
  children: React.ReactNode;
  emoji?: string;
  icon?: React.ReactNode;
  tone?: ChipTone;
  light?: boolean;
  style?: React.CSSProperties;
}) => {
  const c = palette(light);
  const filled = tone === "filled";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        height: CHIP_HEIGHT,
        padding: emoji || icon ? "0 26px 0 18px" : "0 26px",
        borderRadius: radius.round,
        background: filled ? accent : c.surface,
        border: `1px solid ${tone === "accent" ? `${accent}77` : filled ? "transparent" : c.line}`,
        boxShadow: "0 10px 34px rgba(0,0,0,.42)",
        color: filled ? "#ffffff" : c.text,
        ...typo.label,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {emoji ? <Emoji name={emoji} size={40} /> : icon}
      {children}
    </div>
  );
};

/** Мелкая подпись под объектом: откуда взято или зачем нужно. */
export const Origin = ({
  children,
  light = false,
  tone = "muted",
  style,
}: {
  children: React.ReactNode;
  light?: boolean;
  tone?: "muted" | "good";
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      ...typo.caption,
      color: tone === "good" ? "#7bdc8c" : palette(light).textMuted,
      textAlign: "center",
      marginTop: 10,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Плашка вместе с подписью — то, что ставится в кадр как один объект. */
export const ChipCard = ({
  label,
  origin,
  emoji,
  icon,
  tone = "neutral",
  originTone = "muted",
  light = false,
  from = 0,
  style,
}: {
  label: React.ReactNode;
  origin?: React.ReactNode;
  emoji?: string;
  icon?: React.ReactNode;
  tone?: ChipTone;
  originTone?: "muted" | "good";
  light?: boolean;
  from?: number;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const state = enter(frame, from, 16);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        ...css(state),
        scale: String(state.scale * beat(frame, from + 12, 14, 0.06)),
        translate: `0px ${drift(frame, 120, 4, from * 0.03)}px`,
        ...style,
      }}
    >
      <Chip emoji={emoji} icon={icon} tone={tone} light={light}>
        {label}
      </Chip>
      {origin ? (
        <Origin light={light} tone={originTone}>
          {origin}
        </Origin>
      ) : null}
    </div>
  );
};

type Node = {
  label: React.ReactNode;
  origin?: React.ReactNode;
  emoji?: string;
  tone?: ChipTone;
  originTone?: "muted" | "good";
};

/**
 * Дерево плашек: пунктир идёт сверху вниз и ветвится к каждой плашке уровня.
 *
 * Линия рисуется, а не появляется целиком: зритель видит, что одно следует из
 * другого. Уровни включаются по очереди — ровно на том слове, где о них
 * говорят, поэтому шаг задаётся в кадрах, а не автоматом.
 */
export const ChipFlow = ({
  levels,
  starts,
  width = 888,
  light = false,
  rowHeight = 190,
}: {
  levels: Node[][];
  starts: number[];
  width?: number;
  light?: boolean;
  rowHeight?: number;
}) => {
  const frame = useCurrentFrame();
  const c = palette(light);
  const centre = width / 2;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width, height: levels.length * rowHeight }}>
      <svg width={width} height={levels.length * rowHeight} style={{ position: "absolute", inset: 0 }}>
        {levels.map((nodes, level) => {
          if (level === 0) return null;
          const start = starts[level] ?? 0;
          const draw = at(frame, start - 12, start + 6);
          const top = level * rowHeight - rowHeight + CHIP_HEIGHT;
          const bottom = level * rowHeight - 18;
          return nodes.map((_, i) => {
            const span = width / (nodes.length + 1);
            const x = span * (i + 1);
            const path = `M${centre} ${top} C ${centre} ${top + 46}, ${x} ${bottom - 46}, ${x} ${bottom}`;
            return (
              <path
                key={`${level}-${i}`}
                d={path}
                fill="none"
                stroke={c.lineStrong}
                strokeWidth="2"
                strokeDasharray="7 9"
                strokeDashoffset={(1 - draw) * 320}
                opacity={draw}
              />
            );
          });
        })}
      </svg>
      {levels.map((nodes, level) => (
        <div
          key={level}
          style={{
            position: "absolute",
            left: 0,
            top: level * rowHeight,
            width,
            display: "flex",
            justifyContent: "space-evenly",
            alignItems: "flex-start",
          }}
        >
          {nodes.map((node, i) => (
            <ChipCard
              key={i}
              label={node.label}
              origin={node.origin}
              emoji={node.emoji}
              tone={node.tone}
              originTone={node.originTone}
              light={light}
              from={(starts[level] ?? 0) + i * 7}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
