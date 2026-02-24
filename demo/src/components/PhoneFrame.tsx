import React from "react";
import { AbsoluteFill } from "remotion";

export const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        borderRadius: 44,
        overflow: "hidden",
        border: "3px solid #2A2A2A",
        boxShadow:
          "0 0 0 1px #1A1A1A, 0 20px 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      {/* Dynamic Island */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          width: 120,
          height: 36,
          backgroundColor: "#000",
          borderRadius: 20,
          zIndex: 100,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.05)",
        }}
      />
      {/* Status bar area */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 24,
          right: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 99,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#2D2A26",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          9:41
        </span>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {/* Signal bars */}
          <svg width="16" height="12" viewBox="0 0 16 12">
            <rect x="0" y="8" width="3" height="4" rx="0.5" fill="#2D2A26" />
            <rect x="4" y="5" width="3" height="7" rx="0.5" fill="#2D2A26" />
            <rect x="8" y="2" width="3" height="10" rx="0.5" fill="#2D2A26" />
            <rect x="12" y="0" width="3" height="12" rx="0.5" fill="#2D2A26" />
          </svg>
          {/* WiFi */}
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
            <path d="M7 10.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="#2D2A26" />
            <path d="M4.5 7.5a3.5 3.5 0 0 1 5 0" stroke="#2D2A26" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M2 5a7 7 0 0 1 10 0" stroke="#2D2A26" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {/* Battery */}
          <svg width="24" height="12" viewBox="0 0 24 12">
            <rect x="0" y="1" width="20" height="10" rx="2" stroke="#2D2A26" strokeWidth="1" fill="none" />
            <rect x="2" y="3" width="16" height="6" rx="1" fill="#2D2A26" />
            <rect x="21" y="4" width="2" height="4" rx="0.5" fill="#2D2A26" />
          </svg>
        </div>
      </div>
      {children}
    </AbsoluteFill>
  );
};
