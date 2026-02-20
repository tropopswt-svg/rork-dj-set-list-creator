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
  border: "#E8E2D9",
  borderLight: "#F0EBE3",
  text: "#2D2A26",
  textSecondary: "rgba(45, 42, 38, 0.6)",
  textMuted: "#9C968E",
  primary: "#C41E3A",
  primaryDark: "#9E1830",
};

interface Props {
  landscape?: boolean;
}

// ─── Campaign 3: "Finlay Davies, we're coming for your job" (~20 seconds) ──
export const TikTokCampaign3: React.FC<Props> = ({ landscape = false }) => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: colors.background, overflow: "hidden" }}
    >
      {/* Scene 1: Track being identified — waveform + scanning (0-130 frames / 4.3s) */}
      <Sequence from={0} durationInFrames={135}>
        <IdentifyScene />
      </Sequence>

      {/* Scene 2: Result reveal with album art (125-230 frames / 3.5s) */}
      <Sequence from={125} durationInFrames={110}>
        <ResultRevealScene />
      </Sequence>

      {/* Scene 3: "Finlay Davies, we are coming for your job" (225-350 frames / 4.2s) */}
      <Sequence from={225} durationInFrames={130}>
        <FinlayDaviesScene />
      </Sequence>

      {/* Scene 4: Full tracklist showcase with thumbnails (345-500 frames / 5.2s) */}
      <Sequence from={345} durationInFrames={160}>
        <TracklistShowcaseScene />
      </Sequence>

      {/* Scene 5: CTA (495-600 frames / 3.5s) */}
      <Sequence from={495} durationInFrames={105}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Scene 1: Track Identification ─────────────────────────────────────────
// Waveform animation + scanning effect
const IdentifyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneScale = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 35 },
  });

  // Scanning phases
  const isListening = frame < 70;
  const isProcessing = frame >= 70 && frame < 105;
  const isFound = frame >= 105;

  // Scanning progress ring
  const scanProgress = interpolate(frame, [0, 70], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Processing spin
  const processingAngle = isProcessing ? (frame - 70) * 12 : 0;

  // "Listening..." pulse
  const listeningPulse = isListening
    ? 0.6 + Math.sin(frame * 0.2) * 0.4
    : 0;

  const exitOpacity = interpolate(frame, [115, 133], [1, 0], {
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
      {/* Phone with scanning UI */}
      <div
        style={{
          transform: `scale(${phoneScale})`,
        }}
      >
        <IPhoneFrame width={400} height={800}>
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

            {/* Large scanning circle */}
            <div
              style={{
                position: "relative",
                width: 220,
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Progress ring */}
              <svg
                width={220}
                height={220}
                style={{
                  position: "absolute",
                  transform: `rotate(-90deg)`,
                }}
              >
                {/* Background ring */}
                <circle
                  cx={110}
                  cy={110}
                  r={100}
                  fill="none"
                  stroke={colors.border}
                  strokeWidth={4}
                />
                {/* Progress arc */}
                <circle
                  cx={110}
                  cy={110}
                  r={100}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={4}
                  strokeDasharray={`${scanProgress * 628} 628`}
                  strokeLinecap="round"
                />
              </svg>

              {/* Processing spinner overlay */}
              {isProcessing && (
                <div
                  style={{
                    position: "absolute",
                    width: 220,
                    height: 220,
                    borderRadius: "50%",
                    border: `3px solid transparent`,
                    borderTopColor: colors.primary,
                    borderRightColor: colors.primary,
                    transform: `rotate(${processingAngle}deg)`,
                    opacity: 0.6,
                  }}
                />
              )}

              {/* Center content */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {isFound ? (
                  // Checkmark
                  <div
                    style={{
                      fontSize: 60,
                      color: colors.primary,
                      opacity: spring({
                        frame: Math.max(0, frame - 105),
                        fps,
                        config: { damping: 12, stiffness: 80 },
                      }),
                      transform: `scale(${spring({
                        frame: Math.max(0, frame - 105),
                        fps,
                        config: { damping: 12, stiffness: 80 },
                      })})`,
                    }}
                  >
                    {/* Checkmark using div */}
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: "50%",
                        backgroundColor: colors.primary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 12,
                          height: 22,
                          borderRight: "4px solid white",
                          borderBottom: "4px solid white",
                          transform: "rotate(45deg) translateY(-2px)",
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  // Waveform inside circle
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      height: 70,
                    }}
                  >
                    {Array.from({ length: 14 }).map((_, i) => {
                      const h = isListening
                        ? 12 +
                          Math.sin(frame * 0.3 + i * 0.7) * 22 +
                          Math.cos(frame * 0.15 + i * 1.1) * 12
                        : isProcessing
                          ? 8 + Math.sin(frame * 0.5 + i * 0.4) * 6
                          : 8;
                      return (
                        <div
                          key={i}
                          style={{
                            width: 5,
                            height: Math.max(5, h),
                            borderRadius: 3,
                            backgroundColor: colors.primary,
                            opacity: 0.4 + Math.sin(i * 0.5) * 0.3,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Status text */}
            <div
              style={{
                marginTop: 30,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: isFound ? colors.primary : colors.text,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  opacity: isListening ? listeningPulse : 1,
                }}
              >
                {isListening
                  ? "Listening..."
                  : isProcessing
                    ? "Identifying..."
                    : "trakd!"}
              </div>
              {isListening && (
                <div
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    marginTop: 6,
                  }}
                >
                  Hold your phone near the speaker
                </div>
              )}
            </div>
          </div>
        </IPhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: Result Reveal ────────────────────────────────────────────────
// Track result card with album art thumbnail
const ResultRevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardProgress = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 60 },
  });

  const detailsProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 18, stiffness: 55 },
  });

  const exitOpacity = interpolate(frame, [88, 108], [1, 0], {
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
      {/* Celebration glow */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,30,58,0.12) 0%, transparent 55%)",
          opacity: cardProgress,
          transform: `scale(${1 + Math.sin(frame * 0.08) * 0.04})`,
        }}
      />

      {/* Large result card */}
      <div
        style={{
          width: 850,
          opacity: cardProgress,
          transform: `translateY(${(1 - cardProgress) * 40}px) scale(${0.9 + cardProgress * 0.1})`,
        }}
      >
        <div
          style={{
            backgroundColor: colors.surface,
            borderRadius: 28,
            padding: 36,
            border: `2px solid ${colors.primary}`,
            boxShadow: "0 20px 60px rgba(196,30,58,0.12), 0 8px 24px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
            }}
          >
            {/* Album art thumbnail */}
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 20,
                background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Vinyl record graphic */}
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, #333 0%, #111 40%, #222 41%, #111 70%, #1a1a1a 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `rotate(${frame * 3}deg)`,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: colors.primary,
                  }}
                />
              </div>
              {/* Label overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  fontSize: 8,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  letterSpacing: 1,
                }}
              >
                VINYL
              </div>
            </div>

            {/* Track details */}
            <div
              style={{
                flex: 1,
                opacity: detailsProgress,
                transform: `translateX(${(1 - detailsProgress) * 20}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  color: colors.text,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  letterSpacing: -1,
                  lineHeight: 1.2,
                }}
              >
                Rej
              </div>
              <div
                style={{
                  fontSize: 22,
                  color: colors.textSecondary,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  fontWeight: 500,
                  marginTop: 6,
                }}
              >
                Ame
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: colors.primary,
                    backgroundColor: "rgba(196,30,58,0.1)",
                    padding: "6px 14px",
                    borderRadius: 10,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  }}
                >
                  99% match
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.textMuted,
                    backgroundColor: "rgba(45,42,38,0.06)",
                    padding: "6px 14px",
                    borderRadius: 10,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  }}
                >
                  Innervisions
                </div>
              </div>
              {/* Spotify / YouTube links */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 14,
                  opacity: interpolate(frame, [35, 50], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                {["Spotify", "YouTube", "Apple Music"].map((platform, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: colors.primary,
                      border: `1.5px solid ${colors.primary}`,
                      padding: "4px 10px",
                      borderRadius: 8,
                      fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    }}
                  >
                    {platform}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3: Finlay Davies Callout ────────────────────────────────────────
const FinlayDaviesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1Progress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 75 },
  });

  const nameProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const line3Progress = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 14, stiffness: 70 },
  });

  // Dramatic shake on name reveal
  const shakeX =
    frame > 22 && frame < 40
      ? Math.sin(frame * 3) * interpolate(frame, [22, 40], [5, 0])
      : 0;

  const exitOpacity = interpolate(frame, [108, 128], [1, 0], {
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
      {/* Dramatic glow */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,30,58,0.15) 0%, transparent 55%)",
          opacity: nameProgress,
          transform: `scale(${1 + Math.sin(frame * 0.06) * 0.06})`,
        }}
      />

      <div
        style={{
          textAlign: "center",
          padding: "0 50px",
          transform: `translateX(${shakeX}px)`,
        }}
      >
        {/* Line 1 */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: colors.text,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -1.5,
            lineHeight: 1.2,
            opacity: line1Progress,
            transform: `translateY(${(1 - line1Progress) * 20}px)`,
          }}
        >
          Finlay Davies,
        </div>

        {/* Line 2: The big one */}
        <div
          style={{
            fontSize: 58,
            fontWeight: 900,
            color: colors.primary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1.2,
            marginTop: 12,
            opacity: nameProgress,
            transform: `scale(${nameProgress})`,
            textShadow: "0 0 60px rgba(196,30,58,0.3)",
          }}
        >
          we are coming
        </div>

        {/* Line 3 */}
        <div
          style={{
            fontSize: 58,
            fontWeight: 900,
            color: colors.primary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1.2,
            marginTop: 4,
            opacity: line3Progress,
            transform: `translateY(${(1 - line3Progress) * 20}px)`,
            textShadow: "0 0 60px rgba(196,30,58,0.3)",
          }}
        >
          for your job
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Tracklist Showcase ───────────────────────────────────────────
// Rich tracklist with album art thumbnails
const TracklistShowcaseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tracks = [
    {
      artist: "Peggy Gou",
      title: "Starry Night",
      time: "0:00",
      label: "Gudu Records",
      confidence: "99%",
      gradient: "linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)",
    },
    {
      artist: "Ame",
      title: "Rej",
      time: "6:30",
      label: "Innervisions",
      confidence: "98%",
      gradient: "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)",
    },
    {
      artist: "Floating Points",
      title: "Silhouettes (i, ii, iii)",
      time: "13:15",
      label: "Ninja Tune",
      confidence: "97%",
      gradient: "linear-gradient(135deg, #2d3436 0%, #636e72 100%)",
    },
    {
      artist: "Kerri Chandler",
      title: "Rain",
      time: "19:45",
      label: "Kaoz Theory",
      confidence: "99%",
      gradient: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
    },
    {
      artist: "TSHA",
      title: "Sister",
      time: "26:20",
      label: "Ninja Tune",
      confidence: "96%",
      gradient: "linear-gradient(135deg, #00b894 0%, #00cec9 100%)",
    },
    {
      artist: "Ross From Friends",
      title: "Talk to Me You'll Understand",
      time: "33:00",
      label: "Brainfeeder",
      confidence: "95%",
      gradient: "linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)",
    },
    {
      artist: "DJ Boring",
      title: "Winona",
      time: "40:10",
      label: "E-Beamz",
      confidence: "98%",
      gradient: "linear-gradient(135deg, #55a3f8 0%, #2d6cdf 100%)",
    },
    {
      artist: "Mall Grab",
      title: "Pool Party Music",
      time: "47:30",
      label: "Steel City Dance Discs",
      confidence: "97%",
      gradient: "linear-gradient(135deg, #ff7675 0%, #d63031 100%)",
    },
    {
      artist: "Adam Port",
      title: "Planet 9",
      time: "54:00",
      label: "Keinemusik",
      confidence: "99%",
      gradient: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    },
    {
      artist: "Chris Stussy",
      title: "Saudade",
      time: "1:01:20",
      label: "PIV",
      confidence: "96%",
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
  ];

  // Scroll the list
  const scrollOffset = interpolate(
    frame,
    [60, 145],
    [0, 480],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }
  );

  // Header
  const headerProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 65 },
  });

  const exitOpacity = interpolate(frame, [140, 158], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        opacity: exitOpacity,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 0,
          width: "100%",
          padding: "0 60px",
          opacity: headerProgress,
          transform: `translateY(${(1 - headerProgress) * 20}px)`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: colors.textMuted,
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              SET TRACKLIST
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: colors.text,
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                letterSpacing: -1,
              }}
            >
              Boiler Room London
            </div>
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: colors.primary,
              fontFamily: "SF Pro Display, -apple-system, sans-serif",
              letterSpacing: -0.5,
            }}
          >
            trakd
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 10,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: colors.primary,
              fontFamily: "SF Pro Display, -apple-system, sans-serif",
            }}
          >
            10 tracks identified
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: colors.textMuted,
              fontFamily: "SF Pro Display, -apple-system, sans-serif",
            }}
          >
            1h 07m
          </div>
        </div>
      </div>

      {/* Tracklist with thumbnails */}
      <div
        style={{
          position: "absolute",
          top: 240,
          left: 0,
          width: "100%",
          padding: "0 40px",
          transform: `translateY(${-scrollOffset}px)`,
        }}
      >
        {tracks.map((track, index) => {
          const trackDelay = 15 + index * 8;
          const trackProgress = spring({
            frame: Math.max(0, frame - trackDelay),
            fps,
            config: { damping: 20, stiffness: 75 },
          });

          return (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 16px",
                marginBottom: 10,
                backgroundColor: colors.surface,
                borderRadius: 18,
                border: `1px solid ${colors.border}`,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                opacity: trackProgress,
                transform: `translateX(${(1 - trackProgress) * 50}px)`,
              }}
            >
              {/* Album art thumbnail */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  background: track.gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Vinyl disc inside */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.2) 41%, transparent 70%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "rgba(255,255,255,0.6)",
                    }}
                  />
                </div>
              </div>

              {/* Track info */}
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
                      fontSize: 18,
                      fontWeight: 700,
                      color: colors.text,
                      fontFamily: "SF Pro Display, -apple-system, sans-serif",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {track.title}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    fontWeight: 500,
                    marginTop: 3,
                  }}
                >
                  {track.artist}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 5,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: colors.primary,
                      backgroundColor: "rgba(196,30,58,0.08)",
                      padding: "2px 7px",
                      borderRadius: 5,
                      fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    }}
                  >
                    {track.confidence}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: colors.textMuted,
                      fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    }}
                  >
                    {track.label}
                  </div>
                </div>
              </div>

              {/* Timestamp */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.textMuted,
                  fontFamily: "SF Mono, monospace",
                  flexShrink: 0,
                }}
              >
                {track.time}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fade gradient at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 200,
          background: `linear-gradient(transparent, ${colors.background})`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Scene 5: CTA ──────────────────────────────────────────────────────────
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const taglineProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 70 },
  });

  const logoProgress = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 12, stiffness: 65 },
  });

  const ctaProgress = spring({
    frame: Math.max(0, frame - 45),
    fps,
    config: { damping: 16, stiffness: 60 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,30,58,0.12) 0%, transparent 55%)",
          transform: `scale(${1 + Math.sin(frame * 0.08) * 0.04})`,
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
        {/* Tagline */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: colors.text,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -1,
            textAlign: "center",
            opacity: taglineProgress,
            transform: `translateY(${(1 - taglineProgress) * 20}px)`,
          }}
        >
          better than any tracklist page.
        </div>

        {/* Logo */}
        <div
          style={{
            fontSize: 110,
            fontWeight: 900,
            color: colors.primary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -4,
            textShadow: "0 0 80px rgba(196,30,58,0.25)",
            opacity: logoProgress,
            transform: `scale(${logoProgress})`,
          }}
        >
          trakd
        </div>

        {/* Download button */}
        <div
          style={{
            opacity: ctaProgress,
            transform: `translateY(${(1 - ctaProgress) * 15}px)`,
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
