import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { PhoneFrame } from "./components/PhoneFrame";
import { FeedHeader } from "./components/FeedHeader";
import { CategoryPills } from "./components/CategoryPills";
import { SetCard } from "./components/SetCard";
import type { SetCardData } from "./components/SetCard";
import type { TrackClick } from "./components/SetCard";
import { TabBar } from "./components/TabBar";
import { TapIndicator } from "./components/TapIndicator";
import { LogoIntro, usePhoneRevealScale } from "./components/LogoIntro";
import { ActionBubble } from "./components/ActionBubble";
import { ListeningIndicator } from "./components/ListeningIndicator";
import { CtaScene } from "./components/CtaScene";

const FPS = 30;

// Scale factor: design at 390x844, render at 1080x1920
// Use height as constraining dimension so nothing gets clipped
const SCALE = 1920 / 844;

const SETS: SetCardData[] = [
  // Card 1: Locklead
  {
    artist: "Locklead",
    setName: "Locklead — Raw Cuts NYC",
    venue: "Raw Cuts, NYC",
    duration: "1h 45m",
    trackCount: 22,
    isTrackd: true,
    coverImage: "locklead.jpg",
    coverScale: 0.5,
    nowPlaying: {
      track: "Moon (Scott Brandon Remix)",
      artist: "Locklead",
      identified: true,
    },
    tracks: [
      { name: "Apollo", artist: "Locklead", identified: true },
      { name: "Dreams", artist: "Locklead" },
      { name: "T.M.P", artist: "Across Boundaries", identified: true },
      { name: "Blue Monday", artist: "Locklead" },
      { name: "Liquid Rocks", artist: "Across Boundaries", identified: true },
    ],
    likes: 2467,
    comments: 198,
    shares: 445,
  },
  // Card 2: Max Dean
  {
    artist: "Max Dean",
    setName: "Max Dean @ Sound LA",
    venue: "Sound Nightclub, LA",
    duration: "2h 30m",
    trackCount: 28,
    isTrackd: true,
    coverImage: "max-dean.jpg",
    nowPlaying: {
      track: "The Seducer",
      artist: "Max Dean",
      identified: true,
    },
    tracks: [
      { name: "Reckless", artist: "Azari & III", identified: true },
      { name: "Killerz", artist: "Max Dean" },
      { name: "Fascinator", artist: "Max Dean", identified: true },
      { name: "Yes Baby", artist: "Max Dean" },
      { name: "Feel Much Better", artist: "Max Dean & Nafe Smallz", identified: true },
    ],
    likes: 3104,
    comments: 267,
    shares: 589,
  },
  // Card 3: Chris Stussy (last — with track clicking)
  {
    artist: "Chris Stussy",
    setName: "Chris Stussy @ Hudson River Boat Party",
    venue: "Hudson River, NYC",
    duration: "2h 10m",
    trackCount: 24,
    isTrackd: true,
    coverImage: "chris-stussy.jpg",
    nowPlaying: {
      track: "Go (ft. Moby)",
      artist: "Chris Stussy",
      identified: true,
    },
    tracks: [
      { name: "Dalia", artist: "Milion", identified: true },
      { name: "Subsonic", artist: "Josh Baker" },
      { name: "Desire (DeMarzo Rmx)", artist: "Fletsch", identified: true },
      { name: "Bass Jumpin' (Sweat)", artist: "Robbie Doherty" },
      { name: "Freakin (CS Edit)", artist: "Marc Romboy", identified: true },
    ],
    likes: 1892,
    comments: 143,
    shares: 312,
  },
];

// Timeline — shifted +145 for intro phase, slowed for TikTok feel
const CARD_1_ENTER = 135;
const SKIP_1_TAP = 270;
const CARD_1_EXIT = 270;
const CARD_2_ENTER = 272;
const HEART_TAP = 390;
const SKIP_2_TAP = 450;
const CARD_2_EXIT = 450;
const CARD_3_ENTER = 452;

// Track click frames for Stussy card
const TRACK_CLICK_1 = 510;
const TRACK_CLICK_2 = 565;
const TRACK_CLICK_3 = 620;

// CTA end scene
const CTA_START = 670;

const STUSSY_TRACK_CLICKS: TrackClick[] = [
  { frame: TRACK_CLICK_1, track: "First Light", artist: "Pedro Borlado", thumbnail: "track-first-light.jpg" },
  { frame: TRACK_CLICK_2, track: "Subsonic", artist: "Josh Baker", thumbnail: "track-subsonic.jpg" },
  { frame: TRACK_CLICK_3, track: "Seen It All Before", artist: "Chris Stussy", thumbnail: "track-seen-it-all.jpg" },
];

export const TrakdDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const phoneReveal = usePhoneRevealScale(FPS);

  // Subtle ambient orb drift
  const orbDrift1 = interpolate(Math.sin(frame * 0.02), [-1, 1], [-8, 8]);
  const orbDrift2 = interpolate(Math.cos(frame * 0.015), [-1, 1], [-6, 6]);

  // Background color: dark during intro, transitions to #F0EDE8
  const bgColor =
    frame < 125
      ? "#2A2520"
      : frame < 145
        ? `rgb(${interpolate(frame, [125, 145], [42, 240], { extrapolateRight: "clamp" })}, ${interpolate(frame, [125, 145], [37, 237], { extrapolateRight: "clamp" })}, ${interpolate(frame, [125, 145], [32, 232], { extrapolateRight: "clamp" })})`
        : "#F0EDE8";

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      <div
        style={{
          transform: `scale(${SCALE})`,
          transformOrigin: "top center",
          width: 390,
          height: 844,
          position: "relative",
          left: "50%",
          marginLeft: -195,
        }}
      >
        {/* Intro animation layer */}
        <LogoIntro fps={FPS} />

        {/* Phone frame with content — scales up during reveal */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${phoneReveal.scale}) translateY(${phoneReveal.translateY}px)`,
            opacity: phoneReveal.opacity,
            pointerEvents: phoneReveal.ready ? "auto" : "none",
          }}
        >
          <PhoneFrame>
            <AbsoluteFill style={{ backgroundColor: "#F0EDE8" }}>
              {/* Ambient orbs */}
              <div
                style={{
                  position: "absolute",
                  top: -80 + orbDrift1,
                  left: -50,
                  width: 300,
                  height: 300,
                  borderRadius: 999,
                  backgroundColor: "rgba(196,30,58,0.1)",
                  filter: "blur(60px)",
                  zIndex: 0,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 250 + orbDrift2,
                  right: -80,
                  width: 250,
                  height: 250,
                  borderRadius: 999,
                  backgroundColor: "rgba(160,50,180,0.06)",
                  filter: "blur(60px)",
                  zIndex: 0,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 100,
                  left: 10,
                  width: 200,
                  height: 200,
                  borderRadius: 999,
                  backgroundColor: "rgba(50,100,200,0.05)",
                  filter: "blur(60px)",
                  zIndex: 0,
                }}
              />

              {/* Header */}
              <FeedHeader />

              {/* Category pills */}
              <div
                style={{
                  position: "absolute",
                  top: 82,
                  left: 0,
                  right: 0,
                  zIndex: 10,
                }}
              >
                <CategoryPills />
              </div>

              {/* Card 1: Locklead — Raw Cuts */}
              <SetCard
                data={SETS[0]}
                enterFrame={CARD_1_ENTER}
                exitFrame={CARD_1_EXIT}
                skipTapFrame={SKIP_1_TAP}
                fadeEnter
              />

              {/* Card 2: Max Dean @ Sound LA */}
              <SetCard
                data={SETS[1]}
                enterFrame={CARD_2_ENTER}
                exitFrame={CARD_2_EXIT}
                skipTapFrame={SKIP_2_TAP}
                heartTapFrame={HEART_TAP}
              />

              {/* Card 3: Chris Stussy @ Hudson River — with track clicking */}
              <SetCard
                data={SETS[2]}
                enterFrame={CARD_3_ENTER}
                trackClicks={STUSSY_TRACK_CLICKS}
              />

              {/* Tab bar */}
              <TabBar />

              {/* Tap indicators — showing user interaction */}
              {/* Skip tap 1 — on the skip button center */}
              <TapIndicator tapFrame={SKIP_1_TAP} x={195} y={510} />

              {/* Heart tap — action column */}
              <TapIndicator tapFrame={HEART_TAP} x={363} y={520} />

              {/* Skip tap 2 — skip button */}
              <TapIndicator tapFrame={SKIP_2_TAP} x={195} y={510} />

              {/* Track click taps — on the skip button */}
              <TapIndicator tapFrame={TRACK_CLICK_1} x={195} y={510} />
              <TapIndicator tapFrame={TRACK_CLICK_2} x={195} y={510} />
              <TapIndicator tapFrame={TRACK_CLICK_3} x={195} y={510} />

              {/* Listening indicator — shows during track browsing */}
              <ListeningIndicator
                startFrame={TRACK_CLICK_1}
                endFrame={TRACK_CLICK_3 + 35}
                x={12}
                y={270}
              />

            </AbsoluteFill>
          </PhoneFrame>
        </div>

        {/* Marketing action bubbles — outside phone frame so they're not clipped */}
        <ActionBubble text="Discover entire set lists" startFrame={CARD_1_ENTER + 20} duration={95} x={20} y={790} />
        <ActionBubble text="Skip to the next set" startFrame={SKIP_1_TAP - 10} duration={75} x={20} y={790} />
        <ActionBubble text="Save your favorites" startFrame={HEART_TAP - 10} duration={75} x={20} y={790} />
        <ActionBubble text="Listen and browse through tracks" startFrame={TRACK_CLICK_1 - 10} duration={130} x={20} y={790} />

        {/* CTA end scene */}
        <CtaScene startFrame={CTA_START} />
      </div>
    </AbsoluteFill>
  );
};
