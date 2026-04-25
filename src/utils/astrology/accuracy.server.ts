// Server-only Swiss Ephemeris accuracy gate.
// Runs Kyle Merritt's reference chart through FreeAstro and verifies all
// planetary longitudes match expected Swiss Ephemeris values within tolerance.
// On failure, logs full diagnostic context (engine, JD, epoch, deltas) to both
// the Worker console and the accuracy_test_runs table for reproducibility.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callFreeAstro } from "./freeastro.server";
import type {
  AccuracyDelta,
  AccuracyTestResult,
  BirthInput,
  PlanetName,
} from "./types";

export const ACCURACY_TOLERANCE_DEG = 0.5;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Kyle Merritt — 1984-10-25 15:45 EST, Cincinnati, OH
// Cincinnati: 39.1031° N, 84.5120° W. EST = UTC-5 (no DST in late Oct 1984
// after the rules change — but Oct 25 1984 in Cincinnati was still EDT, UTC-4.
// We pass UTC-4 to match standard astrology software outputs for this date.)
export const KYLE_MERRITT_BIRTH: BirthInput = {
  name: "Kyle Merritt",
  birthDate: "1984-10-25",
  birthTime: "15:45",
  city: "Cincinnati",
  country: "USA",
  latitude: 39.1031,
  longitude: -84.512,
  timezoneOffsetHours: -4,
};

// Expected ecliptic longitudes (degrees, geocentric, tropical) per Swiss
// Ephemeris for the chart above. These are the authoritative reference values
// the gate validates against.
export const KYLE_MERRITT_EXPECTED: Record<PlanetName, number> = {
  Sun: 212.42, // 2°25' Scorpio
  Moon: 89.55, // 29°33' Gemini
  Mercury: 232.7, // 22°42' Scorpio
  Venus: 252.18, // 12°11' Sagittarius
  Mars: 285.4, // 15°24' Capricorn
  Jupiter: 296.55, // 26°33' Capricorn
  Saturn: 222.07, // 12°04' Scorpio
  Uranus: 251.05, // 11°03' Sagittarius
  Neptune: 269.63, // 29°38' Sagittarius (note: 29°38' Sag = 269.63)
  Pluto: 211.95, // 1°57' Scorpio
};

function shortestArcDelta(a: number, b: number): number {
  let d = ((a - b + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}

interface CachedResult {
  result: AccuracyTestResult;
  expiresAt: number;
}

let _cache: CachedResult | null = null;

export function clearAccuracyCache(): void {
  _cache = null;
}

async function persistRun(result: AccuracyTestResult): Promise<void> {
  try {
    const payload = {
      passed: result.passed,
      tolerance_degrees: result.toleranceDegrees,
      benchmark_name: result.benchmarkName,
      ephemeris_engine: result.ephemerisEngine,
      ephemeris_config: result.ephemerisConfig,
      julian_day: result.julianDay,
      epoch_utc: result.epochUtc,
      expected_positions: result.expectedPositions,
      actual_positions: result.actualPositions,
      deltas: result.deltas,
      max_delta_degrees: result.maxDeltaDegrees,
      failed_planets: result.failedPlanets,
      raw_response: result.rawResponse as object,
      error_message: result.errorMessage,
      duration_ms: result.durationMs,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("accuracy_test_runs")
      .insert(payload);
    if (error) {
      console.error("[accuracy] failed to persist run:", error.message);
    }
  } catch (e) {
    console.error("[accuracy] persistRun threw:", (e as Error).message);
  }
}

function logFailureDiagnostics(result: AccuracyTestResult): void {
  // Structured single-line summary for log greppability.
  console.error(
    "[accuracy:FAIL]",
    JSON.stringify({
      benchmark: result.benchmarkName,
      tolerance_deg: result.toleranceDegrees,
      ephemeris_engine: result.ephemerisEngine,
      ephemeris_config: result.ephemerisConfig,
      julian_day: result.julianDay,
      epoch_utc: result.epochUtc,
      max_delta_deg: result.maxDeltaDegrees,
      failed_planets: result.failedPlanets,
      duration_ms: result.durationMs,
      error: result.errorMessage,
    })
  );
  // Detailed per-planet table for human inspection.
  console.error("[accuracy:FAIL] per-planet deltas:");
  for (const d of result.deltas) {
    console.error(
      `  - ${d.planet.padEnd(8)} expected=${d.expected.toFixed(4)}° ` +
        `actual=${d.actual.toFixed(4)}° delta=${d.deltaDegrees.toFixed(4)}°` +
        (Math.abs(d.deltaDegrees) > result.toleranceDegrees ? "  <<< OUT OF TOLERANCE" : "")
    );
  }
}

export async function runAccuracyTest(
  options: { useCache?: boolean } = {}
): Promise<AccuracyTestResult> {
  const useCache = options.useCache !== false;

  if (useCache && _cache && _cache.expiresAt > Date.now()) {
    return _cache.result;
  }

  const startedAt = Date.now();
  let result: AccuracyTestResult;

  try {
    const parsed = await callFreeAstro(KYLE_MERRITT_BIRTH);
    const actualMap: Partial<Record<PlanetName, number>> = {};
    for (const p of parsed.planets) actualMap[p.name] = p.longitude;

    const deltas: AccuracyDelta[] = [];
    const failedPlanets: PlanetName[] = [];
    let maxDelta = 0;

    for (const [planet, expected] of Object.entries(KYLE_MERRITT_EXPECTED) as Array<
      [PlanetName, number]
    >) {
      const actual = actualMap[planet];
      if (typeof actual !== "number") {
        failedPlanets.push(planet);
        deltas.push({ planet, expected, actual: NaN, deltaDegrees: NaN });
        maxDelta = Infinity;
        continue;
      }
      const delta = shortestArcDelta(actual, expected);
      const absDelta = Math.abs(delta);
      if (absDelta > maxDelta) maxDelta = absDelta;
      deltas.push({ planet, expected, actual, deltaDegrees: delta });
      if (absDelta > ACCURACY_TOLERANCE_DEG) failedPlanets.push(planet);
    }

    const passed = failedPlanets.length === 0 && Number.isFinite(maxDelta);

    result = {
      passed,
      toleranceDegrees: ACCURACY_TOLERANCE_DEG,
      benchmarkName: "Kyle Merritt — 1984-10-25 15:45 EDT Cincinnati, OH",
      ephemerisEngine: parsed.ephemerisEngine,
      ephemerisConfig: parsed.ephemerisConfig,
      julianDay: parsed.julianDay,
      epochUtc: parsed.epochUtc,
      expectedPositions: KYLE_MERRITT_EXPECTED,
      actualPositions: actualMap,
      deltas,
      maxDeltaDegrees: Number.isFinite(maxDelta) ? maxDelta : -1,
      failedPlanets,
      rawResponse: parsed.raw,
      errorMessage: null,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    result = {
      passed: false,
      toleranceDegrees: ACCURACY_TOLERANCE_DEG,
      benchmarkName: "Kyle Merritt — 1984-10-25 15:45 EDT Cincinnati, OH",
      ephemerisEngine: null,
      ephemerisConfig: null,
      julianDay: null,
      epochUtc: null,
      expectedPositions: KYLE_MERRITT_EXPECTED,
      actualPositions: {},
      deltas: [],
      maxDeltaDegrees: -1,
      failedPlanets: Object.keys(KYLE_MERRITT_EXPECTED) as PlanetName[],
      rawResponse: null,
      errorMessage: (err as Error).message,
      durationMs: Date.now() - startedAt,
    };
  }

  if (!result.passed) {
    logFailureDiagnostics(result);
    await persistRun(result);
  } else {
    console.log(
      `[accuracy:PASS] ${result.benchmarkName} max_delta=${result.maxDeltaDegrees.toFixed(4)}° engine=${result.ephemerisEngine} jd=${result.julianDay}`
    );
    await persistRun(result);
  }

  if (useCache) {
    _cache = { result, expiresAt: Date.now() + CACHE_TTL_MS };
  }

  return result;
}

export async function ensureAccuracyOrThrow(): Promise<AccuracyTestResult> {
  const result = await runAccuracyTest();
  if (!result.passed) {
    throw new Error(
      `Swiss Ephemeris accuracy check failed (max delta ${result.maxDeltaDegrees.toFixed(3)}° > ${ACCURACY_TOLERANCE_DEG}°). Report generation is blocked. Failed planets: ${result.failedPlanets.join(", ")}.`
    );
  }
  return result;
}
