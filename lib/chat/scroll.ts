// The conversation follows new content (a sent message, streaming text) only while auto-follow is on and the reader is
// at, or close to, the bottom. Scrolling up turns following off. Sending turns it back on only when auto-follow is on.
export const stickToBottomThresholdPx = 96;

export function isNearBottom(box: { scrollHeight: number; scrollTop: number; clientHeight: number }) {
  return box.scrollHeight - box.scrollTop - box.clientHeight <= stickToBottomThresholdPx;
}

export function trackNearBottom(autoFollow: boolean, nearBottom: boolean) {
  return autoFollow && nearBottom;
}

export function followAfterSending(autoFollow: boolean) {
  return autoFollow;
}

// Streaming must not pull the viewport when auto-follow is off, even if following was previously armed.
export function followStreamedContent(autoFollow: boolean, following: boolean) {
  return autoFollow && following;
}
