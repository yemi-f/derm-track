import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pollTask, YoucamTaskError } from "./pollTask";

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

describe("pollTask", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with the task data once task_status becomes success", async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ data: { task_status: "running" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { task_status: "running" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { task_status: "success", results: { url: "x" } } }));

    const data = await pollTask("https://example.com/task/1", { intervalMs: 1 });

    expect(data).toEqual({ task_status: "success", results: { url: "x" } });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("throws YoucamTaskError with the response's error code on task_status error", async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ data: { task_status: "error", error: "bad face", error_code: "error_lighting_dark" } })
    );

    await expect(pollTask("https://example.com/task/1", { intervalMs: 1 })).rejects.toMatchObject({
      name: "YoucamTaskError",
      code: "error_lighting_dark",
    });
  });

  it("throws with code task_timeout after exhausting maxAttempts", async () => {
    fetch.mockResolvedValue(jsonResponse({ data: { task_status: "running" } }));

    await expect(
      pollTask("https://example.com/task/1", { intervalMs: 1, maxAttempts: 3 })
    ).rejects.toMatchObject({
      name: "YoucamTaskError",
      code: "task_timeout",
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("throws when the HTTP response itself is not ok, carrying error_code", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ error: "unauthorized", error_code: "invalid_api_key" }, false));

    await expect(pollTask("https://example.com/task/1", { intervalMs: 1 })).rejects.toMatchObject({
      name: "YoucamTaskError",
      code: "invalid_api_key",
    });
  });

  it("YoucamTaskError is a real Error instance", () => {
    const err = new YoucamTaskError("boom", "some_code");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("boom");
    expect(err.code).toBe("some_code");
  });
});
