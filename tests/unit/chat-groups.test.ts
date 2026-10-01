import { describe, expect, it } from "vitest";
import { groupFor } from "../../lib/chat/groups";

describe("history grouping", () => {
  const now = Date.parse("2026-10-02T00:30:00Z");
  const stamps = ["2026-10-02T00:05:00Z", "2026-10-01T23:55:00Z", "2026-10-01T15:00:00Z", "2026-10-01T10:00:00Z", "2026-09-30T12:00:00Z"];

  it("groups by calendar day in the given zone", () => {
    expect(stamps.map((value) => groupFor(value, now, "UTC"))).toEqual(["Today", "Yesterday", "Yesterday", "Yesterday", "Older"]);
    // UTC+7: it is 07:30 on the 2nd. The stamps are 07:05 and 06:55 on the 2nd, then 22:00 and 17:00 on the 1st, then 19:00 on the 30th.
    expect(stamps.map((value) => groupFor(value, now, "Asia/Jakarta"))).toEqual(["Today", "Today", "Yesterday", "Yesterday", "Older"]);
    // UTC-7: it is 17:30 on the 1st, so everything on the 1st is today and the 30th is yesterday.
    expect(stamps.map((value) => groupFor(value, now, "America/Los_Angeles"))).toEqual(["Today", "Today", "Today", "Today", "Yesterday"]);
  });

  it("is why the server and a browser in another zone disagree unless both use the same zone while hydrating", () => {
    // Without a fixed zone the server (UTC) and a Jakarta viewer put the same conversation under different headings...
    expect(groupFor("2026-10-01T23:55:00Z", now, "UTC")).not.toBe(groupFor("2026-10-01T23:55:00Z", now, "Asia/Jakarta"));
    // ...which is a hydration mismatch; computing both sides in UTC from the server's clock makes them identical.
    for (const value of stamps) expect(groupFor(value, now, "UTC")).toBe(groupFor(value, now, "UTC"));
  });

  it("treats a future or equal timestamp as today, and keeps working across a daylight-saving change", () => {
    expect(groupFor("2026-10-02T09:00:00Z", now, "UTC")).toBe("Today");
    const afterClockChange = Date.parse("2026-03-09T12:00:00Z"); // US clocks moved forward on 2026-03-08
    expect(groupFor("2026-03-08T12:00:00Z", afterClockChange, "America/New_York")).toBe("Yesterday");
    expect(groupFor("2026-03-09T01:00:00Z", afterClockChange, "America/New_York")).toBe("Yesterday");
  });

  it("falls back to the viewer's own zone when none is given", () => {
    expect(groupFor("2026-10-02T00:05:00Z", now)).toMatch(/Today|Yesterday/);
  });
});
