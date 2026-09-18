import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { at, blink, typed } from "./motion";
import { accent, palette, type as typo } from "./tokens";

// Текст как объект в кадре, а не подпись под ним.
//
// Разбор `references/incognito.md`: там ни одна надпись не появляется просто
// так. Заголовок главы выводится целиком, а потом в нём выделяется ровно то
// слово, на которое падает ударение в речи, — курсор встаёт перед словом,
// протягивает по нему выделение и оставляет круглые маркеры, как в текстовом
// поле. Приём работает по двум причинам:
//
//   1. Зритель уже тысячу раз делал это сам. Движение читается без объяснения,
//      и взгляд идёт туда, куда его ведут, а не туда, где ярче.
//   2. Ударение в кадре совпадает с ударением в речи. Слово «учёбы» слышно и
//      видно одновременно — это и есть визуализация смысла, а не украшение.
//
// Выделять можно только то слово, которое звучит прямо сейчас. Выделение
// «для красоты» ломает приём: зритель ждёт, что подсвеченное слово важно.

const PICK_ALPHA = "38";

/**
 * Заголовок, в котором одно слово выделяется, как в текстовом поле.
 *
 * `head` — то, что остаётся обычным, `pick` — слово под выделением. Тайминг
 * в кадрах от `from`: 0 — надпись пришла, 6 — курсор встал перед словом,
 * 12–24 — выделение протянулось, дальше стоит с маркерами.
 */
export const SelectedText = ({
  head,
  pick,
  from = 0,
  light = false,
  tone = accent,
  size = typo.headline.fontSize,
  style,
}: {
  head: string;
  pick: string;
  from?: number;
  light?: boolean;
  tone?: string;
  size?: number;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = palette(light);
  const show = at(frame, from, from + 8);
  // Курсор стоит и мигает, пока о слове только заговорили, и гаснет, как
  // только пошло выделение: два мигающих объекта в кадре спорят друг с другом.
  const caretOnly = frame >= from + 6 && frame < from + 12;
  const grown = at(frame, from + 12, from + 24);
  const handles = at(frame, from + 22, from + 30);

  return (
    <div
      style={{
        ...typo.headline,
        fontSize: size,
        color: c.text,
        display: "flex",
        alignItems: "baseline",
        // Высота строки задана явно: полоса выделения совпадает со строкой
        // ровно так же, как в настоящем текстовом поле, а не «на глаз».
        lineHeight: 1.18,
        gap: size * 0.26,
        opacity: show,
        translate: `0px ${(1 - show) * 14}px`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span>{head}</span>
      <span style={{ position: "relative", display: "inline-block", paddingLeft: size * 0.06 }}>
        {/* Полоса выделения растёт слева направо, её правый край и есть курсор. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${(grown * 100).toFixed(2)}%`,
            minWidth: caretOnly || grown > 0 ? 3 : 0,
            background: grown > 0 ? tone + PICK_ALPHA : "transparent",
            borderRight: caretOnly || grown > 0 ? `3px solid ${tone}` : "none",
            opacity: caretOnly ? blink(frame, fps) : 1,
          }}
        />
        {/* Круглые маркеры концов — то, за что в текстовом поле тянут пальцем. */}
        <div
          style={{
            position: "absolute",
            left: -size * 0.065,
            top: -size * 0.065,
            width: size * 0.13,
            height: size * 0.13,
            borderRadius: 999,
            background: tone,
            opacity: caretOnly ? blink(frame, fps) : Math.max(handles, grown),
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${(grown * 100).toFixed(2)}%`,
            bottom: -size * 0.065,
            marginLeft: -size * 0.065,
            width: size * 0.13,
            height: size * 0.13,
            borderRadius: 999,
            background: tone,
            opacity: handles,
          }}
        />
        <span style={{ position: "relative" }}>{pick}</span>
      </span>
    </div>
  );
};

/**
 * Кусок фразы, подсвеченный внутри абзаца.
 *
 * В референсе так помечают то слово в длинной команде, ради которого команду и
 * показывают: остальное можно не читать. Подсветка тонкая — фон и два
 * вертикальных края; заливка в полный цвет превратила бы абзац в плашку.
 */
export const Mark = ({
  children,
  from = 0,
  tone = accent,
  style,
}: {
  children: React.ReactNode;
  from?: number;
  tone?: string;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const on = at(frame, from, from + 8);
  return (
    <span
      style={{
        position: "relative",
        color: on > 0.5 ? tone : "inherit",
        background: tone + Math.round(on * 0x2e).toString(16).padStart(2, "0"),
        boxShadow: "inset " + (2 * on).toFixed(1) + "px 0 0 " + tone + ", inset -" + (2 * on).toFixed(1) + "px 0 0 " + tone,
        padding: "0.06em 0.12em",
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/**
 * Текст, который набирается на глазах, с мигающим курсором.
 *
 * Показывать готовую команду целиком нельзя: зритель принимает её за подпись и
 * не читает. Пока текст набирается, он читается сам собой — и ровно с той
 * скоростью, с какой о нём говорят. `perSecond` подбирается под фразу: текст
 * должен закончиться вместе с ней, а не раньше и не позже.
 */
export const Typed = ({
  text,
  from = 0,
  perSecond = 26,
  light = false,
  keepCaret = false,
  style,
}: {
  text: string;
  from?: number;
  perSecond?: number;
  light?: boolean;
  keepCaret?: boolean;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const count = typed(frame, from, perSecond, fps, text.length);
  const done = count >= text.length;
  return (
    <span style={{ color: palette(light).text, ...style }}>
      {text.slice(0, count)}
      {done && !keepCaret ? null : (
        <span
          style={{
            display: "inline-block",
            width: "0.08em",
            height: "1.05em",
            marginLeft: "0.04em",
            verticalAlign: "text-bottom",
            background: accent,
            opacity: done ? blink(frame, fps) : 1,
          }}
        />
      )}
    </span>
  );
};
