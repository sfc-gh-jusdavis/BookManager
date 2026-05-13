import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("vitest is wired", () => {
    expect(1 + 1).toBe(2);
  });

  it("jsdom DOM is available", () => {
    const el = document.createElement("div");
    el.textContent = "hello";
    expect(el.textContent).toBe("hello");
  });
});
