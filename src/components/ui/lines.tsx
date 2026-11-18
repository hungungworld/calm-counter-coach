import { sentenceBreaks } from "@/lib/line-breaks";
import { cn } from "@/lib/utils";

/** Text broken one sentence (or joined clause) per line. */
export function Lines({ text, className }: { text: string; className?: string }) {
  return <span className={cn("whitespace-pre-line", className)}>{sentenceBreaks(text)}</span>;
}
