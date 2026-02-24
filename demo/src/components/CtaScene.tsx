import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface CtaSceneProps {
  startFrame: number;
}

export const CtaScene: React.FC<CtaSceneProps> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  if (local < 0) return null;

  // Background fade in
  const bgOpacity = interpolate(local, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Title entrance
  const titleProgress = spring({
    frame: Math.max(0, local - 5),
    fps,
    config: { damping: 14, stiffness: 60, mass: 1 },
  });

  // Subtitle entrance
  const subtitleProgress = spring({
    frame: Math.max(0, local - 18),
    fps,
    config: { damping: 14, stiffness: 60, mass: 1 },
  });

  // CTA button entrance
  const ctaProgress = spring({
    frame: Math.max(0, local - 30),
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.8 },
  });

  // Subtle pulse on CTA button
  const ctaPulse = local > 45
    ? interpolate(Math.sin((local - 45) * 0.15), [-1, 1], [1, 1.05])
    : 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#2A2520",
        opacity: bgOpacity,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      {/* trakd logo */}
      <div
        style={{
          opacity: titleProgress,
          transform: `translateY(${interpolate(titleProgress, [0, 1], [30, 0])}px)`,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: "rgba(255,245,230,0.95)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: -1,
            textAlign: "center",
          }}
        >
          trakd
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: subtitleProgress,
          transform: `translateY(${interpolate(subtitleProgress, [0, 1], [20, 0])}px)`,
          maxWidth: 300,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "rgba(255,240,220,0.75)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            lineHeight: 1.4,
            letterSpacing: 0.2,
          }}
        >
          SoundCloud meets TikTok{"\n"}for DJ sets
        </div>
      </div>

      {/* CTA Button */}
      <div
        style={{
          opacity: ctaProgress,
          transform: `translateY(${interpolate(ctaProgress, [0, 1], [20, 0])}px) scale(${ctaPulse})`,
          marginTop: 10,
        }}
      >
        <div
          style={{
            padding: "12px 32px",
            borderRadius: 28,
            backgroundColor: "#C41E3A",
            boxShadow: "0 4px 20px rgba(196,30,58,0.5), 0 0 40px rgba(196,30,58,0.2)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "white",
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: 0.5,
            }}
          >
            Join the waitlist in bio
          </span>
        </div>
      </div>

      {/* Subtle ambient glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          backgroundColor: "rgba(196,30,58,0.08)",
          filter: "blur(80px)",
          transform: "translate(-50%, -50%)",
          zIndex: -1,
        }}
      />
    </AbsoluteFill>
  );
};
