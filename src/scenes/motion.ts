import { Easing, interpolate } from "remotion";

// Правила движения для всех сцен проекта. Они лежат здесь, а не повторяются в
// каждой сцене, потому что нарушение любого из них видно зрителю сразу:
//
// 1. Объект появляется мелким и вырастает. Подставленный в кадр целиком он
//    читается как опечатка монтажа, а рост глаз успевает проследить.
// 2. После появления объект не замирает. Две секунды неподвижной картинки в
//    вертикальном ролике — это пролистывание.
// 3. Всё идёт по одной кривой и в одном темпе, иначе сцена выглядит собранной
//    из разных роликов.

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** Значение от a до b на отрезке кадров, без выхода за края. */
export const at = (frame: number, from: number, to: number, a = 0, b = 1) =>
  interpolate(frame, [from, to], [a, b], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** Появление: прозрачность, рост от мелкого и доворот в ноль. */
export const enter = (frame: number, start: number, length = 18) => {
  const raw = Math.min(1, Math.max(0, (frame - start) / length));
  const eased = EASE(raw);
  return {
    opacity: Math.min(1, raw * 2.2),
    // Перелёт гаснет к концу движения: объект «садится» на место, а не
    // останавливается в нём резко.
    scale: 0.55 + eased * 0.45 + Math.sin(raw * Math.PI) * 0.07,
    rotate: (1 - eased) * -7,
  };
};

/** Непрерывное покачивание: объект живой всё время, пока он в кадре. */
export const drift = (frame: number, period: number, amount: number, phase = 0) =>
  Math.sin(((frame / period) + phase) * Math.PI * 2) * amount;

/** Непрерывное вращение в градусах. */
export const spin = (frame: number, period: number) => (frame / period) * 360;

/** Толчок в момент акцента: короткий подскок масштаба и затухание. */
export const beat = (frame: number, start: number, length = 14, amount = 0.12) => {
  const raw = (frame - start) / length;
  return raw < 0 || raw > 1 ? 1 : 1 + Math.sin(raw * Math.PI) * amount * (1 - raw * 0.4);
};

export const css = (value: { opacity: number; scale: number; rotate: number }) => ({
  opacity: value.opacity,
  scale: String(value.scale),
  rotate: `${value.rotate}deg`,
});
