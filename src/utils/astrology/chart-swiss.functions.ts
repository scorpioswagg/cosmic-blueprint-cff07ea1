// Dedicated Swiss-Ephemeris-only chart endpoint.
//
// HARD CONTRACT:
//   - This server function ONLY calls the pyswisseph-backed Swiss Ephemeris
//     service. It NEVER imports or calls FreeAstro under any circumstances.
//   - The result is persisted with comparison_positions = null.
//   - Use this when callers want a fast, deterministic, side-effect-free
//     calculation without any external comparison source.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calculateWithSwissEphemeris,
  SwissEphemerisUnavailableError,
} from "./swiss-ephemeris.server";
import { geocodeLocation } from "./geocoding.server";

const BirthInputSchema = z.object({
  name: z.string().min(1).max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/),
  city: z.string().min(1).max(120),
  country: z.string().min(1).max(120),
});

export const calculateChartSwissOnly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BirthInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 0) Geocode city/country -> lat/lng/timezone.
    let geo;
    try {
      geo = await geocodeLocation(
        data.city,
        data.country,
        data.birthDate,
        data.birthTime,
      );
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }

    // 1) Swiss Ephemeris is the ONLY engine consulted here.
    let swiss;
    try {
      swiss = await calculateWithSwissEphemeris({
        name: data.name,
        birthDate: data.birthDate,
        birthTime: data.birthTime,
        city: data.city,
        country: data.country,
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezoneOffsetHours: geo.timezoneOffsetHours,
      });
    } catch (err) {
      const message =
        err instanceof SwissEphemerisUnavailableError
          ? err.message
          : `Swiss Ephemeris calculation failed: ${(err as Error).message}`;
      console.error("[calculateChartSwissOnly] swiss error:", message);
      return { ok: false as const, error: message };
    }

    // 2) Persist — comparison_positions intentionally null.
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
      comparison_positions: null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error } = await (supabase as any)
      .from("birth_charts")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("[calculateChartSwissOnly] insert error:", error.message);
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
    };
  });
