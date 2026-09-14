import { describe, expect, test } from "vitest";
import { mapSequential, mapWithConcurrency } from "./concurrency";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe("mapWithConcurrency", () => {
  test("returns results in input order", async () => {
    const results = await mapWithConcurrency([3, 1, 2], 2, async (n) => {
      await new Promise((resolve) => setTimeout(resolve, n));
      return n * 10;
    });

    expect(results).toEqual([
      { status: "fulfilled", value: 30 },
      { status: "fulfilled", value: 10 },
      { status: "fulfilled", value: 20 },
    ]);
  });

  test("captures failures without dropping other items", async () => {
    const results = await mapWithConcurrency(["ok", "boom"], 2, async (item) => {
      if (item === "boom") throw new Error("boom");
      return item;
    });

    expect(results[0]).toEqual({ status: "fulfilled", value: "ok" });
    expect(results[1]?.status).toBe("rejected");
  });

  test("never runs more than the limit at once", async () => {
    let active = 0;
    let peak = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await tick();
      active -= 1;
    });

    expect(peak).toBe(2);
  });

  test("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 3, async () => 1)).toEqual([]);
  });
});

describe("mapSequential", () => {
  test("runs items one after another in order", async () => {
    const started: number[] = [];

    const results = await mapSequential([1, 2, 3], async (n, index) => {
      started.push(n);
      await tick();
      return n + index;
    });

    expect(started).toEqual([1, 2, 3]);
    expect(results).toEqual([1, 3, 5]);
  });
});
