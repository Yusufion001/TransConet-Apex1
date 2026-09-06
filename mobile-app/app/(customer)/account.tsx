import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import { useAuthStore } from "../../src/auth/auth.store";

export default function CustomerAccount() {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const signOut = useAuthStore((state) => state.signOut);
  const loading = useAuthStore((state) => state.loading);

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!user) return;

    setPhone(user.phone ?? "");
  }, [user]);

  const fullName =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "Customer";

  const handleEdit = () => {
    if (!user) return;

    setPhone(user.phone ?? "");
    setEditing(true);
  };

  const handleCancel = () => {
    if (!user) return;

    setPhone(user.phone ?? "");
    setEditing(false);
  };

  const handleSave = async () => {
    if (!user) return;

    const cleanPhone = phone.trim();

    if (cleanPhone.length < 7) {
      Alert.alert("Invalid phone number", "Please enter a valid phone number.");
      return;
    }

    try {
      await updateProfile({
        phone: cleanPhone,
      });

      setEditing(false);
      Alert.alert("Profile updated", "Your account information has been updated.");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to update your profile.";

      Alert.alert("Update failed", message);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await signOut();
            router.replace("/(auth)/welcome");
          },
        },
      ],
    );
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.title}>Account</Text>

        {!editing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={handleEdit}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {fullName.charAt(0).toUpperCase() || "C"}
            </Text>
          </View>

          {!editing ? (
            <>
              <Text style={styles.name}>{fullName}</Text>

              {user.email ? (
                <Text style={styles.secondary}>{user.email}</Text>
              ) : null}

              {user.phone ? (
                <Text style={styles.secondary}>{user.phone}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.editHint}>
              Update your personal account information
            </Text>
          )}
        </View>

        {editing ? (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Verified identity</Text>

            <Text style={styles.inputLabel}>First name</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{user.firstName}</Text>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>

            <Text style={styles.inputLabel}>Last name</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{user.lastName}</Text>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>

            <Text style={styles.identityProtectionText}>
              Your legal name is linked to the identity information provided
              during registration and cannot be changed from your account.
            </Text>

            <Text style={[styles.sectionTitle, styles.contactSectionTitle]}>
              Contact information
            </Text>

            <Text style={styles.inputLabel}>Phone number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor="#98A2B3"
              keyboardType="phone-pad"
              style={styles.input}
              editable={!loading}
            />

            <View style={styles.actionRow}>
              <Pressable
                disabled={loading}
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={loading}
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.pressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save changes</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.infoCard}>
              <View style={styles.row}>
                <Text style={styles.label}>Account type</Text>
                <Text style={styles.value}>{user.role}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.label}>Account status</Text>
                <Text style={styles.value}>{user.status ?? "ACTIVE"}</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              disabled={loading}
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && styles.pressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.signOutText}>Sign out</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E7EC",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 34,
    lineHeight: 38,
    color: "#111827",
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
  },
  editButton: {
    minWidth: 44,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B63CE",
  },
  headerSpacer: {
    width: 44,
  },
  container: {
    padding: 20,
    gap: 16,
  },
  profileCard: {
    alignItems: "center",
    padding: 24,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F1FF",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0B63CE",
  },
  name: {
    marginTop: 14,
    fontSize: 21,
    fontWeight: "800",
    color: "#111827",
  },
  secondary: {
    marginTop: 5,
    fontSize: 14,
    color: "#667085",
  },
  editHint: {
    marginTop: 14,
    fontSize: 14,
    color: "#667085",
    textAlign: "center",
  },
  formCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  sectionTitle: {
    marginBottom: 18,
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  inputLabel: {
    marginBottom: 7,
    fontSize: 13,
    fontWeight: "700",
    color: "#344054",
  },
  input: {
    minHeight: 50,
    marginBottom: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    color: "#111827",
  },
  readOnlyField: {
    minHeight: 50,
    marginBottom: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#F8F9FB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 15,
    color: "#344054",
    fontWeight: "600",
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#027A48",
  },
  identityProtectionText: {
    marginTop: -4,
    marginBottom: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
  },
  contactSectionTitle: {
    marginTop: 18,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#344054",
  },
  saveButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B63CE",
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  infoCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  label: {
    fontSize: 14,
    color: "#667085",
  },
  value: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  divider: {
    height: 1,
    backgroundColor: "#E4E7EC",
    marginVertical: 16,
  },
  signOutButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#B42318",
  },
  signOutText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.75,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
