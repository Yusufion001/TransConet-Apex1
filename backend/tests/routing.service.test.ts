import test, { mock } from "node:test";
import assert from "node:assert/strict";

const fetchMock = mock.fn<(...args: any[]) => any>();

const originalFetch = globalThis.fetch;
globalThis.fetch = fetchMock as typeof fetch;

mock.module(new URL("../src/config/env.js", import.meta.url).href, {
  namedExports: {
    env: {
      GOOGLE_MAP_PLATFORM_KEY: "test-google-key",
    },
  },
});

const { calculateRoute } = await import("../src/routes/routing.service.js");

function resetMocks() {
  fetchMock.mock.resetCalls();
}

test.afterEach(() => {
  resetMocks();
});

test.after(() => {
  globalThis.fetch = originalFetch;
});

test("calculateRoute rejects when Google routing is not configured", async () => {
  mock.timers.enable({ apis: ["Date"] });

  const originalKey = process.env.GOOGLE_MAP_PLATFORM_KEY;
  delete process.env.GOOGLE_MAP_PLATFORM_KEY;

  try {
    const envModule = await import("../src/config/env.js");
    assert.equal(envModule.env.GOOGLE_MAP_PLATFORM_KEY, "test-google-key");
  } finally {
    if (originalKey === undefined) {
      delete process.env.GOOGLE_MAP_PLATFORM_KEY;
    } else {
      process.env.GOOGLE_MAP_PLATFORM_KEY = originalKey;
    }
    mock.timers.reset();
  }
});

test("calculateRoute sends the correct Google Routes API request and returns decoded route data", async () => {
  fetchMock.mock.mockImplementationOnce(async () =>
    new Response(
      JSON.stringify({
        routes: [
          {
            distanceMeters: 12345,
            duration: "600s",
            polyline: {
              encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    ),
  );

  const result = await calculateRoute(
    { latitude: 38.5, longitude: -120.2 },
    { latitude: 40.7, longitude: -120.95 },
  );

  assert.equal(fetchMock.mock.callCount(), 1);

  const [url, options] = fetchMock.mock.calls[0].arguments;

  assert.equal(
    url,
    "https://routes.googleapis.com/directions/v2:computeRoutes",
  );

  assert.equal(options.method, "POST");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.equal(options.headers["X-Goog-Api-Key"], "test-google-key");
  assert.equal(
    options.headers["X-Goog-FieldMask"],
    "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
  );

  const body = JSON.parse(options.body);

  assert.deepEqual(body.origin.location.latLng, {
    latitude: 38.5,
    longitude: -120.2,
  });

  assert.deepEqual(body.destination.location.latLng, {
    latitude: 40.7,
    longitude: -120.95,
  });

  assert.equal(body.travelMode, "DRIVE");
  assert.equal(body.routingPreference, "TRAFFIC_AWARE");
  assert.equal(body.polylineQuality, "HIGH_QUALITY");
  assert.equal(body.polylineEncoding, "ENCODED_POLYLINE");

  assert.equal(result.distanceMeters, 12345);
  assert.equal(result.durationSeconds, 600);
  assert.equal(result.polyline, "_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  assert.ok(result.coordinates.length > 0);
});

test("calculateRoute rejects an upstream Google routing failure", async () => {
  fetchMock.mock.mockImplementationOnce(async () =>
    new Response("upstream failure", { status: 500 }),
  );

  await assert.rejects(
    calculateRoute(
      { latitude: 6.5244, longitude: 3.3792 },
      { latitude: 6.4281, longitude: 3.4219 },
    ),
    {
      message: "Unable to calculate route",
    },
  );
});

test("calculateRoute rejects when Google returns no routes", async () => {
  fetchMock.mock.mockImplementationOnce(async () =>
    new Response(JSON.stringify({ routes: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  await assert.rejects(
    calculateRoute(
      { latitude: 6.5244, longitude: 3.3792 },
      { latitude: 6.4281, longitude: 3.4219 },
    ),
    {
      message: "No route found",
    },
  );
});

test("calculateRoute rejects an invalid duration", async () => {
  fetchMock.mock.mockImplementationOnce(async () =>
    new Response(
      JSON.stringify({
        routes: [
          {
            distanceMeters: 1000,
            duration: "invalid",
            polyline: {
              encodedPolyline: "_p~iF~ps|U_ulLnnqC",
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    ),
  );

  await assert.rejects(
    calculateRoute(
      { latitude: 6.5244, longitude: 3.3792 },
      { latitude: 6.4281, longitude: 3.4219 },
    ),
    {
      message: "Invalid route duration",
    },
  );
});
