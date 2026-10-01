// The conversation follows new content (a sent message, streaming text) only while the reader is at, or close to, the bottom.
// Scrolling up to read earlier text turns following off, so streaming never pulls the view away; sending a message turns it back on.
export const stickToBottomThresholdPx = 96;

export function isNearBottom(box: { scrollHeight: number; scrollTop: number; clientHeight: number }) {
  return box.scrollHeight - box.scrollTop - box.clientHeight <= stickToBottomThresholdPx;
}
