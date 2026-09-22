import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import { getRealtimeSocket } from "./socket";

const LOCATION_TASK_NAME = "transconet-transporter-location";
const ACTIVE_BOOKING_KEY = "transconet_active_tracking_booking";
const ACTIVE_MARKETPLACE_VEHICLE_KEY = "transconet_active_marketplace_vehicle";

type LocationTaskData = {
  locations: Location.LocationObject[];
};

async function publishLocation(location: Location.LocationObject) {
  const [bookingId, marketplaceVehicleId] = await Promise.all([
    SecureStore.getItemAsync(ACTIVE_BOOKING_KEY),
    SecureStore.getItemAsync(ACTIVE_MARKETPLACE_VEHICLE_KEY),
  ]);

  if (!bookingId && !marketplaceVehicleId) {
    return;
  }

  const socket = await getRealtimeSocket();

  if (bookingId) {
    socket.emit("vehicle-location-update", {
      bookingId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: location.coords.speed ?? undefined,
      heading: location.coords.heading ?? undefined,
      accuracy: location.coords.accuracy ?? undefined,
    });

    return;
  }

  if (marketplaceVehicleId) {
    socket.emit("vehicle-marketplace-location-update", {
      vehicleId: marketplaceVehicleId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
  }
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

  await SecureStore.deleteItemAsync(ACTIVE_MARKETPLACE_VEHICLE_KEY);

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
  await SecureStore.deleteItemAsync(ACTIVE_BOOKING_KEY);

  const marketplaceVehicleId =
    await SecureStore.getItemAsync(
      ACTIVE_MARKETPLACE_VEHICLE_KEY,
    );

  if (marketplaceVehicleId) {
    return;
  }

  const running =
    await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );

  if (running) {
    await Location.stopLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );
  }
}

export async function startMarketplaceVehicleLocationTracking(
  vehicleId: string,
): Promise<void> {
  if (!vehicleId || vehicleId.trim().length === 0) {
    throw new Error("Vehicle ID is required for marketplace location tracking.");
  }

  const activeBookingId =
    await SecureStore.getItemAsync(ACTIVE_BOOKING_KEY);

  if (activeBookingId) {
    throw new Error(
      "Marketplace location tracking cannot start while a live trip is active.",
    );
  }

  const foregroundPermission =
    await Location.getForegroundPermissionsAsync();

  if (foregroundPermission.status !== "granted") {
    const requestedForeground =
      await Location.requestForegroundPermissionsAsync();

    if (requestedForeground.status !== "granted") {
      throw new Error(
        "Location permission is required to appear in the marketplace.",
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
        "Background location permission is required for marketplace availability.",
      );
    }
  }

  const activeMarketplaceVehicleId =
    await SecureStore.getItemAsync(
      ACTIVE_MARKETPLACE_VEHICLE_KEY,
    );

  const alreadyRunning =
    await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );

  let initialLocation: Location.LocationObject;

  try {
    initialLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch (error) {
    throw new Error(
      "Unable to get the vehicle's current location. Turn on device location and try again.",
      { cause: error },
    );
  }

  if (alreadyRunning) {
    await Location.stopLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );
  }

  try {
    await Location.startLocationUpdatesAsync(
      LOCATION_TASK_NAME,
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 25,
        timeInterval: 10000,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "TransConet marketplace availability",
          notificationBody:
            "Your vehicle location is being shared while it is available for marketplace loads.",
          notificationColor: "#1E88E5",
        },
      },
    );

    await SecureStore.setItemAsync(
      ACTIVE_MARKETPLACE_VEHICLE_KEY,
      vehicleId,
    );

    await publishLocation(initialLocation);
  } catch (error) {
    await SecureStore.deleteItemAsync(
      ACTIVE_MARKETPLACE_VEHICLE_KEY,
    );

    const activeBookingId =
      await SecureStore.getItemAsync(ACTIVE_BOOKING_KEY);

    if (!activeBookingId) {
      const running =
        await Location.hasStartedLocationUpdatesAsync(
          LOCATION_TASK_NAME,
        );

      if (running) {
        await Location.stopLocationUpdatesAsync(
          LOCATION_TASK_NAME,
        );
      }
    }

    if (
      activeMarketplaceVehicleId &&
      activeMarketplaceVehicleId !== vehicleId
    ) {
      try {
        await Location.startLocationUpdatesAsync(
          LOCATION_TASK_NAME,
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 25,
            timeInterval: 10000,
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: "TransConet marketplace availability",
              notificationBody:
                "Your vehicle location is being shared while it is available for marketplace loads.",
              notificationColor: "#1E88E5",
            },
          },
        );

        await SecureStore.setItemAsync(
          ACTIVE_MARKETPLACE_VEHICLE_KEY,
          activeMarketplaceVehicleId,
        );
      } catch (restoreError) {
        console.warn(
          "Failed to restore previous marketplace location tracking:",
          restoreError,
        );
      }
    }

    throw error;
  }
}

export async function stopMarketplaceVehicleLocationTracking(
  vehicleId?: string,
): Promise<void> {
  const activeMarketplaceVehicleId =
    await SecureStore.getItemAsync(
      ACTIVE_MARKETPLACE_VEHICLE_KEY,
    );

  if (
    vehicleId &&
    activeMarketplaceVehicleId &&
    activeMarketplaceVehicleId !== vehicleId
  ) {
    return;
  }

  await SecureStore.deleteItemAsync(
    ACTIVE_MARKETPLACE_VEHICLE_KEY,
  );

  const activeBookingId =
    await SecureStore.getItemAsync(ACTIVE_BOOKING_KEY);

  if (activeBookingId) {
    return;
  }

  const running =
    await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );

  if (running) {
    await Location.stopLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );
  }
}

export async function getActiveMarketplaceVehicleId(): Promise<
  string | null
> {
  return SecureStore.getItemAsync(
    ACTIVE_MARKETPLACE_VEHICLE_KEY,
  );
}

export async function getActiveTrackingBookingId(): Promise<
  string | null
> {
  return SecureStore.getItemAsync(ACTIVE_BOOKING_KEY);
}

export { LOCATION_TASK_NAME };
