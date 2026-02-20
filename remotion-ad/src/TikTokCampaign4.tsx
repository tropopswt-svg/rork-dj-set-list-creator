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
  clubDark: "#0A0A0C",
};

interface Props {
  landscape?: boolean;
}

// ─── Campaign 4: Camera Tape → Record → Phone Off → Set Builds (~21s) ───────
export const TikTokCampaign4: React.FC<Props> = ({ landscape = false }) => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: colors.clubDark, overflow: "hidden" }}
    >
      {/* Scene 1: Camera tape / sticker (0-100 frames / 3.3s) */}
      <Sequence from={0} durationInFrames={105}>
        <CameraTapeScene />
      </Sequence>

      {/* Scene 2: Press record (95-215 frames / 4s) */}
      <Sequence from={95} durationInFrames={125}>
        <RecordScene />
      </Sequence>

      {/* Scene 3: Phone goes off / trakd builds (210-310 frames / 3.3s) */}
      <Sequence from={210} durationInFrames={105}>
        <PhoneOffScene />
      </Sequence>

      {/* Scene 4: Setlist building with real tracks (305-560 frames / 8.5s) */}
      <Sequence from={305} durationInFrames={260}>
        <SetlistBuildScene />
      </Sequence>

      {/* Scene 5: CTA (555-685 frames / 4.3s) */}
      <Sequence from={555} durationInFrames={130}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Scene 1: Camera Tape ──────────────────────────────────────────────────
const CameraTapeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({ frame, fps, config: { damping: 16, stiffness: 60 } });
  const textProgress = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 14, stiffness: 70 } });
  const exitOpacity = interpolate(frame, [82, 103], [1, 0], { extrapolateLeft: "clamp" });

  const shakeX = Math.sin(frame * 0.4) * 3;
  const shakeY = Math.cos(frame * 0.3) * 2;

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.clubDark, opacity: exitOpacity }}
    >
      {/* Laser streaks */}
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: 300 + i * 240,
            width: 2,
            height: 1200,
            background: `linear-gradient(180deg, rgba(196,30,58,0.2) 0%, transparent 100%)`,
            transform: `rotate(${Math.sin(frame * 0.02 + i) * 15}deg)`,
            transformOrigin: "top center",
            filter: "blur(1px)",
          }}
        />
      ))}

      {/* Phone with taped camera */}
      <div style={{ transform: `translate(${shakeX}px, ${shakeY}px) rotate(-5deg) scale(${enterProgress})`, opacity: enterProgress }}>
        <IPhoneFrame width={340} height={680}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#111",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* Dark camera viewfinder */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle, rgba(40,20,30,0.9) 0%, rgba(10,5,10,0.95) 100%)" }} />

            {/* Laser glow bleeding through */}
            <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(196,30,58,0.15) 0%, transparent 60%)", filter: "blur(20px)" }} />

            {/* Tape strip */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 400,
                height: 55,
                backgroundColor: "rgba(30,30,30,0.85)",
                transform: "translate(-50%, -50%) rotate(-12deg)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ position: "absolute", inset: 0, opacity: 0.15, background: "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.1) 8px, rgba(255,255,255,0.1) 10px)" }} />
            </div>

            {/* NO PHONES sticker */}
            <div
              style={{
                position: "absolute",
                top: "28%",
                right: "15%",
                width: 80,
                height: 80,
                borderRadius: "50%",
                backgroundColor: "rgba(200,50,50,0.9)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: "rotate(8deg)",
                border: "3px solid rgba(255,255,255,0.3)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ fontSize: 8, fontWeight: 800, color: "#FFF", fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: 1, textAlign: "center", lineHeight: 1.2 }}>NO</div>
              <div style={{ fontSize: 8, fontWeight: 800, color: "#FFF", fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: 1, textAlign: "center", lineHeight: 1.2 }}>PHONES</div>
              <div style={{ position: "absolute", width: 60, height: 3, backgroundColor: "#FFF", transform: "rotate(-45deg)", opacity: 0.8 }} />
            </div>
          </div>
        </IPhoneFrame>
      </div>

      {/* Text */}
      <div style={{ position: "absolute", bottom: 280, textAlign: "center", opacity: textProgress, transform: `translateY(${(1 - textProgress) * 20}px)` }}>
        <div style={{ fontSize: 42, fontWeight: 800, color: "#FFF", fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -1.5, lineHeight: 1.2 }}>
          they taped the cameras
        </div>
        <div style={{ fontSize: 42, fontWeight: 900, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -1.5, lineHeight: 1.2, marginTop: 4, textShadow: "0 0 40px rgba(196,30,58,0.3)" }}>
          but not the mic
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: Press Record ──────────────────────────────────────────────────
const RecordScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone entrance
  const phoneScale = spring({ frame, fps, config: { damping: 18, stiffness: 50 } });

  // Button press at frame 55
  const buttonPressed = frame > 55;
  const pressScale = buttonPressed
    ? interpolate(frame, [55, 60, 68], [1, 0.85, 1], { extrapolateRight: "clamp" })
    : 1;

  const isRecording = frame > 68;
  const recordingPulse = isRecording ? 0.6 + Math.sin((frame - 68) * 0.25) * 0.4 : 0;

  // Laser environment
  const laserPhase = frame * 0.04;

  const exitOpacity = interpolate(frame, [105, 123], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.clubDark, opacity: exitOpacity }}
    >
      {/* Lasers */}
      {[...Array(7)].map((_, i) => {
        const angle = Math.sin(laserPhase + i * 0.9) * 30;
        const opacity = 0.12 + Math.sin(frame * 0.1 + i * 2) * 0.08;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: 540 + (i - 3) * 100,
              width: 2,
              height: 1400,
              background: i % 3 === 0
                ? `linear-gradient(180deg, rgba(196,30,58,${opacity}) 0%, transparent 80%)`
                : i % 3 === 1
                  ? `linear-gradient(180deg, rgba(80,60,220,${opacity * 0.7}) 0%, transparent 80%)`
                  : `linear-gradient(180deg, rgba(30,180,120,${opacity * 0.5}) 0%, transparent 80%)`,
              transform: `rotate(${angle}deg)`,
              transformOrigin: "top center",
              filter: "blur(1px)",
            }}
          />
        );
      })}

      {/* DJ booth glow */}
      <div
        style={{
          position: "absolute",
          top: -50,
          left: "50%",
          transform: "translateX(-50%)",
          width: 700,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(196,30,58,0.12) 0%, transparent 60%)",
        }}
      />

      {/* Phone */}
      <div style={{ transform: `scale(${phoneScale})` }}>
        <IPhoneFrame width={340} height={680}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: colors.background,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              paddingTop: 55,
            }}
          >
            {/* App header */}
            <div
              style={{
                position: "absolute",
                top: 55,
                left: 20,
                fontSize: 18,
                fontWeight: 800,
                color: colors.primary,
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                letterSpacing: -0.5,
              }}
            >
              trakd
            </div>

            {/* Vinyl FAB */}
            <div
              style={{
                position: "relative",
                width: 130,
                height: 130,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${pressScale})`,
              }}
            >
              {/* Grooves */}
              <div style={{ position: "absolute", width: 130, height: 130, borderRadius: "50%", border: `1.5px solid rgba(196,30,58,${isRecording ? 0.15 + recordingPulse * 0.15 : 0.25})` }} />
              <div style={{ position: "absolute", width: 114, height: 114, borderRadius: "50%", border: `1.5px solid rgba(196,30,58,${isRecording ? 0.2 + recordingPulse * 0.2 : 0.35})` }} />
              <div style={{ position: "absolute", width: 98, height: 98, borderRadius: "50%", border: `1.5px solid rgba(196,30,58,${isRecording ? 0.25 + recordingPulse * 0.25 : 0.45})` }} />

              {/* Spinning arc */}
              <div
                style={{
                  position: "absolute",
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  border: "2px solid transparent",
                  borderTopColor: colors.primary,
                  borderRightColor: "rgba(196,30,58,0.5)",
                  transform: `rotate(${frame * (isRecording ? 8 : 3)}deg)`,
                  opacity: isRecording ? 0.7 + recordingPulse * 0.3 : 0.4,
                }}
              />

              {/* Recording glow */}
              {isRecording && (
                <div style={{ position: "absolute", width: 130, height: 130, borderRadius: "50%", boxShadow: `0 0 ${15 + recordingPulse * 25}px rgba(196,30,58,${0.2 + recordingPulse * 0.2})` }} />
              )}

              {/* Nested circles */}
              <div style={{ width: 82, height: 82, borderRadius: "50%", backgroundColor: "rgba(196,30,58,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 66, height: 66, borderRadius: "50%", backgroundColor: "rgba(196,30,58,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: "50%",
                      backgroundColor: colors.primary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 6px 16px rgba(196,30,58,0.5)",
                    }}
                  >
                    {isRecording ? (
                      <div style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: "#FFFFFF" }} />
                    ) : (
                      <div style={{ display: "flex", alignItems: "baseline" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: colors.background, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -0.3 }}>trak</span>
                        <span style={{ fontSize: 11, fontWeight: 900, color: colors.background, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -0.3 }}>d</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recording indicator */}
            {isRecording && (
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: interpolate(frame, [68, 78], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: colors.primary, opacity: recordingPulse }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.primary, fontFamily: "SF Mono, monospace" }}>
                  Recording...
                </div>
              </div>
            )}
          </div>
        </IPhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: Phone Goes Off ────────────────────────────────────────────────
const PhoneOffScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Screen goes dark (like phone locking)
  const screenDark = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  // Text: "phone goes off"
  const text1 = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 14, stiffness: 70 } });
  // Text: "trakd builds the set list"
  const text2 = spring({ frame: Math.max(0, frame - 42), fps, config: { damping: 14, stiffness: 70 } });

  const exitOpacity = interpolate(frame, [82, 98], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.clubDark, opacity: exitOpacity }}
    >
      {/* Faint background pulse */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(196,30,58,${0.04 + Math.sin(frame * 0.08) * 0.02}) 0%, transparent 55%)`,
        }}
      />

      {/* Phone screen going dark */}
      <div
        style={{
          opacity: interpolate(frame, [0, 15], [0.8, 0.3], { extrapolateRight: "clamp" }),
          transform: `scale(${interpolate(frame, [0, 15], [0.6, 0.45], { extrapolateRight: "clamp" })})`,
        }}
      >
        <div
          style={{
            width: 200,
            height: 400,
            borderRadius: 30,
            backgroundColor: `rgba(10,10,12,${0.5 + screenDark * 0.5})`,
            border: "2px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Lock icon */}
          <div
            style={{
              opacity: screenDark,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                width: 16,
                height: 12,
                borderRadius: "50% 50% 0 0",
                border: "2px solid rgba(255,255,255,0.3)",
                borderBottom: "none",
              }}
            />
            <div
              style={{
                width: 22,
                height: 16,
                borderRadius: 4,
                backgroundColor: "rgba(255,255,255,0.2)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Text */}
      <div style={{ position: "absolute", bottom: 500, textAlign: "center" }}>
        <div
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -1.5,
            opacity: text1,
            transform: `translateY(${(1 - text1) * 15}px)`,
          }}
        >
          phone goes off.
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 900,
            color: colors.primary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -1.5,
            marginTop: 8,
            opacity: text2,
            transform: `translateY(${(1 - text2) * 15}px)`,
            textShadow: "0 0 40px rgba(196,30,58,0.3)",
          }}
        >
          trakd builds the set list.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3: Setlist Building ──────────────────────────────────────────────
const SetlistBuildScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tracks = [
    { artist: "ADR & OUTTEN", title: "Good Luck", time: "0:00", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
    { artist: "Leon", title: "The Snake", time: "4:20", gradient: "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)" },
    { artist: "M-High", title: "ID", time: "8:00", gradient: "linear-gradient(135deg, #2d3436 0%, #636e72 100%)", unreleased: true },
    { artist: "Daft Punk", title: "Harder Better Faster Stronger (Luke Alessi & Jordan Brando Edit)", time: "18:26", gradient: "linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)" },
    { artist: "Special Ed", title: "Club Scene (Chris Stussy Edit)", time: "22:30", gradient: "linear-gradient(135deg, #00b894 0%, #00cec9 100%)" },
    { artist: "Across Boundaries", title: "Pumpin'", time: "26:00", gradient: "linear-gradient(135deg, #e17055 0%, #d63031 100%)" },
    { artist: "J.K. Rollin", title: "Where's The Party At?", time: "31:30", gradient: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)" },
    { artist: "Hidde Van Wee", title: "Aspire To Inspire", time: "36:30", gradient: "linear-gradient(135deg, #55a3f8 0%, #2d6cdf 100%)" },
    { artist: "Chris Stussy", title: "Won't Stop (Don't)", time: "40:00", gradient: "linear-gradient(135deg, #C41E3A 0%, #9E1830 100%)" },
    { artist: "ID", title: "ID", time: "45:13", gradient: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", unreleased: true },
    { artist: "Milion", title: "LET'S GO B$NG", time: "50:00", gradient: "linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)" },
    { artist: "Chris Stussy & S.A.M.", title: "Breather", time: "54:30", gradient: "linear-gradient(135deg, #00b894 0%, #00cec9 100%)" },
    { artist: "Papa Nugs", title: "Move It Or Lose It", time: "58:00", gradient: "linear-gradient(135deg, #ff7675 0%, #fab1a0 100%)" },
    { artist: "Julian Fijma", title: "Get Stupid", time: "1:02:30", gradient: "linear-gradient(135deg, #fdcb6e 0%, #f39c12 100%)" },
  ];

  // Phone entrance
  const phoneScale = spring({ frame, fps, config: { damping: 20, stiffness: 40 } });

  // Tracks appear one by one
  const visibleTracks = Math.min(tracks.length, Math.floor(frame / 15) + 1);

  // Scroll as tracks fill up — start scrolling after ~8 tracks visible
  const scrollOffset = interpolate(frame, [120, 250], [0, 420], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Timer counting
  const setMinutes = Math.floor(frame / 4);
  const setSeconds = Math.floor(((frame / 4) % 1) * 60);
  const setTimerDisplay = `${setMinutes}:${String(setSeconds).padStart(2, "0")}`;

  // Recording pulse
  const recordingPulse = 0.5 + Math.sin(frame * 0.15) * 0.5;

  const exitOpacity = interpolate(frame, [260, 278], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.background, opacity: exitOpacity }}
    >
      {/* Subtle background glow */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(196,30,58,0.06) 0%, transparent 55%)",
          opacity: phoneScale,
        }}
      />

      <div style={{ transform: `scale(${phoneScale})` }}>
        <IPhoneFrame width={420} height={840}>
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
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -0.5 }}>trakd</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: colors.primary, opacity: recordingPulse, boxShadow: "0 0 6px rgba(196,30,58,0.4)" }} />
                <div style={{ fontSize: 11, fontWeight: 600, color: colors.primary, fontFamily: "SF Mono, monospace" }}>
                  {setTimerDisplay}
                </div>
              </div>
            </div>

            {/* Set info card */}
            <div
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                border: `1.5px solid ${colors.primary}`,
                boxShadow: "0 4px 16px rgba(196,30,58,0.08)",
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>
                Chris Stussy
              </div>
              <div style={{ fontSize: 11, color: colors.textSecondary, fontFamily: "SF Pro Display, -apple-system, sans-serif", marginTop: 2 }}>
                Alexandra Palace • {visibleTracks} tracks identified
              </div>
            </div>

            {/* Tracklist label */}
            <div style={{ fontSize: 9, color: colors.textMuted, letterSpacing: 2, fontWeight: 600, marginBottom: 6, fontFamily: "SF Pro Display, -apple-system, sans-serif", flexShrink: 0 }}>
              BUILDING SETLIST
            </div>

            {/* Tracklist */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ transform: `translateY(${-scrollOffset}px)` }}>
                {tracks.slice(0, visibleTracks).map((track, index) => {
                  const trackFrame = frame - index * 15;
                  const trackProgress = spring({
                    frame: Math.max(0, trackFrame),
                    fps,
                    config: { damping: 14, stiffness: 90 },
                  });

                  const isNew = index === visibleTracks - 1 && trackFrame < 12;
                  const isUnreleased = (track as any).unreleased === true;
                  const isID = track.artist === "ID" && track.title === "ID";
                  const displayTitle = track.title.length > 30 ? track.title.slice(0, 28) + "..." : track.title;

                  return (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "5px 4px",
                        marginBottom: 2,
                        borderRadius: isNew ? 12 : 0,
                        backgroundColor: isNew ? "rgba(196,30,58,0.06)" : "transparent",
                        borderBottom: isNew ? "none" : `1px solid ${colors.borderLight}`,
                        opacity: trackProgress,
                        transform: `translateY(${(1 - trackProgress) * 25}px) scale(${0.95 + trackProgress * 0.05})`,
                      }}
                    >
                      {/* Thumbnail */}
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
                          boxShadow: isNew ? "0 4px 12px rgba(0,0,0,0.15)" : "0 2px 6px rgba(0,0,0,0.08)",
                          transform: `scale(${isNew ? 1.05 : 1})`,
                        }}
                      >
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,0,0,0.2) 0%, transparent 70%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.5)" }} />
                        </div>
                      </div>

                      {/* Track number */}
                      <div style={{ fontSize: 9, color: colors.textMuted, fontFamily: "SF Mono, monospace", width: 18, fontWeight: 500, flexShrink: 0, textAlign: "center" }}>
                        {String(index + 1).padStart(2, "0")}
                      </div>

                      {/* Time */}
                      <div style={{ fontSize: 9, color: colors.textMuted, fontFamily: "SF Mono, monospace", width: 38, fontWeight: 500, flexShrink: 0 }}>
                        {track.time}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: isNew ? 700 : 600, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {displayTitle}
                          </div>
                          {(isUnreleased || isID) && (
                            <div style={{ fontSize: 6, fontWeight: 800, color: "#FFF", backgroundColor: colors.primary, padding: "1px 4px", borderRadius: 3, letterSpacing: 0.5, flexShrink: 0, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>
                              {isID ? "ID" : "UNRELEASED"}
                            </div>
                          )}
                          {isNew && (
                            <div style={{ fontSize: 6, fontWeight: 700, color: colors.primary, backgroundColor: "rgba(196,30,58,0.1)", padding: "1px 4px", borderRadius: 3, flexShrink: 0, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>
                              NEW
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 9, color: colors.textSecondary, fontFamily: "SF Pro Display, -apple-system, sans-serif", marginTop: 1 }}>
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

// ─── Scene 4: CTA ──────────────────────────────────────────────────────────
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const taglineProgress = spring({ frame, fps, config: { damping: 14, stiffness: 70 } });
  const statProgress = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 14, stiffness: 65 } });
  const logoProgress = spring({ frame: Math.max(0, frame - 35), fps, config: { damping: 12, stiffness: 65 } });
  const ctaProgress = spring({ frame: Math.max(0, frame - 55), fps, config: { damping: 16, stiffness: 60 } });

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}
    >
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(196,30,58,0.12) 0%, transparent 55%)", transform: `scale(${1 + Math.sin(frame * 0.08) * 0.04})` }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div
          style={{
            fontSize: 38,
            fontWeight: 700,
            color: colors.text,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: -1,
            textAlign: "center",
            lineHeight: 1.3,
            opacity: taglineProgress,
            transform: `translateY(${(1 - taglineProgress) * 20}px)`,
          }}
        >
          no camera? no problem.
          <br />
          <span style={{ color: colors.primary, fontWeight: 900, textShadow: "0 0 40px rgba(196,30,58,0.2)" }}>
            just trak it.
          </span>
        </div>

        {/* Unreleased stat */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: colors.textSecondary,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            textAlign: "center",
            opacity: statProgress,
            transform: `translateY(${(1 - statProgress) * 12}px)`,
            letterSpacing: -0.3,
          }}
        >
          identifies unreleased tracks &amp; IDs
          <br />
          <span style={{ color: colors.primary, fontWeight: 700 }}>that no other app can find.</span>
        </div>

        <div style={{ fontSize: 100, fontWeight: 900, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -4, textShadow: "0 0 80px rgba(196,30,58,0.25)", opacity: logoProgress, transform: `scale(${logoProgress})` }}>
          trakd
        </div>

        <div style={{ opacity: ctaProgress, transform: `translateY(${(1 - ctaProgress) * 15}px)` }}>
          <div style={{ backgroundColor: colors.primary, borderRadius: 16, padding: "16px 48px", boxShadow: "0 6px 30px rgba(196,30,58,0.3)" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF", fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: 0.5 }}>
              Download Free
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
