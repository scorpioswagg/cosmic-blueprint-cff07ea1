// Server-only FreeAstro API client. Never import from client code.
import type { BirthInput, PlanetName, PlanetPosition } from "./types";

const FREEASTRO_ENDPOINT =
  "https://api.freeastroapi.com/api/v1/natal/calculate";

export interface FreeAstroRawResponse {
  // Shape is best-effort — we tolerate unknown fields and store the raw payload.
  planets?: Array<{
    name?: string;
    longitude?: number;
    full_degree?: number;
    sign?: string;
    is_retrograde?: boolean;
    retrograde?: boolean;
  }>;
  metadata?: {
    ephemeris?: string;
    engine?: string;
    julian_day?: number;
    jd?: number;
    utc?: string;
    epoch_utc?: string;
    config?: Record<string, unknown>;
  };
  ephemeris?: string;
  julian_day?: number;
  jd?: number;
  utc?: string;
  [key: string]: unknown;
}

export interface FreeAstroParsed {
  planets: PlanetPosition[];
  ephemerisEngine: string | null;
  ephemerisConfig: Record<string, unknown> | null;
  julianDay: number | null;
  epochUtc: string | null;
  raw: FreeAstroRawResponse;
}

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

export async function callFreeAstro(input: BirthInput): Promise<FreeAstroParsed> {
  const apiKey = process.env.FREEASTRO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "FREEASTRO_API_KEY is not configured on the server."
    );
  }

  const [year, month, day] = input.birthDate.split("-").map((n) => parseInt(n, 10));
  const [hour, minute] = input.birthTime.split(":").map((n) => parseInt(n, 10));

  const body = {
    year,
    month,
    day,
    hour,
    minute,
    seconds: 0,
    lat: input.latitude,
    lng: input.longitude,
    timezone: input.timezoneOffsetHours,
  };

  const res = await fetch(FREEASTRO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `FreeAstro API ${res.status} ${res.statusText}: ${text.slice(0, 500)}`
    );
  }

  const raw = (await res.json()) as FreeAstroRawResponse;

  const planetsRaw = Array.isArray(raw.planets) ? raw.planets : [];
  const planets: PlanetPosition[] = [];
  for (const p of planetsRaw) {
    const name = normalizePlanetName(p.name);
    if (!name) continue;
    const longitude =
      typeof p.longitude === "number"
        ? p.longitude
        : typeof p.full_degree === "number"
          ? p.full_degree
          : NaN;
    if (!Number.isFinite(longitude)) continue;
    planets.push({
      name,
      longitude: ((longitude % 360) + 360) % 360,
      sign: p.sign,
      retrograde: p.is_retrograde ?? p.retrograde,
    });
  }

  const meta = raw.metadata ?? {};
  return {
    planets,
    ephemerisEngine:
      (meta.ephemeris as string | undefined) ??
      meta.engine ??
      (typeof raw.ephemeris === "string" ? raw.ephemeris : null) ??
      null,
    ephemerisConfig: (meta.config as Record<string, unknown> | undefined) ?? null,
    julianDay:
      (typeof meta.julian_day === "number" ? meta.julian_day : undefined) ??
      (typeof meta.jd === "number" ? meta.jd : undefined) ??
      (typeof raw.julian_day === "number" ? raw.julian_day : undefined) ??
      (typeof raw.jd === "number" ? raw.jd : undefined) ??
      null,
    epochUtc:
      (typeof meta.epoch_utc === "string" ? meta.epoch_utc : undefined) ??
      (typeof meta.utc === "string" ? meta.utc : undefined) ??
      (typeof raw.utc === "string" ? raw.utc : undefined) ??
      null,
    raw,
  };
}
