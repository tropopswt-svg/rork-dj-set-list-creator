import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { IPhoneFrame } from "./components/IPhoneFrame";

// App theme colors (matching constants/colors.ts)
const colors = {
  background: "#F5F0E8",
  surface: "#FFFFFF",
  surfaceLight: "#FAF7F2",
  card: "#FFFFFF",
  border: "#E8E2D9",
  borderLight: "#F0EBE3",
  text: "#2D2A26",
  textSecondary: "rgba(45, 42, 38, 0.6)",
  textMuted: "#9C968E",
  primary: "#C41E3A",
  primaryDark: "#9E1830",
  primaryLight: "rgba(196, 30, 58, 0.1)",
  primaryMedium: "rgba(196, 30, 58, 0.2)",
  // DM bubbles
  bubbleGray: "#E9E9EB",
  bubbleText: "#1C1C1E",
};

interface Props {
  landscape?: boolean;
}

export const TrackIdAd: React.FC<Props> = ({ landscape = false }) => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: colors.background, overflow: "hidden" }}
    >
      {/* Scene 1: Text Hook (0-170 frames / 0-5.7s) */}
      <Sequence from={0} durationInFrames={170}>
        <TextHookScene />
      </Sequence>

      {/* Scene 2: DM Exchange (155-405 frames / 5.2-13.5s) */}
      <Sequence from={155} durationInFrames={250}>
        <DMScene />
      </Sequence>

      {/* Scene 3: Phone Demo (390-670 frames / 13-22.3s) */}
      <Sequence from={390} durationInFrames={280}>
        <PhoneDemoScene />
      </Sequence>

      {/* Scene 4: Reaction + CTA (650-800 frames / 21.7-26.7s) */}
      <Sequence from={650} durationInFrames={150}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Scene 1: "what's the ID at 42:00??" ────────────────────────────────────
const TextHookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textScale = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 50 },
  });

  const textOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  const line2Opacity = interpolate(frame, [35, 65], [0, 1], {
    extrapolateRight: "clamp",
  });

  const line2Y = interpolate(frame, [35, 70], [25, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const exitOpacity = interpolate(frame, [140, 165], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        opacity: exitOpacity,
      }}
    >
      {/* Ambient red glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,30,58,0.1) 0%, transparent 65%)",
          opacity: interpolate(frame, [0, 30], [0, 1]),
        }}
      />

      {/* Main text */}
      <div
        style={{
          opacity: textOpacity,
          transform: `scale(${textScale})`,
          textAlign: "center",
          padding: "0 60px",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: colors.text,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1.1,
          }}
        >
          what's the ID
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: colors.primary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1.1,
            opacity: line2Opacity,
            transform: `translateY(${line2Y}px)`,
            textShadow: "0 0 60px rgba(196,30,58,0.2)",
          }}
        >
          at 42:00??
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: DM Exchange ───────────────────────────────────────────────────
const DMScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Message 1 enters
  const msg1Progress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 22, stiffness: 50 },
  });

  // Message 2 enters (long pause to let msg1 sink in)
  const msg2Progress = spring({
    frame: Math.max(0, frame - 120),
    fps,
    config: { damping: 18, stiffness: 60 },
  });

  const exitOpacity = interpolate(frame, [215, 245], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        opacity: exitOpacity,
      }}
    >
      {/* Subtle ambient glow */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,30,58,0.06) 0%, transparent 70%)",
        }}
      />

      <div
        style={{
          width: 850,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          padding: "0 40px",
        }}
      >
        {/* Friend 1 - gray bubble, left-aligned (iMessage style) */}
        <div
          style={{
            alignSelf: "flex-start",
            maxWidth: "85%",
            opacity: msg1Progress,
            transform: `translateY(${(1 - msg1Progress) * 30}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: colors.bubbleGray,
              borderRadius: 22,
              borderTopLeftRadius: 6,
              padding: "18px 24px",
            }}
          >
            <div
              style={{
                fontSize: 28,
                color: colors.bubbleText,
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                fontWeight: 400,
                lineHeight: 1.4,
              }}
            >
              Yo I'm listening to this{" "}
              <span style={{ fontWeight: 700 }}>
                Prunk b2b Hot Since 82
              </span>{" "}
              set — what's the ID at 42?
            </div>
          </div>
        </div>

        {/* Friend 2 - red bubble, right-aligned */}
        <div
          style={{
            alignSelf: "flex-end",
            opacity: msg2Progress,
            transform: `translateY(${(1 - msg2Progress) * 30}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: colors.primary,
              borderRadius: 22,
              borderTopRightRadius: 6,
              padding: "18px 28px",
              boxShadow: "0 4px 20px rgba(196,30,58,0.25)",
            }}
          >
            <div
              style={{
                fontSize: 32,
                color: "#FFFFFF",
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                fontWeight: 700,
              }}
            >
              TRACK it.
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3: Phone Demo ────────────────────────────────────────────────────
const PhoneDemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone slides up (gentle spring)
  const phoneY = interpolate(
    spring({ frame, fps, config: { damping: 24, stiffness: 30 } }),
    [0, 1],
    [500, 0]
  );

  const phoneOpacity = interpolate(frame, [0, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Phases within scene (generously spread)
  const SEARCH_START = 40;
  const RESULT_START = 100;
  const TRACKLIST_START = 135;
  const SCROLL_START = 195;

  // Search text typing (leisurely)
  const searchQuery = "Prunk b2b Hot Since 82";
  const typeProgress = interpolate(
    frame,
    [SEARCH_START, SEARCH_START + 50],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const typedChars = Math.floor(typeProgress * searchQuery.length);
  const typedText = searchQuery.slice(0, typedChars);

  // Result card appears
  const resultProgress = spring({
    frame: Math.max(0, frame - RESULT_START),
    fps,
    config: { damping: 20, stiffness: 60 },
  });

  // Tracklist data
  const tracks = [
    { artist: "Prunk", title: "Unreleased", time: "0:00" },
    { artist: "Hot Since 82", title: "Buggin'", time: "7:15" },
    { artist: "Solomun", title: "Home", time: "14:30" },
    { artist: "Prunk", title: "Body Language", time: "21:45" },
    { artist: "Âme", title: "Rej", time: "28:20" },
    { artist: "Hot Since 82", title: "Somebody", time: "35:10" },
    { artist: "Floating Points", title: "Nuits Sonores", time: "42:00" },
    { artist: "Prunk", title: "Close Your Eyes", time: "48:30" },
  ];

  const highlightIndex = 6; // 42:00 track

  // Scroll to 42:00 (gentle scroll)
  const scrollOffset = interpolate(
    frame,
    [SCROLL_START, SCROLL_START + 50],
    [0, 220],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }
  );

  // Highlight pulse for the 42:00 track
  const highlightPulse =
    frame > SCROLL_START + 45
      ? 0.12 + Math.sin((frame - SCROLL_START - 45) * 0.15) * 0.08
      : 0;

  const exitOpacity = interpolate(frame, [255, 275], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        opacity: exitOpacity,
      }}
    >
      {/* Phone */}
      <div
        style={{
          transform: `translateY(${phoneY}px)`,
          opacity: phoneOpacity,
        }}
      >
        <IPhoneFrame width={420} height={840}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: colors.background,
              padding: 20,
              paddingTop: 55,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* App header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: colors.primary,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  letterSpacing: -0.5,
                }}
              >
                TRACK'D
              </div>
              <div
                style={{
                  fontSize: 20,
                  color: colors.textMuted,
                }}
              >
                🔍
              </div>
            </div>

            {/* Search bar */}
            <div
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 16,
                border: `1.5px solid ${frame >= SEARCH_START ? colors.primary : colors.border}`,
                boxShadow:
                  frame >= SEARCH_START
                    ? "0 2px 12px rgba(196,30,58,0.1)"
                    : "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  color: typedText ? colors.text : colors.textMuted,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                }}
              >
                {typedText || "Search sets..."}
                {frame >= SEARCH_START &&
                  frame < SEARCH_START + 52 && (
                    <span
                      style={{
                        color: colors.primary,
                        opacity: frame % 20 < 10 ? 1 : 0,
                      }}
                    >
                      |
                    </span>
                  )}
              </div>
            </div>

            {/* Search result card */}
            {frame >= RESULT_START && (
              <div
                style={{
                  opacity: resultProgress,
                  transform: `translateY(${(1 - resultProgress) * 20}px)`,
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  border: `1px solid ${colors.border}`,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  🎧
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: colors.text,
                      fontFamily:
                        "SF Pro Display, -apple-system, sans-serif",
                    }}
                  >
                    Prunk b2b Hot Since 82
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      fontFamily:
                        "SF Pro Display, -apple-system, sans-serif",
                      marginTop: 2,
                    }}
                  >
                    Dekmantel 2024 • 8 tracks
                  </div>
                </div>
              </div>
            )}

            {/* Tracklist */}
            {frame >= TRACKLIST_START && (
              <div
                style={{
                  flex: 1,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {/* TRACKLIST label */}
                <div
                  style={{
                    fontSize: 10,
                    color: colors.textMuted,
                    letterSpacing: 2,
                    fontWeight: 600,
                    marginBottom: 8,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  }}
                >
                  TRACKLIST
                </div>

                <div
                  style={{
                    transform: `translateY(${-scrollOffset}px)`,
                  }}
                >
                  {tracks.map((track, index) => {
                    const trackDelay = TRACKLIST_START + index * 10;
                    const trackProgress = spring({
                      frame: Math.max(0, frame - trackDelay),
                      fps: 30,
                      config: { damping: 20, stiffness: 70 },
                    });

                    const isHighlighted =
                      index === highlightIndex && frame > SCROLL_START + 45;

                    return (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "10px 8px",
                          borderBottom: `1px solid ${colors.borderLight}`,
                          opacity: trackProgress,
                          transform: `translateX(${(1 - trackProgress) * 30}px)`,
                          backgroundColor: isHighlighted
                            ? `rgba(196, 30, 58, ${highlightPulse})`
                            : "transparent",
                          borderRadius: isHighlighted ? 8 : 0,
                        }}
                      >
                        {/* Timestamp */}
                        <div
                          style={{
                            fontSize: 11,
                            color: isHighlighted
                              ? colors.primary
                              : colors.textMuted,
                            fontFamily: "SF Mono, monospace",
                            width: 42,
                            fontWeight: isHighlighted ? 700 : 500,
                          }}
                        >
                          {track.time}
                        </div>
                        {/* Track info */}
                        <div style={{ flex: 1, marginLeft: 10 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: isHighlighted ? 700 : 600,
                              color: isHighlighted
                                ? colors.text
                                : colors.text,
                              fontFamily:
                                "SF Pro Display, -apple-system, sans-serif",
                            }}
                          >
                            {track.title}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: colors.textSecondary,
                              fontFamily:
                                "SF Pro Display, -apple-system, sans-serif",
                              marginTop: 1,
                            }}
                          >
                            {track.artist}
                          </div>
                        </div>
                        {/* Highlight indicator */}
                        {isHighlighted && (
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: colors.primary,
                              boxShadow:
                                "0 0 12px rgba(196,30,58,0.4)",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </IPhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Reaction + CTA ────────────────────────────────────────────────
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Reaction bubble
  const reactionProgress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 55 },
  });

  // Transition to end card
  const endCardOpacity = interpolate(frame, [55, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Stop begging for IDs."
  const taglineProgress = spring({
    frame: Math.max(0, frame - 75),
    fps,
    config: { damping: 20, stiffness: 50 },
  });

  // "TRACK'D"
  const logoProgress = spring({
    frame: Math.max(0, frame - 95),
    fps,
    config: { damping: 15, stiffness: 65 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      {/* Subtle animated background */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(circle at 50% 50%, rgba(196,30,58,0.08) 0%, transparent 60%)",
          opacity: endCardOpacity,
          transform: `scale(${1 + Math.sin(frame * 0.05) * 0.03})`,
        }}
      />

      {/* Reaction message */}
      {frame < 75 && (
        <div
          style={{
            position: "absolute",
            opacity: reactionProgress * (1 - endCardOpacity),
            transform: `translateY(${(1 - reactionProgress) * 30}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: colors.bubbleGray,
              borderRadius: 22,
              borderTopLeftRadius: 6,
              padding: "18px 28px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            }}
          >
            <div
              style={{
                fontSize: 30,
                color: colors.bubbleText,
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                fontWeight: 500,
              }}
            >
              Damn they legit have everything
            </div>
          </div>
        </div>
      )}

      {/* End card */}
      <div
        style={{
          opacity: endCardOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Tagline */}
        <div
          style={{
            fontSize: 42,
            fontWeight: 600,
            color: colors.text,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -1,
            opacity: taglineProgress,
            transform: `translateY(${(1 - taglineProgress) * 20}px)`,
          }}
        >
          Stop begging for IDs.
        </div>

        {/* TRACK'D logo */}
        <div
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: colors.primary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -3,
            textShadow: "0 0 80px rgba(196,30,58,0.2)",
            opacity: logoProgress,
            transform: `scale(${logoProgress})`,
          }}
        >
          TRACK'D
        </div>
      </div>
    </AbsoluteFill>
  );
};
