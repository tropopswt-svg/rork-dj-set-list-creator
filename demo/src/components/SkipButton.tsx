import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface SkipButtonProps {
  tapFrame?: number;
}

export const SkipButton: React.FC<SkipButtonProps> = ({ tapFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let pressScale = 1;
  if (tapFrame !== undefined && frame >= tapFrame) {
    const spr = spring({
      frame: frame - tapFrame,
      fps,
      config: { damping: 8, stiffness: 200, mass: 0.6 },
    });
    pressScale = interpolate(spr, [0, 0.5, 1], [1, 0.85, 1.0]);
  }

  // Glow pulse animation — breathing effect
  const glowOpacity = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.2, 0.5]
  );

  // Shimmer ring rotation
  const shimmerRotation = (frame / 180) * 360; // 6-second rotation at 30fps

  return (
    <div
      style={{
        position: "absolute",
        top: "63%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${pressScale})`,
        width: 80,
        height: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Outer glow ring */}
      <div
        style={{
          position: "absolute",
          width: 94,
          height: 94,
          borderRadius: 47,
          border: "1.5px solid rgba(255,255,255,0.2)",
          boxShadow: `0 0 14px rgba(255,255,255,${glowOpacity})`,
        }}
      />
      {/* Shimmer ring */}
      <div
        style={{
          position: "absolute",
          width: 86,
          height: 86,
          borderRadius: 43,
          borderTop: "1.5px solid rgba(255,255,255,0.35)",
          borderRight: "1.5px solid rgba(255,255,255,0.1)",
          borderBottom: "1.5px solid rgba(255,255,255,0.05)",
          borderLeft: "1.5px solid rgba(255,255,255,0.15)",
          transform: `rotate(${shimmerRotation}deg)`,
        }}
      />
      {/* Main glass button */}
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        {/* Skip forward icon */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="rgba(255,255,255,0.08)">
          <path
            d="M5 4l10 8-10 8V4z"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="rgba(255,255,255,0.08)"
          />
          <line
            x1="19"
            y1="5"
            x2="19"
            y2="19"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
