// Единственный источник цвета, размера и формы для сцен.
//
// Правило простое: в сцене нет ни одного числа и ни одного цвета «на глаз».
// Всё берётся отсюда. Так кадры одного ролика выглядят одной работой, а не
// набором случайных прямоугольников, и правка вкуса делается в одном файле.
//
// Цветовая политика — три уровня, больше нет:
//   1. Подложка и поверхности — нейтральные, почти без насыщенности.
//   2. Текст — три ступени контраста: главное, пояснение, служебное.
//   3. Акцент — ОДИН на ролик, и только на том объекте, о котором идёт речь
//      прямо сейчас. Как только акцентных пятен два, кадр перестаёт вести взгляд.
// Красный и зелёный — не украшение: только «нельзя» и «получилось».

export const dark = {
  ground: "#0b0c0e",
  surface: "rgba(255,255,255,.055)",
  surfaceSolid: "#15171b",
  line: "rgba(255,255,255,.09)",
  lineStrong: "rgba(255,255,255,.16)",
  grid: "rgba(180,200,227,.07)",
  text: "#f2f4f7",
  textSoft: "rgba(242,244,247,.56)",
  textMuted: "rgba(242,244,247,.32)",
} as const;

export const light = {
  ground: "#f4f5f7",
  surface: "rgba(16,22,32,.04)",
  surfaceSolid: "#ffffff",
  line: "rgba(16,22,32,.1)",
  lineStrong: "rgba(16,22,32,.18)",
  grid: "rgba(68,101,139,.1)",
  text: "#10151d",
  textSoft: "rgba(16,21,29,.6)",
  textMuted: "rgba(16,21,29,.38)",
} as const;

/** Акцент один на ролик. Остальные — только по смыслу, не для красоты. */
export const accent = "#2d8cff";
export const positive = "#35c66b";
export const negative = "#ff4d6d";

export const palette = (isLight = false) => (isLight ? light : dark);

/** Шаг сетки: отступы и размеры берутся отсюда, промежуточных значений нет. */
export const step = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128] as const;

export const radius = { small: 14, card: 24, panel: 32, round: 999 } as const;

/** Толщина обводки иконок на сетке 24 px — одна на весь проект. */
export const stroke = 1.75;

export const type = {
  caption: { fontSize: 26, fontWeight: 500, letterSpacing: "0.01em" },
  label: { fontSize: 34, fontWeight: 500, letterSpacing: "-0.005em" },
  title: { fontSize: 46, fontWeight: 600, letterSpacing: "-0.015em" },
  headline: { fontSize: 64, fontWeight: 600, letterSpacing: "-0.02em" },
} as const;

/** Две ступени глубины: поверхность и то, что над ней. Третьей нет. */
export const shadow = {
  flat: "inset 0 1px 0 rgba(255,255,255,.07)",
  raised: "inset 0 1px 0 rgba(255,255,255,.09), 0 24px 60px rgba(0,0,0,.5)",
} as const;

export const card = (isLight = false, raised = false) => {
  const c = palette(isLight);
  return {
    background: c.surface,
    border: `1px solid ${c.line}`,
    borderRadius: radius.card,
    boxShadow: raised ? shadow.raised : shadow.flat,
  } as const;
};
