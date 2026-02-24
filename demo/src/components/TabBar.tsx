import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export const TabBar: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 85,
        backgroundColor: "#0A0A0A",
        borderTop: "1px solid #1A1A1A",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-around",
        paddingTop: 10,
        zIndex: 30,
        opacity,
      }}
    >
      {/* trakd tab — active */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.5" />
        </svg>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#C41E3A",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          trakd
        </span>
      </div>

      {/* Dig tab */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          opacity: 0.5,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="1.5" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          Dig
        </span>
      </div>

      {/* Vinyl FAB — centered, raised */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: -20,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: "#C41E3A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 4px 16px rgba(196,30,58,0.5), 0 0 0 3px rgba(196,30,58,0.15)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Vinyl grooves */}
          <div
            style={{
              position: "absolute",
              width: 50,
              height: 50,
              borderRadius: 25,
              border: "1px solid rgba(196,30,58,0.25)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 42,
              height: 42,
              borderRadius: 21,
              border: "1px solid rgba(196,30,58,0.35)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 34,
              height: 34,
              borderRadius: 17,
              border: "1px solid rgba(196,30,58,0.45)",
            }}
          />
          {/* Center label */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: "white",
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: -0.3,
              zIndex: 1,
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
          >
            trak<span style={{ fontWeight: 900 }}>d</span>
          </span>
        </div>
      </div>

      {/* Crate tab */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          opacity: 0.5,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="white" strokeWidth="1.5" />
        </svg>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          Crate
        </span>
      </div>

      {/* Profile tab */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          opacity: 0.5,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="7" r="4" stroke="white" strokeWidth="1.5" />
        </svg>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          Profile
        </span>
      </div>
    </div>
  );
};
