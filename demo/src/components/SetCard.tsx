import React from "react";
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FloatingPills } from "./FloatingPills";
import { SkipButton } from "./SkipButton";
import { ActionColumn } from "./ActionColumn";
import { NowPlaying } from "./NowPlaying";
import { BottomInfo } from "./BottomInfo";

interface SetCardData {
  artist: string;
  setName: string;
  venue: string;
  trackCount: number;
  duration: string;
  tracks: { name: string; artist: string; identified?: boolean }[];
  coverImage: string;
  likes: number;
  comments: number;
  shares: number;
  isTrackd: boolean;
  nowPlaying: { track: string; artist: string; identified?: boolean };
  coverScale?: number;
}

export interface TrackClick {
  frame: number;
  track: string;
  artist: string;
  thumbnail?: string;
}

interface SetCardProps {
  data: SetCardData;
  enterFrame: number;
  exitFrame?: number;
  skipTapFrame?: number;
  heartTapFrame?: number;
  trackClicks?: TrackClick[];
  fadeEnter?: boolean;
}

export const SetCard: React.FC<SetCardProps> = ({
  data,
  enterFrame,
  exitFrame,
  skipTapFrame,
  heartTapFrame,
  trackClicks,
  fadeEnter,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < enterFrame) return null;

  // Enter animation
  const enterProgress = spring({
    frame: frame - enterFrame,
    fps,
    config: fadeEnter
      ? { damping: 40, stiffness: 12, mass: 3 }
      : { damping: 20, stiffness: 40, mass: 1.5 },
  });
  const enterSlide = fadeEnter ? 0 : interpolate(enterProgress, [0, 1], [500, 0]);

  // Exit animation
  let exitSlide = 0;
  const enterOpacity = fadeEnter ? enterProgress : 1;
  let opacity = enterOpacity;
  if (exitFrame !== undefined && frame >= exitFrame) {
    const exitProgress = spring({
      frame: frame - exitFrame,
      fps,
      config: { damping: 14, stiffness: 80, mass: 1 },
    });
    exitSlide = interpolate(exitProgress, [0, 1], [0, -800]);
    opacity = interpolate(exitProgress, [0, 0.3, 1], [1, 0.9, 0]);
  }

  const translateY = enterSlide + exitSlide;

  if (exitFrame !== undefined && frame > exitFrame + 30 && opacity < 0.01) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 96,
        left: 0,
        right: 0,
        bottom: 85,
        transform: `translateY(${translateY}px)`,
        opacity,
        overflow: "hidden",
        borderRadius: 20,
        margin: "0 6px",
        backgroundColor: "#0A0A0A",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow:
          "0 12px 40px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      {/* Cover image */}
      <Img
        src={staticFile(data.coverImage)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: data.coverScale ? `scale(${data.coverScale})` : undefined,
        }}
      />

      {/* Top overlay gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 30%, transparent 45%)",
        }}
      />
      {/* Bottom overlay — heavier to ensure info panel readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.95) 100%)",
        }}
      />

      {/* Artist badge — glass pill, top-left */}
      <ArtistBadge artist={data.artist} enterFrame={enterFrame} />

      {/* Trackd badge — small, clean, next to artist badge */}
      {data.isTrackd && <TrackdBadge enterFrame={enterFrame} />}

      {/* Now playing bar — below artist badge */}
      <div style={{ position: "absolute", top: 110, left: 0, right: 0 }}>
        <NowPlayingWithClicks
          defaultTrack={data.nowPlaying.track}
          defaultArtist={data.nowPlaying.artist}
          startFrame={enterFrame + 10}
          isIdentified={data.nowPlaying.identified}
          trackClicks={trackClicks}
        />
      </div>

      {/* Floating track pills */}
      <FloatingPills tracks={data.tracks} startFrame={enterFrame + 8} />

      {/* Liquid glass skip button — centered */}
      <SkipButton tapFrame={skipTapFrame} />

      {/* Glass action column — right side, above bottom info */}
      <ActionColumn
        heartTapFrame={heartTapFrame}
        likes={data.likes}
        comments={data.comments}
        shares={data.shares}
        startFrame={enterFrame}
      />

      {/* Bottom info panel — pinned to very bottom, above tab bar */}
      <BottomInfo
        setName={data.setName}
        venue={data.venue}
        trackCount={data.trackCount}
        duration={data.duration}
        startFrame={enterFrame + 5}
      />
    </div>
  );
};

// -- Sub-components --

const ArtistBadge: React.FC<{ artist: string; enterFrame: number }> = ({
  artist,
  enterFrame,
}) => {
  const frame = useCurrentFrame();
  const local = frame - enterFrame;
  const opacity = interpolate(local, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const slideX = interpolate(local, [0, 12], [-20, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 42,
        left: 12,
        zIndex: 10,
        borderRadius: 22,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.2)",
        borderTopColor: "rgba(255,255,255,0.4)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        opacity,
        transform: `translateX(${slideX}px)`,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.3)",
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        {/* Light edge */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 8,
            right: 8,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.35)",
            borderRadius: 1,
          }}
        />
        {/* Avatar circle */}
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="8"
              r="4"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="2"
            />
            <path
              d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="2"
            />
          </svg>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#F5E6D3",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: 0.3,
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          {artist}
        </span>
      </div>
    </div>
  );
};

const TrackdBadge: React.FC<{ enterFrame: number }> = ({ enterFrame }) => {
  const frame = useCurrentFrame();
  const local = frame - enterFrame;
  const opacity = interpolate(local, [8, 20], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        right: 12,
        zIndex: 10,
        opacity,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 8,
        backgroundColor: "rgba(196,30,58,0.85)",
        border: "1px solid rgba(196,30,58,0.6)",
        boxShadow: "0 2px 8px rgba(196,30,58,0.35)",
      }}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
        <circle cx="12" cy="12" r="3" fill="white" />
      </svg>
      <span
        style={{
          fontSize: 8,
          fontWeight: 800,
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        trackd
      </span>
    </div>
  );
};

const NowPlayingWithClicks: React.FC<{
  defaultTrack: string;
  defaultArtist: string;
  startFrame: number;
  isIdentified?: boolean;
  trackClicks?: TrackClick[];
}> = ({ defaultTrack, defaultArtist, startFrame, isIdentified, trackClicks }) => {
  const frame = useCurrentFrame();

  let currentTrack = defaultTrack;
  let currentArtist = defaultArtist;
  let currentThumbnail: string | undefined;
  let changeKey = "default";

  if (trackClicks) {
    for (const click of trackClicks) {
      if (frame >= click.frame) {
        currentTrack = click.track;
        currentArtist = click.artist;
        currentThumbnail = click.thumbnail;
        changeKey = `${click.frame}`;
      }
    }
  }

  return (
    <NowPlaying
      trackName={currentTrack}
      artistName={currentArtist}
      startFrame={startFrame}
      isIdentified={isIdentified}
      thumbnail={currentThumbnail}
      changeKey={changeKey}
    />
  );
};

export type { SetCardData };
