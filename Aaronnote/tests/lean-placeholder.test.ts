import { describe, expect, test, vi, beforeEach, afterEach } from "@voidzero-dev/vite-plus-test";
import { parseLeanPlaceholderLine, scanMarkdownLeanPlaceholders } from "../shared/lean-placeholder.mjs";
import { CoalescedTimer } from "../src/coalesced-timer.ts";

describe("CoalescedTimer", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test("fires after the configured delay", () => {
    const fn = vi.fn();
    const t = new CoalescedTimer(100);
    t.schedule(fn);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  test("coalesces rapid calls into one trailing run", () => {
    const fn = vi.fn();
    const t = new CoalescedTimer(100);
    t.schedule(fn);
    t.schedule(fn);
    t.schedule(fn);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  test("cancel prevents the pending run", () => {
    const fn = vi.fn();
    const t = new CoalescedTimer(100);
    t.schedule(fn);
    t.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  test("sig dedup: skip when sig unchanged since last fire", () => {
    const fn = vi.fn();
    const t = new CoalescedTimer(100);
    t.schedule(fn, "abc");
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();

    // Same sig — should be a no-op
    t.schedule(fn, "abc");
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();

    // Different sig — should fire again
    t.schedule(fn, "xyz");
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("sig dedup resets when sig changes mid-pending", () => {
    const fn = vi.fn();
    const t = new CoalescedTimer(100);
    t.schedule(fn, "a");
    t.schedule(fn, "b");        // replaces pending "a" → still new sig, so it queues
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  test("cancel preserves lastSig so dedup still works after cancel", () => {
    const fn = vi.fn();
    const t = new CoalescedTimer(100);
    t.schedule(fn, "sig1");
    vi.advanceTimersByTime(100);   // fires; lastSig = "sig1"

    t.schedule(fn, "sig1");        // dedup → no-op
    t.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledOnce(); // still only one call
  });
});

describe("Lean placeholder syntax", () => {
  test("parses linked Lean selectors containing parentheses", () => {
    const line = "@@lean4(../../../../project/UNSW/ISO(202603)/GraphTensor.lean) [lean-mps0spux]";

    expect(parseLeanPlaceholderLine(line)).toMatchObject({
      selector: "../../../../project/UNSW/ISO(202603)/GraphTensor.lean",
      tag: "lean-mps0spux",
    });
    expect(scanMarkdownLeanPlaceholders(line)).toMatchObject([{
      selector: "../../../../project/UNSW/ISO(202603)/GraphTensor.lean",
      tag: "lean-mps0spux",
    }]);
  });
});
