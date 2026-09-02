import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import { getRealtimeSocket } from "./socket";

const LOCATION_TASK_NAME = "transconet-transporter-location";
const ACTIVE_BOOKING_KEY = "transconet_active_tracking_booking";

type LocationTaskData = {
  locations: Location.LocationObject[];
};

async function publishLocation(location: Location.LocationObject) {
  const bookingId = await SecureStore.getItemAsync(ACTIVE_BOOKING_KEY);

  if (!bookingId) {
    return;
  }

  const socket = await getRealtimeSocket();

  socket.emit("vehicle-location-update", {
    bookingId,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    speed: location.coords.speed ?? undefined,
    heading: location.coords.heading ?? undefined,
    accuracy: location.coords.accuracy ?? undefined,
  });
}

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask<LocationTaskData>(
    LOCATION_TASK_NAME,
    async ({ data, error }) => {
      if (error) {
        console.warn("TransConet location task error:", error.message);
        return;
      }

      if (!data?.locations?.length) {
        return;
      }

      const latestLocation =
        data.locations[data.locations.length - 1];

      try {
        await publishLocation(latestLocation);
      } catch (taskError) {
        console.warn(
          "TransConet failed to publish transporter location:",
          taskError instanceof Error
            ? taskError.message
            : taskError,
        );
      }
    },
  );
}

export async function startTransporterLocationTracking(
  bookingId: string,
): Promise<void> {
  const foregroundPermission =
    await Location.getForegroundPermissionsAsync();

  if (foregroundPermission.status !== "granted") {
    const requestedForeground =
      await Location.requestForegroundPermissionsAsync();

    if (requestedForeground.status !== "granted") {
      throw new Error(
        "Location permission is required for live trip tracking.",
      );
    }
  }

  const backgroundPermission =
    await Location.getBackgroundPermissionsAsync();

  if (backgroundPermission.status !== "granted") {
    const requestedBackground =
      await Location.requestBackgroundPermissionsAsync();

    if (requestedBackground.status !== "granted") {
      throw new Error(
        "Background location permission is required for live trip tracking.",
      );
    }
  }

  const activeBookingId =
    await SecureStore.getItemAsync(ACTIVE_BOOKING_KEY);

  const alreadyRunning =
    await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );

  if (alreadyRunning) {
    if (activeBookingId === bookingId) {
      return;
    }

    await Location.stopLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );
  }

  await SecureStore.setItemAsync(
    ACTIVE_BOOKING_KEY,
    bookingId,
  );

  await Location.startLocationUpdatesAsync(
    LOCATION_TASK_NAME,
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 25,
      timeInterval: 10000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "TransConet live trip tracking",
        notificationBody:
          "Your location is being shared while your trip is in progress.",
        notificationColor: "#1E88E5",
      },
    },
  );
}

export async function stopTransporterLocationTracking(): Promise<void> {
  const running =
    await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );

  if (running) {
    await Location.stopLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );
  }

  await SecureStore.deleteItemAsync(ACTIVE_BOOKING_KEY);
}

export async function getActiveTrackingBookingId(): Promise<
  string | null
> {
  return SecureStore.getItemAsync(ACTIVE_BOOKING_KEY);
}

export { LOCATION_TASK_NAME };
