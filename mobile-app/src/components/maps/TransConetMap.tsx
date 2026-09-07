import React, { useMemo } from "react";
import MapView, {
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
};

export default function TransConetMap({
  region,
  markers = [],
  routeCoordinates = [],
  pinCoordinate,
  onPinChange,
  interactive = true,
}: TransConetMapProps) {
  const hasRoute = useMemo(
    () => routeCoordinates.length > 1,
    [routeCoordinates],
  );

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
        initialRegion={region}
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

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={marker.coordinate}
            title={marker.title}
            description={marker.description}
          />
        ))}

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
