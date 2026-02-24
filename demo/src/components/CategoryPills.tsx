import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

const categories = ["For You", "New Sets", "Most Popular", "Deep Cuts"];

export const CategoryPills: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 4,
        paddingBottom: 10,
        opacity,
        position: "relative",
        zIndex: 10,
        backgroundColor: "#F0EDE8",
        alignItems: "center",
      }}
    >
      {categories.map((cat, i) => {
        const isActive = i === 0;
        const slideX = interpolate(frame, [5 + i * 3, 20 + i * 3], [30, 0], {
          extrapolateRight: "clamp",
        });
        // Simulate the scroll-wheel scale effect
        const scale = isActive ? 1.05 : 0.85 - i * 0.03;
        const pillOpacity = isActive ? 1 : 0.5 - (i - 1) * 0.08;

        return (
          <div
            key={cat}
            style={{
              padding: isActive ? "8px 20px" : "6px 14px",
              borderRadius: 20,
              backgroundColor: isActive
                ? "rgba(255,255,255,0.8)"
                : "rgba(0,0,0,0.02)",
              border: isActive
                ? "1px solid rgba(196,30,58,0.25)"
                : "1px solid rgba(0,0,0,0.06)",
              color: isActive ? "#C41E3A" : "rgba(0,0,0,0.35)",
              fontSize: isActive ? 15 : 12,
              fontWeight: isActive ? 800 : 600,
              fontFamily: "system-ui, -apple-system, sans-serif",
              whiteSpace: "nowrap",
              transform: `translateX(${slideX}px) scale(${scale})`,
              opacity: pillOpacity,
              boxShadow: isActive
                ? "0 4px 12px rgba(196,30,58,0.35)"
                : "none",
              letterSpacing: isActive ? -0.3 : 0,
            }}
          >
            {cat}
          </div>
        );
      })}
    </div>
  );
};
