// Server functions exposing the accuracy gate to client code.
import { createServerFn } from "@tanstack/react-start";
import { runAccuracyTest } from "./accuracy.server";

export const getAccuracyStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await runAccuracyTest();
    // Return a compact, client-safe summary (no raw API payload).
    return {
      passed: result.passed,
      toleranceDegrees: result.toleranceDegrees,
      benchmarkName: result.benchmarkName,
      ephemerisEngine: result.ephemerisEngine,
      julianDay: result.julianDay,
      epochUtc: result.epochUtc,
      maxDeltaDegrees: result.maxDeltaDegrees,
      failedPlanets: result.failedPlanets,
      errorMessage: result.errorMessage,
      durationMs: result.durationMs,
    };
  }
);
