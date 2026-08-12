export class YoucamTaskError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "YoucamTaskError";
    this.code = code;
  }
}

// Shared polling helper for YouCam's async task endpoints (Analysis, Simulation).
// Polls GET {url} until task_status is "success" or "error". YouCam's docs note
// execution time isn't guaranteed, so the default budget is generous (2 minutes).
export async function pollTask(url, { intervalMs = 2000, maxAttempts = 60 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.YOUCAM_API_KEY}` },
    });
    const json = await res.json();

    if (!res.ok) {
      throw new YoucamTaskError(
        json.error || "YouCam task request failed",
        json.error_code
      );
    }

    const status = json.data?.task_status;
    console.log(`[pollTask] attempt ${i + 1}/${maxAttempts}: ${status}`);

    if (status === "success") return json.data;
    if (status === "error") {
      throw new YoucamTaskError(
        json.data?.error || "YouCam task failed",
        json.data?.error_code || json.data?.error
      );
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new YoucamTaskError("YouCam task timed out", "task_timeout");
}
