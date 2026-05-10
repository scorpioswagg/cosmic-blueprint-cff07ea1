// Server-only Swiss Ephemeris adapter.
// SOURCE OF TRUTH: All canonical planetary positions in this product are
// produced here. AI must NEVER simulate these values, and the FreeAstro
// comparison helper must NEVER be substituted for this function as the
// authoritative source.
//
// This adapter calls an externally-hosted Swiss Ephemeris (pyswisseph)
// FastAPI service whose URL is provided via the SWISS_EPHEMERIS_URL secret.
// If the service is not configured or returns an error, calculation is
// HARD-FAILED — we do not silently fall back to any other engine for the
// canonical record.

import type { BirthInput, PlanetName, PlanetPosition } from "./types";

const PLANET_ALIAS: Record<string, PlanetName> = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
};

function normalizePlanetName(raw: string | undefined): PlanetName | null {
  if (!raw) return null;
  return PLANET_ALIAS[raw.trim().toLowerCase()] ?? null;
}

export interface SwissEphemerisResult {
  planets: PlanetPosition[];
  ascendant: number | null;
  midheaven: number | null;
  houses: number[] | null;
  julianDay: number | null;
  epochUtc: string | null;
  ephemerisEngine: string; // always set to identify the source of truth
  raw: unknown;
}

interface SwissEphemerisRawResponse {
  planets?: Array<{
    name?: string;
    longitude?: number;
    sign?: string;
    retrograde?: boolean;
    is_retrograde?: boolean;
  }>;
  ascendant?: number;
  midheaven?: number;
  houses?: number[];
  julian_day?: number;
  jd?: number;
  utc?: string;
  epoch_utc?: string;
  engine?: string;
  ephemeris?: string;
  [k: string]: unknown;
}

export class SwissEphemerisUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SwissEphemerisUnavailableError";
  }
}

export async function calculateWithSwissEphemeris(
  input: BirthInput
): Promise<SwissEphemerisResult> {
  const baseUrl = process.env.SWISS_EPHEMERIS_URL;
  if (!baseUrl) {
    throw new SwissEphemerisUnavailableError(
      "Swiss Ephemeris service is not configured (SWISS_EPHEMERIS_URL missing). " +
        "Canonical chart calculation is blocked — AI must never simulate positions."
    );
  }

  const [year, month, day] = input.birthDate.split("-").map((n) => parseInt(n, 10));
  const [hour, minute] = input.birthTime.split(":").map((n) => parseInt(n, 10));

  const url = baseUrl.replace(/\/$/, "") + "/calculate-chart";
  const apiKey = process.env.SWISS_EPHEMERIS_API_KEY;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      year,
      month,
      day,
      hour,
      minute,
      seconds: 0,
      latitude: input.latitude,
      longitude: input.longitude,
      timezone: input.timezoneOffsetHours,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new SwissEphemerisUnavailableError(
      `Swiss Ephemeris service ${res.status} ${res.statusText}: ${text.slice(0, 500)}`
    );
  }

  const raw = (await res.json()) as SwissEphemerisRawResponse;
  const planets: PlanetPosition[] = [];
  for (const p of raw.planets ?? []) {
    const name = normalizePlanetName(p.name);
    if (!name) continue;
    const longitude = typeof p.longitude === "number" ? p.longitude : NaN;
    if (!Number.isFinite(longitude)) continue;
    planets.push({
      name,
      longitude: ((longitude % 360) + 360) % 360,
      sign: p.sign,
      retrograde: p.retrograde ?? p.is_retrograde,
    });
  }

  return {
    planets,
    ascendant: typeof raw.ascendant === "number" ? raw.ascendant : null,
    midheaven: typeof raw.midheaven === "number" ? raw.midheaven : null,
    houses: Array.isArray(raw.houses) ? raw.houses : null,
    julianDay:
      (typeof raw.julian_day === "number" ? raw.julian_day : undefined) ??
      (typeof raw.jd === "number" ? raw.jd : undefined) ??
      null,
    epochUtc:
      (typeof raw.epoch_utc === "string" ? raw.epoch_utc : undefined) ??
      (typeof raw.utc === "string" ? raw.utc : undefined) ??
      null,
    ephemerisEngine:
      (typeof raw.engine === "string" ? raw.engine : undefined) ??
      (typeof raw.ephemeris === "string" ? raw.ephemeris : undefined) ??
      "swiss_ephemeris",
    raw,
  };
}
