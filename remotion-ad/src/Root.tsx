import { Composition } from "remotion";
import { TrackdCommercial } from "./TrackdCommercial";
import { TrackIdAd } from "./TrackIdAd";
import { TikTokAd } from "./TikTokAd";
import { TikTokCampaign2 } from "./TikTokCampaign2";
import { TikTokCampaign3 } from "./TikTokCampaign3";
import { TikTokCampaign4 } from "./TikTokCampaign4";
import { TikTokCampaign5 } from "./TikTokCampaign5";
import { TikTokCampaign6 } from "./TikTokCampaign6";

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
      <Composition
        id="TikTokAd"
        component={TikTokAd}
        durationInFrames={545} // ~18 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="TikTokCampaign2"
        component={TikTokCampaign2}
        durationInFrames={590} // ~19.7 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="TikTokCampaign3"
        component={TikTokCampaign3}
        durationInFrames={600} // ~20 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="TikTokCampaign4"
        component={TikTokCampaign4}
        durationInFrames={685} // ~22.8 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="TikTokCampaign5"
        component={TikTokCampaign5}
        durationInFrames={720} // ~24 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="TikTokCampaign6"
        component={TikTokCampaign6}
        durationInFrames={1930} // ~64 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
    </>
  );
};
