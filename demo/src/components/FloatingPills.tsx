import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface FloatingPillsProps {
  tracks: { name: string; artist: string; identified?: boolean }[];
  startFrame: number;
}

const PILL_ROWS = [
  { y: 200, speed: 0.7, delay: 0, direction: 1 },
  { y: 270, speed: 1.0, delay: 12, direction: -1 },
  { y: 340, speed: 0.55, delay: 6, direction: 1 },
  { y: 400, speed: 0.85, delay: 18, direction: -1 },
  { y: 460, speed: 0.65, delay: 9, direction: 1 },
];

export const FloatingPills: React.FC<FloatingPillsProps> = ({
  tracks,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0) return null;

  return (
    <>
      {PILL_ROWS.map((row, i) => {
        const track = tracks[i % tracks.length];
        const effectiveFrame = Math.max(0, localFrame - row.delay);
        const progress = (effectiveFrame * row.speed * 1.2) % 600;
        const x =
          row.direction > 0
            ? interpolate(progress, [0, 600], [-220, 430])
            : interpolate(progress, [0, 600], [430, -220]);

        const fadeIn = interpolate(
          localFrame,
          [row.delay, row.delay + 15],
          [0, 1],
          { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
        );

        const isGold = track.identified;
        const bg = isGold ? "rgba(40,30,0,0.6)" : "rgba(0,0,0,0.55)";
        const border = isGold
          ? "rgba(255,215,0,0.35)"
          : "rgba(255,255,255,0.12)";
        const textColor = isGold
          ? "rgba(255,215,0,0.9)"
          : "rgba(255,255,255,0.7)";

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: row.y,
              left: 0,
              transform: `translateX(${x}px)`,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 14,
              backgroundColor: bg,
              border: `1px solid ${border}`,
              opacity: fadeIn * 0.85,
              pointerEvents: "none",
            }}
          >
            {/* Mini waveform */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                height: 12,
              }}
            >
              {[0, 1, 2].map((j) => {
                const h = interpolate(
                  Math.sin((localFrame + j * 4 + i * 7) * 0.3),
                  [-1, 1],
                  [3, 10]
                );
                return (
                  <div
                    key={j}
                    style={{
                      width: 2,
                      height: h,
                      borderRadius: 1,
                      backgroundColor: isGold
                        ? "rgba(255,215,0,0.7)"
                        : "rgba(255,255,255,0.4)",
                    }}
                  />
                );
              })}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                fontFamily: "system-ui, -apple-system, sans-serif",
                color: textColor,
                whiteSpace: "nowrap",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              {track.name}
            </span>
          </div>
        );
      })}
    </>
  );
};
