import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface BottomInfoProps {
  setName: string;
  venue: string;
  trackCount: number;
  duration: string;
  startFrame: number;
}

export const BottomInfo: React.FC<BottomInfoProps> = ({
  setName,
  venue,
  trackCount,
  duration,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0) return null;

  const opacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const slideY = interpolate(localFrame, [0, 15], [16, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        left: 10,
        right: 62,
        opacity,
        transform: `translateY(${slideY}px)`,
        zIndex: 20,
        // Glass panel
        backgroundColor: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 16,
        padding: 12,
        boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
      }}
    >
      {/* Light edge */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 12,
          right: 12,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.25)",
          borderRadius: 1,
        }}
      />
      {/* Title */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#FFFFFF",
          fontFamily: "system-ui, -apple-system, sans-serif",
          marginBottom: 8,
          lineHeight: 1.25,
          textShadow: "0 1px 3px rgba(0,0,0,0.4)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {setName}
      </div>
      {/* Meta pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {/* Venue pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="2"
            />
            <circle
              cx="12"
              cy="10"
              r="3"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="2"
            />
          </svg>
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.8)",
              fontWeight: 600,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {venue}
          </span>
        </div>
        {/* Duration pill */}
        <div
          style={{
            padding: "3px 8px",
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.08)",
            fontSize: 10,
            color: "rgba(255,255,255,0.8)",
            fontWeight: 600,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {duration}
        </div>
        {/* Track count pill */}
        <div
          style={{
            padding: "3px 8px",
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 18V5l12-2v13"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="6"
              cy="18"
              r="3"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="2"
            />
            <circle
              cx="18"
              cy="16"
              r="3"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="2"
            />
          </svg>
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.8)",
              fontWeight: 600,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {trackCount} tracks
          </span>
        </div>
      </div>
    </div>
  );
};
