import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

interface FeatureHighlightProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  delay?: number;
  accentColor?: string;
}

export const FeatureHighlight: React.FC<FeatureHighlightProps> = ({
  icon,
  title,
  description,
  delay = 0,
  accentColor = "#C41E3A",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = frame - delay;

  const iconScale = spring({
    frame: Math.max(0, adjustedFrame),
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const textProgress = spring({
    frame: Math.max(0, adjustedFrame - 8),
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const lineWidth = interpolate(
    adjustedFrame,
    [0, 20],
    [0, 100],
    { extrapolateRight: "clamp" }
  );

  if (adjustedFrame < 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Icon */}
      {icon && (
        <div
          style={{
            transform: `scale(${iconScale})`,
            width: 80,
            height: 80,
            borderRadius: 20,
            backgroundColor: `${accentColor}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 10px 40px ${accentColor}30`,
          }}
        >
          {icon}
        </div>
      )}

      {/* Animated line */}
      <div
        style={{
          width: `${lineWidth}%`,
          maxWidth: 60,
          height: 3,
          backgroundColor: accentColor,
          borderRadius: 2,
        }}
      />

      {/* Title */}
      <div
        style={{
          opacity: textProgress,
          transform: `translateY(${(1 - textProgress) * 20}px)`,
          fontSize: 28,
          fontWeight: 700,
          color: "#fff",
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          textAlign: "center",
        }}
      >
        {title}
      </div>

      {/* Description */}
      {description && (
        <div
          style={{
            opacity: textProgress,
            transform: `translateY(${(1 - textProgress) * 20}px)`,
            fontSize: 16,
            fontWeight: 400,
            color: "rgba(255,255,255,0.6)",
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            textAlign: "center",
            maxWidth: 250,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
};

// Animated counter component
interface AnimatedCounterProps {
  from?: number;
  to: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  fontSize?: number;
  color?: string;
  delay?: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  from = 0,
  to,
  duration = 30,
  suffix = "",
  prefix = "",
  fontSize = 64,
  color = "#fff",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = frame - delay;

  const count = Math.floor(
    interpolate(adjustedFrame, [0, duration], [from, to], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  if (adjustedFrame < 0) {
    return null;
  }

  return (
    <div
      style={{
        fontSize,
        fontWeight: 800,
        color,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        letterSpacing: -2,
      }}
    >
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </div>
  );
};

// Pulsing dot indicator
interface PulsingDotProps {
  color?: string;
  size?: number;
  delay?: number;
}

export const PulsingDot: React.FC<PulsingDotProps> = ({
  color = "#C41E3A",
  size = 12,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = frame - delay;

  const pulse = interpolate(
    adjustedFrame % 30,
    [0, 15, 30],
    [1, 1.3, 1]
  );

  const opacity = interpolate(
    adjustedFrame % 30,
    [0, 15, 30],
    [1, 0.7, 1]
  );

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        transform: `scale(${pulse})`,
        opacity,
        boxShadow: `0 0 ${size}px ${color}`,
      }}
    />
  );
};
