import React, { useEffect, useMemo, useRef } from "react";
import MapView, {
  AnimatedRegion,
  Marker,
  Polyline,
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
};

export default function TransConetMap({
  region,
  markers = [],
  routeCoordinates = [],
  pinCoordinate,
  onPinChange,
  interactive = true,
  animatedMarkerId,
}: TransConetMapProps) {
  const hasRoute = useMemo(
    () => routeCoordinates.length > 1,
    [routeCoordinates],
  );

  const animatedCoordinate = useRef(
    new AnimatedRegion({
      latitude: markers.find((marker) => marker.id === animatedMarkerId)?.coordinate.latitude ?? region.latitude,
      longitude: markers.find((marker) => marker.id === animatedMarkerId)?.coordinate.longitude ?? region.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;

  useEffect(() => {
    const animatedMarker = markers.find(
      (marker) => marker.id === animatedMarkerId,
    );

    if (!animatedMarker) {
      return;
    }

    animatedCoordinate.timing({
      latitude: animatedMarker.coordinate.latitude,
      longitude: animatedMarker.coordinate.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
      duration: 900,
      useNativeDriver: false,
    } as any).start();
  }, [animatedCoordinate, animatedMarkerId, markers]);

  const handleMapPress = (event: MapPressEvent) => {
    if (!interactive || !onPinChange) {
      return;
    }

    onPinChange(event.nativeEvent.coordinate);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        region={region}
        onPress={handleMapPress}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
      >
        {pinCoordinate ? (
          <Marker
            coordinate={pinCoordinate}
            draggable={interactive && Boolean(onPinChange)}
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
            strokeWidth={4}
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
