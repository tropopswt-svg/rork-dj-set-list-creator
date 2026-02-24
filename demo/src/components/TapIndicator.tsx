import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface TapIndicatorProps {
  tapFrame: number;
  x: number;
  y: number;
}

export const TapIndicator: React.FC<TapIndicatorProps> = ({
  tapFrame,
  x,
  y,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < tapFrame || frame > tapFrame + 24) return null;

  const localFrame = frame - tapFrame;

  const spr = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.4 },
  });

  const scale = interpolate(spr, [0, 1], [0.3, 1.3]);
  const opacity = interpolate(localFrame, [0, 4, 24], [0.9, 0.7, 0], {
    extrapolateRight: "clamp",
  });

  // Ripple ring that expands outward
  const rippleScale = interpolate(localFrame, [0, 24], [0.5, 2.0], {
    extrapolateRight: "clamp",
  });
  const rippleOpacity = interpolate(localFrame, [0, 24], [0.4, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <>
      {/* Ripple ring */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 44,
          height: 44,
          borderRadius: 22,
          border: "1.5px solid rgba(255,255,255,0.5)",
          transform: `translate(-50%, -50%) scale(${rippleScale})`,
          opacity: rippleOpacity,
          zIndex: 50,
          pointerEvents: "none",
        }}
      />
      {/* Inner circle */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "rgba(255,255,255,0.25)",
          border: "1.5px solid rgba(255,255,255,0.4)",
          transform: `translate(-50%, -50%) scale(${scale})`,
          opacity,
          zIndex: 51,
          pointerEvents: "none",
          boxShadow: "0 0 12px rgba(255,255,255,0.2)",
        }}
      />
    </>
  );
};
