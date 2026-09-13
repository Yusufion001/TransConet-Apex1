import { useEffect, useState } from "react";
import { router } from "expo-router";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import TransConetMap from "../../../src/components/maps/TransConetMap";
import {
  autocompletePlaces,
  type PlaceSuggestion,
} from "../../../src/api/places";
import {
  createExpressBooking,
  getExpressConfig,
  getExpressQuote,
  type ExpressConfig,
  type ExpressQuote,
} from "../../../src/api/express";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function ExpressBookingScreen() {
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupLandmark, setPickupLandmark] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationLandmark, setDestinationLandmark] = useState("");

  const [pickupCoordinates, setPickupCoordinates] =
    useState<Coordinates | null>(null);
  const [destinationCoordinates, setDestinationCoordinates] =
    useState<Coordinates | null>(null);

  const [pickupSuggestions, setPickupSuggestions] = useState<PlaceSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] =
    useState<PlaceSuggestion[]>([]);

  const [placesLoading, setPlacesLoading] = useState<
    "pickup" | "destination" | null
  >(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const [packageCount, setPackageCount] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [packagingType, setPackagingType] = useState("");
  const [cargoDescription, setCargoDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");

  const [expressConfig, setExpressConfig] =
    useState<ExpressConfig | null>(null);
  const [expressConfigLoading, setExpressConfigLoading] =
    useState(true);
  const [expressConfigError, setExpressConfigError] =
    useState<string | null>(null);

  const [quote, setQuote] = useState<ExpressQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [locationPickerType, setLocationPickerType] =
    useState<"pickup" | "destination">("pickup");
  const [locationPickerCoordinate, setLocationPickerCoordinate] =
    useState<Coordinates | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadExpressConfig() {
      setExpressConfigLoading(true);
      setExpressConfigError(null);

      try {
        const config = await getExpressConfig();

        if (!mounted) return;

        setExpressConfig(config);

        if (!config.enabled) {
          setExpressConfigError(
            "Express service is currently unavailable.",
          );
        }
      } catch (error) {
        if (!mounted) return;

        setExpressConfigError(
          error instanceof Error
            ? error.message
            : "Unable to load Express configuration.",
        );
      } finally {
        if (mounted) {
          setExpressConfigLoading(false);
        }
      }
    }

    void loadExpressConfig();

    return () => {
      mounted = false;
    };
  }, []);

  async function resolveAddress(
    address: string,
  ): Promise<Coordinates | null> {
    const results = await Location.geocodeAsync(address);

    if (!results.length) return null;

    const result = results[0];

    if (
      !Number.isFinite(result.latitude) ||
      !Number.isFinite(result.longitude)
    ) {
      return null;
    }

    return {
      latitude: result.latitude,
      longitude: result.longitude,
    };
  }

  async function searchPlaceSuggestions(
    value: string,
    type: "pickup" | "destination",
  ) {
    const query = value.trim();

    if (query.length < 2) {
      if (type === "pickup") {
        setPickupSuggestions([]);
      } else {
        setDestinationSuggestions([]);
      }
      return;
    }

    setPlacesLoading(type);

    try {
      const suggestions = await autocompletePlaces(query);

      if (type === "pickup") {
        setPickupSuggestions(suggestions);
      } else {
        setDestinationSuggestions(suggestions);
      }
    } catch {
      if (type === "pickup") {
        setPickupSuggestions([]);
      } else {
        setDestinationSuggestions([]);
      }
    } finally {
      setPlacesLoading((current) =>
        current === type ? null : current,
      );
    }
  }

  function selectPlaceSuggestion(
    suggestion: PlaceSuggestion,
    type: "pickup" | "destination",
  ) {
    if (type === "pickup") {
      setPickupLocation(suggestion.text);
      setPickupSuggestions([]);
      setPickupCoordinates(null);
    } else {
      setDestination(suggestion.text);
      setDestinationSuggestions([]);
      setDestinationCoordinates(null);
    }

    setQuote(null);
  }

  async function useCurrentLocation() {
    setLocationLoading(true);

    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Location permission required",
          "Please allow TransConet to access your location so your pickup point can be identified.",
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setPickupCoordinates(coordinates);
      setQuote(null);

      try {
        const addresses =
          await Location.reverseGeocodeAsync(coordinates);
        const address = addresses[0];

        if (address) {
          const parts = [
            address.name,
            address.street,
            address.city,
            address.region,
          ].filter(Boolean);

          if (parts.length > 0) {
            setPickupLocation(parts.join(", "));
          }
        }
      } catch {
        // Coordinates remain valid if reverse geocoding fails.
      }
    } catch (error) {
      Alert.alert(
        "Unable to get location",
        error instanceof Error
          ? error.message
          : "Please enter your pickup location manually.",
      );
    } finally {
      setLocationLoading(false);
    }
  }

  async function openLocationPicker(
    type: "pickup" | "destination",
  ) {
    const existing =
      type === "pickup"
        ? pickupCoordinates
        : destinationCoordinates;

    if (existing) {
      setLocationPickerCoordinate(existing);
      setLocationPickerType(type);
      setLocationPickerVisible(true);
      return;
    }

    const address =
      type === "pickup" ? pickupLocation : destination;

    if (!address.trim()) {
      Alert.alert(
        type === "pickup"
          ? "Pickup location required"
          : "Destination required",
        `Enter a ${type} location first so TransConet can identify it on the map.`,
      );
      return;
    }

    setLocationLoading(true);

    try {
      const coordinates = await resolveAddress(address.trim());

      if (!coordinates) {
        Alert.alert(
          "Location not found",
          `We could not identify that ${type} location. Please check the address and try again.`,
        );
        return;
      }

      setLocationPickerCoordinate(coordinates);
      setLocationPickerType(type);
      setLocationPickerVisible(true);
    } catch {
      Alert.alert(
        "Location unavailable",
        `We could not identify that ${type} location right now. Please try again.`,
      );
    } finally {
      setLocationLoading(false);
    }
  }

  async function getQuote() {
    if (expressConfigLoading) {
      Alert.alert(
        "Express configuration loading",
        "Please wait while the Express service configuration loads.",
      );
      return;
    }

    if (expressConfigError || !expressConfig) {
      Alert.alert(
        "Express service unavailable",
        expressConfigError ??
          "Express pricing configuration is currently unavailable.",
      );
      return;
    }

    if (!pickupLocation.trim() || !destination.trim()) {
      Alert.alert(
        "Missing information",
        "Enter pickup and destination before requesting an Express quote.",
      );
      return;
    }

    const numericWeight = Number(weightKg);
    const numericPackageCount = Number(packageCount);

    if (!packagingType.trim()) {
      Alert.alert(
        "Packaging type required",
        "Select a configured packaging type before requesting an Express quote.",
      );
      return;
    }

    if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
      Alert.alert(
        "Invalid weight",
        "Cargo weight must be greater than zero.",
      );
      return;
    }

    if (
      !Number.isInteger(numericPackageCount) ||
      numericPackageCount <= 0
    ) {
      Alert.alert(
        "Invalid package count",
        "Package count must be a whole number greater than zero.",
      );
      return;
    }

    if (numericWeight > expressConfig.maxCargoWeightKg) {
      Alert.alert(
        "Cargo weight exceeds limit",
        `The maximum Express cargo weight is ${expressConfig.maxCargoWeightKg.toLocaleString(
          "en-NG",
        )} kg.`,
      );
      return;
    }

    setQuoteLoading(true);

    try {
      let pickup = pickupCoordinates;

      if (!pickup) {
        pickup = await resolveAddress(pickupLocation.trim());
      }

      if (!pickup) {
        Alert.alert(
          "Pickup location not found",
          "Confirm your pickup location on the map.",
        );
        return;
      }

      let destinationPoint = destinationCoordinates;

      if (!destinationPoint) {
        destinationPoint = await resolveAddress(destination.trim());
      }

      if (!destinationPoint) {
        Alert.alert(
          "Destination not found",
          "Confirm your destination on the map.",
        );
        return;
      }

      setPickupCoordinates(pickup);
      setDestinationCoordinates(destinationPoint);

      const result = await getExpressQuote({
        weightKg: numericWeight,
        packageCount: numericPackageCount,
        packagingType: packagingType.trim(),
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
        destinationLatitude: destinationPoint.latitude,
        destinationLongitude: destinationPoint.longitude,
      });

      setQuote(result);
    } catch (error) {
      Alert.alert(
        "Unable to calculate Express quote",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setQuoteLoading(false);
    }
  }

  async function confirmBooking() {
    if (!quote) {
      Alert.alert(
        "Quote required",
        "Please request an Express quote first.",
      );
      return;
    }

    if (!pickupCoordinates || !destinationCoordinates) {
      Alert.alert(
        "Locations required",
        "Confirm both pickup and destination locations on the map.",
      );
      return;
    }

    if (!scheduledDate.trim()) {
      Alert.alert(
        "Scheduled date required",
        "Enter the scheduled date in YYYY-MM-DD format.",
      );
      return;
    }

    const numericWeight = Number(weightKg);
    const numericPackageCount = Number(packageCount);

    if (
      !Number.isFinite(numericWeight) ||
      numericWeight <= 0 ||
      !Number.isInteger(numericPackageCount) ||
      numericPackageCount <= 0
    ) {
      Alert.alert(
        "Invalid shipment details",
        "Check the package count and cargo weight.",
      );
      return;
    }

    setBookingLoading(true);

    try {
      const result = await createExpressBooking(
        {
          pickupLocation: pickupLocation.trim(),
          pickupLandmark: pickupLandmark.trim() || undefined,
          destination: destination.trim(),
          destinationLandmark:
            destinationLandmark.trim() || undefined,
          pickupLatitude: pickupCoordinates.latitude,
          pickupLongitude: pickupCoordinates.longitude,
          destinationLatitude: destinationCoordinates.latitude,
          destinationLongitude: destinationCoordinates.longitude,
          scheduledDate: scheduledDate.trim(),
          packagingType: packagingType.trim(),
          packageCount: numericPackageCount,
          weightKg: numericWeight,
          cargoDescription:
            cargoDescription.trim() || undefined,
        },
      );

      if (!result.checkoutUrl) {
        throw new Error(
          "Paystack checkout link is unavailable.",
        );
      }

      router.push({
        pathname: "/(customer)/express/[id]",
        params: {
          id: result.expressBookingId,
          bookingId: result.bookingId,
          paymentStatus: result.paymentStatus,
          checkoutUrl: result.checkoutUrl,
        },
      });
    } catch (error) {
      Alert.alert(
        "Unable to create Express booking",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Express Booking</Text>
        <Text style={styles.subtitle}>
          Book a direct, expedited transport request separately from
          the Marketplace.
        </Text>

        <Text style={styles.sectionTitle}>Pickup</Text>

        <Text style={styles.label}>Pickup location</Text>
        <TextInput
          value={pickupLocation}
          onChangeText={(value) => {
            setPickupLocation(value);
            setPickupCoordinates(null);
            setQuote(null);
            void searchPlaceSuggestions(value, "pickup");
          }}
          placeholder="Enter pickup address"
          style={styles.input}
        />

        {pickupSuggestions.length > 0 && (
          <View style={styles.suggestionsCard}>
            {pickupSuggestions.map((suggestion) => (
              <Pressable
                key={suggestion.placeId}
                onPress={() =>
                  selectPlaceSuggestion(suggestion, "pickup")
                }
                style={styles.suggestionItem}
              >
                <Text style={styles.suggestionTitle}>
                  {suggestion.text}
                </Text>
                {suggestion.secondaryText ? (
                  <Text style={styles.suggestionSecondary}>
                    {suggestion.secondaryText}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          disabled={locationLoading || bookingLoading}
          onPress={useCurrentLocation}
          style={styles.secondaryButton}
        >
          {locationLoading ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.secondaryButtonText}>
              Use my current location
            </Text>
          )}
        </Pressable>

        {pickupCoordinates ? (
          <Text style={styles.confirmedText}>
            Pickup location confirmed
          </Text>
        ) : null}

        <Pressable
          disabled={locationLoading || bookingLoading}
          onPress={() => openLocationPicker("pickup")}
          style={styles.mapButton}
        >
          <Text style={styles.mapButtonText}>
            Confirm pickup on map
          </Text>
        </Pressable>

        <Text style={styles.label}>Pickup landmark</Text>
        <TextInput
          value={pickupLandmark}
          onChangeText={setPickupLandmark}
          placeholder="Optional landmark"
          style={styles.input}
        />

        <Text style={styles.sectionTitle}>Destination</Text>

        <Text style={styles.label}>Destination</Text>
        <TextInput
          value={destination}
          onChangeText={(value) => {
            setDestination(value);
            setDestinationCoordinates(null);
            setQuote(null);
            void searchPlaceSuggestions(value, "destination");
          }}
          placeholder="Enter destination address"
          style={styles.input}
        />

        {destinationSuggestions.length > 0 && (
          <View style={styles.suggestionsCard}>
            {destinationSuggestions.map((suggestion) => (
              <Pressable
                key={suggestion.placeId}
                onPress={() =>
                  selectPlaceSuggestion(
                    suggestion,
                    "destination",
                  )
                }
                style={styles.suggestionItem}
              >
                <Text style={styles.suggestionTitle}>
                  {suggestion.text}
                </Text>
                {suggestion.secondaryText ? (
                  <Text style={styles.suggestionSecondary}>
                    {suggestion.secondaryText}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        {destinationCoordinates ? (
          <Text style={styles.confirmedText}>
            Destination location confirmed
          </Text>
        ) : null}

        <Pressable
          disabled={locationLoading || bookingLoading}
          onPress={() => openLocationPicker("destination")}
          style={styles.mapButton}
        >
          <Text style={styles.mapButtonText}>
            Confirm destination on map
          </Text>
        </Pressable>

        <Text style={styles.label}>Destination landmark</Text>
        <TextInput
          value={destinationLandmark}
          onChangeText={setDestinationLandmark}
          placeholder="Optional landmark"
          style={styles.input}
        />

        <Text style={styles.sectionTitle}>Shipment</Text>

        <Text style={styles.label}>Package count</Text>
        <TextInput
          value={packageCount}
          onChangeText={(value) => {
            setPackageCount(value);
            setQuote(null);
          }}
          placeholder="Number of packages"
          keyboardType="number-pad"
          style={styles.input}
        />

        <Text style={styles.label}>Cargo weight</Text>
        <TextInput
          value={weightKg}
          onChangeText={(value) => {
            setWeightKg(value);
            setQuote(null);
          }}
          placeholder="Weight in kg"
          keyboardType="decimal-pad"
          style={styles.input}
        />
        {expressConfig ? (
          <Text style={styles.fieldHint}>
            Maximum Express cargo weight:{" "}
            {expressConfig.maxCargoWeightKg.toLocaleString("en-NG")} kg
          </Text>
        ) : null}

        <Text style={styles.label}>Packaging type</Text>

        {expressConfigLoading ? (
          <View style={styles.configLoading}>
            <ActivityIndicator />
            <Text style={styles.configLoadingText}>
              Loading available packaging types...
            </Text>
          </View>
        ) : expressConfigError ? (
          <View style={styles.configError}>
            <Text style={styles.configErrorText}>
              {expressConfigError}
            </Text>
          </View>
        ) : expressConfig &&
          Object.keys(expressConfig.packageTypes).length > 0 ? (
          <View style={styles.packageTypeGrid}>
            {Object.keys(expressConfig.packageTypes).map((item) => {
              const selected = packagingType === item;

              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    setPackagingType(item);
                    setQuote(null);
                  }}
                  style={[
                    styles.packageTypeOption,
                    selected && styles.packageTypeOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.packageTypeText,
                      selected && styles.packageTypeTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.configError}>
            <Text style={styles.configErrorText}>
              No Express packaging types are currently configured.
            </Text>
          </View>
        )}

        {expressConfig && !expressConfigError ? (
          <Text style={styles.fieldHint}>
            Select one of the packaging types configured by TransConet.
          </Text>
        ) : null}

        <Text style={styles.label}>Scheduled date</Text>
        <TextInput
          value={scheduledDate}
          onChangeText={setScheduledDate}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
          style={styles.input}
        />

        <Text style={styles.label}>Cargo description</Text>
        <TextInput
          value={cargoDescription}
          onChangeText={setCargoDescription}
          placeholder="Describe your shipment"
          multiline
          style={[styles.input, styles.textArea]}
        />

        <Pressable
          disabled={
            expressConfigLoading ||
            !!expressConfigError ||
            !expressConfig ||
            quoteLoading ||
            bookingLoading
          }
          onPress={getQuote}
          style={[
            styles.primaryButton,
            (expressConfigLoading ||
              !!expressConfigError ||
              !expressConfig ||
              quoteLoading ||
              bookingLoading) &&
              styles.buttonDisabled,
          ]}
        >
          {quoteLoading ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.primaryButtonText}>
              Get Express Quote
            </Text>
          )}
        </Pressable>

        {quote ? (
          <View style={styles.quoteCard}>
            <Text style={styles.quoteTitle}>Express Quote</Text>

            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Distance</Text>
              <Text style={styles.quoteValue}>
                {quote.distanceKm.toLocaleString("en-NG")} km
              </Text>
            </View>

            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Weight</Text>
              <Text style={styles.quoteValue}>
                {quote.weightKg.toLocaleString("en-NG")} kg
              </Text>
            </View>

            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>
                Packaging charge
              </Text>
              <Text style={styles.quoteValue}>
                ₦{quote.packagingCharge.toLocaleString("en-NG")}
              </Text>
            </View>

            <View style={styles.quoteDivider} />

            <Text style={styles.totalLabel}>TOTAL EXPRESS FARE</Text>
            <Text style={styles.totalAmount}>
              ₦{quote.fare.toLocaleString("en-NG")}
            </Text>
          </View>
        ) : null}

        {quote ? (
          <Pressable
            disabled={bookingLoading}
            onPress={confirmBooking}
            style={[
              styles.primaryButton,
              bookingLoading && styles.buttonDisabled,
            ]}
          >
            {bookingLoading ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.primaryButtonText}>
                Continue to Express Payment
              </Text>
            )}
          </Pressable>
        ) : null}

        <Pressable
          disabled={bookingLoading}
          onPress={() => router.back()}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={locationPickerVisible}
        animationType="slide"
        onRequestClose={() => setLocationPickerVisible(false)}
      >
        <View style={styles.locationModal}>
          <Text style={styles.locationModalTitle}>
            Confirm{" "}
            {locationPickerType === "pickup"
              ? "pickup"
              : "destination"}{" "}
            location
          </Text>

          <Text style={styles.locationModalHint}>
            Move the pin to the exact collection point, then confirm.
          </Text>

          <View style={styles.locationMapContainer}>
            {locationPickerCoordinate ? (
              <TransConetMap
                region={{
                  latitude: locationPickerCoordinate.latitude,
                  longitude: locationPickerCoordinate.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                pinCoordinate={locationPickerCoordinate}
                onPinChange={setLocationPickerCoordinate}
                interactive
              />
            ) : null}
          </View>

          <View style={styles.locationModalActions}>
            <Pressable
              onPress={() => setLocationPickerVisible(false)}
              style={styles.locationModalCancel}
            >
              <Text style={styles.locationModalCancelText}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              disabled={!locationPickerCoordinate}
              onPress={() => {
                if (!locationPickerCoordinate) return;

                if (locationPickerType === "pickup") {
                  setPickupCoordinates(locationPickerCoordinate);
                } else {
                  setDestinationCoordinates(
                    locationPickerCoordinate,
                  );
                }

                setQuote(null);
                setLocationPickerVisible(false);
              }}
              style={styles.locationModalConfirm}
            >
              <Text style={styles.locationModalConfirmText}>
                Confirm location
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#101828",
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 22,
    color: "#667085",
    fontSize: 14,
    lineHeight: 21,
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: "800",
    color: "#102A43",
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#344054",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    color: "#101828",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
  },
  packageTypeGrid: {
    gap: 8,
  },
  packageTypeOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
  },
  packageTypeOptionSelected: {
    borderColor: "#175CD3",
    backgroundColor: "#F5F9FF",
  },
  packageTypeText: {
    color: "#475467",
    fontSize: 14,
    fontWeight: "700",
  },
  packageTypeTextSelected: {
    color: "#175CD3",
    fontWeight: "800",
  },
  configLoading: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  configLoadingText: {
    color: "#667085",
    fontSize: 13,
  },
  configError: {
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FEF2F2",
  },
  configErrorText: {
    color: "#B42318",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  suggestionsCard: {
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E3EF",
    overflow: "hidden",
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E6EEF5",
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#102A43",
  },
  suggestionSecondary: {
    marginTop: 3,
    fontSize: 12,
    color: "#627D98",
  },
  secondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#344054",
    fontWeight: "700",
  },
  mapButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#B8CCE0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  mapButtonText: {
    color: "#175CD3",
    fontWeight: "700",
  },
  confirmedText: {
    marginTop: 8,
    color: "#027A48",
    fontSize: 13,
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#175CD3",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  quoteCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#F4F8FC",
    borderWidth: 1,
    borderColor: "#D7E3EF",
  },
  quoteTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#102A43",
    marginBottom: 12,
  },
  quoteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  quoteLabel: {
    color: "#667085",
  },
  quoteValue: {
    color: "#344054",
    fontWeight: "700",
  },
  quoteDivider: {
    height: 1,
    backgroundColor: "#D7E3EF",
    marginVertical: 14,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#667085",
  },
  totalAmount: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "900",
    color: "#101828",
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelText: {
    color: "#667085",
    fontWeight: "700",
  },
  locationModal: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 24,
  },
  locationModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#101828",
    paddingHorizontal: 20,
  },
  locationModalHint: {
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 16,
  },
  locationMapContainer: {
    flex: 1,
    minHeight: 320,
    overflow: "hidden",
  },
  locationModalActions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
  },
  locationModalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  locationModalCancelText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "800",
  },
  locationModalConfirm: {
    flex: 1,
    backgroundColor: "#175CD3",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  locationModalConfirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
