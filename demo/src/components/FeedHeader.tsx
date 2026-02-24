import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export const FeedHeader: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 52,
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 6,
        opacity,
        zIndex: 10,
        position: "relative",
        backgroundColor: "#F0EDE8",
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#C41E3A",
          letterSpacing: -0.5,
        }}
      >
        trakd
      </div>
      {/* Mute button — glass pill */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "rgba(0,0,0,0.04)",
          border: "1px solid rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M11 5L6 9H2v6h4l5 4V5z"
            stroke="#C41E3A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15.54 8.46a5 5 0 0 1 0 7.07"
            stroke="#C41E3A"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
