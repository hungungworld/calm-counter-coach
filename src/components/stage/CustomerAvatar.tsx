import { CustomerPortrait } from "@/components/stage/CustomerPortrait";
import { getCustomerArt } from "@/lib/customer-art";
import { moodFromAnger, type Scenario } from "@/lib/roleplay-rules";
import { cn } from "@/lib/utils";

/**
 * A small face for cards and headers: a close crop of the rendered still when the
 * scenario has one, otherwise the illustrated portrait.
 */
export function CustomerAvatar({
  scenario,
  anger,
  speaking = false,
  className,
}: {
  scenario: Scenario;
  /** 0 (calm) to 100 (furious). */
  anger: number;
  speaking?: boolean;
  className?: string;
}) {
  const art = getCustomerArt(scenario.id);
  if (!art) {
    return (
      <CustomerPortrait
        look={scenario.look}
        anger={anger}
        speaking={speaking}
        className={className}
        title={`${scenario.tag} 손님`}
      />
    );
  }
  return (
    <span className={cn("block overflow-hidden", className)}>
      <img
        src={art.frames[moodFromAnger(anger)]}
        alt={`${scenario.tag} 손님`}
        draggable={false}
        className="h-full w-full scale-[1.9] object-cover"
        style={{ objectPosition: "50% 18%", transformOrigin: "50% 26%" }}
      />
    </span>
  );
}
