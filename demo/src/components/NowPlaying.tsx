import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";

interface NowPlayingProps {
  trackName: string;
  artistName: string;
  startFrame: number;
  isIdentified?: boolean;
  thumbnail?: string;
  changeKey?: string;
}

export const NowPlaying: React.FC<NowPlayingProps> = ({
  trackName,
  artistName,
  startFrame,
  thumbnail,
  changeKey,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0) return null;

  const opacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const slideX = interpolate(localFrame, [0, 12], [-20, 0], {
    extrapolateRight: "clamp",
  });

  const bg = "rgba(0,0,0,0.25)";
  const borderColor = "rgba(255,255,255,0.18)";
  const titleColor = "rgba(255,255,255,0.95)";

  return (
    <div
      key={changeKey}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        backgroundColor: bg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${borderColor}`,
        borderTop: "1px solid rgba(255,255,255,0.3)",
        borderRadius: 14,
        boxShadow: "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
        marginLeft: 12,
        marginRight: 64,
        opacity,
        transform: `translateX(${slideX}px)`,
      }}
    >
      {/* Thumbnail */}
      {thumbnail && (
        <Img
          src={staticFile(thumbnail)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      )}
      {/* Waveform bars */}
      {!thumbnail && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            height: 18,
            flexShrink: 0,
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const barHeight = interpolate(
              Math.sin((localFrame + i * 5) * 0.35),
              [-1, 1],
              [3, 16]
            );
            return (
              <div
                key={i}
                style={{
                  width: 2.5,
                  height: barHeight,
                  borderRadius: 1.5,
                  backgroundColor: "#C41E3A",
                }}
              />
            );
          })}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: titleColor,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          {trackName}
        </div>
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 500,
            marginTop: 1,
          }}
        >
          {artistName}
        </div>
      </div>
    </div>
  );
};
