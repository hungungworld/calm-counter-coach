import { describe, expect, it } from "vitest";

import { sentenceBreaks } from "@/lib/line-breaks";

describe("sentence line breaks", () => {
  it("puts each sentence on its own line", () => {
    expect(sentenceBreaks("확인해 보겠습니다. 감사합니다.")).toBe(
      "확인해 보겠습니다.\n감사합니다.",
    );
  });

  it("breaks after a comma that joins two clauses", () => {
    expect(sentenceBreaks("환불은 어렵지만, 다른 방법을 찾겠습니다.")).toBe(
      "환불은 어렵지만,\n다른 방법을 찾겠습니다.",
    );
  });

  it("keeps commas that only list words or follow a short reply", () => {
    expect(sentenceBreaks("공감, 사과, 대안을 써요.")).toBe("공감, 사과, 대안을 써요.");
    expect(sentenceBreaks("네, 걱정되실 수 있습니다.")).toBe("네, 걱정되실 수 있습니다.");
  });

  it("splits English sentences too", () => {
    expect(sentenceBreaks("I'm sorry. Let me help.")).toBe("I'm sorry.\nLet me help.");
  });
});
