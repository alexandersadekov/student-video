import React from "react";
import { useCurrentFrame } from "remotion";
import { Plus, Send } from "lucide-react";
import { arrive, at, drift, pushIn } from "./motion";
import { accent, palette, radius, shadow, step, stroke, type as typo } from "./tokens";

// Окно приложения: то, о чём говорят, показано само, а не описано плашкой.
//
// Разбор `references/incognito.md`. Когда речь идёт про кнопку, пункт меню или
// набранную команду, в кадре появляется окно и в нём происходит ровно то, что
// звучит: открывается меню, нажимается пункт, набирается текст. Порядок
// действий в окне совпадает с порядком слов во фразе — это и есть вся логика.
//
// Три вещи, без которых приём не работает:
//
//   1. Окно приходит из расфокуса, мелким, и всё время медленно наезжает. Пока
//      оно размыто, зритель слушает; когда оно резкое — смотрит. Замершее окно
//      в вертикальном ролике равно пролистыванию.
//   2. В окне происходит одно действие за раз, и каждое — на своём слове.
//      Два одновременных изменения зритель не успевает разобрать.
//   3. Нажатие показывается нажатием: кольцо на кнопке, потом результат.
//      Пункт, который «сам» подсветился, читается как ошибка рендера.
//
// Чужого логотипа и чужого названия в окне нет: это форма окна, а не копия
// конкретного продукта. Точный интерфейс — только по референсу и только в
// личном ролике, см. README про `scripts/apply-research.py`.

const DOTS = ["#ff5f57", "#febc2e", "#28c840"];

/** Окно с полосой заголовка. Приходит из расфокуса и всё время наезжает. */
export const AppWindow = ({
  title,
  children,
  sidebar,
  from = 0,
  hold = 150,
  width = 760,
  height = 940,
  light = true,
  style,
}: {
  title?: string;
  children?: React.ReactNode;
  sidebar?: React.ReactNode;
  from?: number;
  hold?: number;
  width?: number;
  height?: number;
  light?: boolean;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const c = palette(light);
  const come = arrive(frame, from, 12);
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        borderRadius: radius.card,
        overflow: "hidden",
        background: c.surfaceSolid,
        border: `1px solid ${c.line}`,
        boxShadow: shadow.raised,
        opacity: come.opacity,
        filter: come.filter,
        scale: String(come.scale * pushIn(frame, from, hold)),
        translate: `0px ${drift(frame, 150, 5).toFixed(2)}px`,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: step[1],
          padding: `0 ${step[3]}px`,
          height: 56,
          flexShrink: 0,
          background: light ? "rgba(16,22,32,.05)" : "rgba(255,255,255,.05)",
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        {DOTS.map((d) => (
          <div key={d} style={{ width: 13, height: 13, borderRadius: 999, background: d }} />
        ))}
        {title ? (
          <div style={{ ...typo.caption, color: c.textSoft, marginLeft: step[2] }}>{title}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {sidebar ? (
          <div
            style={{
              width: 220,
              flexShrink: 0,
              borderRight: `1px solid ${c.line}`,
              background: light ? "rgba(16,22,32,.03)" : "rgba(255,255,255,.03)",
              padding: step[2],
            }}
          >
            {sidebar}
          </div>
        ) : null}
        <div style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * Список пунктов меню: строки приходят по одной, одна оказывается нужной.
 *
 * `picked` — индекс пункта, о котором идёт речь; он подсвечивается не сразу, а
 * на `pickAt`, то есть на том слове, где его называют.
 */
export const MenuList = ({
  items,
  from = 0,
  picked,
  pickAt = 0,
  light = true,
  style,
}: {
  items: { label: string; icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> }[];
  from?: number;
  picked?: number;
  pickAt?: number;
  light?: boolean;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const c = palette(light);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: step[1],
        borderRadius: radius.small,
        background: light ? "rgba(16,22,32,.04)" : "rgba(255,255,255,.05)",
        border: `1px solid ${c.line}`,
        ...style,
      }}
    >
      {items.map((item, i) => {
        const show = at(frame, from + i * 3, from + i * 3 + 8);
        const on = i === picked ? at(frame, pickAt, pickAt + 7) : 0;
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: step[2],
              padding: `${step[1]}px ${step[2]}px`,
              borderRadius: radius.small - 4,
              background: on > 0 ? `${accent}22` : "transparent",
              color: on > 0.5 ? accent : c.textSoft,
              ...typo.caption,
              fontWeight: on > 0.5 ? 600 : typo.caption.fontWeight,
              opacity: show,
              translate: `${(1 - show) * -10}px 0px`,
            }}
          >
            {Icon ? <Icon size={26} color={on > 0.5 ? accent : c.textMuted} strokeWidth={stroke} /> : null}
            {item.label}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Кольцо нажатия: расходится от кнопки и гаснет.
 *
 * Без него пункт меню открывается «сам», и зритель не понимает, что именно
 * надо повторить у себя.
 */
export const Ripple = ({ from, size = 74, tone = accent }: { from: number; size?: number; tone?: string }) => {
  const frame = useCurrentFrame();
  const grow = at(frame, from, from + 14);
  if (frame < from || grow >= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: 999,
        border: `3px solid ${tone}`,
        scale: String(0.4 + grow * 0.9),
        opacity: 1 - grow,
      }}
    />
  );
};

/** Строка ввода внизу окна: кнопка вложения, поле и отправка. */
export const Composer = ({
  children,
  chip,
  chipFrom = 0,
  plusPressedAt,
  active = false,
  light = true,
  style,
}: {
  children?: React.ReactNode;
  chip?: string;
  chipFrom?: number;
  plusPressedAt?: number;
  active?: boolean;
  light?: boolean;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const c = palette(light);
  const chipOn = chip ? at(frame, chipFrom, chipFrom + 10) : 0;
  return (
    <div
      style={{
        margin: step[3],
        padding: step[2],
        borderRadius: radius.small,
        background: light ? "rgba(16,22,32,.04)" : "rgba(255,255,255,.05)",
        border: `1px solid ${active ? accent : c.line}`,
        ...style,
      }}
    >
      <div style={{ ...typo.caption, color: c.text, minHeight: 34, lineHeight: 1.45 }}>
        {children ?? <span style={{ color: c.textMuted }}>Спросите что-нибудь</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: step[1], marginTop: step[2] }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Plus size={28} color={c.textMuted} strokeWidth={stroke} />
          {plusPressedAt === undefined ? null : <Ripple from={plusPressedAt} size={58} />}
        </div>
        {chipOn > 0 ? (
          <div
            style={{
              ...typo.caption,
              fontSize: 22,
              padding: "6px 14px",
              borderRadius: 999,
              background: accent,
              color: "#ffffff",
              opacity: chipOn,
              scale: String(0.7 + chipOn * 0.3),
            }}
          >
            {chip}
          </div>
        ) : null}
        <div style={{ flex: 1 }} />
        <Send size={28} color={c.textMuted} strokeWidth={stroke} />
      </div>
    </div>
  );
};

/** Реплика в переписке: своя справа, ответ слева. */
export const Bubble = ({
  children,
  mine = false,
  from = 0,
  light = true,
  style,
}: {
  children: React.ReactNode;
  mine?: boolean;
  from?: number;
  light?: boolean;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const c = palette(light);
  const show = at(frame, from, from + 9);
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "78%",
        padding: `${step[2]}px ${step[3]}px`,
        borderRadius: radius.card,
        background: mine ? accent : light ? "rgba(16,22,32,.05)" : "rgba(255,255,255,.06)",
        color: mine ? "#ffffff" : c.text,
        ...typo.caption,
        lineHeight: 1.45,
        opacity: show,
        translate: `0px ${(1 - show) * 16}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
