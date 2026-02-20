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
  // Dark club scenes
  clubDark: "#0A0A0C",
  clubGlow: "#C41E3A",
};

interface Props {
  landscape?: boolean;
}

// ─── Campaign 2: Record & Dance (~22 seconds) ──────────────────────────────
export const TikTokCampaign2: React.FC<Props> = ({ landscape = false }) => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: colors.clubDark, overflow: "hidden" }}
    >
      {/* Scene 1: Hook — "POV: front row at a house set" (0-85 frames / 2.8s) */}
      <Sequence from={0} durationInFrames={90}>
        <HookScene />
      </Sequence>

      {/* Scene 2: Open app, hit Record Set (80-230 frames / 5s) */}
      <Sequence from={80} durationInFrames={155}>
        <RecordSetScene />
      </Sequence>

      {/* Scene 3: Phone away — dance scene (225-355 frames / 4.3s) */}
      <Sequence from={225} durationInFrames={135}>
        <DanceScene />
      </Sequence>

      {/* Scene 4: Pull phone out — full set trakd (350-490 frames / 4.7s) */}
      <Sequence from={350} durationInFrames={145}>
        <SetRevealScene />
      </Sequence>

      {/* Scene 5: "I trakd it." + CTA (485-590 frames / 3.5s) */}
      <Sequence from={485} durationInFrames={105}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Scene 1: Hook ─────────────────────────────────────────────────────────
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1Progress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const line2Progress = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const line3Progress = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const exitOpacity = interpolate(frame, [68, 88], [1, 0], {
    extrapolateLeft: "clamp",
  });

  // Strobe flicker in background
  const strobeOpacity =
    frame > 20
      ? Math.max(0, Math.sin(frame * 0.7) * 0.15 + 0.05)
      : 0;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.clubDark,
        opacity: exitOpacity,
      }}
    >
      {/* Ambient club glow */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,30,58,0.15) 0%, transparent 55%)",
          opacity: interpolate(frame, [0, 25], [0, 1]),
          transform: `scale(${1 + Math.sin(frame * 0.06) * 0.08})`,
        }}
      />

      {/* Strobe flash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(255,255,255," + strobeOpacity + ")",
        }}
      />

      <div
        style={{
          textAlign: "center",
          padding: "0 60px",
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: 4,
            textTransform: "uppercase",
            marginBottom: 20,
            opacity: line1Progress,
            transform: `translateY(${(1 - line1Progress) * 15}px)`,
          }}
        >
          POV
        </div>
        <div
          style={{
            fontSize: 54,
            fontWeight: 800,
            color: "#FFFFFF",
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1.15,
            opacity: line2Progress,
            transform: `scale(${line2Progress})`,
          }}
        >
          you're front row
        </div>
        <div
          style={{
            fontSize: 54,
            fontWeight: 900,
            color: colors.clubGlow,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1.15,
            marginTop: 6,
            opacity: line3Progress,
            transform: `scale(${line3Progress})`,
            textShadow: "0 0 60px rgba(196,30,58,0.4)",
          }}
        >
          at a house set
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: Record Set ───────────────────────────────────────────────────
const RecordSetScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone slides up from bottom
  const phoneY = interpolate(
    spring({ frame, fps, config: { damping: 22, stiffness: 35 } }),
    [0, 1],
    [700, 0]
  );

  const phoneOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  // "Record Set" button press at frame 70
  const buttonPressed = frame > 70;
  const pressScale = buttonPressed
    ? interpolate(frame, [70, 75, 82], [1, 0.92, 1], {
        extrapolateRight: "clamp",
      })
    : 1;

  // Recording state starts after press
  const isRecording = frame > 82;
  const recordingPulse = isRecording
    ? 0.6 + Math.sin((frame - 82) * 0.2) * 0.4
    : 0;

  // Timer counting up
  const timerSeconds = isRecording ? Math.floor((frame - 82) / 30) : 0;
  const timerMinutes = Math.floor(timerSeconds / 60);
  const timerDisplay = `${timerMinutes}:${String(timerSeconds % 60).padStart(2, "0")}`;

  // Track count incrementing
  const trackCount = isRecording
    ? Math.min(1, Math.floor((frame - 95) / 20))
    : 0;

  // Phone slides down (put in pocket) at frame 120
  const pocketY = frame > 115
    ? interpolate(frame, [115, 150], [0, 900], {
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.cubic),
      })
    : 0;

  const exitOpacity = interpolate(frame, [135, 153], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.clubDark,
        opacity: exitOpacity,
      }}
    >
      {/* Subtle club atmosphere */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,30,58,0.08) 0%, transparent 60%)",
          transform: `scale(${1 + Math.sin(frame * 0.05) * 0.05})`,
        }}
      />

      {/* Phone */}
      <div
        style={{
          transform: `translateY(${phoneY + pocketY}px)`,
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
              padding: 24,
              paddingTop: 60,
            }}
          >
            {/* App header */}
            <div
              style={{
                alignSelf: "flex-start",
                fontSize: 20,
                fontWeight: 800,
                color: colors.primary,
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                letterSpacing: -0.5,
                marginBottom: 30,
              }}
            >
              trakd
            </div>

            {/* Set info card */}
            <div
              style={{
                width: "100%",
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 18,
                marginBottom: 30,
                border: `1px solid ${colors.border}`,
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Now at
              </div>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 700,
                  color: colors.text,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                }}
              >
                Chris Stussy
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  marginTop: 3,
                }}
              >
                Alexandra Palace
              </div>
            </div>

            {/* Vinyl FAB Record Button — matching app design */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 24,
              }}
            >
              {/* Outer vinyl container with grooves */}
              <div
                style={{
                  position: "relative",
                  width: 160,
                  height: 160,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${pressScale * (isRecording ? 0.95 + recordingPulse * 0.03 : 1)})`,
                }}
              >
                {/* Groove 1 — outermost ring */}
                <div
                  style={{
                    position: "absolute",
                    width: 160,
                    height: 160,
                    borderRadius: "50%",
                    border: `1.5px solid rgba(196,30,58,${isRecording ? 0.15 + recordingPulse * 0.15 : 0.25})`,
                  }}
                />
                {/* Groove 2 — middle ring */}
                <div
                  style={{
                    position: "absolute",
                    width: 140,
                    height: 140,
                    borderRadius: "50%",
                    border: `1.5px solid rgba(196,30,58,${isRecording ? 0.2 + recordingPulse * 0.2 : 0.35})`,
                  }}
                />
                {/* Groove 3 — inner ring */}
                <div
                  style={{
                    position: "absolute",
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    border: `1.5px solid rgba(196,30,58,${isRecording ? 0.25 + recordingPulse * 0.25 : 0.45})`,
                  }}
                />

                {/* Spinning accent arc (pre-press and during recording) */}
                <div
                  style={{
                    position: "absolute",
                    width: 170,
                    height: 170,
                    borderRadius: "50%",
                    border: "2px solid transparent",
                    borderTopColor: colors.primary,
                    borderRightColor: `rgba(196,30,58,0.5)`,
                    transform: `rotate(${frame * (isRecording ? 6 : 3)}deg)`,
                    opacity: isRecording ? 0.6 + recordingPulse * 0.4 : interpolate(frame, [30, 50], [0, 0.5], { extrapolateRight: "clamp" }),
                  }}
                />

                {/* Recording glow */}
                {isRecording && (
                  <div
                    style={{
                      position: "absolute",
                      width: 160,
                      height: 160,
                      borderRadius: "50%",
                      boxShadow: `0 0 ${20 + recordingPulse * 30}px rgba(196,30,58,${0.2 + recordingPulse * 0.25})`,
                    }}
                  />
                )}

                {/* Center button — three nested circles like the app */}
                {/* Outer light circle */}
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: "50%",
                    backgroundColor: `rgba(196,30,58,0.1)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Middle circle */}
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      backgroundColor: `rgba(196,30,58,0.2)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {/* Inner solid button */}
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        backgroundColor: colors.primary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: `0 6px 16px rgba(196,30,58,0.5)`,
                      }}
                    >
                      {isRecording ? (
                        // Stop square
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            backgroundColor: "#FFFFFF",
                          }}
                        />
                      ) : (
                        // "trakd" text like the real FAB
                        <div style={{ display: "flex", alignItems: "baseline" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: colors.background,
                              fontFamily: "SF Pro Display, -apple-system, sans-serif",
                              letterSpacing: -0.3,
                            }}
                          >
                            trak
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              color: colors.background,
                              fontFamily: "SF Pro Display, -apple-system, sans-serif",
                              letterSpacing: -0.3,
                            }}
                          >
                            d
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* "Record a Set" label (before press) */}
              {!isRecording && frame < 70 && (
                <div
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 14,
                    padding: "12px 24px",
                    border: `1px solid ${colors.border}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    opacity: interpolate(frame, [25, 40], [0, 1], { extrapolateRight: "clamp" }),
                    transform: `translateY(${interpolate(frame, [25, 40], [10, 0], { extrapolateRight: "clamp" })}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      backgroundColor: "rgba(196,30,58,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {/* Disc icon */}
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: `2px solid ${colors.primary}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          backgroundColor: colors.primary,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.text,
                        fontFamily: "SF Pro Display, -apple-system, sans-serif",
                      }}
                    >
                      Record a Set
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        fontFamily: "SF Pro Display, -apple-system, sans-serif",
                      }}
                    >
                      Auto-ID every track at a live set
                    </div>
                  </div>
                </div>
              )}

              {/* Recording waveform + timer */}
              {isRecording && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                    opacity: interpolate(frame, [82, 95], [0, 1], {
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  {/* Waveform bars */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      height: 40,
                    }}
                  >
                    {Array.from({ length: 20 }).map((_, i) => {
                      const barScale = 0.4 + Math.sin((frame - 82) * 0.25 + i * 0.8) * 0.3 + Math.cos((frame - 82) * 0.15 + i * 1.2) * 0.2;
                      return (
                        <div
                          key={i}
                          style={{
                            width: 3,
                            height: Math.max(4, barScale * 36),
                            borderRadius: 2,
                            backgroundColor: colors.primary,
                            opacity: 0.5,
                          }}
                        />
                      );
                    })}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: colors.primary,
                        opacity: recordingPulse,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: colors.primary,
                        fontFamily: "SF Mono, monospace",
                      }}
                    >
                      {timerDisplay}
                    </div>
                  </div>
                  {trackCount > 0 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        fontFamily: "SF Pro Display, -apple-system, sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      {trackCount} track identified
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </IPhoneFrame>
      </div>

      {/* "phone goes in pocket" text overlay */}
      {frame > 118 && (
        <div
          style={{
            position: "absolute",
            bottom: 350,
            opacity: interpolate(frame, [118, 135, 148, 153], [0, 1, 1, 0], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              fontFamily: "SF Pro Display, -apple-system, sans-serif",
              letterSpacing: 1,
            }}
          >
            *phone goes in pocket*
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ─── Scene 3: Dance Scene ──────────────────────────────────────────────────
// Stylized club/dancing visualization — crowd silhouettes, strobes, bass
const DanceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // BPM-synced pulse (128 BPM = ~4.27 beats/sec = beat every ~7 frames at 30fps)
  const beatPhase = (frame % 7) / 7;
  const onBeat = beatPhase < 0.3;
  const beatIntensity = onBeat ? 1 - beatPhase / 0.3 : 0;

  // Scene energy builds over time (faster ramp for shorter scene)
  const energy = interpolate(frame, [0, 100], [0.4, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Strobe lights
  const strobeR = Math.sin(frame * 0.13) * 0.5 + 0.5;
  const strobeB = Math.cos(frame * 0.17 + 2) * 0.5 + 0.5;

  // Timer overlay counting up (set duration — faster for shorter scene)
  const setMinutes = Math.floor(frame / 3); // More accelerated time
  const setSeconds = Math.floor(((frame / 3) % 1) * 60);
  const setTimerDisplay = `${setMinutes}:${String(setSeconds).padStart(2, "0")}`;

  // Track count growing (faster)
  const trackCount = Math.min(14, Math.floor(frame / 9));

  // Crowd silhouettes data
  const crowdMembers = Array.from({ length: 20 }, (_, i) => ({
    x: (i / 20) * 1080 - 20 + Math.sin(i * 3.7) * 40,
    baseHeight: 250 + Math.sin(i * 2.3) * 80,
    bounceSpeed: 0.15 + Math.sin(i * 1.1) * 0.05,
    bounceAmount: 15 + Math.sin(i * 4.2) * 10,
    width: 50 + Math.sin(i * 1.7) * 15,
    headSize: 32 + Math.sin(i * 2.9) * 6,
    armPhase: i * 0.8,
  }));

  const exitOpacity = interpolate(frame, [115, 133], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.clubDark,
        opacity: exitOpacity,
        overflow: "hidden",
      }}
    >
      {/* Laser beams from top */}
      {[...Array(5)].map((_, i) => {
        const angle = Math.sin(frame * 0.03 + i * 1.2) * 25;
        const laserOpacity = energy * (0.15 + beatIntensity * 0.2);
        return (
          <div
            key={`laser-${i}`}
            style={{
              position: "absolute",
              top: 0,
              left: 540 + (i - 2) * 120,
              width: 3,
              height: 1200,
              background: i % 2 === 0
                ? `linear-gradient(180deg, rgba(196,30,58,${laserOpacity}) 0%, transparent 100%)`
                : `linear-gradient(180deg, rgba(80,60,220,${laserOpacity * 0.7}) 0%, transparent 100%)`,
              transform: `rotate(${angle}deg)`,
              transformOrigin: "top center",
              filter: "blur(2px)",
            }}
          />
        );
      })}

      {/* DJ booth glow at top */}
      <div
        style={{
          position: "absolute",
          top: -100,
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, rgba(196,30,58,${0.12 + beatIntensity * 0.15}) 0%, transparent 60%)`,
          filter: `blur(${10 - beatIntensity * 5}px)`,
        }}
      />

      {/* Secondary colored glow */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, rgba(80,60,220,${0.06 + strobeB * 0.06}) 0%, transparent 60%)`,
        }}
      />

      {/* Bass waveform across middle */}
      <div
        style={{
          position: "absolute",
          top: 700,
          left: 0,
          width: 1080,
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          opacity: 0.2 + beatIntensity * 0.15,
        }}
      >
        {Array.from({ length: 60 }).map((_, i) => {
          const h =
            8 +
            Math.sin(frame * 0.25 + i * 0.4) * 35 * energy +
            Math.cos(frame * 0.15 + i * 0.7) * 20 * energy +
            beatIntensity * 30 * Math.sin(i * 0.3);
          return (
            <div
              key={i}
              style={{
                width: 4,
                height: Math.max(4, h),
                borderRadius: 2,
                backgroundColor: colors.primary,
                opacity: 0.4 + Math.sin(i * 0.3) * 0.2,
              }}
            />
          );
        })}
      </div>

      {/* Crowd silhouettes at bottom */}
      {crowdMembers.map((person, i) => {
        const bounce =
          Math.sin(frame * person.bounceSpeed + person.armPhase) *
          person.bounceAmount *
          energy;
        const armUp =
          Math.sin(frame * 0.12 + person.armPhase) > 0.3 && energy > 0.6;
        const bodyY = 1920 - person.baseHeight + bounce;

        return (
          <React.Fragment key={`person-${i}`}>
            {/* Body */}
            <div
              style={{
                position: "absolute",
                left: person.x,
                top: bodyY,
                width: person.width,
                height: person.baseHeight + 100,
                backgroundColor: "rgba(0,0,0,0.85)",
                borderRadius: "20px 20px 0 0",
              }}
            />
            {/* Head */}
            <div
              style={{
                position: "absolute",
                left: person.x + (person.width - person.headSize) / 2,
                top: bodyY - person.headSize + 5,
                width: person.headSize,
                height: person.headSize,
                borderRadius: "50%",
                backgroundColor: "rgba(0,0,0,0.85)",
              }}
            />
            {/* Raised arm */}
            {armUp && (
              <div
                style={{
                  position: "absolute",
                  left: person.x + person.width * 0.6,
                  top: bodyY - person.headSize - 30 + Math.sin(frame * 0.2 + i) * 10,
                  width: 8,
                  height: 60,
                  backgroundColor: "rgba(0,0,0,0.85)",
                  borderRadius: 4,
                  transform: `rotate(${-15 + Math.sin(frame * 0.15 + i * 2) * 15}deg)`,
                  transformOrigin: "bottom center",
                }}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Strobe flash on heavy beats */}
      {beatIntensity > 0.8 && frame % 28 < 3 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: `rgba(255,255,255,${0.15 * energy})`,
          }}
        />
      )}

      {/* Recording indicator overlay — top left */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 60,
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: 0.9,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: colors.primary,
            opacity: 0.5 + Math.sin(frame * 0.15) * 0.5,
            boxShadow: "0 0 12px rgba(196,30,58,0.5)",
          }}
        />
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: "SF Mono, monospace",
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {setTimerDisplay}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "rgba(255,255,255,0.6)",
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            marginLeft: 4,
          }}
        >
          {trackCount} tracks
        </div>
      </div>

      {/* "trakd is listening" subtle text — bottom center */}
      <div
        style={{
          position: "absolute",
          bottom: 140,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: 0.5 + Math.sin(frame * 0.08) * 0.2,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: 2,
          }}
        >
          trakd is listening
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Set Reveal ───────────────────────────────────────────────────
// Pull phone back out — entire set has been tracked
const SetRevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone rises back up
  const phoneY = interpolate(
    spring({ frame, fps, config: { damping: 20, stiffness: 30 } }),
    [0, 1],
    [800, 0]
  );

  const phoneOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Background transitions from dark club to warm app feel
  const bgTransition = interpolate(frame, [0, 50], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const tracks = [
    { artist: "Chris Stussy", title: "Saudade", time: "0:00", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
    { artist: "Chris Stussy", title: "Darkness", time: "6:30", gradient: "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)" },
    { artist: "Prunk", title: "Body Language", time: "13:15", gradient: "linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)" },
    { artist: "Chris Stussy", title: "Darkness", time: "19:40", gradient: "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)", unreleased: true },
    { artist: "Folamour", title: "The Journey", time: "25:10", gradient: "linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)" },
    { artist: "Chris Stussy", title: "Mirage", time: "31:00", gradient: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)" },
    { artist: "DJ Boring", title: "Winona", time: "37:20", gradient: "linear-gradient(135deg, #55a3f8 0%, #2d6cdf 100%)" },
    { artist: "Chris Stussy", title: "Darkness (VIP)", time: "43:45", gradient: "linear-gradient(135deg, #1a1a2e 0%, #2d1a3e 100%)", unreleased: true },
    { artist: "Ame", title: "Rej", time: "50:10", gradient: "linear-gradient(135deg, #2d3436 0%, #636e72 100%)" },
    { artist: "Chris Stussy", title: "Hold On", time: "56:30", gradient: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)" },
    { artist: "Floating Points", title: "Silhouettes", time: "1:02:15", gradient: "linear-gradient(135deg, #00b894 0%, #00cec9 100%)" },
    { artist: "Chris Stussy", title: "Night Drive", time: "1:08:40", gradient: "linear-gradient(135deg, #1a1a2e 0%, #4a3f8a 100%)" },
    { artist: "Peggy Gou", title: "Starry Night", time: "1:14:00", gradient: "linear-gradient(135deg, #ff7675 0%, #d63031 100%)" },
    { artist: "Chris Stussy", title: "Closing Edit", time: "1:19:30", gradient: "linear-gradient(135deg, #636e72 0%, #2d3436 100%)" },
  ];

  // Scroll the tracklist
  const scrollOffset = interpolate(
    frame,
    [70, 125],
    [0, 380],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }
  );

  const exitOpacity = interpolate(frame, [120, 138], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: interpolate(bgTransition, [0, 1], [0, 1]) > 0.5
          ? colors.background
          : colors.clubDark,
        opacity: exitOpacity,
      }}
    >
      {/* Transitioning background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: colors.background,
          opacity: bgTransition,
        }}
      />

      {/* Phone */}
      <div
        style={{
          transform: `translateY(${phoneY}px)`,
          opacity: phoneOpacity,
        }}
      >
        <IPhoneFrame width={400} height={800}>
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
                marginBottom: 12,
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "#22C55E",
                  }}
                />
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#22C55E",
                    fontFamily: "SF Mono, monospace",
                  }}
                >
                  Set Complete
                </div>
              </div>
            </div>

            {/* Set summary card */}
            <div
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                marginBottom: 14,
                border: `1.5px solid ${colors.primary}`,
                boxShadow: "0 4px 20px rgba(196,30,58,0.1)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
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
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.6)",
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: colors.text,
                      fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    }}
                  >
                    Chris Stussy
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      fontFamily: "SF Pro Display, -apple-system, sans-serif",
                      marginTop: 2,
                    }}
                  >
                    Alexandra Palace
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      marginTop: 6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: colors.primary,
                        fontFamily: "SF Pro Display, -apple-system, sans-serif",
                      }}
                    >
                      14 tracks
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: colors.textMuted,
                        fontFamily: "SF Pro Display, -apple-system, sans-serif",
                      }}
                    >
                      1h 23m
                    </div>
                  </div>
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
                marginBottom: 6,
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
              }}
            >
              FULL SETLIST
            </div>

            {/* Scrolling tracklist */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                style={{
                  transform: `translateY(${-scrollOffset}px)`,
                }}
              >
                {tracks.map((track, index) => {
                  const trackDelay = 30 + index * 5;
                  const trackProgress = spring({
                    frame: Math.max(0, frame - trackDelay),
                    fps,
                    config: { damping: 22, stiffness: 80 },
                  });

                  const isUnreleased = (track as any).unreleased === true;

                  return (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "6px 4px",
                        gap: 10,
                        borderBottom: `1px solid ${colors.borderLight}`,
                        opacity: trackProgress,
                        transform: `translateX(${(1 - trackProgress) * 35}px)`,
                      }}
                    >
                      {/* Album art thumbnail */}
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 8,
                          background: track.gradient,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                        }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.15) 51%, transparent 70%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: "50%",
                              backgroundColor: "rgba(255,255,255,0.5)",
                            }}
                          />
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div
                        style={{
                          fontSize: 9,
                          color: colors.textMuted,
                          fontFamily: "SF Mono, monospace",
                          width: 42,
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        {track.time}
                      </div>

                      {/* Track info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: colors.text,
                              fontFamily: "SF Pro Display, -apple-system, sans-serif",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {track.title}
                          </div>
                          {isUnreleased && (
                            <div
                              style={{
                                fontSize: 7,
                                fontWeight: 800,
                                color: "#FFFFFF",
                                backgroundColor: colors.primary,
                                padding: "1px 4px",
                                borderRadius: 3,
                                letterSpacing: 0.5,
                                flexShrink: 0,
                                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                              }}
                            >
                              UNRELEASED
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: colors.textSecondary,
                            fontFamily: "SF Pro Display, -apple-system, sans-serif",
                            marginTop: 1,
                          }}
                        >
                          {track.artist}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </IPhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5: CTA ──────────────────────────────────────────────────────────
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "I trakd it." reveal
  const taglineProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 70 },
  });

  // Logo
  const logoProgress = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 12, stiffness: 65 },
  });

  // CTA button
  const ctaProgress = spring({
    frame: Math.max(0, frame - 50),
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
      {/* Red glow */}
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
          gap: 30,
        }}
      >
        {/* "I trakd it." tagline */}
        <div
          style={{
            fontSize: 62,
            fontWeight: 900,
            color: colors.text,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -2.5,
            opacity: taglineProgress,
            transform: `scale(${taglineProgress})`,
          }}
        >
          I{" "}
          <span
            style={{
              color: colors.primary,
              textShadow: "0 0 50px rgba(196,30,58,0.25)",
            }}
          >
            trakd
          </span>{" "}
          it.
        </div>

        {/* Logo */}
        <div
          style={{
            fontSize: 100,
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

        {/* Download CTA */}
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
