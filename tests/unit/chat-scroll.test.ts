import { describe, expect, it } from "vitest";
import { followAfterSending, followStreamedContent, isNearBottom, stickToBottomThresholdPx, trackNearBottom } from "../../lib/chat/scroll";

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

describe("auto-follow", () => {
  it("keeps the near-bottom rule only while auto-follow is on", () => {
    expect(trackNearBottom(true, true)).toBe(true);
    expect(trackNearBottom(true, false)).toBe(false);
    expect(trackNearBottom(false, true)).toBe(false);
    expect(trackNearBottom(false, false)).toBe(false);
  });

  it("lets a sent message resume following only when auto-follow is on", () => {
    expect(followAfterSending(true)).toBe(true);
    expect(followAfterSending(false)).toBe(false);
  });

  it("does not follow streamed content when auto-follow is off", () => {
    expect(followStreamedContent(true, true)).toBe(true);
    expect(followStreamedContent(true, false)).toBe(false);
    expect(followStreamedContent(false, true)).toBe(false);
    expect(followStreamedContent(false, false)).toBe(false);
  });
});
