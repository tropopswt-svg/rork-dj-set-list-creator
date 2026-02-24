import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface ListeningIndicatorProps {
  startFrame: number;
  endFrame: number;
  x: number;
  y: number;
}

export const ListeningIndicator: React.FC<ListeningIndicatorProps> = ({
  startFrame,
  endFrame,
  x,
  y,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  if (local < 0 || frame > endFrame) return null;

  const enterProgress = spring({
    frame: local,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });

  const exitOpacity = interpolate(frame, [endFrame - 12, endFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulsing glow on the speaker icon
  const pulseScale = interpolate(
    Math.sin(local * 0.5),
    [-1, 1],
    [0.9, 1.15]
  );

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 16,
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.12)",
        opacity: enterProgress * exitOpacity,
        transform: `scale(${interpolate(enterProgress, [0, 1], [0.8, 1])})`,
      }}
    >
      {/* Speaker / volume icon with pulse */}
      <div style={{ transform: `scale(${pulseScale})`, display: "flex", alignItems: "center" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          {/* Speaker body */}
          <path
            d="M11 5L6 9H2v6h4l5 4V5z"
            fill="#C41E3A"
          />
          {/* Sound waves */}
          <path
            d="M15.54 8.46a5 5 0 0 1 0 7.07"
            stroke="#C41E3A"
            strokeWidth="2"
            strokeLinecap="round"
            opacity={interpolate(Math.sin(local * 0.6), [-1, 1], [0.3, 1])}
          />
          <path
            d="M19.07 4.93a10 10 0 0 1 0 14.14"
            stroke="#C41E3A"
            strokeWidth="2"
            strokeLinecap="round"
            opacity={interpolate(Math.sin(local * 0.6 + 1), [-1, 1], [0.2, 0.8])}
          />
        </svg>
      </div>
      {/* Animated sound bars */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          height: 14,
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const barHeight = interpolate(
            Math.sin((local + i * 4) * 0.4),
            [-1, 1],
            [3, 13]
          );
          return (
            <div
              key={i}
              style={{
                width: 2,
                height: barHeight,
                borderRadius: 1,
                backgroundColor: "#C41E3A",
              }}
            />
          );
        })}
      </div>
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          color: "rgba(255,255,255,0.85)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: 0.3,
        }}
      >
        Now Playing
      </span>
    </div>
  );
};
