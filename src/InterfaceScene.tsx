import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { CalendarClock, Image, Sparkles, Users } from "lucide-react";
import { Backdrop } from "./scenes/Backdrop";
import { Emoji } from "./scenes/chips";
import { Mark, SelectedText, Typed } from "./scenes/text";
import { AppWindow, Bubble, Composer, MenuList } from "./scenes/window";
import { beat, css, drift, enter } from "./scenes/motion";
import { palette, type as typo } from "./scenes/tokens";

// Витрина второго набора: текст и интерфейс в движении.
//
// Открывается в студии как Scene-Interface. Здесь показано не «что умеет
// компонент», а порядок, ради которого всё это и сделано: сначала звучит
// слово — потом ровно оно происходит в кадре.
//
//   реплика                          кадр
//   «лучшее ВРЕМЯ для публикации»    заголовок, выделение ложится на «время»
//   «открываешь меню»                окно приходит из расфокуса, жмём «+»
//   «выбираешь запланировать»        пункт подсвечивается, в строке — плашка
//   «пишешь подпись»                 текст набирается, ключевое помечено
//   «и он отвечает»                  приходит ответ
//
// Разбор, из которого это выведено, — references/incognito.md.

const MENU = [
  { label: "Фото и видео", icon: Image },
  { label: "Отметить людей", icon: Users },
  { label: "Запланировать", icon: CalendarClock },
  { label: "Подобрать обложку", icon: Sparkles },
];

const ACT2 = 96;
const ACT3 = 252;

export const InterfaceScene = ({ light = false }: { light?: boolean }) => {
  const frame = useCurrentFrame();
  const c = palette(light);

  return (
    <AbsoluteFill style={{ fontFamily: "Inter", color: c.text }}>
      <Backdrop light={light} />

      {/* Акт 1. Заголовок главы: выделение ложится на слово под ударением. */}
      <Sequence from={0} durationInFrames={ACT2 + 12} layout="none">
        <Act1 light={light} />
      </Sequence>

      {/* Акт 2. Окно и меню: нажатие показано нажатием. */}
      <Sequence from={ACT2} durationInFrames={ACT3 - ACT2 + 12} layout="none">
        <Act2 light={light} />
      </Sequence>

      {/* Акт 3. Набор текста: команда читается, пока её печатают. */}
      <Sequence from={ACT3} layout="none">
        <Act3 light={light} />
      </Sequence>

      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 72,
          width: 1080,
          textAlign: "center",
          ...typo.caption,
          color: c.textMuted,
          opacity: frame < 20 ? 0 : 1,
        }}
      >
        Scene-Interface — выделение, окно, набор текста
      </div>
    </AbsoluteFill>
  );
};

const Act1 = ({ light }: { light: boolean }) => {
  const frame = useCurrentFrame();
  const state = enter(frame, 6, 18);
  const out = frame > 84 ? (frame - 84) / 12 : 0;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 56,
        opacity: 1 - out,
        filter: out > 0 ? `blur(${out * 12}px)` : "none",
        scale: String(1 - out * 0.06),
      }}
    >
      <div
        style={{
          ...css(state),
          scale: String(state.scale * beat(frame, 26, 16, 0.08)),
          translate: `0px ${drift(frame, 110, 9)}px`,
          rotate: `${drift(frame, 150, 4)}deg`,
        }}
      >
        <Emoji name="alarm_clock" size={230} />
      </div>
      <SelectedText head="Лучшее" pick="время" from={14} light={light} size={86} />
    </div>
  );
};

const Act2 = ({ light }: { light: boolean }) => {
  const frame = useCurrentFrame();
  const out = frame > 144 ? (frame - 144) / 12 : 0;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 1 - out,
        filter: out > 0 ? `blur(${out * 12}px)` : "none",
      }}
    >
      <AppWindow title="Публикация" from={0} hold={150} width={760} height={1020} light={!light}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 24 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...typo.label,
              color: palette(!light).textMuted,
            }}
          >
            Черновик
          </div>
          {/* Меню открывается после нажатия на «+», а не одновременно с ним. */}
          {frame >= 42 ? (
            <MenuList items={MENU} from={42} picked={2} pickAt={78} light={!light} style={{ width: "100%" }} />
          ) : null}
        </div>
        <Composer light={!light} plusPressedAt={34} chip="через 2 часа" chipFrom={96} />
      </AppWindow>
    </div>
  );
};

const Act3 = ({ light }: { light: boolean }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <AppWindow title="Публикация" from={0} hold={170} width={760} height={1020} light={!light}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: 24, overflow: "hidden" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...typo.label,
              color: palette(!light).textMuted,
            }}
          >
            Черновик
          </div>
          {frame >= 108 ? (
            <Bubble from={108} light={!light}>
              Поставил на <Mark from={120}>19:40</Mark> — в это время ваши подписчики в сети.
            </Bubble>
          ) : null}
        </div>
        <Composer light={!light} active={frame > 16}>
          <Typed text="Напомни за час и подбери обложку по первому кадру" from={20} perSecond={17} light={!light} />
        </Composer>
      </AppWindow>
    </div>
  );
};
