import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Img,
  staticFile,
} from "remotion";
import { IPhoneFrame } from "./components/IPhoneFrame";

// App brand colors - matching the actual app
const colors = {
  background: "#F5F0E8",
  surface: "#FFFFFF",
  surfaceLight: "#FAF7F2",
  text: "#2D2A26",
  textSecondary: "#6B6560",
  textMuted: "#9C968E",
  primary: "#C41E3A",
  primaryLight: "rgba(196, 30, 58, 0.1)",
  primaryMedium: "rgba(196, 30, 58, 0.2)",
  border: "#E8E2D9",
};

interface Props {
  landscape?: boolean;
}

export const TrackdCommercial: React.FC<Props> = ({ landscape = false }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        overflow: "hidden",
      }}
    >
      {/* Scene 1: Opening - Logo with curved arc (0-100 frames) */}
      <Sequence from={0} durationInFrames={100}>
        <OpeningScene />
      </Sequence>

      {/* Scene 2: Discover Sets - Card scroll with UI (90-320 frames) */}
      <Sequence from={90} durationInFrames={250}>
        <DiscoverScrollScene />
      </Sequence>

      {/* Scene 3: Set Detail - Tracklist (320-620 frames) */}
      <Sequence from={320} durationInFrames={320}>
        <TracklistScene />
      </Sequence>

      {/* Scene 4: Live Identify - TRACK button (620-900 frames) */}
      <Sequence from={620} durationInFrames={300}>
        <IdentifyScene />
      </Sequence>

      {/* Scene 5: Final CTA (900-1020 frames) */}
      <Sequence from={900} durationInFrames={120}>
        <FinalScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// Opening Scene - Big logo with curved arc animation
const OpeningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Arc animation - letters curve in from a circular path
  const arcProgress = interpolate(frame, [0, 35], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const subtitleOpacity = interpolate(frame, [45, 65], [0, 1], {
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [85, 100], [1, 0], {
    extrapolateLeft: "clamp",
  });

  // Individual letter animations for curved effect
  const letters = "TRACK'D".split("");
  const centerIndex = (letters.length - 1) / 2;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        opacity: exitOpacity,
      }}
    >
      {/* Large ambient glow */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(196,30,58,0.12) 0%, transparent 60%)",
          opacity: logoOpacity,
          transform: `scale(${0.7 + arcProgress * 0.3})`,
        }}
      />

      {/* Rotating arc lines */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 500 + i * 80,
            height: 500 + i * 80,
            borderRadius: "50%",
            border: `2px solid rgba(196,30,58,${0.1 + i * 0.05})`,
            opacity: logoOpacity * 0.5,
            transform: `rotate(${interpolate(frame, [0, 100], [i * 30 - 45, i * 30 + 15])}deg)`,
          }}
        />
      ))}

      <div
        style={{
          opacity: logoOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Logo with curved letter animation - MUCH BIGGER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {letters.map((letter, index) => {
            const distanceFromCenter = index - centerIndex;
            const curveAmount = Math.abs(distanceFromCenter) * 12;
            const startY = distanceFromCenter > 0 ? curveAmount * 2 : -curveAmount * 2;
            const startRotation = distanceFromCenter * 12;

            const letterY = interpolate(arcProgress, [0, 1], [startY * 2.5, 0]);
            const letterRotation = interpolate(arcProgress, [0, 1], [startRotation * 1.5, 0]);
            const letterOpacity = interpolate(arcProgress, [0, 0.4, 1], [0, 0.6, 1]);
            const letterScale = interpolate(arcProgress, [0, 1], [0.6, 1]);

            return (
              <div
                key={index}
                style={{
                  fontSize: 180,
                  fontWeight: 900,
                  color: colors.primary,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  letterSpacing: -6,
                  transform: `translateY(${letterY}px) rotate(${letterRotation}deg) scale(${letterScale})`,
                  opacity: letterOpacity,
                  textShadow: "0 0 120px rgba(196,30,58,0.4)",
                }}
              >
                {letter}
              </div>
            );
          })}
        </div>

        <div
          style={{
            opacity: subtitleOpacity,
            fontSize: 24,
            fontWeight: 500,
            color: colors.textSecondary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: 6,
            marginTop: 40,
          }}
        >
          DISCOVER • IDENTIFY • COLLECT
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Discover Scene - Card-based scroll matching the app
const DiscoverScrollScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneY = interpolate(
    spring({ frame, fps, config: { damping: 20, stiffness: 60 } }),
    [0, 1],
    [400, 0]
  );

  const phoneOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Scroll animation - cards move up
  const scrollOffset = interpolate(frame, [50, 180], [0, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const textOpacity = interpolate(frame, [25, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  const textY = interpolate(frame, [25, 50], [30, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const exitOpacity = interpolate(frame, [230, 250], [1, 0], {
    extrapolateLeft: "clamp",
  });

  // Sample sets matching app style
  const sets = [
    { artist: "Chris Stussy", venue: "Hudson River", location: "NYC", tracks: 12 },
    { artist: "Peggy Gou", venue: "Boiler Room", location: "Seoul", tracks: 18 },
    { artist: "DJ Boring", venue: "Dekmantel", location: "AMS", tracks: 15 },
    { artist: "TSHA", venue: "Fabric", location: "London", tracks: 14 },
    { artist: "Fred Again..", venue: "Coachella", location: "CA", tracks: 22 },
  ];

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        opacity: exitOpacity,
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 700, color: colors.text, letterSpacing: -1 }}>
          Discover Sets
        </div>
        <div style={{ fontSize: 20, color: colors.textSecondary, marginTop: 10 }}>
          From the world's best DJs
        </div>
      </div>

      {/* Phone */}
      <div
        style={{
          transform: `translateY(${phoneY}px)`,
          opacity: phoneOpacity,
          marginTop: 100,
        }}
      >
        <IPhoneFrame width={420} height={840}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: colors.background,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* App Header */}
            <div
              style={{
                padding: "50px 16px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ width: 40 }} />
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.primary, letterSpacing: -1 }}>
                TRACK'D
              </div>
              {/* Vinyl button */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontSize: 14, color: "#fff" }}>+</div>
              </div>
            </div>

            {/* Search Bar */}
            <div
              style={{
                margin: "0 16px 12px",
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 14, color: colors.textMuted }}>🔍</div>
              <div style={{ fontSize: 14, color: colors.textMuted }}>
                Search sets, artists, venues...
              </div>
            </div>

            {/* Filter Chips */}
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "0 16px",
                marginBottom: 16,
              }}
            >
              {/* Popular chip */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: "12px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <span style={{ fontSize: 12 }}>📈</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary }}>Popular</span>
              </div>
              {/* Recent chip - active */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  padding: "12px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 12 }}>🕐</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Recent</span>
              </div>
              {/* Dig chip */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: "12px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <span style={{ fontSize: 12 }}>⚙️</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary }}>Dig</span>
              </div>
            </div>

            {/* Set Cards - scrollable list */}
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -scrollOffset,
                  left: 0,
                  right: 0,
                  padding: "0 12px",
                }}
              >
                {sets.map((set, index) => {
                  // Centered card gets highlighted
                  const cardCenter = index * 95 - scrollOffset + 50;
                  const distanceFromCenter = Math.abs(cardCenter - 150);
                  const isSelected = distanceFromCenter < 50;
                  const scale = isSelected ? 1.03 : 0.97;
                  const opacity = isSelected ? 1 : 0.7;

                  return (
                    <div
                      key={index}
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                        transform: `scale(${scale}) translateY(${isSelected ? -4 : 0}px)`,
                        opacity,
                        boxShadow: isSelected ? "0 4px 20px rgba(196,30,58,0.15)" : "0 2px 8px rgba(0,0,0,0.05)",
                      }}
                    >
                      {/* Cover */}
                      <div
                        style={{
                          width: 70,
                          height: 70,
                          borderRadius: 10,
                          background: `linear-gradient(135deg, ${colors.primary} 0%, #8B0000 100%)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 24,
                          position: "relative",
                        }}
                      >
                        🎧
                        {/* Play button overlay */}
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            backgroundColor: "rgba(0,0,0,0.2)",
                            borderRadius: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: "rgba(0,0,0,0.5)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span style={{ fontSize: 10, color: "#fff", marginLeft: 2 }}>▶</span>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        {/* Artist chip */}
                        <div
                          style={{
                            display: "inline-flex",
                            backgroundColor: isSelected ? colors.primary : colors.surfaceLight,
                            border: `1.5px solid ${colors.primary}`,
                            borderRadius: 12,
                            padding: "3px 8px",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: isSelected ? "#fff" : colors.primary,
                            }}
                          >
                            {set.artist}
                          </span>
                        </div>

                        {/* Venue name */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                          <div
                            style={{
                              width: 3,
                              height: 14,
                              backgroundColor: isSelected ? colors.primary : colors.border,
                              borderRadius: 2,
                            }}
                          />
                          <div style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>
                            {set.venue}
                          </div>
                        </div>

                        {/* Footer */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: 6,
                          }}
                        >
                          <div
                            style={{
                              backgroundColor: "#FFF8F0",
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 9,
                              fontWeight: 700,
                              color: "#8B7355",
                            }}
                          >
                            {set.tracks} tracks
                          </div>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {/* Location badge */}
                            <div
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 3,
                                backgroundColor: "#2563EB",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <span style={{ fontSize: 7, color: "#fff" }}>📍</span>
                            </div>
                            {/* TRACK'D badge */}
                            <div
                              style={{
                                backgroundColor: colors.primary,
                                padding: "2px 4px",
                                borderRadius: 3,
                                fontSize: 7,
                                fontWeight: 900,
                                color: "#fff",
                              }}
                            >
                              T'D
                            </div>
                          </div>
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

// Tracklist Scene - matches original design
const TracklistScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const PHASE_SHOW_SCREEN = { start: 0, end: 60 };
  const PHASE_POPULATE = { start: 60, end: 100 };
  const PHASE_CLICK = { start: 100, end: 130 };
  const PHASE_PROCESS = { start: 130, end: 200 };
  const PHASE_REVEAL = { start: 200, end: 320 };

  const isShowScreen = frame < PHASE_POPULATE.start;
  const isPopulate = frame >= PHASE_POPULATE.start && frame < PHASE_CLICK.start;
  const isClick = frame >= PHASE_CLICK.start && frame < PHASE_PROCESS.start;
  const isProcess = frame >= PHASE_PROCESS.start && frame < PHASE_REVEAL.start;
  const isReveal = frame >= PHASE_REVEAL.start;

  const phoneScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  const zoomScale = interpolate(frame, [PHASE_CLICK.start, PHASE_CLICK.start + 20], [1, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const fullLink = "soundcloud.com/chris-stussy-hudson-river";
  const populateProgress = interpolate(frame, [PHASE_POPULATE.start, PHASE_POPULATE.end - 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const typedChars = Math.floor(populateProgress * fullLink.length);
  const typedLink = fullLink.slice(0, typedChars);

  const buttonPressed = frame >= PHASE_CLICK.start + 5 && frame < PHASE_CLICK.start + 15;
  const buttonScale = buttonPressed ? 0.95 : 1;
  const magicRotation = interpolate(frame, [PHASE_PROCESS.start, PHASE_PROCESS.end], [0, 1080], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const processingPulse = Math.sin((frame - PHASE_PROCESS.start) * 0.25) * 0.15 + 1;

  const tracks = [
    { artist: "Chris Stussy", title: "Soulmate", time: "0:00" },
    { artist: "Floorplan", title: "Never Grow Old", time: "6:22" },
    { artist: "DJ Boring", title: "Winona", time: "12:45" },
    { artist: "Peggy Gou", title: "Starry Night", time: "19:18" },
    { artist: "Chris Stussy", title: "Breather", time: "26:33" },
    { artist: "TSHA", title: "Sister", time: "33:10" },
    { artist: "Fred Again..", title: "Marea", time: "39:45" },
  ];

  const getTitle = () => {
    if (isShowScreen || isPopulate) return "Paste Any Link";
    if (isClick) return "Processing...";
    if (isProcess) return "Analyzing Set...";
    return "Tracklist Ready";
  };

  const exitOpacity = interpolate(frame, [300, 320], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        opacity: exitOpacity,
      }}
    >
      {isProcess && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 50% 50%, rgba(196,30,58,0.15) 0%, transparent 60%)",
            transform: `scale(${processingPulse})`,
          }}
        />
      )}

      <div style={{ position: "absolute", top: 70, textAlign: "center", width: "100%" }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: colors.text, letterSpacing: -1 }}>
          {getTitle()}
        </div>
        <div style={{ fontSize: 20, color: colors.textSecondary, marginTop: 10 }}>
          {isReveal ? "Every track timestamped" : "SoundCloud, YouTube, Mixcloud"}
        </div>
      </div>

      <div style={{ transform: `scale(${phoneScale * zoomScale})`, marginTop: 80 }}>
        <IPhoneFrame width={420} height={840}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: colors.background,
              padding: 20,
              paddingTop: 60,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {(isShowScreen || isPopulate || isClick) && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40 }}>
                <div style={{ textAlign: "center", marginBottom: 30 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: colors.text, marginBottom: 8 }}>Add New Set</div>
                  <div style={{ fontSize: 14, color: colors.textSecondary }}>Paste a link to any DJ set</div>
                </div>

                <div
                  style={{
                    width: "100%",
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: 20,
                    border: `2px solid ${frame >= PHASE_POPULATE.start ? colors.primary : colors.border}`,
                  }}
                >
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10, fontWeight: 500 }}>SET LINK</div>
                  <div
                    style={{
                      fontSize: 14,
                      color: typedLink ? colors.text : colors.textMuted,
                      fontFamily: "monospace",
                      padding: "12px 0",
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    {typedLink || "https://soundcloud.com/..."}
                    {isPopulate && <span style={{ color: colors.primary, opacity: frame % 30 < 15 ? 1 : 0 }}>|</span>}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 30,
                    backgroundColor: colors.primary,
                    borderRadius: 30,
                    padding: "16px 40px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    transform: `scale(${buttonScale})`,
                  }}
                >
                  <span style={{ fontSize: 20 }}>✨</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>Process Set</span>
                </div>
              </div>
            )}

            {isProcess && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: colors.primaryLight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 30,
                    transform: `scale(${processingPulse})`,
                  }}
                >
                  <div style={{ fontSize: 56, transform: `rotate(${magicRotation}deg)` }}>✨</div>
                </div>
                <div style={{ width: "80%", height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${interpolate(frame, [PHASE_PROCESS.start, PHASE_PROCESS.end - 5], [0, 100])}%`,
                      height: "100%",
                      backgroundColor: colors.primary,
                    }}
                  />
                </div>
                <div style={{ fontSize: 14, color: colors.textSecondary, marginTop: 16 }}>Identifying tracks...</div>
              </div>
            )}

            {isReveal && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Fixed header */}
                <div
                  style={{
                    opacity: interpolate(frame, [PHASE_REVEAL.start, PHASE_REVEAL.start + 15], [0, 1]),
                    marginBottom: 16,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: 16,
                      backgroundColor: colors.surface,
                      borderRadius: 16,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 12,
                        background: `linear-gradient(135deg, ${colors.primary} 0%, #8B0000 100%)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                      }}
                    >
                      🎧
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>Chris Stussy</div>
                      <div style={{ fontSize: 13, color: colors.textSecondary }}>Hudson River</div>
                    </div>
                    <div style={{ fontSize: 12, color: colors.primary, fontWeight: 600 }}>7 tracks</div>
                  </div>
                </div>

                {/* TRACKLIST label */}
                <div
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    marginBottom: 10,
                    letterSpacing: 1.5,
                    fontWeight: 600,
                    opacity: interpolate(frame, [PHASE_REVEAL.start + 15, PHASE_REVEAL.start + 25], [0, 1]),
                  }}
                >
                  TRACKLIST
                </div>

                {/* Tracks cascade under header */}
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {tracks.map((track, index) => {
                    const trackDelay = PHASE_REVEAL.start + 25 + index * 12;
                    const trackProgress = spring({
                      frame: Math.max(0, frame - trackDelay),
                      fps: 30,
                      config: { damping: 12, stiffness: 120 },
                    });

                    return (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "10px 0",
                          borderBottom: `1px solid ${colors.border}`,
                          opacity: trackProgress,
                          transform: `translateY(${(1 - trackProgress) * 40}px)`,
                        }}
                      >
                        <div style={{ fontSize: 11, color: colors.primary, fontFamily: "monospace", width: 42, fontWeight: 600 }}>
                          {track.time}
                        </div>
                        <div style={{ flex: 1, marginLeft: 10 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{track.title}</div>
                          <div style={{ fontSize: 12, color: colors.textSecondary }}>{track.artist}</div>
                        </div>
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

// Identify Scene with TRACK button
const IdentifyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const isListening = frame > 30 && frame < 180;
  const isIdentified = frame >= 180;
  const buttonPulse = isListening ? 1 + Math.sin(frame * 0.2) * 0.08 : 1;

  const resultOpacity = interpolate(frame, [180, 200], [0, 1], { extrapolateRight: "clamp" });
  const resultScale = spring({ frame: Math.max(0, frame - 180), fps, config: { damping: 12, stiffness: 100 } });
  const exitOpacity = interpolate(frame, [280, 300], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        opacity: exitOpacity,
      }}
    >
      {isListening && (
        <div
          style={{
            position: "absolute",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(196,30,58,0.1) 0%, transparent 70%)",
            transform: `scale(${1 + Math.sin(frame * 0.15) * 0.1})`,
          }}
        />
      )}

      <div style={{ position: "absolute", top: 70, textAlign: "center", width: "100%", opacity: interpolate(frame, [10, 30], [0, 1]) }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: colors.text, letterSpacing: -1 }}>
          {isIdentified ? "Found It" : "Listening..."}
        </div>
        <div style={{ fontSize: 20, color: colors.textSecondary, marginTop: 10 }}>
          {isIdentified ? "Even unreleased tracks" : "Identify any track instantly"}
        </div>
      </div>

      <div style={{ transform: `scale(${phoneScale})`, marginTop: 80 }}>
        <IPhoneFrame width={420} height={840}>
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
            }}
          >
            {!isIdentified ? (
              <>
                {/* TRACK Button */}
                <div
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                    backgroundColor: colors.primary,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 35,
                    transform: `scale(${buttonPulse})`,
                    boxShadow: `0 0 ${60 + Math.sin(frame * 0.2) * 20}px rgba(196,30,58,0.5)`,
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>TRACK</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 4, letterSpacing: 1 }}>TAP TO IDENTIFY</div>
                </div>

                {/* Waveform */}
                <div style={{ display: "flex", gap: 4, height: 50, alignItems: "center" }}>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 4,
                        height: 12 + Math.sin((frame * 0.25) + i * 0.5) * 18,
                        backgroundColor: colors.primary,
                        borderRadius: 2,
                        opacity: 0.5 + Math.sin((frame * 0.15) + i) * 0.3,
                      }}
                    />
                  ))}
                </div>
                <div style={{ marginTop: 25, fontSize: 16, color: colors.textSecondary }}>Listening...</div>
              </>
            ) : (
              <div style={{ opacity: resultOpacity, transform: `scale(${resultScale})`, textAlign: "center" }}>
                <div
                  style={{
                    width: 180,
                    height: 180,
                    borderRadius: 16,
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 24px",
                    boxShadow: "0 25px 50px rgba(0,0,0,0.2)",
                  }}
                >
                  <div style={{ fontSize: 56 }}>💿</div>
                </div>

                <div style={{ fontSize: 26, fontWeight: 700, color: colors.text, marginBottom: 6 }}>Breather</div>
                <div style={{ fontSize: 18, color: colors.primary, marginBottom: 16 }}>Chris Stussy</div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: colors.primaryLight,
                    padding: "8px 16px",
                    borderRadius: 24,
                    border: `1px solid ${colors.primaryMedium}`,
                  }}
                >
                  <span style={{ fontSize: 14 }}>✨</span>
                  <span style={{ fontSize: 13, color: colors.primary, fontWeight: 600 }}>UNRELEASED</span>
                </div>

                <div
                  style={{
                    marginTop: 20,
                    padding: 16,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6, letterSpacing: 1 }}>FROM SET</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>Chris Stussy Hudson River</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>26:33 timestamp</div>
                </div>
              </div>
            )}
          </div>
        </IPhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// Final Scene
const FinalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const ctaOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: "radial-gradient(circle at 50% 50%, rgba(196,30,58,0.1) 0%, transparent 60%)",
          transform: `scale(${1 + Math.sin(frame * 0.05) * 0.05})`,
        }}
      />

      <div style={{ transform: `scale(${logoScale})`, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: colors.primary,
            letterSpacing: -3,
            textShadow: "0 0 80px rgba(196,30,58,0.3)",
          }}
        >
          TRACK'D
        </div>

        <div style={{ opacity: ctaOpacity, marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: 28, fontWeight: 500, color: colors.text }}>Know Your Music</div>

          <div
            style={{
              backgroundColor: colors.text,
              borderRadius: 14,
              padding: "16px 32px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill={colors.background}>
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <div style={{ color: colors.background, fontWeight: 600, fontSize: 18 }}>Download on App Store</div>
          </div>

          <div style={{ fontSize: 15, color: colors.textSecondary }}>Free • iOS</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
