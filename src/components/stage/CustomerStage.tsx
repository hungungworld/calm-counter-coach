import { useEffect, useRef, useState, type RefObject } from "react";

import { CinematicStage } from "@/components/stage/CinematicStage";
import { CustomerPortrait } from "@/components/stage/CustomerPortrait";
import { getCustomerArt } from "@/lib/customer-art";
import type { CustomerLook, Scenario } from "@/lib/roleplay-rules";
import type { StageHandle, StageState } from "@/lib/stage/scene";
import { cn } from "@/lib/utils";

type StageProps = {
  /** Emotion temperature, 0 to 100. */
  anger: number;
  state: StageState;
  /** Mouth openness 0 to 1, written every frame by the voice hook. */
  levelRef: RefObject<number>;
  className?: string;
  children?: React.ReactNode;
};

/**
 * The customer across the counter. Scenarios that have rendered film-style stills use
 * them; the rest get the live 3D customer, and if WebGL is missing an illustrated
 * portrait. Whichever shows, it reads the same emotion temperature and speech level.
 */
export function CustomerStage({ scenario, ...props }: StageProps & { scenario: Scenario }) {
  const art = getCustomerArt(scenario.id);
  if (art) return <CinematicStage art={art} {...props} />;
  return <LiveStage look={scenario.look} {...props} />;
}

/** Real-time 3D customer. three.js loads only when this mounts. */
function LiveStage({
  look,
  anger,
  state,
  levelRef,
  className,
  children,
}: StageProps & { look: CustomerLook }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<StageHandle | null>(null);
  const latest = useRef({ anger, state });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  latest.current = { anger, state };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let handle: StageHandle | null = null;
    let observer: ResizeObserver | null = null;

    import("@/lib/stage/scene")
      .then(({ createStage }) => {
        if (cancelled) return;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        handle = createStage(canvas, look, { reducedMotion });
        handleRef.current = handle;
        handle.setAnger(latest.current.anger);
        handle.setState(latest.current.state);
        handle.setMouthSource(() => levelRef.current ?? 0);
        observer = new ResizeObserver(() => handle?.resize());
        observer.observe(canvas);
        setReady(true);
      })
      .catch((error: unknown) => {
        console.error("[stage] 3D stage could not start", error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      handle?.dispose();
      handleRef.current = null;
    };
  }, [look, levelRef]);

  // A jump or drop in temperature gets a visible body reaction, not just a new face.
  const previousAnger = useRef(anger);
  useEffect(() => {
    const handle = handleRef.current;
    const change = anger - previousAnger.current;
    previousAnger.current = anger;
    if (!handle) return;
    handle.setAnger(anger);
    if (change >= 8) handle.react("flare");
    else if (change <= -8) handle.react("relief");
  }, [anger]);

  useEffect(() => {
    handleRef.current?.setState(state);
  }, [state]);

  return (
    <div className={cn("relative overflow-hidden bg-stage", className)}>
      {failed ? (
        <div className="flex h-full w-full items-end justify-center bg-stage">
          <CustomerPortrait
            look={look}
            anger={anger}
            speaking={state === "speaking"}
            className="h-[92%] w-auto"
          />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-label="연습 상대 고객이 서 있는 매장 카운터"
          className={cn(
            "block h-full w-full transition-opacity duration-700",
            ready ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      {children}
    </div>
  );
}
