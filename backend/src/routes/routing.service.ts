import { env } from "../config/env.js";

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
  coordinates: RouteCoordinate[];
};

function decodePolyline(encoded: string): RouteCoordinate[] {
  const coordinates: RouteCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += (result & 1) ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += (result & 1) ? ~(result >> 1) : result >> 1;

    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }

  return coordinates;
}

export async function calculateRoute(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
): Promise<RouteResult> {
  if (env.ROUTING_PROVIDER !== "google") {
    throw new Error(
      `Routing provider "${env.ROUTING_PROVIDER}" is not configured`,
    );
  }

  if (!env.GOOGLE_MAP_PLATFORM_KEY) {
    throw new Error("Google Maps routing is not configured");
  }

  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_MAP_PLATFORM_KEY,
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.latitude,
              longitude: origin.longitude,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        polylineQuality: "HIGH_QUALITY",
        polylineEncoding: "ENCODED_POLYLINE",
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Unable to calculate route");
  }

  const payload = (await response.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      polyline?: {
        encodedPolyline?: string;
      };
    }>;
  };

  const route = payload.routes?.[0];

  if (
    !route ||
    typeof route.distanceMeters !== "number" ||
    !route.duration ||
    !route.polyline?.encodedPolyline
  ) {
    throw new Error("No route found");
  }

  const durationMatch = /^(\d+(?:\.\d+)?)s$/.exec(route.duration);

  if (!durationMatch) {
    throw new Error("Invalid route duration");
  }

  const durationSeconds = Number(durationMatch[1]);

  if (!Number.isFinite(durationSeconds)) {
    throw new Error("Invalid route duration");
  }

  return {
    distanceMeters: route.distanceMeters,
    durationSeconds,
    polyline: route.polyline.encodedPolyline,
    coordinates: decodePolyline(route.polyline.encodedPolyline),
  };
}

export type PlaceSuggestion = {
  placeId: string;
  text: string;
  secondaryText: string | undefined;
};

export async function autocompletePlaces(
  input: string,
): Promise<PlaceSuggestion[]> {
  if (!env.GOOGLE_MAP_PLATFORM_KEY) {
    throw new Error("Google Maps places is not configured");
  }

  const query = input.trim();

  if (!query) {
    return [];
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_MAP_PLATFORM_KEY,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ["ng"],
        languageCode: "en",
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Unable to search places");
  }

  const payload = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: {
          text?: string;
        };
        structuredFormat?: {
          mainText?: {
            text?: string;
          };
          secondaryText?: {
            text?: string;
          };
        };
      };
    }>;
  };

  return (payload.suggestions ?? [])
    .map((suggestion) => {
      const prediction = suggestion.placePrediction;

      if (!prediction?.placeId || !prediction.text?.text) {
        return null;
      }

      return {
        placeId: prediction.placeId,
        text: prediction.text.text,
        secondaryText:
          prediction.structuredFormat?.secondaryText?.text ??
          undefined,
      };
    })
    .filter((item): item is PlaceSuggestion => item !== null)
    .slice(0, 5);
}

