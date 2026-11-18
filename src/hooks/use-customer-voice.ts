import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { synthesizeSpeech } from "@/lib/roleplay.functions";
import type { Scenario } from "@/lib/roleplay-rules";

/** Where the customer's voice comes from right now. */
export type VoiceSource = "ai" | "device" | "silent";

const FEMALE_HINT =
  /yuna|sora|sunhi|heami|seoyeon|jimin|google 한국|samantha|jenny|aria|zira|female|여성/i;
const MALE_HINT = /injoon|minsu|hyunsu|bongjin|gookmin|daniel|alex|guy|david|male|남성/i;

function pickDeviceVoice(lang: "ko" | "en", gender: "f" | "m"): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(lang));
  if (voices.length === 0) return null;
  const hint = gender === "f" ? FEMALE_HINT : MALE_HINT;
  return voices.find((v) => hint.test(v.name)) ?? voices[0] ?? null;
}

// One audio context for the whole visit. Browsers only let sound start after a tap, so
// the "start" button calls primeAudio() and every later line can play on its own.
let sharedContext: AudioContext | null = null;

export function primeAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor && !sharedContext) sharedContext = new Ctor();
    void sharedContext?.resume();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      const warmUp = new SpeechSynthesisUtterance(" ");
      warmUp.volume = 0;
      window.speechSynthesis.speak(warmUp);
    }
  } catch {
    // Sound is optional; captions still carry the conversation.
  }
}

/** Mouth movement when the real loudness is not available (device voice or muted). */
function syllableShape(seconds: number): number {
  const beat = Math.abs(Math.sin(seconds * Math.PI * 5.4));
  const phrase = 0.6 + 0.4 * Math.sin(seconds * 2.1 + 0.6);
  return Math.min(1, 0.12 + beat * phrase * 0.9);
}

/**
 * Speaks the customer's lines and reports how wide the mouth should be while it does.
 * Order of preference: an AI voice acted to the emotion temperature, the device's own
 * voice, then silence with captions. Each step down happens on its own, so a missing
 * voice never blocks the practice.
 */
export function useCustomerVoice(scenario: Scenario) {
  const synthesize = useServerFn(synthesizeSpeech);
  /** True from the moment a line is requested until it has finished. */
  const [speaking, setSpeaking] = useState(false);
  /** True only while the voice is actually audible (or miming, when muted). */
  const [sounding, setSounding] = useState(false);
  const [source, setSource] = useState<VoiceSource>("device");
  const [muted, setMuted] = useState(false);

  /** Mouth openness 0 to 1, read every frame by the 3D stage. */
  const levelRef = useRef(0);
  const mutedRef = useRef(false);
  const aiVoiceWorks = useRef<boolean | null>(null);
  const token = useRef(0);
  const current = useRef<{ stop: () => void } | null>(null);
  const frame = useRef(0);

  const halt = useCallback(() => {
    cancelAnimationFrame(frame.current);
    current.current?.stop();
    current.current = null;
    levelRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    token.current += 1;
    halt();
    setSpeaking(false);
    setSounding(false);
  }, [halt]);

  useEffect(
    () => () => {
      token.current += 1;
      halt();
    },
    [halt],
  );

  /** Moves the mouth in a syllable rhythm when real loudness cannot be measured. */
  const mouthAlong = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const started = performance.now();
    const loop = (now: number) => {
      levelRef.current = syllableShape((now - started) / 1000);
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
  }, []);

  const playAi = useCallback(
    (audioBase64: string, mime: string, mine: number) =>
      new Promise<boolean>((resolve) => {
        const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
        const audio = new Audio(url);
        let analyser: AnalyserNode | null = null;
        let sourceNode: MediaElementAudioSourceNode | null = null;
        const context = sharedContext;
        if (context) {
          try {
            sourceNode = context.createMediaElementSource(audio);
            analyser = context.createAnalyser();
            analyser.fftSize = 256;
            sourceNode.connect(analyser);
            analyser.connect(context.destination);
          } catch {
            analyser = null;
          }
        }
        const samples = new Uint8Array(analyser?.fftSize ?? 0);
        let smooth = 0;
        const loudness = () => {
          if (!analyser) return syllableShape(audio.currentTime);
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
          const raw = Math.min(1, Math.sqrt(sum / samples.length) * 5.5);
          smooth += (raw - smooth) * 0.5;
          return smooth;
        };

        let settled = false;
        const done = (ok: boolean) => {
          if (settled) return;
          settled = true;
          cancelAnimationFrame(frame.current);
          levelRef.current = 0;
          audio.pause();
          sourceNode?.disconnect();
          analyser?.disconnect();
          URL.revokeObjectURL(url);
          current.current = null;
          resolve(ok);
        };
        current.current = { stop: () => done(true) };
        audio.onended = () => done(true);
        audio.onerror = () => done(false);
        audio
          .play()
          .then(() => {
            if (mine !== token.current) return done(true);
            setSounding(true);
            cancelAnimationFrame(frame.current);
            const loop = () => {
              levelRef.current = loudness();
              frame.current = requestAnimationFrame(loop);
            };
            frame.current = requestAnimationFrame(loop);
          })
          .catch(() => done(false));
      }),
    [],
  );

  const playDevice = useCallback(
    (text: string, anger: number) =>
      new Promise<boolean>((resolve) => {
        if (!("speechSynthesis" in window)) return resolve(false);
        const voice = pickDeviceVoice(scenario.lang, scenario.look.gender);
        // No voice for this language means garbled or silent output: use captions instead.
        if (!voice && window.speechSynthesis.getVoices().length > 0) return resolve(false);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = scenario.lang === "en" ? "en-US" : "ko-KR";
        if (voice) utterance.voice = voice;
        const heat = anger / 100;
        utterance.pitch = scenario.look.voice.pitch;
        utterance.rate = scenario.look.voice.rate * (0.92 + heat * 0.18);
        utterance.volume = 1;

        let settled = false;
        const guard = window.setTimeout(() => done(true), 4000 + text.length * 260);
        // Some browsers never fire onstart: assume the voice is audible shortly after.
        const assumeStarted = window.setTimeout(() => setSounding(true), 350);
        const done = (ok: boolean) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(guard);
          window.clearTimeout(assumeStarted);
          cancelAnimationFrame(frame.current);
          levelRef.current = 0;
          current.current = null;
          resolve(ok);
        };
        current.current = {
          stop: () => {
            window.speechSynthesis.cancel();
            done(true);
          },
        };
        utterance.onstart = () => setSounding(true);
        utterance.onend = () => done(true);
        utterance.onerror = () => done(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        mouthAlong();
      }),
    [mouthAlong, scenario],
  );

  const playSilent = useCallback(
    (text: string) =>
      new Promise<boolean>((resolve) => {
        const timer = window.setTimeout(() => done(), Math.min(9000, 900 + text.length * 85));
        const done = () => {
          window.clearTimeout(timer);
          cancelAnimationFrame(frame.current);
          levelRef.current = 0;
          current.current = null;
          resolve(true);
        };
        current.current = { stop: done };
        setSounding(true);
        mouthAlong();
      }),
    [mouthAlong],
  );

  /** Speaks one line and resolves when it has finished (or was stopped). */
  const speak = useCallback(
    async (text: string, anger: number) => {
      token.current += 1;
      const mine = token.current;
      halt();
      setSpeaking(true);
      try {
        if (mutedRef.current) {
          setSource("silent");
          await playSilent(text);
          return;
        }
        if (aiVoiceWorks.current !== false) {
          try {
            const result = await synthesize({ data: { scenarioId: scenario.id, text, anger } });
            if (mine !== token.current) return;
            if (result.ok) {
              aiVoiceWorks.current = true;
              setSource("ai");
              if (await playAi(result.audio, result.mime, mine)) return;
            } else {
              aiVoiceWorks.current = false;
            }
          } catch {
            aiVoiceWorks.current = false;
          }
          if (mine !== token.current) return;
        }
        setSource("device");
        if (await playDevice(text, anger)) return;
        if (mine !== token.current) return;
        setSource("silent");
        await playSilent(text);
      } finally {
        if (mine === token.current) {
          setSpeaking(false);
          setSounding(false);
        }
      }
    },
    [halt, playAi, playDevice, playSilent, scenario.id, synthesize],
  );

  const toggleMuted = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    // Muting mid-sentence cuts the line short; the caption still shows all of it.
    if (mutedRef.current) current.current?.stop();
  }, []);

  return { speak, stop, speaking, sounding, source, muted, toggleMuted, levelRef };
}
