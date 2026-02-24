import { Composition } from "remotion";
import { TrakdDemo } from "./TrakdDemo";

export const Root: React.FC = () => {
  return (
    <Composition
      id="TrakdDemo"
      component={TrakdDemo}
      durationInFrames={770}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
