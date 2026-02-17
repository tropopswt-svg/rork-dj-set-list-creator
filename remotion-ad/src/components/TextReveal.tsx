import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

interface TextRevealProps {
  text: string;
  fontSize?: number;
  color?: string;
  delay?: number;
  style?: "slide" | "fade" | "scale" | "typewriter";
  fontWeight?: number;
  letterSpacing?: number;
}

export const TextReveal: React.FC<TextRevealProps> = ({
  text,
  fontSize = 48,
  color = "#fff",
  delay = 0,
  style = "slide",
  fontWeight = 700,
  letterSpacing = -1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = frame - delay;

  if (adjustedFrame < 0) {
    return null;
  }

  const getAnimationStyle = () => {
    switch (style) {
      case "slide": {
        const progress = spring({
          frame: adjustedFrame,
          fps,
          config: { damping: 15, stiffness: 100 },
        });
        return {
          opacity: progress,
          transform: `translateY(${(1 - progress) * 40}px)`,
        };
      }
      case "fade": {
        const opacity = interpolate(adjustedFrame, [0, 20], [0, 1], {
          extrapolateRight: "clamp",
        });
        return { opacity };
      }
      case "scale": {
        const scale = spring({
          frame: adjustedFrame,
          fps,
          config: { damping: 12, stiffness: 150 },
        });
        const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
          extrapolateRight: "clamp",
        });
        return {
          opacity,
          transform: `scale(${scale})`,
        };
      }
      case "typewriter": {
        const charsToShow = Math.floor(
          interpolate(adjustedFrame, [0, text.length * 2], [0, text.length], {
            extrapolateRight: "clamp",
          })
        );
        return {
          opacity: 1,
          clipPath: `inset(0 ${100 - (charsToShow / text.length) * 100}% 0 0)`,
        };
      }
      default:
        return {};
    }
  };

  return (
    <div
      style={{
        fontSize,
        fontWeight,
        color,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        letterSpacing,
        ...getAnimationStyle(),
      }}
    >
      {text}
    </div>
  );
};

// Word-by-word reveal component
interface WordRevealProps {
  text: string;
  fontSize?: number;
  color?: string;
  delay?: number;
  wordDelay?: number;
  fontWeight?: number;
}

export const WordReveal: React.FC<WordRevealProps> = ({
  text,
  fontSize = 48,
  color = "#fff",
  delay = 0,
  wordDelay = 5,
  fontWeight = 700,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: fontSize * 0.3,
        justifyContent: "center",
      }}
    >
      {words.map((word, index) => {
        const wordFrame = frame - delay - index * wordDelay;
        const progress = spring({
          frame: Math.max(0, wordFrame),
          fps,
          config: { damping: 15, stiffness: 100 },
        });

        return (
          <span
            key={index}
            style={{
              fontSize,
              fontWeight,
              color,
              fontFamily: "SF Pro Display, -apple-system, sans-serif",
              opacity: wordFrame > 0 ? progress : 0,
              transform: `translateY(${(1 - (wordFrame > 0 ? progress : 0)) * 30}px)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// Character-by-character reveal
interface CharRevealProps {
  text: string;
  fontSize?: number;
  color?: string;
  delay?: number;
  charDelay?: number;
  fontWeight?: number;
}

export const CharReveal: React.FC<CharRevealProps> = ({
  text,
  fontSize = 48,
  color = "#fff",
  delay = 0,
  charDelay = 2,
  fontWeight = 700,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: "flex" }}>
      {text.split("").map((char, index) => {
        const charFrame = frame - delay - index * charDelay;
        const progress = spring({
          frame: Math.max(0, charFrame),
          fps,
          config: { damping: 20, stiffness: 200 },
        });

        return (
          <span
            key={index}
            style={{
              fontSize,
              fontWeight,
              color,
              fontFamily: "SF Pro Display, -apple-system, sans-serif",
              opacity: charFrame > 0 ? progress : 0,
              transform: `translateY(${(1 - (charFrame > 0 ? progress : 0)) * 20}px)`,
              display: "inline-block",
              whiteSpace: "pre",
            }}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
};
