import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Mic, RotateCcw, Send, X } from "lucide-react";
import { toast } from "sonner";

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
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { getCustomerReply } from "@/lib/roleplay.functions";
import {
  MAX_REPLY_LENGTH,
  MAX_STAFF_TURNS,
  MIN_STAFF_TURNS,
  MOOD_LABEL,
  TIME_LIMIT_SECONDS,
  canRequestFeedback,
  canSendReply,
  formatClock,
  type ChatTurn,
  type Mood,
  type Scenario,
} from "@/lib/roleplay-rules";
import { cn } from "@/lib/utils";

const moodDot: Record<Mood, string> = {
  angry: "bg-mood-angry",
  softening: "bg-mood-softening",
  calm: "bg-mood-calm",
};

export function ChatScreen({
  scenario,
  onExit,
  onFinish,
}: {
  scenario: Scenario;
  onExit: () => void;
  onFinish: (turns: ChatTurn[]) => void;
}) {
  const ask = useServerFn(getCustomerReply);
  const [turns, setTurns] = useState<ChatTurn[]>([{ role: "customer", text: scenario.firstLine }]);
  const [mood, setMood] = useState<Mood>("angry");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TIME_LIMIT_SECONDS);
  const requestId = useRef(0);

  const staffTurns = turns.filter((t) => t.role === "staff").length;
  const timeUp = secondsLeft <= 0;
  const sendable = canSendReply({ staffTurns, timeUp, waiting }) && !error;
  const feedbackReady = canRequestFeedback({ staffTurns, timeUp, waiting });
  const finished = !waiting && !error && (timeUp || staffTurns >= MAX_STAFF_TURNS);

  // Countdown pauses while the customer is "talking" so AI wait time isn't counted.
  useEffect(() => {
    if (timeUp || waiting) return;
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [timeUp, waiting]);

  const requestReply = useCallback(
    async (history: ChatTurn[]) => {
      const myId = ++requestId.current;
      setWaiting(true);
      setError(null);
      try {
        const res = await ask({ data: { scenarioId: scenario.id, turns: history } });
        if (myId !== requestId.current) return;
        if (res.ok) {
          setTurns((prev) => [...prev, { role: "customer", text: res.reply }]);
          setMood(res.mood);
        } else {
          setError(res.error);
        }
      } catch {
        if (myId === requestId.current) {
          setError("연결이 불안정해요. 다시 시도해 주세요.");
        }
      } finally {
        if (myId === requestId.current) setWaiting(false);
      }
    },
    [ask, scenario.id],
  );

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || !sendable) return;
    const next: ChatTurn[] = [...turns, { role: "staff", text: text.slice(0, MAX_REPLY_LENGTH) }];
    setTurns(next);
    void requestReply(next);
  };

  const retry = () => void requestReply(turns);

  const remainingReplies = MAX_STAFF_TURNS - staffTurns;

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="border-b border-gold-soft bg-card px-5 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onExit}
            className="-ml-2 flex h-11 items-center gap-1 px-2 text-sm text-muted-foreground"
          >
            <X className="size-4" />
            그만하기
          </button>
          <div
            className={cn(
              "rounded-sm border px-3 py-1 font-serif text-lg font-bold tabular-nums",
              secondsLeft <= 30
                ? "border-mood-angry text-mood-angry"
                : "border-gold-soft text-primary",
            )}
            aria-label={`남은 시간 ${formatClock(secondsLeft)}`}
          >
            {formatClock(secondsLeft)}
          </div>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">2단계 · {scenario.place}</p>
            <h2 className="mt-1 truncate text-xl font-bold text-primary">{scenario.tag}</h2>
          </div>
          <div className="shrink-0 text-right text-sm">
            <p className="text-muted-foreground">
              답변 <span className="font-semibold text-foreground">{staffTurns}</span>/
              {MAX_STAFF_TURNS}
            </p>
            <p className="mt-0.5 flex items-center justify-end gap-1.5 text-foreground">
              <span className={cn("size-2 rounded-full", moodDot[mood])} />
              {MOOD_LABEL[mood]}
            </p>
          </div>
        </div>
      </header>

      {/* Transcript */}
      <Conversation className="flex-1">
        <ConversationContent className="gap-6 px-5 py-6">
          <p className="mx-auto max-w-xs text-center text-sm text-muted-foreground">
            {scenario.title}. 직원이 되어 글로 답해 보세요.
          </p>
          {turns.map((t, i) =>
            t.role === "customer" ? (
              <Message key={i} from="assistant" className="max-w-[88%]">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex size-7 items-center justify-center rounded-full border border-gold bg-card font-serif text-sm font-bold text-primary">
                    손
                  </span>
                  손님
                </span>
                <MessageContent className="border-l-2 border-gold pl-4 text-[1.05rem] leading-relaxed">
                  <MessageResponse>{t.text}</MessageResponse>
                </MessageContent>
              </Message>
            ) : (
              <Message key={i} from="user" className="max-w-[85%]">
                <MessageContent className="text-[1.05rem] leading-relaxed group-[.is-user]:rounded-md group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                  {t.text}
                </MessageContent>
              </Message>
            ),
          )}

          {waiting && (
            <Message from="assistant">
              <Shimmer className="text-base">손님이 말하는 중…</Shimmer>
            </Message>
          )}

          {error && (
            <div className="paper-card flex flex-col gap-3 p-4" role="alert">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="quiet" onClick={retry} className="h-11 w-full">
                <RotateCcw />
                다시 시도
              </Button>
            </div>
          )}

          {finished && (
            <p className="text-center text-sm text-muted-foreground">
              {timeUp ? "시간이 다 됐어요." : "답변을 모두 했어요."} 이제 피드백을 받아 보세요.
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Bottom actions */}
      <div className="border-t border-gold-soft bg-card px-4 pt-3 safe-bottom">
        {feedbackReady && (
          <Button
            variant={finished ? "lux" : "quiet"}
            size="xl"
            className="mb-3"
            onClick={() => onFinish(turns)}
          >
            대화 마치고 피드백 받기
            <ArrowRight />
          </Button>
        )}

        {!finished && (
          <>
            <PromptInput onSubmit={handleSubmit} className="bg-background">
              <PromptInputTextarea
                placeholder={sendable ? "직원으로서 답을 적어 주세요" : "손님 답을 기다려요"}
                disabled={!sendable}
                maxLength={MAX_REPLY_LENGTH}
                className="min-h-14 text-base"
              />
              <PromptInputFooter>
                <PromptInputButton
                  aria-label="음성으로 답하기 (준비 중)"
                  className="size-11"
                  onClick={() => toast("음성 답변은 준비 중이에요. 지금은 글로 답해 주세요.")}
                >
                  <Mic className="size-5" />
                </PromptInputButton>
                <PromptInputSubmit
                  status={waiting ? "submitted" : error ? "error" : "ready"}
                  disabled={!sendable}
                  aria-label="보내기"
                  className="h-11 gap-1.5 px-4 text-sm"
                  size="sm"
                >
                  {waiting ? undefined : (
                    <>
                      보내기
                      <Send className="size-4" />
                    </>
                  )}
                </PromptInputSubmit>
              </PromptInputFooter>
            </PromptInput>
            <p className="pb-1 pt-2 text-center text-xs text-muted-foreground">
              {staffTurns < MIN_STAFF_TURNS
                ? `${MIN_STAFF_TURNS - staffTurns}번 더 답하면 피드백을 받을 수 있어요`
                : `${remainingReplies}번 더 답할 수 있어요`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
