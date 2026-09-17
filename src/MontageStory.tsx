import {
  Interactive,
  Img,
  staticFile,
  interpolate,
  Easing,
  useCurrentFrame,
} from "remotion";
import { Video } from "@remotion/media";
import type { CSSProperties } from "react";
const easing = {
  easing: Easing.bezier(0.22, 1, 0.36, 1),
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
const motion = (f: number, a: number, b: number, x: number, y: number) =>
  interpolate(f, [a, b], [x, y], easing);
const darkGlass: CSSProperties = {
  background: "linear-gradient(145deg,#25272b,#111214 75%)",
  border: "1px solid #ffffff42",
  boxShadow: "inset 0 1px 1px #ffffff25,0 24px 65px #0008",
  borderRadius: 30,
};
const Film = () => (
  <svg width="108" height="108" viewBox="0 0 100 100" fill="none">
    <rect
      x="13"
      y="17"
      width="74"
      height="66"
      rx="13"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path d="M43 34L65 50 43 66Z" fill="currentColor" />
    <path
      d="M25 18V82M75 18V82M13 34H25M13 50H25M13 66H25M75 34H87M75 50H87M75 66H87"
      stroke="currentColor"
      strokeWidth="3"
    />
  </svg>
);
const Wave = ({ f, cut = false }: { f: number; cut?: boolean }) => (
  <svg
    viewBox="0 0 660 190"
    width="660"
    height="190"
    style={{ overflow: "visible" }}
  >
    {Array.from({ length: 55 }, (_, i) => {
      const gap = i >= 22 && i < 33;
      const closing = cut ? motion(f, 13, 36, 0, 132) : 0;
      const x = i * 12 - (i >= 33 ? closing : 0) + (cut ? closing / 2 : 0);
      const h = gap ? 5 : 24 + Math.abs(Math.sin(i * 1.79)) * 80;
      return (
        <rect
          key={i}
          x={x}
          y={95 - h / 2}
          width="5"
          height={h}
          rx="2.5"
          fill={gap ? "#666b72" : "#e2e5e9"}
          opacity={gap && cut ? 1 - motion(f, 5, 15, 0, 1) : 1}
        />
      );
    })}
    {cut && (
      <rect
        x={264 + motion(f, 13, 36, 0, 66)}
        y="25"
        width={Math.max(0, 132 - motion(f, 13, 36, 0, 132))}
        height="140"
        rx="10"
        fill="#82aefe18"
        stroke="#8bb5ff"
        strokeDasharray="5 6"
        opacity={1 - motion(f, 32, 44, 0, 1)}
      />
    )}
  </svg>
);
export const MontageStory = ({
  mode,
  lightTheme = false,
  // Путь к исходнику внутри public/. Обязателен: у сцены нет своего видео, а
  // дефолт указывал бы на файл, которого в шаблоне нет.
  sourceFile,
}: {
  mode: "edit" | "process" | "compare";
  lightTheme?: boolean;
  sourceFile: string;
}) => {
  const source = staticFile(sourceFile);
  const f = useCurrentFrame();
  // Light contrast is motivated by the subtitle demonstration, not a recurring timer.
  const light = lightTheme || (mode === "process" && f >= 118 && f < 144);
  const glass: CSSProperties = light
    ? {
        ...darkGlass,
        background: "linear-gradient(145deg,#ffffff,#e8edf4)",
        border: "1px solid #7e91ac55",
        boxShadow: "inset 0 1px 1px #fff,0 22px 60px #30496b1c",
      }
    : darkGlass;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: light ? "#eef1f6" : "#14171d",
        color: light ? "#172333" : "#f1f2f4",
        fontFamily: "Tahoma",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: light
            ? "linear-gradient(#44658b16 1px,transparent 1px),linear-gradient(90deg,#44658b16 1px,transparent 1px)"
            : "linear-gradient(#b4c8e312 1px,transparent 1px),linear-gradient(90deg,#b4c8e312 1px,transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse at 50% 48%,black 25%,transparent 85%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 480,
          width: 880,
          height: 900,
          background: light
            ? "radial-gradient(ellipse,#ffffffed 0%,#a8c9f440 40%,transparent 72%)"
            : "radial-gradient(ellipse,#759bc54a 0%,#38578326 42%,transparent 72%)",
          scale: interpolate(f, [0, 120], [0.9, 1.08], easing),
        }}
      />
      {mode === "edit" ? (
        <>
          <Interactive.Div
            name="Живое видео • приближение"
            style={{
              ...glass,
              position: "absolute",
              left: 330,
              top: 500,
              width: 420,
              height: 570,
              overflow: "hidden",
              scale: interpolate(f, [0, 16, 60], [0.84, 1, 1.03], easing),
              translate: interpolate(
                f,
                [0, 16],
                ["0px 65px", "0px 0px"],
                easing,
              ),
            }}
          >
            <Video
              src={source}
              trimBefore={275}
              muted
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                boxShadow: "inset 0 0 0 1px #ffffff30",
                borderRadius: 30,
              }}
            />
          </Interactive.Div>
          <Interactive.Div
            name="Монтаж • сборка клипов"
            style={{
              ...glass,
              position: "absolute",
              left: 142,
              top: 1105,
              width: 796,
              height: 250,
              padding: 30,
              scale: interpolate(f, [6, 25], [0.93, 1], easing),
              opacity: interpolate(f, [0, 8], [0, 1], easing),
            }}
          >
            <div style={{ display: "flex", gap: 10, height: 85 }}>
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 85,
                    marginLeft: i === 3 ? motion(f, 30, 52, 75, 0) : 0,
                    background: "linear-gradient(135deg,#747d89,#303640)",
                    border: "1px solid #ffffff35",
                    borderRadius: 9,
                    translate: `${motion(f, 5 + i * 2, 24 + i * 2, (i - 2.5) * 25, 0)}px 0px`,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M7 4L20 12 7 20Z" fill="#dce1e8" />
                  </svg>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 25,
                    borderRadius: 6,
                    background: "#8eafe3",
                    opacity: motion(f, 16 + i * 3, 24 + i * 3, 0.15, 0.9),
                  }}
                />
              ))}
            </div>
            <div
              style={{
                height: 32,
                marginTop: 15,
                overflow: "hidden",
                opacity: 0.7,
              }}
            >
              <div
                style={{
                  scale: "1 .35",
                  transformOrigin: "50% 0",
                  marginTop: -16,
                }}
              >
                <Wave f={f} />
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: motion(f, 8, 62, 32, 763),
                top: 15,
                bottom: 15,
                width: 2,
                background: "#d2e3ff",
              }}
            />
          </Interactive.Div>
        </>
      ) : mode === "process" ? (
        <>
          <Interactive.Div
            name="Процесс • центральный объект"
            style={{
              position: "absolute",
              left: 130,
              top: 650,
              width: 820,
              height: 740,
              scale: interpolate(f, [0, 18], [0.9, 1], easing),
            }}
          >
            {f < 118 && (
              <>
                <svg
                  style={{ position: "absolute", inset: 0 }}
                  width="820"
                  height="740"
                >
                  <path
                    d="M250 340C350 340 395 250 495 250"
                    fill="none"
                    stroke="#6f7784"
                    strokeWidth="2"
                    strokeDasharray="3 12"
                    opacity={motion(f, 45, 65, 0, 1)}
                  />
                  <circle
                    cx={motion(f, 53, 84, 250, 495)}
                    cy={motion(f, 53, 84, 340, 250)}
                    r="6"
                    fill="#aecaff"
                    opacity={
                      motion(f, 48, 54, 0, 1) * (1 - motion(f, 82, 91, 0, 1))
                    }
                  />
                </svg>
                <div
                  style={{
                    ...glass,
                    position: "absolute",
                    left: motion(f, 26, 58, 270, 70),
                    top: motion(f, 26, 58, 150, 245),
                    width: 280,
                    height: 310,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 20,
                    rotate: `${motion(f, 0, 20, -7, 0)}deg`,
                    scale: motion(f, 78, 100, 1, 0.84),
                    opacity: 1 - motion(f, 98, 115, 0, 1),
                  }}
                >
                  <Film />
                  <span style={{ fontSize: 27, color: "#b9bec7" }}>
                    Видео.mp4
                  </span>
                  <div
                    style={{
                      height: 3,
                      width: 150,
                      background: "#313640",
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        height: 3,
                        width: motion(f, 18, 63, 0, 150),
                        background: "#b8c9e6",
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    ...glass,
                    position: "absolute",
                    left: motion(f, 88, 115, 495, 270),
                    top: motion(f, 88, 115, 110, 150),
                    width: 280,
                    height: 310,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 16,
                    scale: motion(f, 44, 68, 0.8, 1),
                    opacity: motion(f, 44, 60, 0, 1),
                  }}
                >
                  <Img
                    src={staticFile("openai-official.svg")}
                    style={{
                      width: 160,
                      height: 160,
                      background: light ? "#1b2028" : "transparent",
                      borderRadius: 24,
                    }}
                  />
                  <span style={{ fontSize: 30 }}>ChatGPT</span>
                </div>
              </>
            )}
            {f >= 118 && f < 144 && (
              <div
                style={{
                  position: "absolute",
                  left: 80,
                  top: 200,
                  width: 660,
                  height: 260,
                  ...glass,
                  padding: 35,
                  scale: interpolate(
                    f,
                    [118, 128, 143],
                    [0.9, 1.04, 1],
                    easing,
                  ),
                }}
              >
                <Wave f={f - 118} />
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    position: "absolute",
                    left: 45,
                    bottom: 24,
                  }}
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: 25,
                        width: 90,
                        borderRadius: 7,
                        background: "#83abd7",
                        opacity: motion(f, 118 + i * 2, 123 + i * 2, 0, 1),
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {f >= 144 && f < 185 && (
              <div
                style={{
                  ...glass,
                  position: "absolute",
                  left: 30,
                  top: 140,
                  width: 760,
                  height: 360,
                  padding: "72px 50px",
                  scale: interpolate(
                    f,
                    [144, 155, 173, 184],
                    [0.94, 1.06, 1.06, 1],
                    easing,
                  ),
                }}
              >
                <Wave f={f - 144} cut />
              </div>
            )}
            {f >= 185 && (
              <div style={{ position: "absolute", inset: 0 }}>
                {[2, 1, 0].map((i) => (
                  <div
                    key={i}
                    style={{
                      ...glass,
                      position: "absolute",
                      left: 160 + i * motion(f, 185, 213, 0, 64),
                      top: 100 + i * motion(f, 185, 213, 0, 78),
                      width: 420,
                      height: 300,
                      rotate: `${motion(f, 185, 218, 0, (i - 1) * -7)}deg`,
                      scale: motion(f, 218, 246, 1, 1.045),
                    }}
                  >
                    <div style={{ margin: 25, display: "flex", gap: 9 }}>
                      {[0, 1, 2].map((j) => (
                        <div
                          key={j}
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 9,
                            background: "#ffffff40",
                          }}
                        />
                      ))}
                    </div>
                    {i === 0 ? (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <svg width="100" height="100" viewBox="0 0 100 100">
                          <path d="M30 20L77 50 30 80Z" fill="#c8d8ef" />
                        </svg>
                      </div>
                    ) : (
                      <div
                        style={{
                          margin: 30,
                          height: 130,
                          borderRadius: 13,
                          background: "linear-gradient(135deg,#424b59,#1a1e26)",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Interactive.Div>
        </>
      ) : (
        <Interactive.Div
          name="Модель • обучение на правилах"
          style={{
            position: "absolute",
            left: 150,
            top: 640,
            width: 780,
            height: 620,
            scale: interpolate(
              f,
              [0, 18, 65, 105, 122],
              [0.93, 1, 1.025, 1.045, 1.045],
              easing,
            ),
          }}
        >
          <svg
            width="780"
            height="620"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <path
              d="M150 105 Q190 265 385 265"
              fill="none"
              stroke="#9cb8dd"
              strokeWidth="2"
              strokeDasharray="4 10"
              opacity={
                motion(f, 15, 30, 0, 0.6) * (1 - motion(f, 92, 108, 0, 1))
              }
            />
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                cx={motion(f, 22 + i * 18, 48 + i * 18, 150, 390)}
                cy={motion(f, 22 + i * 18, 48 + i * 18, 105, 265)}
                r="6"
                fill="#c4dbff"
                opacity={
                  motion(f, 20 + i * 18, 25 + i * 18, 0, 1) *
                  (1 - motion(f, 45 + i * 18, 50 + i * 18, 0, 1))
                }
              />
            ))}
            <circle
              cx="390"
              cy="255"
              r={motion(f, 78, 114, 135, 220)}
              fill="none"
              stroke="#b2d2ff"
              strokeWidth="2"
              opacity={
                motion(f, 76, 82, 0, 0.55) * (1 - motion(f, 82, 116, 0, 1))
              }
            />
          </svg>
          <div
            style={{
              ...glass,
              position: "absolute",
              left: 245,
              top: 110,
              width: 290,
              height: 290,
              display: "grid",
              placeItems: "center",
              fontSize: 135,
              scale: interpolate(
                f,
                [0, 25, 76, 90, 110],
                [0.85, 1, 1.03, 1.13, 1.06],
                easing,
              ),
              opacity: motion(f, 0, 12, 0, 1),
              translate: interpolate(
                f,
                [0, 24, 65, 100],
                ["0px 25px", "0px 0px", "0px -9px", "0px 0px"],
                easing,
              ),
            }}
          >
            🧠
          </div>
          <div
            style={{
              position: "absolute",
              left: 310,
              top: 420,
              fontSize: 30,
              color: "#c9ced6",
            }}
          >
            Модель
          </div>
          <div
            style={{
              ...glass,
              position: "absolute",
              left: interpolate(f, [0, 22, 65, 100], [-35, 15, 85, 165], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              top: interpolate(f, [0, 22, 65, 100], [-15, 10, 60, 170], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              width: 220,
              height: 140,
              padding: 24,
              opacity: motion(f, 6, 20, 0, 1) * (1 - motion(f, 91, 108, 0, 1)),
              scale: motion(f, 65, 100, 1, 0.7),
            }}
          >
            <div style={{ fontSize: 38, marginBottom: 8 }}>📋</div>
            <span style={{ fontSize: 25 }}>Правила</span>
          </div>
          <div
            style={{
              position: "absolute",
              right: 75,
              top: 330,
              fontSize: 65,
              opacity: motion(f, 28, 40, 0, 1) * (1 - motion(f, 65, 90, 0, 1)),
              scale: interpolate(
                f,
                [28, 40, 49, 58],
                [0.65, 1.1, 0.97, 1],
                easing,
              ),
              translate: interpolate(
                f,
                [28, 46, 65],
                ["0px 20px", "0px 0px", "-8px -5px"],
                easing,
              ),
            }}
          >
            ⚠️
          </div>
          <div
            style={{
              position: "absolute",
              right: 130,
              top: 315,
              width: 74,
              height: 74,
              borderRadius: 74,
              background: "#c5d5ed",
              color: "#17202c",
              display: "grid",
              placeItems: "center",
              fontSize: 46,
              scale: motion(f, 96, 116, 0.5, 1),
              opacity: motion(f, 96, 109, 0, 1),
            }}
          >
            ✓
          </div>
        </Interactive.Div>
      )}
    </div>
  );
};
