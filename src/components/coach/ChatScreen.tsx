import { useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, Mic, RotateCcw, Send, Square, X } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputController,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AngerGauge, CalmChips, EngineBadge } from "@/components/coach/parts";
import { CustomerAvatar } from "@/components/stage/CustomerAvatar";
import { Button } from "@/components/ui/button";
import { usePracticeSession, type SessionResult } from "@/hooks/use-practice-session";
import { useSpeechInput } from "@/hooks/use-speech-input";
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
import { cn } from "@/lib/utils";

type Props = {
  scenario: Scenario;
  difficulty: Difficulty;
  onExit: () => void;
  onFinish: (result: SessionResult) => void;
};

/** Written rehearsal: the same round as the stage, for places where speaking is not possible. */
export function ChatScreen(props: Props) {
  return (
    <PromptInputProvider>
      <ChatBody {...props} />
    </PromptInputProvider>
  );
}

function ChatBody({ scenario, difficulty, onExit, onFinish }: Props) {
  const session = usePracticeSession({ scenario, difficulty });
  const input = usePromptInputController().textInput;
  const transcribe = useServerFn(transcribeSpeech);
  // Seconds spent speaking the text now in the box, when it was dictated.
  const spoken = useRef<number | null>(null);

  const speech = useSpeechInput({
    lang: scenario.lang,
    transcribe: (audio, mime) => transcribe({ data: { audio, mime, lang: scenario.lang } }),
    // Dictation lands in the box for the person to check and fix; it is never sent for them.
    onAnswer: (answer) => {
      const joined = [input.value.trim(), answer.text].filter(Boolean).join(" ");
      input.setInput(joined.slice(0, MAX_REPLY_LENGTH));
      spoken.current = (spoken.current ?? 0) + answer.seconds;
    },
  });

  const handleSubmit = (message: PromptInputMessage) => {
    const seconds = spoken.current;
    const sent = session.submit(
      message.text,
      seconds === null ? {} : { viaVoice: true, speakSeconds: seconds },
    );
    if (sent) spoken.current = null;
  };

  const hints = DIFFICULTIES[difficulty].hints;
  const remaining = MAX_STAFF_TURNS - session.staffTurns;
  const listening = speech.status === "listening";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-background lg:max-w-3xl">
      <header className="border-b border-gold-soft bg-card px-5 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onExit}
            className="-ml-2 flex h-11 items-center gap-1 rounded-sm px-2 text-sm text-muted-foreground outline-none transition-opacity duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:opacity-60"
          >
            <X className="size-4" />
            그만하기
          </button>
          <div
            className={cn(
              "rounded-sm border px-3 py-1 font-serif text-lg font-bold tabular-nums",
              session.secondsLeft <= 30
                ? "border-mood-angry text-mood-angry"
                : "border-gold-soft text-primary",
            )}
            aria-label={`남은 시간 ${formatClock(session.secondsLeft)}`}
          >
            {formatClock(session.secondsLeft)}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <CustomerAvatar
            scenario={scenario}
            anger={session.anger}
            speaking={session.waiting}
            className="size-14 rounded-full border border-gold-soft bg-background"
          />
          <div className="min-w-0">
            <p className="eyebrow">{scenario.place}</p>
            <h2 className="truncate text-xl font-bold text-primary">{scenario.tag}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            답변{" "}
            <span className="font-serif text-xl font-bold text-foreground">
              {session.staffTurns}
            </span>
            /{MAX_STAFF_TURNS}
          </p>
        </div>
        <AngerGauge anger={session.anger} className="mt-3" />
      </header>

      <Conversation className="flex-1">
        <ConversationContent className="gap-6 px-5 py-6">
          <p className="mx-auto max-w-xs text-center text-sm text-muted-foreground">
            {scenario.title}. 직원이 되어 글로 답해 보세요.
          </p>
          {session.turns.map((turn, i) =>
            turn.role === "customer" ? (
              <Message key={i} from="assistant" className="max-w-[88%]">
                <span className="text-xs text-muted-foreground">손님</span>
                <MessageContent className="border-l-2 border-gold pl-4 text-[1.05rem] leading-relaxed">
                  <MessageResponse>{turn.text}</MessageResponse>
                </MessageContent>
              </Message>
            ) : (
              <Message key={i} from="user" className="max-w-[85%]">
                <MessageContent className="text-[1.05rem] leading-relaxed group-[.is-user]:rounded-md group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                  {turn.text}
                </MessageContent>
              </Message>
            ),
          )}

          {session.waiting && (
            <Message from="assistant">
              <Shimmer className="text-base">손님이 말하는 중…</Shimmer>
            </Message>
          )}

          {session.error && (
            <div className="paper-card flex flex-col gap-3 p-4" role="alert">
              <p className="text-sm text-destructive">{session.error}</p>
              <Button variant="quiet" onClick={session.retry} className="h-11 w-full">
                <RotateCcw />
                다시 시도
              </Button>
            </div>
          )}

          {session.finished && (
            <p className="text-center text-sm text-muted-foreground">
              {session.timeUp ? "시간이 다 됐어요." : "답변을 모두 했어요."} 이제 피드백을 받아
              보세요.
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-gold-soft bg-card px-4 pt-3 safe-bottom">
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
            {session.hint.line}
          </p>
        )}

        {session.feedbackReady && (
          <Button
            variant={session.finished ? "lux" : "quiet"}
            size="xl"
            className="mt-3"
            onClick={() => onFinish(session.result())}
          >
            대화 마치고 피드백 받기
            <ArrowRight />
          </Button>
        )}

        {!session.finished && (
          <>
            {(listening || speech.error) && (
              <p
                className={cn(
                  "mt-3 text-sm leading-relaxed",
                  speech.error ? "text-destructive" : "text-foreground",
                )}
                aria-live="polite"
              >
                {speech.error ?? (speech.interim || "듣고 있어요. 다 말하면 잠시 멈추세요.")}
              </p>
            )}
            <PromptInput onSubmit={handleSubmit} className="mt-3 bg-background">
              <PromptInputTextarea
                placeholder={
                  session.sendable ? "직원으로서 답을 적어 주세요" : "손님 답을 기다려요"
                }
                disabled={!session.sendable}
                maxLength={MAX_REPLY_LENGTH}
                className="min-h-14 text-base"
              />
              <PromptInputFooter>
                <PromptInputButton
                  aria-label={listening ? "말하기 끝내기" : "음성으로 받아쓰기"}
                  aria-pressed={listening}
                  disabled={
                    speech.engine === "none" ||
                    speech.status === "transcribing" ||
                    (!session.sendable && !listening)
                  }
                  className={cn("size-11", listening && "bg-mood-angry text-primary-foreground")}
                  onClick={() => (listening ? speech.stop() : speech.start())}
                >
                  {speech.status === "transcribing" ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : listening ? (
                    <Square className="size-4 fill-current" />
                  ) : (
                    <Mic className="size-5" />
                  )}
                </PromptInputButton>
                <PromptInputSubmit
                  status={session.waiting ? "submitted" : session.error ? "error" : "ready"}
                  disabled={!session.sendable}
                  aria-label="보내기"
                  className="h-11 gap-2 px-4 text-sm"
                  size="sm"
                >
                  {session.waiting ? undefined : (
                    <>
                      보내기
                      <Send className="size-4" />
                    </>
                  )}
                </PromptInputSubmit>
              </PromptInputFooter>
            </PromptInput>
            <p className="pb-1 pt-2 text-center text-xs text-muted-foreground">
              {session.staffTurns < MIN_STAFF_TURNS
                ? `${MIN_STAFF_TURNS - session.staffTurns}번 더 답하면 피드백을 받을 수 있어요`
                : `${remaining}번 더 답할 수 있어요`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
