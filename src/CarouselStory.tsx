import {
  AbsoluteFill,
  Interactive,
  interpolate,
  staticFile,
  Img,
  useCurrentFrame,
} from "remotion";
import { motionPresets } from "./MotionExamples";
const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
const m = (f: number, a: number, b: number, x: number, y: number) =>
  interpolate(f, [a, b], [x, y], { ...clamp, easing: motionPresets.morph });
export const CarouselStory = () => {
  const f = useCurrentFrame(),
    light = f >= 48 && f < 220;
  return (
    <AbsoluteFill
      style={{
        background: light ? "#eef1f5" : "#141920",
        fontFamily: "Inter",
        color: light ? "#182431" : "#eef3fa",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: light
            ? "linear-gradient(#45678b0d 1px,transparent 1px),linear-gradient(90deg,#45678b0d 1px,transparent 1px)"
            : "linear-gradient(#b5cbea10 1px,transparent 1px),linear-gradient(90deg,#b5cbea10 1px,transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />
      <AbsoluteFill
        style={{
          background: light
            ? "radial-gradient(ellipse at center,#fff9,transparent 70%)"
            : "radial-gradient(ellipse at center,#658fba40,transparent 70%)",
        }}
      />
      {f < 220 && (
        <>
          <Interactive.Div
            name="Morph • текст превращается в слайд"
            style={{
              position: "absolute",
              left: m(f, 48, 98, 140, 195),
              top: m(f, 48, 98, 675, 495),
              width: m(f, 48, 98, 800, 690),
              height: m(f, 48, 98, 450, 790),
              borderRadius: m(f, 48, 98, 24, 40),
              background: light ? "#fff" : "#222a35",
              border: "1px solid #8099b440",
              boxShadow: "0 30px 90px #0002",
              overflow: "hidden",
              scale: interpolate(f, [0, 18], [0.93, 1], {
                ...clamp,
                easing: motionPresets.smooth,
              }),
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 55,
                top: 55,
                display: "flex",
                gap: 16,
                opacity: 1 - m(f, 48, 76, 0, 1),
              }}
            >
              <Img
                src={staticFile("openai-official.svg")}
                style={{ width: 38, height: 38 }}
              />
              <span style={{ fontSize: 30 }}>Текст слайдов</span>
            </div>
            <div
              style={{
                position: "absolute",
                left: 55,
                top: m(f, 48, 98, 150, 65),
                fontSize: m(f, 48, 98, 40, 62),
                fontWeight: 600,
                width: 560,
              }}
            >
              {"Как собрать карусель".slice(
                0,
                Math.max(0, Math.floor(f / 1.7)),
              )}
            </div>
            <div
              style={{
                position: "absolute",
                left: 55,
                top: m(f, 48, 98, 245, 260),
                width: m(f, 48, 98, 600, 580),
                height: m(f, 48, 98, 12, 285),
                borderRadius: m(f, 48, 98, 6, 26),
                background: "#aac5e4",
                opacity: interpolate(f, [24, 40], [0, 1], clamp),
              }}
            >
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 580 285"
                style={{ opacity: m(f, 70, 100, 0, 1) }}
              >
                <rect
                  x="120"
                  y="65"
                  width="140"
                  height="170"
                  rx="18"
                  fill="#edf4ff"
                  transform="rotate(-9 190 150)"
                />
                <rect
                  x="250"
                  y="38"
                  width="170"
                  height="210"
                  rx="18"
                  fill="#fff"
                />
                <path
                  d="M280 88H380M280 115H365M280 145H390M280 175H360"
                  stroke="#658bb4"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div
              style={{
                position: "absolute",
                left: 55,
                top: m(f, 48, 98, 285, 600),
                width: m(f, 145, 182, 450, 555),
                height: 14,
                borderRadius: 7,
                background: f >= 180 ? "#77a98f" : "#a2abb6",
                opacity: m(f, 30, 45, 0, 1),
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 55,
                top: m(f, 48, 98, 325, 645),
                width: 390,
                height: 14,
                borderRadius: 7,
                background: "#c5cdd6",
                opacity: m(f, 35, 48, 0, 1),
              }}
            />
            {f >= 150 && (
              <Interactive.Div
                name="Bounce • правка подтверждена"
                style={{
                  position: "absolute",
                  right: 32,
                  bottom: 30,
                  width: 75,
                  height: 75,
                  borderRadius: 40,
                  background: "#d9eee2",
                  scale: interpolate(f, [150, 178], [0.2, 1], {
                    ...clamp,
                    easing: motionPresets.bounce,
                  }),
                }}
              >
                <svg viewBox="0 0 75 75">
                  <path
                    d="M20 38L32 50 55 25"
                    fill="none"
                    stroke="#3d8061"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Interactive.Div>
            )}
          </Interactive.Div>
          {f >= 138 && f < 185 && (
            <svg
              width="90"
              height="90"
              viewBox="0 0 60 60"
              style={{
                position: "absolute",
                left: m(f, 138, 175, 870, 730),
                top: m(f, 138, 175, 1200, 1100),
              }}
            >
              <path
                d="M8 5L13 49 25 34 43 32Z"
                fill="#273849"
                stroke="white"
                strokeWidth="3"
              />
            </svg>
          )}
        </>
      )}
      {f >= 220 && f < 290 && (
        <Interactive.Div
          name="Bounce • 500 подписчиков"
          style={{
            position: "absolute",
            left: 140,
            top: 700,
            width: 800,
            textAlign: "center",
            scale: interpolate(f, [220, 242], [0.7, 1], {
              ...clamp,
              easing: motionPresets.bounce,
            }),
          }}
        >
          <div style={{ fontSize: 210, fontWeight: 600, letterSpacing: -12 }}>
            500
          </div>
          <div style={{ fontSize: 46, color: "#b6cce3" }}>подписчиков</div>
          <svg
            width="460"
            height="130"
            viewBox="0 0 460 130"
            style={{ marginTop: 40 }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <g
                key={i}
                opacity={m(f, 240 + i * 5, 249 + i * 5, 0, 1)}
                transform={`translate(${i * 90},0)`}
              >
                <circle cx="45" cy="30" r="20" fill="#aac7e6" />
                <path d="M10 108V93C10 52 80 52 80 93V108" fill="#aac7e6" />
              </g>
            ))}
          </svg>
        </Interactive.Div>
      )}
      {f >= 290 && (
        <Interactive.Div
          name="Morph • видео становится каруселью"
          style={{
            position: "absolute",
            left: 140,
            top: 525,
            width: 800,
            height: 760,
          }}
        >
          {[0, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: m(f, 411, 457, 240, i === 0 ? 0 : 515),
                top: 100,
                width: 285,
                height: 500,
                borderRadius: 28,
                background: "#dce8f6",
                rotate: `${m(f, 411, 457, 0, i === 0 ? -9 : 9)}deg`,
                opacity: m(f, 403, 427, 0, 1),
                boxShadow: "0 20px 50px #0005",
              }}
            >
              <div
                style={{
                  margin: 35,
                  height: 130,
                  background: "#90b4d8",
                  borderRadius: 18,
                }}
              />
              <div
                style={{
                  margin: 35,
                  height: 12,
                  background: "#8c9fb2",
                  borderRadius: 6,
                }}
              />
              <div
                style={{
                  margin: 35,
                  width: 130,
                  height: 12,
                  background: "#b3c0cd",
                  borderRadius: 6,
                }}
              />
            </div>
          ))}
          <div
            style={{
              position: "absolute",
              left: m(f, 407, 461, 170, 245),
              top: m(f, 407, 461, 0, 40),
              width: m(f, 407, 461, 460, 310),
              height: m(f, 407, 461, 730, 540),
              borderRadius: 32,
              background: "#fff",
              boxShadow: "0 28px 60px #0006",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 25,
                borderRadius: 20,
                background: "#aac5e1",
                height: m(f, 407, 461, 680, 235),
              }}
            />
            <svg
              viewBox="0 0 100 100"
              style={{
                position: "absolute",
                width: 100,
                top: 260,
                left: "50%",
                translate: "-50% 0",
                opacity: 1 - m(f, 409, 437, 0, 1),
              }}
            >
              <path d="M30 15L80 50 30 85Z" fill="white" />
            </svg>
            <div
              style={{
                position: "absolute",
                top: 300,
                left: 35,
                right: 35,
                opacity: m(f, 435, 466, 0, 1),
              }}
            >
              <div
                style={{ height: 16, background: "#43678d", borderRadius: 8 }}
              />
              <div
                style={{
                  height: 12,
                  background: "#b3c2d2",
                  borderRadius: 8,
                  marginTop: 25,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: "70%",
                  background: "#b3c2d2",
                  borderRadius: 8,
                  marginTop: 20,
                }}
              />
            </div>
          </div>
        </Interactive.Div>
      )}
    </AbsoluteFill>
  );
};
