// Admin-only accuracy test runner using ONLY Swiss Ephemeris (pyswisseph).
// Recalculates the Kyle Merritt reference chart and diffs each planet's
// ecliptic longitude against the expected Swiss Ephemeris values.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calculateWithSwissEphemeris,
  SwissEphemerisUnavailableError,
} from "./swiss-ephemeris.server";
import {
  ACCURACY_TOLERANCE_DEG,
  KYLE_MERRITT_BIRTH,
  KYLE_MERRITT_EXPECTED,
} from "./accuracy.server";
import type { PlanetName } from "./types";

function shortestArcDelta(a: number, b: number): number {
  let d = ((a - b + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}

export const runSwissAccuracyTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Admin gate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: roles } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = Array.isArray(roles) && roles.some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) {
      return { ok: false as const, error: "Admin access required." };
    }

    const startedAt = Date.now();
    try {
      const swiss = await calculateWithSwissEphemeris(KYLE_MERRITT_BIRTH);
      const actualMap: Partial<Record<PlanetName, number>> = {};
      for (const p of swiss.planets) actualMap[p.name] = p.longitude;

      const deltas = (Object.entries(KYLE_MERRITT_EXPECTED) as Array<[PlanetName, number]>).map(
        ([planet, expected]) => {
          const actual = actualMap[planet];
          if (typeof actual !== "number") {
            return { planet, expected, actual: null, deltaDegrees: null, withinTolerance: false };
          }
          const delta = shortestArcDelta(actual, expected);
          return {
            planet,
            expected,
            actual,
            deltaDegrees: delta,
            withinTolerance: Math.abs(delta) <= ACCURACY_TOLERANCE_DEG,
          };
        },
      );

      const failed = deltas.filter((d) => !d.withinTolerance).map((d) => d.planet);
      const maxDelta = deltas.reduce(
        (m, d) => (d.deltaDegrees != null ? Math.max(m, Math.abs(d.deltaDegrees)) : m),
        0,
      );

      return {
        ok: true as const,
        passed: failed.length === 0,
        toleranceDegrees: ACCURACY_TOLERANCE_DEG,
        benchmarkName: "Kyle Merritt — 1984-10-25 15:45 EDT Cincinnati, OH",
        ephemerisEngine: swiss.ephemerisEngine,
        julianDay: swiss.julianDay,
        epochUtc: swiss.epochUtc,
        deltas,
        maxDeltaDegrees: maxDelta,
        failedPlanets: failed,
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      const message =
        err instanceof SwissEphemerisUnavailableError
          ? err.message
          : `Swiss Ephemeris calculation failed: ${(err as Error).message}`;
      return {
        ok: false as const,
        error: message,
        durationMs: Date.now() - startedAt,
      };
    }
  });
