import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Keyboard,
  Mic,
  Pencil,
  RotateCcw,
  Send,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { AngerGauge, CalmChips, EngineBadge, MicButton } from "@/components/coach/parts";
import { CustomerStage } from "@/components/stage/CustomerStage";
import { Button } from "@/components/ui/button";
import { Lines } from "@/components/ui/lines";
import { useCustomerVoice } from "@/hooks/use-customer-voice";
import { usePracticeSession, type SessionResult } from "@/hooks/use-practice-session";
import { useSpeechInput, type SpokenAnswer } from "@/hooks/use-speech-input";
import { sentenceBreaks } from "@/lib/line-breaks";
import { transcribeSpeech } from "@/lib/roleplay.functions";
import {
  DIFFICULTIES,
  MAX_REPLY_LENGTH,
  MAX_STAFF_TURNS,
  MIN_STAFF_TURNS,
  formatClock,
  getCalmStep,
  type Difficulty,
  type Scenario,
} from "@/lib/roleplay-rules";
import type { StageState } from "@/lib/stage/scene";
import { cn } from "@/lib/utils";

/** How long a recognised answer waits on screen before it is sent on its own. */
const AUTO_SEND_MS = 1600;

/** Reveals a line a few characters at a time while it is being spoken. */
function useTypewriter(text: string, running: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => setCount(0), [text]);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setCount((c) => Math.min(text.length, c + 1)), 46);
    return () => window.clearInterval(id);
  }, [running, text]);
  return count;
}

/**
 * Face-to-face rehearsal: the customer stands across the counter and speaks; the staff
 * member answers out loud (or types), and the customer reacts in voice, face and posture.
 */
export function StageScreen({
  scenario,
  difficulty,
  onExit,
  onFinish,
}: {
  scenario: Scenario;
  difficulty: Difficulty;
  onExit: () => void;
  onFinish: (result: SessionResult) => void;
}) {
  const voice = useCustomerVoice(scenario);
  // True from the moment a customer line arrives until it has been spoken in full.
  const [customerBusy, setCustomerBusy] = useState(true);
  const session = usePracticeSession({ scenario, difficulty, hold: customerBusy });
  const transcribe = useServerFn(transcribeSpeech);

  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [heard, setHeard] = useState<SpokenAnswer | null>(null);
  const readyAt = useRef(0);
  const startedAt = useRef(0);

  const speech = useSpeechInput({
    lang: scenario.lang,
    onAnswer: setHeard,
    transcribe: (audio, mime) => transcribe({ data: { audio, mime, lang: scenario.lang } }),
  });

  /* ----- the customer speaks each new line ----- */
  const customerLines = session.turns.filter((t) => t.role === "customer");
  const lineCount = customerLines.length;
  const line = customerLines[lineCount - 1];
  const speak = voice.speak;

  useEffect(() => {
    if (!line) return;
    setCustomerBusy(true);
    // The first line waits for the customer to walk up to the counter.
    const id = window.setTimeout(
      () => {
        void speak(line.text, line.anger ?? 70).then(() => {
          readyAt.current = performance.now();
          startedAt.current = 0;
          setCustomerBusy(false);
        });
      },
      lineCount === 1 ? 1300 : 150,
    );
    return () => window.clearTimeout(id);
    // Runs once per customer line; `line` is read fresh for that line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineCount]);

  // The caption keeps the app-wide rhythm: one sentence (or joined clause) per line.
  const caption = sentenceBreaks(line?.text ?? "");
  const shown = useTypewriter(caption, voice.sounding);
  const captionReady = !customerBusy || voice.sounding;
  const visibleChars = customerBusy ? shown : caption.length;

  /* ----- the staff member answers ----- */
  const canAnswer = session.sendable && !customerBusy;

  const markStart = () => {
    if (!startedAt.current) startedAt.current = performance.now();
  };

  const send = (text: string, viaVoice: boolean, speakSeconds?: number) => {
    const reaction =
      readyAt.current && startedAt.current
        ? Math.max(0, (startedAt.current - readyAt.current) / 1000)
        : undefined;
    const sent = session.submit(text, {
      viaVoice,
      ...(speakSeconds !== undefined && { speakSeconds }),
      ...(reaction !== undefined && { reactionSeconds: Math.round(reaction * 10) / 10 }),
    });
    if (sent) {
      setDraft("");
      setHeard(null);
    }
    return sent;
  };
  const sendRef = useRef(send);
  sendRef.current = send;

  // A recognised answer goes out on its own after a beat, unless the person steps in.
  // The timer is keyed to the answer alone, so the ticking clock never restarts it.
  useEffect(() => {
    if (!heard) return;
    const id = window.setTimeout(
      () => sendRef.current(heard.text, true, heard.seconds),
      AUTO_SEND_MS,
    );
    return () => window.clearTimeout(id);
  }, [heard]);

  const onMic = () => {
    if (speech.status === "listening") return speech.stop();
    if (!canAnswer || heard) return;
    markStart();
    speech.start();
  };

  const editHeard = () => {
    if (!heard) return;
    setDraft(heard.text);
    setHeard(null);
    setTyping(true);
  };

  const speakAgain = () => {
    setHeard(null);
    speech.start();
  };

  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault();
    send(draft, false);
  };

  const stageState: StageState = voice.sounding
    ? "speaking"
    : speech.status === "listening"
      ? "listening"
      : session.waiting || customerBusy
        ? "thinking"
        : "idle";

  const hints = DIFFICULTIES[difficulty].hints;
  const noVoiceInput = speech.engine === "none";
  const showTyping = typing || noVoiceInput;

  let guide = "마이크를 누르고 직원으로서 답해 보세요.";
  if (session.waiting) guide = "손님이 답을 듣고 있어요.";
  else if (customerBusy) guide = "손님 말을 끝까지 들어 주세요.";
  else if (speech.status === "listening") guide = "듣고 있어요. 다 말하면 잠시 멈추세요.";
  else if (speech.status === "transcribing") guide = "말을 글로 바꾸고 있어요.";

  return (
    <div className="flex h-dvh flex-col bg-stage lg:flex-row">
      {/* ---------- the counter ---------- */}
      <CustomerStage
        scenario={scenario}
        anger={session.anger}
        state={stageState}
        levelRef={voice.levelRef}
        className="min-h-0 flex-1 lg:h-full"
      >
        <div className="stage-scrim absolute inset-x-0 top-0 px-4 pb-12 pt-3 text-stage-foreground lg:px-8 lg:pt-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onExit}
              className="-ml-2 flex h-11 items-center gap-1 rounded-sm px-2 text-sm text-stage-foreground/80 outline-none transition-opacity duration-150 hover:text-stage-foreground focus-visible:ring-2 focus-visible:ring-gold active:opacity-60"
            >
              <X className="size-4" />
              그만하기
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={voice.toggleMuted}
                aria-label={voice.muted ? "손님 목소리 켜기" : "손님 목소리 끄기"}
                aria-pressed={voice.muted}
                className="flex size-11 items-center justify-center rounded-sm text-stage-foreground/80 outline-none transition-opacity duration-150 hover:text-stage-foreground focus-visible:ring-2 focus-visible:ring-gold active:opacity-60"
              >
                {voice.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
              <div
                className={cn(
                  "rounded-sm border px-3 py-1 font-serif text-lg font-bold tabular-nums",
                  session.secondsLeft <= 30
                    ? "border-mood-angry bg-mood-angry/25 text-stage-foreground"
                    : "border-gold-soft/60 text-stage-foreground",
                )}
                aria-label={`남은 시간 ${formatClock(session.secondsLeft)}`}
              >
                {formatClock(session.secondsLeft)}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.7rem] font-medium tracking-[0.2em] text-gold-soft">
                {scenario.place}
              </p>
              <h2 className="mt-1 truncate text-2xl font-bold">{scenario.tag}</h2>
            </div>
            <p className="shrink-0 text-sm text-stage-foreground/80">
              답변{" "}
              <span className="font-serif text-xl font-bold text-stage-foreground">
                {session.staffTurns}
              </span>
              /{MAX_STAFF_TURNS}
            </p>
          </div>
          <AngerGauge anger={session.anger} tone="stage" className="mt-3 max-w-60 lg:max-w-64" />
        </div>

        {/* what the customer is saying */}
        <div className="stage-scrim-bottom absolute inset-x-0 bottom-0 px-4 pb-4 pt-20 lg:px-8 lg:pb-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <p className="text-[0.7rem] font-medium tracking-[0.2em] text-gold-soft">손님</p>
              {voice.sounding && (
                <button
                  type="button"
                  onClick={voice.stop}
                  className="flex h-7 items-center gap-1 rounded-sm px-2 text-xs text-stage-foreground/70 outline-none transition-opacity duration-150 hover:text-stage-foreground focus-visible:ring-2 focus-visible:ring-gold active:opacity-60"
                >
                  <SkipForward className="size-3" />말 넘기기
                </button>
              )}
            </div>
            {captionReady && line ? (
              <p
                className="mt-1 font-serif text-[1.3rem] font-bold leading-snug text-stage-foreground lg:text-[1.7rem]"
                aria-live="polite"
                aria-label={line.text}
              >
                <span aria-hidden className="whitespace-pre-line">
                  {caption.slice(0, visibleChars)}
                  <span className="opacity-0">{caption.slice(visibleChars)}</span>
                </span>
              </p>
            ) : (
              <Shimmer className="mt-1 text-base text-stage-foreground/70">
                {lineCount === 1 ? "손님이 다가오고 있어요…" : "손님이 말하려고 해요…"}
              </Shimmer>
            )}
          </div>
        </div>
      </CustomerStage>

      {/* ---------- the staff member's side ---------- */}
      <section className="flex flex-col border-t border-gold-soft bg-card px-4 pt-3 safe-bottom lg:w-[27rem] lg:border-l lg:border-t-0 lg:px-6 lg:pt-6">
        {/* running log: desktop only, the phone keeps the stage large */}
        <ol className="hidden min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 lg:block">
          {session.turns.map((turn, i) => (
            <li key={i} className={cn("text-sm leading-relaxed", turn.role === "staff" && "pl-8")}>
              <p className="text-[0.7rem] font-medium tracking-[0.2em] text-gold">
                {turn.role === "staff" ? "나" : "손님"}
              </p>
              <p
                className={cn(
                  "mt-1",
                  turn.role === "staff"
                    ? "rounded-sm bg-primary px-3 py-2 text-primary-foreground"
                    : "border-l-2 border-gold pl-3 text-foreground",
                )}
              >
                <Lines text={turn.text} />
              </p>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.7rem] font-medium tracking-[0.2em] text-gold">응대 4단계</p>
          {session.engine === "sim" && <EngineBadge />}
        </div>
        <CalmChips
          covered={session.covered}
          next={hints ? session.hint?.step : null}
          className="mt-2"
        />

        {hints && session.hint && !session.finished && (
          <p className="mt-3 rounded-sm border border-gold-soft bg-background px-3 py-2 text-sm leading-relaxed">
            <span className="mr-2 font-medium text-gold">
              {getCalmStep(session.hint.step).name} 힌트
            </span>
            <Lines text={session.hint.line} />
          </p>
        )}

        <div className="mt-3 pb-1">
          {session.error ? (
            <div className="paper-card flex flex-col gap-3 p-4" role="alert">
              <p className="text-sm text-destructive">
                <Lines text={session.error} />
              </p>
              <Button variant="quiet" onClick={session.retry} className="h-11 w-full">
                <RotateCcw />
                다시 시도
              </Button>
            </div>
          ) : session.finished && !customerBusy ? (
            <div className="animate-rise space-y-2">
              <p className="text-center text-sm text-muted-foreground">
                {session.timeUp ? "시간이 다 됐어요." : "답변을 모두 했어요."} 이제 피드백을 받아
                보세요.
              </p>
              <Button variant="lux" size="xl" onClick={() => onFinish(session.result())}>
                대화 마치고 피드백 받기
                <ArrowRight />
              </Button>
            </div>
          ) : heard ? (
            <div className="animate-rise paper-card p-4">
              <p className="text-[0.7rem] font-medium tracking-[0.2em] text-gold">내가 한 말</p>
              <p className="mt-1 leading-relaxed">
                <Lines text={heard.text} />
              </p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full w-full origin-left bg-primary"
                  style={{ animation: `auto-send ${AUTO_SEND_MS}ms linear forwards` }}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="quiet" className="h-11 flex-1" onClick={speakAgain}>
                  <Mic />
                  다시 말하기
                </Button>
                <Button variant="quiet" className="h-11 flex-1" onClick={editHeard}>
                  <Pencil />
                  고치기
                </Button>
              </div>
            </div>
          ) : showTyping ? (
            <form onSubmit={submitDraft} className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => {
                  markStart();
                  setDraft(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(draft, false);
                  }
                }}
                disabled={!canAnswer}
                maxLength={MAX_REPLY_LENGTH}
                rows={2}
                placeholder={canAnswer ? "직원으로서 답을 적어 주세요" : guide}
                aria-label="직원 답변"
                className="block w-full resize-none rounded-sm border border-input bg-background px-3 py-2 text-base leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
              />
              <div className="flex gap-2">
                {!noVoiceInput && (
                  <Button
                    type="button"
                    variant="quiet"
                    className="h-12 px-4"
                    onClick={() => setTyping(false)}
                    aria-label="말로 답하기"
                  >
                    <Mic />
                    말로
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="lux"
                  className="h-12 flex-1 text-base"
                  disabled={!canAnswer || !draft.trim()}
                >
                  보내기
                  <Send />
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <p
                className={cn(
                  "min-h-12 text-center text-sm leading-relaxed",
                  speech.interim ? "text-foreground" : "text-muted-foreground",
                )}
                aria-live="polite"
              >
                <Lines text={speech.error ?? (speech.interim || guide)} />
              </p>
              <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTyping(true)}
                  className="flex h-11 items-center gap-2 justify-self-start rounded-sm px-2 text-sm text-muted-foreground outline-none transition-opacity duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:opacity-60"
                >
                  <Keyboard className="size-4" />
                  글로 답하기
                </button>
                <MicButton
                  status={speech.status}
                  levelRef={speech.levelRef}
                  disabled={!canAnswer && speech.status !== "listening"}
                  onPress={onMic}
                />
                <span />
              </div>
            </div>
          )}

          {session.feedbackReady && !session.finished && !heard && (
            <Button
              variant="quiet"
              className="mt-3 h-12 w-full"
              onClick={() => onFinish(session.result())}
            >
              대화 마치고 피드백 받기
              <ArrowRight />
            </Button>
          )}
          {!session.feedbackReady && !session.error && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {MIN_STAFF_TURNS - session.staffTurns}번 더 답하면 피드백을 받을 수 있어요
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
