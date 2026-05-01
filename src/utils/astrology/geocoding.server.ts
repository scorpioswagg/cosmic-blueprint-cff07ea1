// Server-only geocoding: resolves city + country → lat, lng, timezone offset.
// Uses OpenStreetMap Nominatim (free, no API key) + TimeAPI.io for timezone.

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
  timezoneName: string;
  displayName: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export async function geocodeLocation(
  city: string,
  country: string,
  birthDate: string,
  birthTime: string
): Promise<GeocodingResult> {
  // 1. Geocode city/country → lat/lng via Nominatim
  const q = encodeURIComponent(`${city}, ${country}`);
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    {
      headers: {
        "User-Agent": "CosmicBlueprint/1.0 (astrology-app)",
        Accept: "application/json",
      },
    }
  );

  if (!geoRes.ok) {
    throw new Error(`Geocoding service returned ${geoRes.status}`);
  }

  const geoData = (await geoRes.json()) as NominatimResult[];
  if (!geoData.length) {
    throw new Error(
      `Could not find coordinates for "${city}, ${country}". Please check spelling.`
    );
  }

  const latitude = parseFloat(geoData[0].lat);
  const longitude = parseFloat(geoData[0].lon);
  const displayName = geoData[0].display_name;

  // 2. Get timezone offset for those coordinates at the given birth date/time.
  //    Use TimeAPI.io (free, no key required).
  let timezoneOffsetHours = 0;
  let timezoneName = "UTC";

  try {
    const tzRes = await fetch(
      `https://timeapi.io/api/timezone/coordinate?latitude=${latitude}&longitude=${longitude}`,
      { headers: { Accept: "application/json" } }
    );

    if (tzRes.ok) {
      const tzData = (await tzRes.json()) as {
        timeZone?: string;
        currentUtcOffset?: { hours?: number; minutes?: number };
      };

      timezoneName = tzData.timeZone ?? "UTC";

      // For historical dates we need the offset at the birth date, not "now".
      // Use the date-based endpoint for a more accurate offset.
      const dtRes = await fetch(
        `https://timeapi.io/api/conversion/converttimezone`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            fromTimeZone: timezoneName,
            dateTime: `${birthDate} ${birthTime}:00`,
            toTimeZone: "UTC",
            dstAmbiguity: "",
          }),
        }
      );

      if (dtRes.ok) {
        const dtData = (await dtRes.json()) as {
          offset?: string; // e.g. "-05:00:00"
          utcOffset?: string;
          fromTimezone?: { utcOffset?: string };
        };

        const offsetStr =
          dtData.fromTimezone?.utcOffset ?? dtData.offset ?? dtData.utcOffset;
        if (offsetStr) {
          const parsed = parseUtcOffset(offsetStr);
          if (parsed !== null) timezoneOffsetHours = parsed;
        }
      }

      // Fallback: use the current offset if the conversion endpoint failed
      if (
        timezoneOffsetHours === 0 &&
        tzData.currentUtcOffset &&
        typeof tzData.currentUtcOffset.hours === "number"
      ) {
        timezoneOffsetHours =
          tzData.currentUtcOffset.hours +
          (tzData.currentUtcOffset.minutes ?? 0) / 60;
      }
    }
  } catch {
    // Non-fatal: default to UTC offset 0
    console.warn("[geocode] timezone lookup failed, defaulting to UTC");
  }

  return { latitude, longitude, timezoneOffsetHours, timezoneName, displayName };
}

/** Parse an offset string like "-05:00:00" or "+05:30" → number */
function parseUtcOffset(s: string): number | null {
  const m = s.match(/^([+-]?)(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2], 10) + parseInt(m[3], 10) / 60);
}
