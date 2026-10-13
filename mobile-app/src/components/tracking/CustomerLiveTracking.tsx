import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import TransConetMap, { type MapCoordinate } from "../maps/TransConetMap";
import { calculateRoute, type RouteResult } from "../../api/routing";

type LiveLocation = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recordedAt?: string | null;
};

type CustomerLiveTrackingProps = {
  pickup: MapCoordinate | null;
  destination: MapCoordinate | null;
  vehicleLocation: LiveLocation | null;
  status: string;
  title?: string;
  enabled?: boolean;
};

function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return "—";

  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";

  const minutes = Math.max(1, Math.round(seconds / 60));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return "Waiting for GPS";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Live";

  return `Updated ${date.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function CustomerLiveTracking({
  pickup,
  destination,
  vehicleLocation,
  status,
  title = "LIVE TRACKING",
  enabled = true,
}: CustomerLiveTrackingProps) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [followingVehicle, setFollowingVehicle] = useState(true);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [acceptedVehicleLocation, setAcceptedVehicleLocation] =
    useState<LiveLocation | null>(null);
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
  const lastRouteRequestAt = useRef(0);
  const lastRouteCoordinate = useRef<MapCoordinate | null>(null);
  const lastRecordedAtMs = useRef(0);

  // Re-evaluate GPS freshness even when no new realtime event arrives.
  useEffect(() => {
    const timer = setInterval(() => setFreshnessNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!vehicleLocation) {
      return;
    }

    const latitude = Number(vehicleLocation.latitude);
    const longitude = Number(vehicleLocation.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return;
    }

    const hasRecordedAt = Boolean(vehicleLocation.recordedAt);
    if (!hasRecordedAt) return;
    const recordedAtMs = hasRecordedAt
      ? Date.parse(vehicleLocation.recordedAt as string)
      : 0;

    // Reject malformed timestamps when the backend supplied one.
    if (hasRecordedAt && !Number.isFinite(recordedAtMs)) {
      return;
    }

    // A transporter location should not arrive materially in the future.
    if (hasRecordedAt && recordedAtMs > Date.now() + 30_000) {
      return;
    }

    // Realtime delivery can arrive out of order. Never move the customer
    // marker backwards in time.
    if (
      hasRecordedAt &&
      lastRecordedAtMs.current > 0 &&
      recordedAtMs < lastRecordedAtMs.current
    ) {
      return;
    }

    if (hasRecordedAt) {
      lastRecordedAtMs.current = recordedAtMs;
    }

    setAcceptedVehicleLocation({
      ...vehicleLocation,
      latitude,
      longitude,
      recordedAt: vehicleLocation.recordedAt,
    });
  }, [vehicleLocation]);

  useEffect(() => {
    if (!enabled) {
      setFollowingVehicle(true);
      setAcceptedVehicleLocation(null);
      lastRecordedAtMs.current = 0;
      lastRouteCoordinate.current = null;
    }
  }, [enabled]);

  const vehicleCoordinate = useMemo<MapCoordinate | null>(() => {
    if (!acceptedVehicleLocation) return null;

    return {
      latitude: acceptedVehicleLocation.latitude,
      longitude: acceptedVehicleLocation.longitude,
    };
  }, [acceptedVehicleLocation]);

const gpsFreshness = (() => {
    if (
      !acceptedVehicleLocation ||
      typeof acceptedVehicleLocation.recordedAt !== "string" ||
      !acceptedVehicleLocation.recordedAt.trim()
    ) {
      return "WAITING FOR GPS";
    }
    const recordedAtMs = Date.parse(acceptedVehicleLocation.recordedAt);
    if (!Number.isFinite(recordedAtMs)) return "WAITING FOR GPS";
    const ageMs = freshnessNow - recordedAtMs;
    return ageMs >= -30_000 && ageMs <= 15_000
      ? "LIVE"
      : "LOCATION DELAYED";
  })();

    const mapRegion = useMemo(
    () => ({
      latitude:
        followingVehicle && vehicleCoordinate
          ? vehicleCoordinate.latitude
          : (pickup?.latitude ??
            destination?.latitude ??
            vehicleCoordinate?.latitude ??
            6.5244),
      longitude:
        followingVehicle && vehicleCoordinate
          ? vehicleCoordinate.longitude
          : (pickup?.longitude ??
            destination?.longitude ??
            vehicleCoordinate?.longitude ??
            3.3792),
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    }),
    [destination, followingVehicle, pickup, vehicleCoordinate],
  );

  const routeOrigin = useMemo(
    () => vehicleCoordinate ?? pickup,
    [pickup, vehicleCoordinate],
  );

  const loadRoute = useCallback(async () => {
    if (!routeOrigin || !destination || !enabled) {
      setRoute(null);
      return;
    }

    const now = Date.now();
    const elapsed = now - lastRouteRequestAt.current;
    const throttleMs = 15000;

    const previous = lastRouteCoordinate.current;
    const movedMeaningfully =
      !previous ||
      Math.abs(routeOrigin.latitude - previous.latitude) > 0.0007 ||
      Math.abs(routeOrigin.longitude - previous.longitude) > 0.0007;

    if (previous && !movedMeaningfully) {
      return;
    }

    if (elapsed < throttleMs) {
      return;
    }

    lastRouteRequestAt.current = now;
    lastRouteCoordinate.current = routeOrigin;
    setRouteLoading(true);
    setRouteError(null);

    try {
      const result = await calculateRoute(routeOrigin, destination);
      setRoute(result);
    } catch {
      setRouteError("Route unavailable");
    } finally {
      setRouteLoading(false);
    }
  }, [destination, enabled, routeOrigin]);

  useEffect(() => {
    void loadRoute();
  }, [loadRoute]);

  const markers = useMemo(() => {
    const result = [];

    if (detailsVisible && pickup) {
      result.push({
        id: "tracking-pickup",
        coordinate: pickup,
        title: "Pickup",
        description: "Shipment pickup location",
      });
    }

    if (detailsVisible && destination) {
      result.push({
        id: "tracking-destination",
        coordinate: destination,
        title: "Destination",
        description: "Shipment destination",
      });
    }

    if (vehicleCoordinate) {
      result.push({
        id: "tracking-vehicle",
        coordinate: vehicleCoordinate,
        title: "Transporter",
        description: "Live transporter location",
      });
    }

    return result;
  }, [detailsVisible, destination, pickup, vehicleCoordinate]);

  if (!enabled) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <TransConetMap
          region={mapRegion}
          markers={markers}
          routeCoordinates={detailsVisible ? route?.coordinates : undefined}
          animatedMarkerId={vehicleCoordinate ? "tracking-vehicle" : undefined}
          animatedMarkerHeading={acceptedVehicleLocation?.heading}
          onUserMapInteraction={() => setFollowingVehicle(false)}
          onMapGestureStart={() => setFollowingVehicle(false)}
          onMapTap={() => setDetailsVisible((visible) => !visible)}
          followCoordinate={vehicleCoordinate}
          followEnabled={followingVehicle}
          interactive
        />

        <View style={styles.topStatus}>
          <View style={[styles.liveDot, gpsFreshness !== "LIVE" && styles.liveDotMuted]} />
          <Text style={styles.liveLabel}>{gpsFreshness}</Text>
        </View>

        <Pressable
          style={styles.recenterButton}
          onPress={() => setFollowingVehicle(true)}
        >
          <Text style={styles.recenterText}>
            {followingVehicle ? "FOLLOWING VEHICLE" : "RE-CENTER"}
          </Text>
        </Pressable>

        {detailsVisible && routeLoading ? (
          <View style={styles.routeBadge}>
            <ActivityIndicator size="small" />
            <Text style={styles.routeBadgeText}>Calculating route...</Text>
          </View>
        ) : null}

        {detailsVisible && routeError ? (
          <View style={styles.routeBadge}>
            <Text style={styles.routeBadgeText}>{routeError}</Text>
          </View>
        ) : null}

        {!detailsVisible ? (
          <Pressable
            style={styles.peekPanel}
            onPress={() => setDetailsVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Show journey details"
          >
            <View style={styles.peekHandle} />
            <Text style={styles.peekTitle}>JOURNEY DETAILS</Text>
            <Text style={styles.peekSubtitle}>Tap the map or here to view route and ETA</Text>
          </Pressable>
        ) : (
          <View style={styles.infoPanel}>
            <View style={styles.panelHeading}>
              <View style={styles.panelHeadingText}>
                <Text style={styles.eyebrow}>{title}</Text>
                <Text style={styles.panelTitle}>Your shipment is moving</Text>
                <Text style={styles.status}>{status.replaceAll("_", " ")}</Text>
              </View>
              <Text style={styles.updated}>
                {formatUpdatedAt(acceptedVehicleLocation?.recordedAt)}
              </Text>
            </View>

            <View style={styles.locationRow}>
              <View style={styles.locationRail}>
                <View style={styles.pickupDot} />
                <View style={styles.locationLine} />
                <View style={styles.destinationDot} />
              </View>
              <View style={styles.locationLabels}>
                <Text style={styles.locationCaption}>PICKUP</Text>
                <Text style={styles.locationValue} numberOfLines={1}>
                  {pickup ? `${pickup.latitude.toFixed(4)}, ${pickup.longitude.toFixed(4)}` : "Pickup location unavailable"}
                </Text>
                <View style={styles.locationSpacer} />
                <Text style={styles.locationCaption}>DESTINATION</Text>
                <Text style={styles.locationValue} numberOfLines={1}>
                  {destination ? `${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}` : "Destination unavailable"}
                </Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>DISTANCE LEFT</Text>
                <Text style={styles.metricValue}>
                  {route ? formatDistance(route.distanceMeters) : "—"}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>EST. ARRIVAL</Text>
                <Text style={styles.metricValue}>
                  {route ? formatDuration(route.durationSeconds) : "—"}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>GPS STATUS</Text>
                <Text style={styles.metricValue}>
                  {gpsFreshness === "LIVE" ? "CONNECTED" : gpsFreshness === "LOCATION DELAYED" ? "DELAYED" : "WAITING"}
                </Text>
              </View>
            </View>

            <View style={styles.telemetryRow}>
              <Text style={styles.telemetryText}>
                {acceptedVehicleLocation?.speed != null
                  ? `Speed ${Number(acceptedVehicleLocation.speed).toFixed(0)}`
                  : "Speed unavailable"}
              </Text>
              {acceptedVehicleLocation?.accuracy != null ? (
                <Text style={styles.telemetryText}>
                  GPS accuracy ±{Number(acceptedVehicleLocation.accuracy).toFixed(0)} m
                </Text>
              ) : null}
              <Text style={styles.telemetryText}>
                {formatUpdatedAt(acceptedVehicleLocation?.recordedAt)}
              </Text>
            </View>

            <Pressable
              style={styles.hideDetails}
              onPress={() => setDetailsVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Hide journey details"
            >
              <Text style={styles.hideDetailsText}>HIDE JOURNEY DETAILS</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E4EAF4",
    marginBottom: 16,
  },
  mapContainer: {
    height: 560,
    position: "relative",
    backgroundColor: "#F2F5FA",
  },
  topStatus: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#E4EAF4",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#12B76A",
  },
  liveDotMuted: {
    opacity: 0.4,
  },
  liveLabel: {
    color: "#175CD3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  recenterButton: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#D7E0EF",
  },
  recenterText: {
    color: "#175CD3",
    fontSize: 10,
    fontWeight: "900",
  },
  routeBadge: {
    position: "absolute",
    top: 58,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#E4EAF4",
  },
  routeBadgeText: {
    color: "#344054",
    fontSize: 11,
    fontWeight: "700",
  },
  peekPanel: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E4EAF4",
  },
  peekHandle: {
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#D0D5DD",
    marginBottom: 10,
  },
  peekTitle: {
    color: "#175CD3",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  peekSubtitle: {
    color: "#667085",
    fontSize: 11,
    marginTop: 5,
    textAlign: "center",
  },
  infoPanel: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E4EAF4",
    shadowColor: "#101828",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  panelHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  panelHeadingText: {
    flex: 1,
  },
  eyebrow: {
    color: "#175CD3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  panelTitle: {
    color: "#101828",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 5,
  },
  status: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "capitalize",
  },
  updated: {
    color: "#667085",
    fontSize: 10,
    textAlign: "right",
    maxWidth: 105,
  },
  locationRow: {
    flexDirection: "row",
    marginTop: 15,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#EAECF0",
  },
  locationRail: {
    width: 22,
    alignItems: "center",
    paddingTop: 4,
  },
  pickupDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#175CD3",
    backgroundColor: "#FFFFFF",
  },
  locationLine: {
    width: 2,
    height: 22,
    backgroundColor: "#B2CCFF",
  },
  destinationDot: {
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: "#175CD3",
  },
  locationLabels: {
    flex: 1,
  },
  locationCaption: {
    color: "#667085",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  locationValue: {
    color: "#344054",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  locationSpacer: {
    height: 10,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 13,
    paddingBottom: 10,
  },
  metric: {
    flex: 1,
    minWidth: 0,
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#EAECF0",
    marginHorizontal: 8,
  },
  metricLabel: {
    color: "#667085",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  metricValue: {
    color: "#101828",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5,
  },
  telemetryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderTopWidth: 1,
    borderColor: "#EAECF0",
    paddingTop: 10,
  },
  telemetryText: {
    color: "#667085",
    fontSize: 10,
    fontWeight: "600",
  },
  hideDetails: {
    alignItems: "center",
    paddingTop: 12,
    marginTop: 10,
    borderTopWidth: 1,
    borderColor: "#EAECF0",
  },
  hideDetailsText: {
    color: "#175CD3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
});
