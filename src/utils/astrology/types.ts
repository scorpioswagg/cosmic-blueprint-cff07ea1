// Shared astrology types — safe to import from client or server.

export type PlanetName =
  | "Sun"
  | "Moon"
  | "Mercury"
  | "Venus"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "Uranus"
  | "Neptune"
  | "Pluto";

export interface PlanetPosition {
  name: PlanetName;
  longitude: number; // ecliptic longitude in degrees [0, 360)
  sign?: string;
  retrograde?: boolean;
}

export interface BirthInput {
  name: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm (24h, local time at birth location)
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number; // e.g. -5 for EST (used for UT conversion)
}

export interface AccuracyDelta {
  planet: PlanetName;
  expected: number;
  actual: number;
  deltaDegrees: number; // signed shortest-arc difference
}

export interface AccuracyTestResult {
  passed: boolean;
  toleranceDegrees: number;
  benchmarkName: string;
  ephemerisEngine: string | null;
  ephemerisConfig: Record<string, unknown> | null;
  julianDay: number | null;
  epochUtc: string | null;
  expectedPositions: Record<PlanetName, number>;
  actualPositions: Partial<Record<PlanetName, number>>;
  deltas: AccuracyDelta[];
  maxDeltaDegrees: number;
  failedPlanets: PlanetName[];
  rawResponse: unknown;
  errorMessage: string | null;
  durationMs: number;
}
