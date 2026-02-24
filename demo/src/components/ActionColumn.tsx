import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface ActionColumnProps {
  heartTapFrame?: number;
  likes: number;
  comments: number;
  shares: number;
  startFrame: number;
}

const GlassButton: React.FC<{
  children: React.ReactNode;
  label: string;
  scale?: number;
}> = ({ children, label, scale = 1 }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
    }}
  >
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderTopColor: "rgba(255,255,255,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${scale})`,
        boxShadow:
          "0 3px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
      }}
    >
      {children}
    </div>
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: "rgba(255,255,255,0.85)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
      }}
    >
      {label}
    </span>
  </div>
);

export const ActionColumn: React.FC<ActionColumnProps> = ({
  heartTapFrame,
  likes,
  comments,
  shares,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const fadeIn = interpolate(localFrame, [5, 20], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const slideX = interpolate(localFrame, [5, 20], [20, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const isLiked = heartTapFrame !== undefined && frame >= heartTapFrame;

  let heartScale = 1;
  if (heartTapFrame !== undefined && frame >= heartTapFrame) {
    const spr = spring({
      frame: frame - heartTapFrame,
      fps,
      config: { damping: 6, stiffness: 300, mass: 0.5 },
    });
    heartScale = interpolate(spr, [0, 0.4, 1], [1, 1.5, 1]);
  }

  const heartColor = isLiked ? "#C41E3A" : "rgba(255,255,255,0.85)";
  const heartFill = isLiked ? "#C41E3A" : "none";
  const displayLikes = isLiked ? likes + 1 : likes;

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <div
      style={{
        position: "absolute",
        right: 10,
        bottom: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        zIndex: 20,
        opacity: fadeIn,
        transform: `translateX(${slideX}px)`,
      }}
    >
      {/* Heart */}
      <GlassButton label={formatCount(displayLikes)} scale={heartScale}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill={heartFill}>
          <path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            stroke={heartColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </GlassButton>

      {/* Comment */}
      <GlassButton label={formatCount(comments)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </GlassButton>

      {/* Share */}
      <GlassButton label={formatCount(shares)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="16 6 12 2 8 6"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="12"
            y1="2"
            x2="12"
            y2="15"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </GlassButton>
    </div>
  );
};
