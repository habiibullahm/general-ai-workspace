import { describe, expect, it } from "vitest";
import { cn } from "../../lib/utils";

describe("class name utility", () => {
  it("merges conflicting Tailwind classes", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });
});
