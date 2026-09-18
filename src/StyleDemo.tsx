import {
  AbsoluteFill,
  Interactive,
  Sequence,
  staticFile,
  Img,
  useCurrentFrame,
  getRemotionEnvironment,
} from "remotion";
import { ProjectGuides } from "./ProjectGuides";

// Витрина двух стилей без чужого материала: вместо камеры — заглушка, вместо
// иллюстрации — пример из public/examples. Координаты повторяют то, что
// scripts/import-video.py генерирует для настоящих роликов, поэтому демо
// показывает реальную компоновку, а не приблизительную схему.
const SCENE_FROM = 50;
const SCENE_TO = 150;

const CAPTIONS = [
  { text: "смотрите", from: 0, duration: 50 },
  { text: "вот так", from: 50, duration: 50 },
  { text: "это работает", from: 100, duration: 50 },
  { text: "и мы вернулись", from: 150, duration: 50 },
];

export const StyleDemo = ({
  showGuides = true,
  fullScreenExplanation = false,
  lightTheme = false,
}: {
  showGuides?: boolean;
  fullScreenExplanation?: boolean;
  lightTheme?: boolean;
}) => {
  const frame = useCurrentFrame();
  const active = frame >= SCENE_FROM && frame < SCENE_TO;
  const split = active && !fullScreenExplanation;

  return (
    <AbsoluteFill
      showInTimeline={false}
      style={{ background: "#111", fontFamily: "Inter" }}
    >
      <Sequence
        name="Субтитры • раскрыть"
        durationInFrames={200}
        style={{ zIndex: 2 }}
      >
        {CAPTIONS.map((caption) => (
          <Interactive.Div
            key={caption.text}
            name={caption.text}
            from={caption.from}
            durationInFrames={caption.duration}
            style={{
              position: "absolute",
              left: "50%",
              top: active && fullScreenExplanation ? 1420 : split ? 960 : 1280,
              translate: "-50% -50%",
              width: "max-content",
              maxWidth: 850,
              fontFamily: "Inter",
              fontSize: 73,
              lineHeight: 1.1,
              color: "white",
              textAlign: "center",
              background: "rgba(0,0,0,.88)",
              padding: "20px",
              borderRadius: 24,
            }}
          >
            {caption.text}
          </Interactive.Div>
        ))}
      </Sequence>

      <Sequence
        name="Объяснение • визуализация"
        from={SCENE_FROM}
        durationInFrames={SCENE_TO - SCENE_FROM}
        style={{ zIndex: 1 }}
      >
        <div
          style={{
            position: "absolute",
            width: 1080,
            height: fullScreenExplanation ? 1920 : 960,
            background: lightTheme ? "#f6f7f9" : "#0c1118",
          }}
        >
          <Interactive.Div
            name="Материал • масштаб и ключи"
            durationInFrames={SCENE_TO - SCENE_FROM}
            style={{
              position: "absolute",
              left: 96,
              top: fullScreenExplanation ? 560 : 254,
              width: 888,
              height: fullScreenExplanation ? 800 : 660,
              scale: 1,
              translate: "0px 0px",
              opacity: 1,
            }}
          >
            <Img
              src={staticFile("examples/diagram.png")}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </Interactive.Div>
        </div>
      </Sequence>

      <div
        style={{
          position: "absolute",
          top: split ? 960 : 0,
          left: 0,
          width: 1080,
          height: split ? 960 : 1920,
          opacity: active && fullScreenExplanation ? 0 : 1,
          overflow: "hidden",
        }}
      >
        <Interactive.Div
          name="Камера • здесь ваше видео"
          durationInFrames={200}
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(160deg,#2b3340,#171c24)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Inter",
              fontSize: 44,
              color: "#8ea0b8",
              textAlign: "center",
              lineHeight: 1.4,
              padding: "0 120px",
            }}
          >
            Здесь ваше видео
            <br />
            после IMPORT-VIDEO.cmd
          </div>
        </Interactive.Div>
      </div>

      <Sequence
        name="Направляющие • НЕ ЭКСПОРТ"
        durationInFrames={200}
        style={{ zIndex: 20, pointerEvents: "none" }}
      >
        {showGuides && !getRemotionEnvironment().isRendering ? (
          <ProjectGuides opacity={0.4} />
        ) : null}
      </Sequence>
    </AbsoluteFill>
  );
};
