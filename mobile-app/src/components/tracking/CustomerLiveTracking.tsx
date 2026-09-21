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
  const [acceptedVehicleLocation, setAcceptedVehicleLocation] =
    useState<LiveLocation | null>(null);
  const lastRouteRequestAt = useRef(0);
  const lastRouteCoordinate = useRef<MapCoordinate | null>(null);
  const lastRecordedAtMs = useRef(0);

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
      recordedAt: vehicleLocation.recordedAt ?? new Date().toISOString(),
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

    if (pickup) {
      result.push({
        id: "tracking-pickup",
        coordinate: pickup,
        title: "Pickup",
        description: "Shipment pickup location",
      });
    }

    if (destination) {
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
  }, [destination, pickup, vehicleCoordinate]);

  if (!enabled) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>LIVE</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.status}>{status.replaceAll("_", " ")}</Text>
        </View>

        {acceptedVehicleLocation ? (
          <Text style={styles.updated}>
            {formatUpdatedAt(acceptedVehicleLocation.recordedAt)}
          </Text>
        ) : null}
      </View>

      <View style={styles.mapContainer}>
        <TransConetMap
          region={mapRegion}
          markers={markers}
          routeCoordinates={route?.coordinates}
          animatedMarkerId={vehicleCoordinate ? "tracking-vehicle" : undefined}
          animatedMarkerHeading={acceptedVehicleLocation?.heading}
          onUserMapInteraction={() => setFollowingVehicle(false)}
          onMapGestureStart={() => setFollowingVehicle(false)}
          followCoordinate={vehicleCoordinate}
          followEnabled={followingVehicle}
          interactive
        />

        <Pressable
          style={styles.recenterButton}
          onPress={() => setFollowingVehicle(true)}
        >
          <Text style={styles.recenterText}>
            {followingVehicle ? "FOLLOWING VEHICLE" : "RE-CENTER"}
          </Text>
        </Pressable>

        {routeLoading ? (
          <View style={styles.routeBadge}>
            <ActivityIndicator size="small" />
            <Text style={styles.routeBadgeText}>Calculating route...</Text>
          </View>
        ) : null}

        {routeError ? (
          <View style={styles.routeBadge}>
            <Text style={styles.routeBadgeText}>{routeError}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.infoPanel}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>REMAINING DISTANCE</Text>
          <Text style={styles.metricValue}>
            {route ? formatDistance(route.distanceMeters) : "—"}
          </Text>
        </View>

        <View style={styles.metric}>
          <Text style={styles.metricLabel}>ETA</Text>
          <Text style={styles.metricValue}>
            {route ? formatDuration(route.durationSeconds) : "—"}
          </Text>
        </View>

        <View style={styles.metric}>
          <Text style={styles.metricLabel}>GPS</Text>
          <Text style={styles.metricValue}>
            {acceptedVehicleLocation ? "CONNECTED" : "WAITING"}
          </Text>
        </View>
      </View>

      {acceptedVehicleLocation?.speed != null ? (
        <View style={styles.vehicleRow}>
          <Text style={styles.vehicleText}>
            Current speed: {Number(acceptedVehicleLocation.speed).toFixed(0)}
          </Text>

          {acceptedVehicleLocation.accuracy != null ? (
            <Text style={styles.vehicleSubtext}>
              GPS accuracy ±
              {Number(acceptedVehicleLocation.accuracy).toFixed(0)}m
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EAECF0",
    marginBottom: 16,
  },
  header: {
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#12B76A",
  },
  liveLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#067647",
  },
  title: {
    color: "#101828",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 5,
  },
  status: {
    color: "#475467",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "capitalize",
  },
  updated: {
    color: "#667085",
    fontSize: 11,
    marginLeft: 10,
  },
  mapContainer: {
    height: 460,
    position: "relative",
  },
  recenterButton: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#D0D5DD",
  },
  recenterText: {
    color: "#175CD3",
    fontSize: 10,
    fontWeight: "900",
  },
  routeBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  routeBadgeText: {
    color: "#475467",
    fontSize: 11,
    fontWeight: "700",
  },
  infoPanel: {
    flexDirection: "row",
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    color: "#667085",
    fontSize: 9,
    fontWeight: "900",
  },
  metricValue: {
    color: "#101828",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },
  vehicleRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  vehicleText: {
    color: "#344054",
    fontSize: 13,
    fontWeight: "700",
  },
  vehicleSubtext: {
    color: "#667085",
    fontSize: 11,
    marginTop: 3,
  },
});
