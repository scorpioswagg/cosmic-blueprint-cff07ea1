// Server functions: chart calculation.
//
// CRITICAL ARCHITECTURE RULE:
//   - Swiss Ephemeris is the SINGLE source of truth for all stored
//     planetary positions, ascendant, midheaven, and houses.
//   - FreeAstro is OPTIONAL and used ONLY for side-by-side comparison.
//     Its values are stored under `comparison_positions` and NEVER
//     overwrite or substitute for the Swiss Ephemeris results.
//   - AI does not simulate positions anywhere in this flow.
console.log("API URL:", import.meta.env.VITE_SWISS_EPHEMERIS_URL);
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callFreeAstro } from "./freeastro.server";
import {
  calculateWithSwissEphemeris,
  SwissEphemerisUnavailableError,
} from "./swiss-ephemeris.server";
import { geocodeLocation } from "./geocoding.server";
import type { AccuracyDelta, PlanetName, PlanetPosition } from "./types";

const BirthInputSchema = z.object({
  name: z.string().min(1).max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/),
  city: z.string().min(1).max(120),
  country: z.string().min(1).max(120),
  compareWithFreeAstro: z.boolean().optional().default(false),
});

function shortestArcDelta(a: number, b: number): number {
  let d = ((a - b + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}

function buildDeltas(
  truth: PlanetPosition[],
  comparison: PlanetPosition[]
): AccuracyDelta[] {
  const compMap = new Map<PlanetName, number>();
  for (const p of comparison) compMap.set(p.name, p.longitude);
  const out: AccuracyDelta[] = [];
  for (const t of truth) {
    const c = compMap.get(t.name);
    if (typeof c !== "number") continue;
    out.push({
      planet: t.name,
      expected: t.longitude,
      actual: c,
      deltaDegrees: shortestArcDelta(c, t.longitude),
    });
  }
  return out;
}

export const calculateChart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BirthInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 0) GEOCODE — resolve city/country → lat, lng, timezone
    let geo;
    try {
      geo = await geocodeLocation(data.city, data.country, data.birthDate, data.birthTime);
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }

    const birthInput = {
      name: data.name,
      birthDate: data.birthDate,
      birthTime: data.birthTime,
      city: data.city,
      country: data.country,
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezoneOffsetHours: geo.timezoneOffsetHours,
    };

    // 1) SOURCE OF TRUTH — Swiss Ephemeris.
    let swiss;
    try {
      swiss = await calculateWithSwissEphemeris(birthInput);
    } catch (err) {
      const message =
        err instanceof SwissEphemerisUnavailableError
          ? err.message
          : `Swiss Ephemeris calculation failed: ${(err as Error).message}`;
      console.error("[calculateChart] swiss ephemeris error:", message);
      return { ok: false as const, error: message };
    }

    // 2) OPTIONAL — FreeAstro comparison.
    let comparison: {
      engine: "freeastro";
      planets: PlanetPosition[];
      julianDay: number | null;
      epochUtc: string | null;
      deltas: AccuracyDelta[];
      maxDeltaDegrees: number;
      error: string | null;
    } | null = null;

    if (data.compareWithFreeAstro) {
      try {
        const fa = await callFreeAstro(birthInput);
        const deltas = buildDeltas(swiss.planets, fa.planets);
        const maxDelta = deltas.reduce((m, d) => Math.max(m, Math.abs(d.deltaDegrees)), 0);
        comparison = {
          engine: "freeastro",
          planets: fa.planets,
          julianDay: fa.julianDay,
          epochUtc: fa.epochUtc,
          deltas,
          maxDeltaDegrees: maxDelta,
          error: null,
        };
      } catch (err) {
        const msg = (err as Error).message;
        console.warn("[calculateChart] freeastro comparison failed:", msg);
        comparison = {
          engine: "freeastro",
          planets: [],
          julianDay: null,
          epochUtc: null,
          deltas: [],
          maxDeltaDegrees: -1,
          error: msg,
        };
      }
    }

    // 3) Persist.
    const insertPayload = {
      user_id: userId,
      name: data.name,
      birth_date: data.birthDate,
      birth_time: data.birthTime,
      city: data.city,
      country: data.country,
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezone: geo.timezoneName,
      planets: swiss.planets as unknown as object,
      ascendant: swiss.ascendant,
      midheaven: swiss.midheaven,
      houses: (swiss.houses ?? null) as unknown as object | null,
      calculation_source: swiss.ephemerisEngine,
      comparison_positions: comparison as unknown as object | null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error } = await (supabase as any)
      .from("birth_charts")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("[calculateChart] insert error:", error.message);
      return { ok: false as const, error: error.message };
    }

    return {
      ok: true as const,
      chartId: inserted.id as string,
      geocoding: {
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezoneName,
        timezoneOffset: geo.timezoneOffsetHours,
        resolvedLocation: geo.displayName,
      },
      sourceOfTruth: {
        engine: swiss.ephemerisEngine,
        planets: swiss.planets,
        ascendant: swiss.ascendant,
        midheaven: swiss.midheaven,
        julianDay: swiss.julianDay,
        epochUtc: swiss.epochUtc,
      },
      comparison,
    };
  });
