import { describe, expect, it } from "vitest";
import { isNearBottom, stickToBottomThresholdPx } from "../../lib/chat/scroll";

describe("following the conversation", () => {
  const box = (scrollTop: number) => ({ scrollHeight: 2000, clientHeight: 600, scrollTop });

  it("follows while the reader is at the bottom or within the threshold", () => {
    expect(isNearBottom(box(1400))).toBe(true);
    expect(isNearBottom(box(1400 - stickToBottomThresholdPx))).toBe(true);
  });

  it("stops following once the reader has scrolled up to read", () => {
    expect(isNearBottom(box(1400 - stickToBottomThresholdPx - 1))).toBe(false);
    expect(isNearBottom(box(0))).toBe(false);
  });

  it("treats content shorter than the viewport as at the bottom", () => {
    expect(isNearBottom({ scrollHeight: 300, clientHeight: 600, scrollTop: 0 })).toBe(true);
  });
});
