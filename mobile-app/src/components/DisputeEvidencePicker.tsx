import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

export type DisputeAsset = ImagePicker.ImagePickerAsset;

type Props = {
  assets: DisputeAsset[];
  onChange: (assets: DisputeAsset[]) => void;
  disabled?: boolean;
};

export default function DisputeEvidencePicker({
  assets,
  onChange,
  disabled,
}: Props) {
  const [busy, setBusy] = useState(false);

  const pick = async (camera: boolean, video: boolean) => {
    if (assets.length >= 10) {
      Alert.alert("Evidence limit", "You can attach up to 10 files.");
      return;
    }

    setBusy(true);

    try {
      if (camera) {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          Alert.alert("Permission required", "Camera permission is required.");
          return;
        }
      }

      if (!camera) {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            "Permission required",
            "Photo and video library permission is required.",
          );
          return;
        }
      }

      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: video ? ["videos"] : ["images"],
            videoMaxDuration: 120,
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            allowsMultipleSelection: true,
            selectionLimit: 10 - assets.length,
            orderedSelection: true,
            quality: 1,
          });

      if (!result.canceled && result.assets?.length) {
        onChange([...assets, ...result.assets].slice(0, 10));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={styles.hint}>
        Evidence is optional. Add pickup photos or video if they help explain
        the dispute.
      </Text>

      <View style={styles.actions}>
        <Pressable
          disabled={disabled || busy}
          onPress={() => void pick(true, false)}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Photo</Text>
        </Pressable>

        <Pressable
          disabled={disabled || busy}
          onPress={() => void pick(true, true)}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Video</Text>
        </Pressable>

        <Pressable
          disabled={disabled || busy}
          onPress={() => void pick(false, false)}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Gallery</Text>
        </Pressable>
      </View>

      {assets.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.preview}>
            {assets.map((asset, index) => (
              <View key={`${asset.uri}-${index}`} style={styles.item}>
                {asset.type === "video" ? (
                  <View style={styles.video}>
                    <Text style={styles.videoText}>VIDEO</Text>
                  </View>
                ) : (
                  <Image source={{ uri: asset.uri }} style={styles.image} />
                )}

                <Pressable
                  onPress={() =>
                    onChange(assets.filter((_, i) => i !== index))
                  }
                  style={styles.remove}
                >
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#B2CCEE",
    backgroundColor: "#F4F8FF",
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0B63CE",
  },
  preview: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  item: {
    width: 90,
    height: 90,
    borderRadius: 9,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#EAECF0",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  video: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  videoText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#475467",
  },
  remove: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101828",
  },
  removeText: {
    color: "#FFFFFF",
    fontSize: 17,
  },
});
