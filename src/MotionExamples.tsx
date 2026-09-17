import {
  AbsoluteFill,
  Interactive,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
export const motionPresets = {
  smooth: Easing.bezier(0.16, 1, 0.3, 1),
  bounce: Easing.bezier(0.34, 1.56, 0.64, 1),
  morph: Easing.bezier(0.65, 0, 0.35, 1),
};
export const MotionExamples = () => {
  const f = useCurrentFrame() % 100,
    clamp = {
      extrapolateLeft: "clamp" as const,
      extrapolateRight: "clamp" as const,
    };
  return (
    <AbsoluteFill
      style={{
        background: "#141a22",
        color: "white",
        fontFamily: "Tahoma",
        padding: 80,
      }}
    >
      <h1 style={{ fontSize: 60 }}>Движение по смыслу</h1>
      <div style={{ position: "absolute", top: 320, left: 100, fontSize: 45 }}>
        Smooth · мягкое появление
      </div>
      <Interactive.Div
        name="Smooth"
        style={{
          position: "absolute",
          top: 420,
          left: 150,
          width: 220,
          height: 170,
          borderRadius: 24,
          background: "#9bbde0",
          translate: interpolate(f, [0, 30], ["-60px 0px", "0px 0px"], {
            ...clamp,
            easing: motionPresets.smooth,
          }),
          scale: interpolate(f, [0, 30], [0.85, 1], {
            ...clamp,
            easing: motionPresets.smooth,
          }),
        }}
      />
      <div style={{ position: "absolute", top: 740, left: 100, fontSize: 45 }}>
        Bounce · один акцент
      </div>
      <Interactive.Div
        name="Bounce"
        style={{
          position: "absolute",
          top: 840,
          left: 150,
          width: 220,
          height: 170,
          borderRadius: 24,
          background: "#9bbde0",
          scale: interpolate(f, [0, 28], [0.65, 1], {
            ...clamp,
            easing: motionPresets.bounce,
          }),
        }}
      />
      <div style={{ position: "absolute", top: 1160, left: 100, fontSize: 45 }}>
        Morph · изменение формы
      </div>
      <Interactive.Div
        name="Morph"
        style={{
          position: "absolute",
          top: 1260,
          left: 150,
          width: interpolate(f, [0, 40], [170, 560], {
            ...clamp,
            easing: motionPresets.morph,
          }),
          height: 170,
          borderRadius: interpolate(f, [0, 40], [85, 24], {
            ...clamp,
            easing: motionPresets.morph,
          }),
          background: "#9bbde0",
        }}
      />
    </AbsoluteFill>
  );
};
