import React from "react";

interface IPhoneFrameProps {
  children: React.ReactNode;
  width?: number;
  height?: number;
}

export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({
  children,
  width = 320,
  height = 640,
}) => {
  const borderRadius = 50;
  const bezelWidth = 12;
  const notchWidth = 120;
  const notchHeight = 34;

  return (
    <div
      style={{
        position: "relative",
        width: width + bezelWidth * 2,
        height: height + bezelWidth * 2,
      }}
    >
      {/* Phone body with gradient border */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: borderRadius + 4,
          background: "linear-gradient(145deg, #3a3a3a 0%, #1a1a1a 50%, #2a2a2a 100%)",
          boxShadow: `
            0 50px 100px -20px rgba(0,0,0,0.8),
            0 30px 60px -30px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(255,255,255,0.1),
            inset 0 -1px 0 rgba(0,0,0,0.3)
          `,
        }}
      />

      {/* Side button - Volume */}
      <div
        style={{
          position: "absolute",
          left: -3,
          top: 120,
          width: 4,
          height: 35,
          backgroundColor: "#2a2a2a",
          borderRadius: "2px 0 0 2px",
          boxShadow: "inset 1px 0 0 rgba(255,255,255,0.1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -3,
          top: 165,
          width: 4,
          height: 35,
          backgroundColor: "#2a2a2a",
          borderRadius: "2px 0 0 2px",
          boxShadow: "inset 1px 0 0 rgba(255,255,255,0.1)",
        }}
      />

      {/* Side button - Power */}
      <div
        style={{
          position: "absolute",
          right: -3,
          top: 140,
          width: 4,
          height: 60,
          backgroundColor: "#2a2a2a",
          borderRadius: "0 2px 2px 0",
          boxShadow: "inset -1px 0 0 rgba(255,255,255,0.1)",
        }}
      />

      {/* Screen area */}
      <div
        style={{
          position: "absolute",
          top: bezelWidth,
          left: bezelWidth,
          width: width,
          height: height,
          borderRadius: borderRadius - 4,
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        {/* Screen content */}
        {children}

        {/* Dynamic Island / Notch */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: notchWidth,
            height: notchHeight,
            backgroundColor: "#000",
            borderRadius: notchHeight / 2,
            boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
          }}
        >
          {/* Camera dot */}
          <div
            style={{
              position: "absolute",
              right: 20,
              top: "50%",
              transform: "translateY(-50%)",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "radial-gradient(circle at 30% 30%, #2a2a4a 0%, #0a0a1a 100%)",
              boxShadow: "inset 0 0 3px rgba(100,100,255,0.3)",
            }}
          />
        </div>

        {/* Home indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 134,
            height: 5,
            backgroundColor: "rgba(255,255,255,0.3)",
            borderRadius: 3,
          }}
        />
      </div>

      {/* Screen reflection */}
      <div
        style={{
          position: "absolute",
          top: bezelWidth,
          left: bezelWidth,
          width: width,
          height: height,
          borderRadius: borderRadius - 4,
          background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
