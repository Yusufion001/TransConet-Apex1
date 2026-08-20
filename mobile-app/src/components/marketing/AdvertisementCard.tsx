import React from "react";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Advertisement } from "../../types/marketing";

type Props = {
  advertisement: Advertisement;
};

export function AdvertisementCard({ advertisement }: Props) {
  const handlePress = async () => {
    if (!advertisement.ctaUrl) return;

    const supported = await Linking.canOpenURL(advertisement.ctaUrl);

    if (supported) {
      await Linking.openURL(advertisement.ctaUrl);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>ADVERTISEMENT</Text>

      {advertisement.imageUrl ? (
        <Image
          source={{ uri: advertisement.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.content}>
        <Text style={styles.title}>{advertisement.title}</Text>

        {advertisement.description ? (
          <Text style={styles.description}>
            {advertisement.description}
          </Text>
        ) : null}

        {advertisement.ctaLabel && advertisement.ctaUrl ? (
          <Pressable
            accessibilityRole="button"
            onPress={handlePress}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>
              {advertisement.ctaLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F4F7FA",
  },
  label: {
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#667085",
  },
  image: {
    width: "100%",
    height: 150,
    marginTop: 10,
  },
  content: {
    padding: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#101828",
  },
  description: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#475467",
  },
  button: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: "#101828",
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
