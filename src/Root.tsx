import { Composition } from "remotion";
import { MotionExamples } from "./MotionExamples";
import { CarouselStory } from "./CarouselStory";
import { PromptExamples } from "./PromptExamples";
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
      durationInFrames={300}
      fps={25}
      width={1080}
      height={1920}
    />
    <Composition
      id="Scene-Prompts"
      component={PromptExamples}
      durationInFrames={300}
      fps={25}
      width={1080}
      height={1920}
    />
    <ImportedCompositions />
    <LocalCompositions />
  </>
);
