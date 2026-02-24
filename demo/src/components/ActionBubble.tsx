import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface ActionBubbleProps {
  text: string;
  startFrame: number;
  duration?: number;
  x: number;
  y: number;
  align?: "left" | "right";
}

export const ActionBubble: React.FC<ActionBubbleProps> = ({
  text,
  startFrame,
  duration = 60,
  x,
  y,
  align = "left",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  if (local < 0 || local > duration) return null;

  const enterProgress = spring({
    frame: local,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  const exitOpacity = interpolate(local, [duration - 15, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const slideX = align === "left"
    ? interpolate(enterProgress, [0, 1], [-20, 0])
    : interpolate(enterProgress, [0, 1], [20, 0]);

  const scale = interpolate(enterProgress, [0, 1], [0.8, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: align === "left" ? x : undefined,
        right: align === "right" ? x : undefined,
        top: y,
        zIndex: 20,
        transform: `translateX(${slideX}px) scale(${scale})`,
        opacity: enterProgress * exitOpacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "10px 22px",
          borderRadius: 24,
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderTop: "1px solid rgba(255,255,255,0.25)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "rgba(255,255,255,0.95)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: 0.3,
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
