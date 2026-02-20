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

const colors = {
  background: "#F5F0E8",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E8E2D9",
  borderLight: "#F0EBE3",
  text: "#2D2A26",
  textSecondary: "rgba(45, 42, 38, 0.6)",
  textMuted: "#9C968E",
  primary: "#C41E3A",
  primaryDark: "#9E1830",
  // Comment bubbles
  commentBg: "#FFFFFF",
  commentBorder: "#E8E2D9",
};

interface Props {
  landscape?: boolean;
}

// ─── Main TikTok Ad Composition (~18 seconds) ──────────────────────────────
export const TikTokAd: React.FC<Props> = ({ landscape = false }) => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: colors.background, overflow: "hidden" }}
    >
      {/* Scene 1: Hook text (0-75 frames / 2.5s) */}
      <Sequence from={0} durationInFrames={80}>
        <HookScene />
      </Sequence>

      {/* Scene 2: Comment flood (70-170 frames / 3.3s) */}
      <Sequence from={70} durationInFrames={105}>
        <CommentFloodScene />
      </Sequence>

      {/* Scene 3: Phone reveal + record (165-310 frames / 4.8s) */}
      <Sequence from={165} durationInFrames={150}>
        <PhoneRecordScene />
      </Sequence>

      {/* Scene 4: Track identified + tracklist (305-430 frames / 4.2s) */}
      <Sequence from={305} durationInFrames={130}>
        <TrackRevealScene />
      </Sequence>

      {/* Scene 5: Stats flex (425-490 frames / 2.2s) */}
      <Sequence from={425} durationInFrames={70}>
        <StatsScene />
      </Sequence>

      {/* Scene 6: CTA (485-545 frames / 2s) */}
      <Sequence from={485} durationInFrames={60}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Scene 1: Hook ─────────────────────────────────────────────────────────
// "every time someone asks 'what's the ID?' in the comments..."
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1Scale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const line2Scale = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const exitOpacity = interpolate(frame, [60, 78], [1, 0], {
    extrapolateLeft: "clamp",
  });

  // Subtle shake on "ID?" for emphasis
  const shakeX =
    frame > 20 && frame < 35
      ? Math.sin(frame * 2.5) * interpolate(frame, [20, 35], [4, 0])
      : 0;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        opacity: exitOpacity,
      }}
    >
      {/* Red glow pulse */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,30,58,0.12) 0%, transparent 60%)",
          opacity: interpolate(frame, [0, 20], [0, 1]),
          transform: `scale(${1 + Math.sin(frame * 0.08) * 0.05})`,
        }}
      />

      <div
        style={{
          textAlign: "center",
          padding: "0 50px",
          transform: `translateX(${shakeX}px)`,
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: colors.text,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1.15,
            opacity: line1Scale,
            transform: `scale(${line1Scale})`,
          }}
        >
          every time someone asks
        </div>
        <div
          style={{
            fontSize: 68,
            fontWeight: 900,
            color: colors.primary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1.15,
            marginTop: 8,
            opacity: line2Scale,
            transform: `scale(${line2Scale})`,
            textShadow: "0 0 60px rgba(196,30,58,0.25)",
          }}
        >
          "what's the ID?"
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: Comment Flood ────────────────────────────────────────────────
// Rapid-fire YouTube/Reddit style comments asking for track IDs
const CommentFloodScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const comments = [
    { user: "djfanatic92", text: "ID at 23:15 pls?? 🙏", platform: "yt" },
    { user: "house_head", text: "track at 1:04:00 anyone??", platform: "reddit" },
    { user: "raver_mike", text: "NEED the ID at 45 min 😭", platform: "yt" },
    { user: "techno_sara", text: "what song is this @ 32:00", platform: "yt" },
    { user: "vinyl_only", text: "been looking for the 18min track for MONTHS", platform: "reddit" },
    { user: "festivalQn", text: "ID?? ID?? ID?? 🔥", platform: "yt" },
    { user: "deep_cuts", text: "somebody please help, track at 55:20", platform: "reddit" },
  ];

  const exitOpacity = interpolate(frame, [85, 103], [1, 0], {
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
      {/* Scrolling comments */}
      <div
        style={{
          width: 900,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: "0 50px",
        }}
      >
        {comments.map((comment, i) => {
          const delay = i * 8;
          const progress = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: { damping: 18, stiffness: 90 },
          });

          return (
            <div
              key={i}
              style={{
                opacity: progress,
                transform: `translateX(${(1 - progress) * (i % 2 === 0 ? -60 : 60)}px)`,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                backgroundColor: colors.commentBg,
                borderRadius: 16,
                padding: "14px 18px",
                border: `1px solid ${colors.commentBorder}`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor:
                    comment.platform === "yt"
                      ? "rgba(196,30,58,0.15)"
                      : "rgba(45,42,38,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: colors.primary,
                  flexShrink: 0,
                }}
              >
                {comment.user[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: colors.textMuted,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    marginBottom: 3,
                  }}
                >
                  @{comment.user}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    color: colors.text,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    fontWeight: 500,
                    lineHeight: 1.3,
                  }}
                >
                  {comment.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3: Phone Record ─────────────────────────────────────────────────
// Phone slides up, shows TRACK'D app with recording animation
const PhoneRecordScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneY = interpolate(
    spring({ frame, fps, config: { damping: 20, stiffness: 35 } }),
    [0, 1],
    [600, 0]
  );

  const phoneOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // "just TRACK it" text above phone
  const textProgress = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 16, stiffness: 70 },
  });

  // Recording state starts at frame 55
  const isRecording = frame > 55;
  const recordingPulse = isRecording
    ? 0.7 + Math.sin((frame - 55) * 0.2) * 0.3
    : 0;

  // Waveform bars
  const waveformBars = 24;

  const exitOpacity = interpolate(frame, [130, 148], [1, 0], {
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
      {/* "trak that." text */}
      <div
        style={{
          position: "absolute",
          top: 180,
          opacity: textProgress,
          transform: `translateY(${(1 - textProgress) * 20}px)`,
        }}
      >
        <span
          style={{
            fontSize: 58,
            fontWeight: 900,
            color: colors.primary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            textShadow: "0 0 50px rgba(196,30,58,0.2)",
          }}
        >
          trak that.
        </span>
      </div>

      {/* Phone */}
      <div
        style={{
          transform: `translateY(${phoneY + 60}px)`,
          opacity: phoneOpacity,
        }}
      >
        <IPhoneFrame width={380} height={760}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: colors.background,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              paddingTop: 60,
            }}
          >
            {/* App header */}
            <div
              style={{
                position: "absolute",
                top: 60,
                left: 24,
                fontSize: 20,
                fontWeight: 800,
                color: colors.primary,
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                letterSpacing: -0.5,
              }}
            >
              trakd
            </div>

            {/* Centered recording UI */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 30,
                marginTop: 20,
              }}
            >
              {/* Big trak button */}
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  background: isRecording
                    ? `radial-gradient(circle, ${colors.primary} 0%, ${colors.primaryDark} 100%)`
                    : `radial-gradient(circle, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isRecording
                    ? `0 0 ${40 + recordingPulse * 30}px rgba(196,30,58,${0.3 + recordingPulse * 0.2})`
                    : "0 8px 30px rgba(196,30,58,0.3)",
                  transform: `scale(${isRecording ? 0.95 + recordingPulse * 0.05 : 1})`,
                }}
              >
                {isRecording ? (
                  // Recording square icon
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      backgroundColor: "#FFFFFF",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: "#FFFFFF",
                      fontFamily: "SF Pro Display, -apple-system, sans-serif",
                      letterSpacing: 1,
                    }}
                  >
                    trak
                  </div>
                )}
              </div>

              {/* Recording status */}
              {isRecording && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    opacity: interpolate(
                      frame,
                      [55, 65],
                      [0, 1],
                      { extrapolateRight: "clamp" }
                    ),
                  }}
                >
                  {/* Red dot */}
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: colors.primary,
                      opacity: recordingPulse,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: colors.primary,
                      fontFamily: "SF Mono, monospace",
                    }}
                  >
                    Listening...
                  </div>
                </div>
              )}

              {/* Waveform */}
              {isRecording && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    height: 80,
                    opacity: interpolate(
                      frame,
                      [58, 70],
                      [0, 1],
                      { extrapolateRight: "clamp" }
                    ),
                  }}
                >
                  {Array.from({ length: waveformBars }).map((_, i) => {
                    const barHeight = isRecording
                      ? 15 +
                        Math.sin((frame - 55) * 0.3 + i * 0.8) * 25 +
                        Math.cos((frame - 55) * 0.15 + i * 1.2) * 10
                      : 15;
                    return (
                      <div
                        key={i}
                        style={{
                          width: 5,
                          height: Math.max(6, barHeight),
                          borderRadius: 3,
                          backgroundColor: colors.primary,
                          opacity: 0.5 + Math.sin(i * 0.5) * 0.3,
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </IPhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Track Reveal ─────────────────────────────────────────────────
// Track gets identified, full tracklist cascades in
const TrackRevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneScale = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 40 },
  });

  // Phase 1: "Track Found!" flash (0-40)
  const foundFlash = interpolate(frame, [0, 15, 30, 45], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });

  // Phase 2: Result card (30+)
  const resultProgress = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 18, stiffness: 65 },
  });

  // Phase 3: Tracklist (55+)
  const tracks = [
    { artist: "Chris Stussy", title: "Darkness", time: "0:00" },
    { artist: "DJ Boring", title: "Winona", time: "6:30" },
    { artist: "Mall Grab", title: "Pool Party", time: "13:15" },
    { artist: "Ross From Friends", title: "Talk to Me", time: "19:45" },
    { artist: "Floating Points", title: "Silhouettes", time: "26:20" },
    { artist: "TSHA", title: "Sister", time: "33:00" },
    { artist: "Kerri Chandler", title: "Rain", time: "40:10" },
  ];

  const exitOpacity = interpolate(frame, [110, 128], [1, 0], {
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
      {/* "Track Found!" flash text above phone */}
      <div
        style={{
          position: "absolute",
          top: 200,
          opacity: foundFlash,
          transform: `scale(${0.8 + foundFlash * 0.2})`,
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: colors.primary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -1.5,
            textShadow: "0 0 40px rgba(196,30,58,0.3)",
          }}
        >
          trakd.
        </div>
      </div>

      {/* Phone with results */}
      <div
        style={{
          transform: `scale(${phoneScale}) translateY(40px)`,
        }}
      >
        <IPhoneFrame width={380} height={760}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: colors.background,
              padding: 18,
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
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: colors.primary,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  letterSpacing: -0.5,
                }}
              >
                trakd
              </div>
            </div>

            {/* Identified result card */}
            <div
              style={{
                opacity: resultProgress,
                transform: `translateY(${(1 - resultProgress) * 25}px) scale(${0.95 + resultProgress * 0.05})`,
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                border: `2px solid ${colors.primary}`,
                boxShadow: "0 6px 24px rgba(196,30,58,0.12)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                {/* Album art placeholder */}
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "rgba(255,255,255,0.8)",
                      }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: colors.text,
                        fontFamily: "SF Pro Display, -apple-system, sans-serif",
                      }}
                    >
                      Darkness
                    </div>
                    {/* UNRELEASED badge */}
                    <div
                      style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: "#FFFFFF",
                        backgroundColor: colors.primary,
                        padding: "2px 6px",
                        borderRadius: 4,
                        letterSpacing: 0.8,
                        fontFamily: "SF Pro Display, -apple-system, sans-serif",
                      }}
                    >
                      UNRELEASED
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: colors.textSecondary,
                      fontFamily: "SF Pro Display, -apple-system, sans-serif",
                      marginTop: 2,
                    }}
                  >
                    Chris Stussy
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: colors.primary,
                        backgroundColor: "rgba(196,30,58,0.1)",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontFamily: "SF Pro Display, -apple-system, sans-serif",
                      }}
                    >
                      98% match
                    </div>
                  </div>
                </div>
              </div>

              {/* "See other sets" button */}
              <div
                style={{
                  marginTop: 12,
                  backgroundColor: "rgba(196,30,58,0.06)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: `1px solid rgba(196,30,58,0.12)`,
                  opacity: interpolate(frame, [42, 55], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  transform: `translateY(${interpolate(frame, [42, 55], [10, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.primary,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  }}
                >
                  See other sets this track was played in
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: colors.primary,
                    fontWeight: 700,
                  }}
                >
                  &rsaquo;
                </div>
              </div>
            </div>

            {/* TRACKLIST label */}
            <div
              style={{
                fontSize: 10,
                color: colors.textMuted,
                letterSpacing: 2,
                fontWeight: 600,
                marginBottom: 8,
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                opacity: frame > 55 ? 1 : 0,
              }}
            >
              FULL SETLIST
            </div>

            {/* Tracklist */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              {tracks.map((track, index) => {
                const trackDelay = 55 + index * 7;
                const trackProgress = spring({
                  frame: Math.max(0, frame - trackDelay),
                  fps,
                  config: { damping: 20, stiffness: 80 },
                });

                return (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "9px 6px",
                      borderBottom: `1px solid ${colors.borderLight}`,
                      opacity: trackProgress,
                      transform: `translateX(${(1 - trackProgress) * 40}px)`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: index === 0 ? colors.primary : colors.textMuted,
                        fontFamily: "SF Mono, monospace",
                        width: 40,
                        fontWeight: index === 0 ? 700 : 500,
                      }}
                    >
                      {track.time}
                    </div>
                    <div style={{ flex: 1, marginLeft: 8 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: index === 0 ? 700 : 600,
                          color: colors.text,
                          fontFamily: "SF Pro Display, -apple-system, sans-serif",
                        }}
                      >
                        {track.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: colors.textSecondary,
                          fontFamily: "SF Pro Display, -apple-system, sans-serif",
                          marginTop: 1,
                        }}
                      >
                        {track.artist}
                      </div>
                    </div>
                    {index === 0 && (
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: colors.primary,
                          boxShadow: "0 0 10px rgba(196,30,58,0.4)",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </IPhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5: Stats Flex ───────────────────────────────────────────────────
// Quick stats + tagline
const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const taglineProgress = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 70 },
  });

  const stats = [
    { label: "Sets", value: "50K+" },
    { label: "Tracks", value: "2M+" },
    { label: "Artists", value: "12K+" },
  ];

  const exitOpacity = interpolate(frame, [55, 68], [1, 0], {
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
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,30,58,0.1) 0%, transparent 55%)",
          opacity: taglineProgress,
        }}
      />

      {/* Tagline */}
      <div
        style={{
          opacity: taglineProgress,
          transform: `translateY(${(1 - taglineProgress) * 30}px)`,
          textAlign: "center",
          marginBottom: 60,
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: colors.text,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1.15,
          }}
        >
          Every track.
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: colors.text,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1.15,
          }}
        >
          Every set.
        </div>
        <div
          style={{
            fontSize: 58,
            fontWeight: 900,
            color: colors.primary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1.3,
            textShadow: "0 0 50px rgba(196,30,58,0.2)",
          }}
        >
          I trakd it.
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: 50,
        }}
      >
        {stats.map((stat, i) => {
          const statProgress = spring({
            frame: Math.max(0, frame - 12 - i * 8),
            fps,
            config: { damping: 18, stiffness: 70 },
          });

          return (
            <div
              key={i}
              style={{
                textAlign: "center",
                opacity: statProgress,
                transform: `translateY(${(1 - statProgress) * 25}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 46,
                  fontWeight: 900,
                  color: colors.primary,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  letterSpacing: -1,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: colors.textMuted,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginTop: 4,
                }}
              >
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 6: CTA ──────────────────────────────────────────────────────────
// TRACK'D logo + "Link in bio" TikTok style
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const subtextProgress = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 18, stiffness: 60 },
  });

  const linkProgress = spring({
    frame: Math.max(0, frame - 28),
    fps,
    config: { damping: 16, stiffness: 65 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      {/* Large background glow */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,30,58,0.12) 0%, transparent 55%)",
          transform: `scale(${1 + Math.sin(frame * 0.1) * 0.04})`,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontSize: 110,
            fontWeight: 900,
            color: colors.primary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -4,
            textShadow: "0 0 80px rgba(196,30,58,0.25)",
            opacity: logoScale,
            transform: `scale(${logoScale})`,
          }}
        >
          trakd
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: colors.text,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -0.5,
            opacity: subtextProgress,
            transform: `translateY(${(1 - subtextProgress) * 15}px)`,
          }}
        >
          Know Your Music.
        </div>

        {/* Link in bio CTA */}
        <div
          style={{
            marginTop: 20,
            opacity: linkProgress,
            transform: `translateY(${(1 - linkProgress) * 15}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: colors.primary,
              borderRadius: 16,
              padding: "16px 48px",
              boxShadow: "0 6px 30px rgba(196,30,58,0.3)",
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#FFFFFF",
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                letterSpacing: 0.5,
              }}
            >
              Download Free
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
