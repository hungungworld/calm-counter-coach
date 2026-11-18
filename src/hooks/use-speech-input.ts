import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_VOICE_SECONDS, type ScenarioLang } from "@/lib/roleplay-rules";

/** How the staff member's voice becomes text on this device. */
export type SpeechEngine = "live" | "recorder" | "none";
export type SpeechStatus = "idle" | "listening" | "transcribing";

export type SpokenAnswer = {
  text: string;
  /** Seconds the person actually spent speaking (pauses before and after trimmed). */
  seconds: number;
};

type Transcribe = (
  audioBase64: string,
  mime: string,
) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;

type Options = {
  lang: ScenarioLang;
  onAnswer: (answer: SpokenAnswer) => void;
  /** Server speech-to-text, used where the browser has no live recognition. */
  transcribe: Transcribe;
};

/* The Web Speech API is not in TypeScript's DOM library yet. */
type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; 0: RecognitionAlternative };
type RecognitionEvent = { results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function canRecord(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

// Live recognition can exist but be unusable (no speech service behind it). Once it
// fails that way we stop offering it for the rest of the visit.
let liveRecognitionBroken = false;

function pickEngine(): SpeechEngine {
  if (!liveRecognitionBroken && recognitionCtor()) return "live";
  if (canRecord()) return "recorder";
  return "none";
}

const SILENCE_MS = 1700;
const MIC_DENIED = "마이크를 쓸 수 없어요. 글로 답해 주세요.";
const NOTHING_HEARD = "말소리가 들리지 않았어요. 다시 눌러 말해 주세요.";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

/**
 * Push-to-talk for the practice screens. Prefers the browser's live recognition (words
 * appear while speaking, nothing is uploaded by us); otherwise records the answer and
 * sends it once for transcription. Recordings are never kept.
 */
export function useSpeechInput({ lang, onAnswer, transcribe }: Options) {
  const [engine, setEngine] = useState<SpeechEngine>("none");
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Microphone loudness 0 to 1, for the pulsing ring around the button. */
  const levelRef = useRef(0);

  const callbacks = useRef({ onAnswer, transcribe });
  callbacks.current = { onAnswer, transcribe };

  const stopper = useRef<{ stop: () => void; cancel: () => void } | null>(null);

  useEffect(() => {
    setEngine(pickEngine());
    return () => stopper.current?.cancel();
  }, []);

  const finish = useCallback((text: string, seconds: number) => {
    const clean = text.trim();
    setInterim("");
    setStatus("idle");
    levelRef.current = 0;
    if (!clean) {
      setError(NOTHING_HEARD);
      return;
    }
    callbacks.current.onAnswer({ text: clean, seconds: Math.max(0.6, seconds) });
  }, []);

  const startLive = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    // Android Chrome repeats phrases in continuous mode, so it gets single-shot mode.
    const continuous = !/Android/i.test(navigator.userAgent);
    recognition.lang = lang === "en" ? "en-US" : "ko-KR";
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let heard = "";
    let firstAt = 0;
    let lastAt = 0;
    let cancelled = false;
    let failure = "";
    let silence = 0;
    const limit = window.setTimeout(() => recognition.stop(), MAX_VOICE_SECONDS * 1000);

    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i]?.[0]?.transcript ?? "";
      }
      heard = text;
      const now = performance.now();
      if (!firstAt) firstAt = now;
      lastAt = now;
      levelRef.current = 1;
      setInterim(text.trim());
      if (continuous) {
        window.clearTimeout(silence);
        silence = window.setTimeout(() => recognition.stop(), SILENCE_MS);
      }
    };
    recognition.onerror = (event) => {
      failure = event.error;
    };
    recognition.onend = () => {
      window.clearTimeout(limit);
      window.clearTimeout(silence);
      stopper.current = null;
      if (cancelled) return;
      if (failure === "not-allowed" || failure === "audio-capture") {
        setInterim("");
        setStatus("idle");
        setError(MIC_DENIED);
        return;
      }
      if (
        failure === "network" ||
        failure === "service-not-allowed" ||
        failure === "language-not-supported"
      ) {
        // No speech service behind this browser: switch to record-and-transcribe.
        liveRecognitionBroken = true;
        const next = pickEngine();
        setEngine(next);
        setInterim("");
        setStatus("idle");
        setError(
          next === "recorder"
            ? "녹음 방식으로 바꿨어요. 마이크를 다시 눌러 주세요."
            : "이 기기에서는 음성 답변을 쓸 수 없어요. 글로 답해 주세요.",
        );
        return;
      }
      finish(heard, firstAt ? (lastAt - firstAt) / 1000 + 0.7 : 0);
    };

    stopper.current = {
      stop: () => recognition.stop(),
      cancel: () => {
        cancelled = true;
        recognition.abort();
      },
    };
    setStatus("listening");
    try {
      recognition.start();
    } catch {
      stopper.current = null;
      setStatus("idle");
      setError(MIC_DENIED);
    }
  }, [finish, lang]);

  const startRecorder = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setError(MIC_DENIED);
      return;
    }

    const mime =
      ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      ) ?? "";
    const recorder = new MediaRecorder(
      stream,
      mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : undefined,
    );
    const chunks: Blob[] = [];
    let cancelled = false;
    let voicedMs = 0;
    let lastVoiced = 0;
    let frame = 0;

    // Loudness meter: drives the button ring and ends the take after a pause.
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const audio = AudioCtor ? new AudioCtor() : null;
    const analyser = audio?.createAnalyser() ?? null;
    if (audio && analyser) {
      analyser.fftSize = 512;
      audio.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let previous = performance.now();
      const meter = (now: number) => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
        const loudness = Math.sqrt(sum / samples.length);
        levelRef.current = Math.min(1, loudness * 6);
        if (loudness > 0.03) {
          voicedMs += now - previous;
          lastVoiced = now;
        } else if (lastVoiced && now - lastVoiced > SILENCE_MS && recorder.state === "recording") {
          recorder.stop();
        }
        previous = now;
        frame = requestAnimationFrame(meter);
      };
      frame = requestAnimationFrame(meter);
    }

    const limit = window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, MAX_VOICE_SECONDS * 1000);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      window.clearTimeout(limit);
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((track) => track.stop());
      void audio?.close();
      stopper.current = null;
      levelRef.current = 0;
      if (cancelled) return;
      if (voicedMs < 250) {
        setStatus("idle");
        setError(NOTHING_HEARD);
        return;
      }
      setStatus("transcribing");
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType || mime || "audio/webm" });
        const result = await callbacks.current.transcribe(await blobToBase64(blob), blob.type);
        if (cancelled) return;
        if (result.ok) finish(result.text, voicedMs / 1000);
        else {
          setStatus("idle");
          setError(result.error);
        }
      } catch {
        setStatus("idle");
        setError("말을 글로 바꾸지 못했어요. 글로 답해 주세요.");
      }
    };

    stopper.current = {
      stop: () => {
        if (recorder.state === "recording") recorder.stop();
      },
      cancel: () => {
        cancelled = true;
        if (recorder.state === "recording") recorder.stop();
        setStatus("idle");
      },
    };
    setStatus("listening");
    recorder.start();
  }, [finish]);

  const start = useCallback(() => {
    if (stopper.current) return;
    setError(null);
    setInterim("");
    const current = pickEngine();
    setEngine(current);
    if (current === "live") startLive();
    else if (current === "recorder") void startRecorder();
    else setError("이 기기에서는 음성 답변을 쓸 수 없어요. 글로 답해 주세요.");
  }, [startLive, startRecorder]);

  /** Ends the take and keeps what was said. */
  const stop = useCallback(() => stopper.current?.stop(), []);
  /** Ends the take and throws it away. */
  const cancel = useCallback(() => {
    stopper.current?.cancel();
    stopper.current = null;
    setInterim("");
    setStatus("idle");
    levelRef.current = 0;
  }, []);

  return { engine, status, interim, error, levelRef, start, stop, cancel };
}
