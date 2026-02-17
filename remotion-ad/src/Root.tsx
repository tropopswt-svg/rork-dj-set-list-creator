import { Composition } from "remotion";
import { TrackdCommercial } from "./TrackdCommercial";
import { TrackIdAd } from "./TrackIdAd";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TrackdCommercial"
        component={TrackdCommercial}
        durationInFrames={1020} // 34 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="TrackdCommercial-Landscape"
        component={TrackdCommercial}
        durationInFrames={1020}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ landscape: true }}
      />
      <Composition
        id="TrackIdAd"
        component={TrackIdAd}
        durationInFrames={800} // ~27 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="TrackIdAd-Landscape"
        component={TrackIdAd}
        durationInFrames={800}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ landscape: true }}
      />
    </>
  );
};
