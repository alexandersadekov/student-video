import React from "react";
import {
  Bookmark,
  Eye,
  Heart,
  MessageCircle,
  MousePointer2,
  Play,
  Send,
  Upload,
} from "lucide-react";
import { accent, card, negative, palette, radius, stroke, type as typo } from "./tokens";

// Элементы интерфейса для сцен.
//
// Иконки берём из Lucide (лицензия ISC, в LICENSES.md): это готовый набор,
// нарисованный на одной сетке 24 px с одной толщиной обводки. Самодельные
// пути этим не заменяются — именно от них графика выглядит дешёвой: у каждого
// значка свои пропорции, свой наклон и своя толщина линии.
//
// Чужие логотипы и точные копии чужих экранов в шаблон не входят: у них своя
// лицензия. Для своего ролика их кладут в папку проекта — см. README, раздел
// про apply-research.py, который скачивает материалы вместе с источником
// и условиями использования.

export { Bookmark, Eye, Heart, MessageCircle, Play, Send, Upload };

type Tone = "neutral" | "accent" | "like";

const toneColor = (tone: Tone, light: boolean) =>
  tone === "accent" ? accent : tone === "like" ? negative : palette(light).textSoft;

/** Круглая кнопка действия — та же форма, что у панели реакций в ленте. */
export const ActionButton = ({
  icon: Icon,
  size = 112,
  tone = "neutral",
  filled = false,
  light = false,
  style,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;
  size?: number;
  tone?: Tone;
  filled?: boolean;
  light?: boolean;
  style?: React.CSSProperties;
}) => {
  const color = toneColor(tone, light);
  return (
    <div
      style={{
        width: size,
        height: size,
        ...card(light),
        borderRadius: radius.round,
        // Подложку красит только акцент. У «нравится» цветной сам значок:
        // два залитых цветом пятна в кадре уже спорят друг с другом.
        borderColor: tone === "accent" ? `${color}66` : card(light).border.split(" ").slice(2).join(" "),
        background: tone === "accent" ? `${color}22` : card(light).background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <Icon size={size * 0.44} color={color} strokeWidth={stroke} fill={filled ? color : "none"} />
    </div>
  );
};

/** Основная кнопка: единственное синее пятно в кадре. */
export const PrimaryButton = ({
  children,
  icon: Icon,
  style,
}: {
  children?: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      padding: children ? "18px 32px" : 22,
      borderRadius: radius.small,
      background: accent,
      color: "#ffffff",
      ...typo.label,
      ...style,
    }}
  >
    {Icon ? <Icon size={34} color="#ffffff" strokeWidth={stroke + 0.25} /> : null}
    {children}
  </div>
);

/** Панель с заголовком — из неё собирается любая «карточка приложения». */
export const Panel = ({
  title,
  subtitle,
  children,
  light = false,
  width,
  style,
}: {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  light?: boolean;
  width?: number;
  style?: React.CSSProperties;
}) => {
  const c = palette(light);
  return (
    <div style={{ width, ...card(light, true), borderRadius: radius.panel, overflow: "hidden", ...style }}>
      {title ? (
        <div style={{ padding: "20px 26px", borderBottom: `1px solid ${c.line}` }}>
          <div style={{ ...typo.label, color: c.text }}>{title}</div>
          {subtitle ? <div style={{ ...typo.caption, color: c.textMuted, marginTop: 4 }}>{subtitle}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
};

/** Служебная подпись под объектом: «шаг 1», «через 2 часа». Всегда мелкая. */
export const StepCaption = ({ children, light = false }: { children: React.ReactNode; light?: boolean }) => (
  <div style={{ ...typo.caption, color: palette(light).textMuted, textAlign: "center" }}>{children}</div>
);

/** Курсор — он показывает, что кнопку действительно нажимают, а не она сама. */
export const Pointer = ({ pressed = false, light = false }: { pressed?: boolean; light?: boolean }) => (
  <div style={{ position: "relative", filter: "drop-shadow(0 6px 14px rgba(0,0,0,.55))" }}>
    <MousePointer2
      size={52}
      color={light ? "#10151d" : "#ffffff"}
      fill={light ? "#10151d" : "#ffffff"}
      strokeWidth={1}
    />
    {pressed ? (
      <div
        style={{
          position: "absolute",
          left: 2,
          top: 2,
          width: 46,
          height: 46,
          borderRadius: radius.round,
          border: `3px solid ${accent}`,
          opacity: 0.85,
        }}
      />
    ) : null}
  </div>
);
