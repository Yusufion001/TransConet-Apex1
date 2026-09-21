import React, { useEffect, useMemo, useRef } from "react";
import MapView, {
  AnimatedRegion,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type Region,
} from "react-native-maps";
import { StyleSheet, View } from "react-native";

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type TransConetMapMarker = {
  id: string;
  coordinate: MapCoordinate;
  title?: string;
  description?: string;
};

type TransConetMapProps = {
  region: Region;
  markers?: TransConetMapMarker[];
  routeCoordinates?: MapCoordinate[];
  pinCoordinate?: MapCoordinate;
  onPinChange?: (coordinate: MapCoordinate) => void;
  interactive?: boolean;
  animatedMarkerId?: string;
  animatedMarkerHeading?: number | null;
  onUserMapInteraction?: () => void;
  onMapGestureStart?: () => void;
  followCoordinate?: MapCoordinate | null;
  followEnabled?: boolean;
  fitCoordinates?: MapCoordinate[];
  fitToCoordinatesOnChange?: boolean;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
};

export default function TransConetMap({
  region,
  markers = [],
  routeCoordinates = [],
  pinCoordinate,
  onPinChange,
  interactive = true,
  animatedMarkerId,
  animatedMarkerHeading,
  onUserMapInteraction,
  onMapGestureStart,
  followCoordinate,
  followEnabled = false,
  fitCoordinates = [],
  fitToCoordinatesOnChange = false,
  showsUserLocation = false,
  showsMyLocationButton = false,
}: TransConetMapProps) {
  const mapRef = useRef<MapView | null>(null);

  const hasRoute = routeCoordinates.length > 1;

  const animatedMarker = useMemo(
    () => markers.find((marker) => marker.id === animatedMarkerId),
    [animatedMarkerId, markers],
  );

  const animatedCoordinate = useRef(
    new AnimatedRegion({
      latitude: animatedMarker?.coordinate.latitude ?? region.latitude,
      longitude: animatedMarker?.coordinate.longitude ?? region.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;

  const previousFitKey = useRef("");
  const previousAnimatedCoordinate = useRef<MapCoordinate | null>(null);

  useEffect(() => {
    if (!animatedMarker) {
      previousAnimatedCoordinate.current = null;
      return;
    }

    const next = animatedMarker.coordinate;
    const previous = previousAnimatedCoordinate.current;

    if (!previous) {
      animatedCoordinate.setValue({
        latitude: next.latitude,
        longitude: next.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
      });
      previousAnimatedCoordinate.current = next;
      return;
    }

    const latitudeDelta = next.latitude - previous.latitude;
    const longitudeDelta = next.longitude - previous.longitude;
    const distanceDegrees = Math.sqrt(
      latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta,
    );

    // GPS updates normally arrive around every 5–10 seconds. Keep the
    // animation below the update interval so the marker does not lag badly.
    const duration = Math.max(
      450,
      Math.min(1200, Math.round(500 + distanceDegrees * 900000)),
    );

    animatedCoordinate
      .timing({
        latitude: next.latitude,
        longitude: next.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration,
        useNativeDriver: false,
      } as any)
      .start();

    previousAnimatedCoordinate.current = next;
  }, [animatedCoordinate, animatedMarker]);

  useEffect(() => {
    if (!followEnabled || !followCoordinate || !interactive) {
      return;
    }

    mapRef.current?.animateCamera(
      {
        center: {
          latitude: followCoordinate.latitude,
          longitude: followCoordinate.longitude,
        },
      },
      {
        duration: 650,
      },
    );
  }, [
    followCoordinate?.latitude,
    followCoordinate?.longitude,
    followEnabled,
    interactive,
  ]);

  useEffect(() => {
    if (!fitToCoordinatesOnChange || fitCoordinates.length < 2) {
      return;
    }

    const validCoordinates = fitCoordinates.filter(
      (coordinate) =>
        Number.isFinite(coordinate.latitude) &&
        Number.isFinite(coordinate.longitude),
    );

    if (validCoordinates.length < 2) {
      return;
    }

    const fitKey = validCoordinates
      .map(
        (coordinate) =>
          `${coordinate.latitude.toFixed(5)},${coordinate.longitude.toFixed(5)}`,
      )
      .join("|");

    if (fitKey === previousFitKey.current) {
      return;
    }

    previousFitKey.current = fitKey;

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(validCoordinates, {
        edgePadding: {
          top: 70,
          right: 45,
          bottom: 90,
          left: 45,
        },
        animated: true,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [fitCoordinates, fitToCoordinatesOnChange]);

  const handleMapPress = (event: MapPressEvent) => {
    if (interactive) {
      onUserMapInteraction?.();
    }

    if (!interactive || !onPinChange) {
      return;
    }

    onPinChange(event.nativeEvent.coordinate);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onPress={handleMapPress}
        onRegionChangeStart={
          interactive
            ? (_region, details) => {
                if (details?.isGesture) {
                  onMapGestureStart?.();
                  onUserMapInteraction?.();
                }
              }
            : undefined
        }
        onPanDrag={
          interactive
            ? () => {
                onUserMapInteraction?.();
              }
            : undefined
        }
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={showsMyLocationButton && interactive}
        toolbarEnabled={false}
        loadingEnabled
        moveOnMarkerPress={false}
      >
        {pinCoordinate ? (
          <Marker
            coordinate={pinCoordinate}
            draggable={interactive && Boolean(onPinChange)}
            onDragStart={interactive ? onUserMapInteraction : undefined}
            onDragEnd={(event) => {
              onPinChange?.(event.nativeEvent.coordinate);
            }}
            title="Selected location"
          />
        ) : null}

        {markers.map((marker) => {
          if (marker.id === animatedMarkerId) {
            return (
              <Marker.Animated
                key={marker.id}
                coordinate={animatedCoordinate as any}
                title={marker.title}
                description={marker.description}
                rotation={
                  animatedMarkerHeading != null ? animatedMarkerHeading : 0
                }
                flat
                anchor={{ x: 0.5, y: 0.5 }}
              />
            );
          }

          return (
            <Marker
              key={marker.id}
              coordinate={marker.coordinate}
              title={marker.title}
              description={marker.description}
            />
          );
        })}

        {hasRoute ? (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
});
