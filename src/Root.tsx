import { Composition } from "remotion";
import { MotionExamples } from "./MotionExamples";
import { CarouselStory } from "./CarouselStory";
import { PromptExamples } from "./PromptExamples";
import { StyleDemo } from "./StyleDemo";
import { ImportedCompositions } from "./generated/Registry";
import { LocalCompositions } from "./local/Local";
import "./index.css";

// Композиции шаблона. Импортированные ролики живут в src/generated/Registry.tsx
// (его пишет scripts/import-video.py), личные — в src/local/Local.tsx.
// Обе папки не попадают в git, поэтому этот файл правится только вручную.
export const RemotionRoot = () => (
  <>
    <Composition
      id="Motion-Examples"
      component={MotionExamples}
      durationInFrames={200}
      fps={25}
      width={1080}
      height={1920}
    />
    <Composition
      id="Scene-Carousel"
      component={CarouselStory}
      durationInFrames={507}
      fps={25}
      width={1080}
      height={1920}
    />
    <Composition
      id="Scene-Prompts"
      component={PromptExamples}
      durationInFrames={425}
      fps={25}
      width={1080}
      height={1920}
    />
    <Composition
      id="Style1-Split"
      component={StyleDemo}
      durationInFrames={200}
      fps={25}
      width={1080}
      height={1920}
      defaultProps={{
        showGuides: true,
        fullScreenExplanation: false,
        lightTheme: false,
      }}
    />
    <Composition
      id="Style2-Fullscreen"
      component={StyleDemo}
      durationInFrames={200}
      fps={25}
      width={1080}
      height={1920}
      defaultProps={{
        showGuides: true,
        fullScreenExplanation: true,
        lightTheme: false,
      }}
    />
    <ImportedCompositions />
    <LocalCompositions />
  </>
);
