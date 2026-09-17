import {
  AbsoluteFill,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { motionPresets } from "./MotionExamples";
const ease = {
  easing: motionPresets.smooth,
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
export const PromptExamples = () => {
  const f = useCurrentFrame(),
    start = f < 148 ? 0 : f < 282 ? 148 : 282,
    t = f - start;
  const resultAt = f < 148 ? 79 : f < 282 ? 205 : 342;
  const command =
    f < 148 ? "/3dbillboard" : f < 282 ? "/handwriter" : "/metaads";
  const asset = f < 148 ? "billboard" : f < 282 ? "diagram" : "product";
  if (f >= 425) return null;
  return (
    <AbsoluteFill
      style={{
        height: 960,
        overflow: "hidden",
        background: "radial-gradient(ellipse at 50% 48%,#293746,#13181e 75%)",
        fontFamily: "Tahoma",
        color: "white",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(#b8d6f010 1px,transparent 1px),linear-gradient(90deg,#b8d6f010 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {f < resultAt ? (
        <Interactive.Div
          name="ChatGPT • ввод команды"
          style={{
            position: "absolute",
            left: 120,
            top: 265,
            width: 840,
            height: 405,
            borderRadius: 30,
            background: "#202123",
            border: "1px solid #ffffff24",
            boxShadow: "0 22px 55px #0005",
            scale: interpolate(t, [0, 16], [0.94, 1], ease),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: 35,
              fontSize: 35,
            }}
          >
            <Img
              src={staticFile("openai-official.svg")}
              style={{ width: 48, height: 48 }}
            />
            ChatGPT
          </div>
          <div
            style={{
              margin: "25px 30px",
              padding: "30px 25px",
              borderRadius: 24,
              background: "#303134",
              fontSize: 48,
              height: 105,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>
              {command.slice(0, Math.max(0, Math.floor((t - 5) / 2.5)))}
              <span style={{ opacity: Math.floor(t / 10) % 2 ? 0 : 1 }}>|</span>
            </span>
            <span
              style={{
                borderRadius: 50,
                background: "#dfe6ef",
                color: "#222",
                padding: "2px 15px",
              }}
            >
              ↑
            </span>
          </div>
          <div style={{ fontSize: 23, color: "#acb3bd", marginLeft: 35 }}>
            Иллюстрация ввода
          </div>
        </Interactive.Div>
      ) : (
        <>
          <Interactive.Div
            name="Результат • smooth"
            style={{
              position: "absolute",
              left: 170,
              top: 125,
              width: 740,
              height: 740,
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 28px 65px #0007",
              scale: interpolate(
                f,
                [resultAt, resultAt + 12, resultAt + 25, resultAt + 100],
                [0.94, 1.02, 1, 1.035],
                ease,
              ),
            }}
          >
            <Img
              src={staticFile(`examples/${asset}.png`)}
              style={{ width: "100%", height: "100%" }}
            />
          </Interactive.Div>
          <div
            style={{
              position: "absolute",
              top: 65,
              left: 170,
              fontSize: 27,
              color: "#c4d0df",
            }}
          >
            {command} · пример
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
