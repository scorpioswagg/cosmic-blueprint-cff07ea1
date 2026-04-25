// Server functions: chart calculation.
//
// CRITICAL ARCHITECTURE RULE:
//   - Swiss Ephemeris is the SINGLE source of truth for all stored
//     planetary positions, ascendant, midheaven, and houses.
//   - FreeAstro is OPTIONAL and used ONLY for side-by-side comparison.
//     Its values are stored under `comparison_positions` and NEVER
//     overwrite or substitute for the Swiss Ephemeris results.
//   - AI does not simulate positions anywhere in this flow.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callFreeAstro } from "./freeastro.server";
import {
  calculateWithSwissEphemeris,
  SwissEphemerisUnavailableError,
} from "./swiss-ephemeris.server";
import type { AccuracyDelta, PlanetName, PlanetPosition } from "./types";

const BirthInputSchema = z.object({
  name: z.string().min(1).max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/),
  city: z.string().min(1).max(120),
  country: z.string().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezoneOffsetHours: z.number().min(-14).max(14),
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
      expected: t.longitude, // "expected" = source of truth (Swiss Ephemeris)
      actual: c, // "actual" = comparison engine value
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

    // 1) SOURCE OF TRUTH — Swiss Ephemeris.
    let swiss;
    try {
      swiss = await calculateWithSwissEphemeris({
        name: data.name,
        birthDate: data.birthDate,
        birthTime: data.birthTime,
        city: data.city,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        timezoneOffsetHours: data.timezoneOffsetHours,
      });
    } catch (err) {
      const message =
        err instanceof SwissEphemerisUnavailableError
          ? err.message
          : `Swiss Ephemeris calculation failed: ${(err as Error).message}`;
      console.error("[calculateChart] swiss ephemeris error:", message);
      return {
        ok: false as const,
        error: message,
      };
    }

    // 2) OPTIONAL — FreeAstro comparison. Failure here must NOT block storage
    //    of the canonical Swiss Ephemeris result.
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
        const fa = await callFreeAstro({
          name: data.name,
          birthDate: data.birthDate,
          birthTime: data.birthTime,
          city: data.city,
          country: data.country,
          latitude: data.latitude,
          longitude: data.longitude,
          timezoneOffsetHours: data.timezoneOffsetHours,
        });
        const deltas = buildDeltas(swiss.planets, fa.planets);
        const maxDelta = deltas.reduce(
          (m, d) => Math.max(m, Math.abs(d.deltaDegrees)),
          0
        );
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

    // 3) Persist. `planets` ALWAYS holds Swiss Ephemeris values.
    //    `comparison_positions` holds the optional comparison payload.
    const insertPayload = {
      user_id: userId,
      name: data.name,
      birth_date: data.birthDate,
      birth_time: data.birthTime,
      city: data.city,
      country: data.country,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: String(data.timezoneOffsetHours),
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
