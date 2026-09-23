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

        <View style={styles.headerTitleWrap}>
          <Text style={styles.eyebrow}>PROFILE</Text>
          <Text style={styles.title}>Account</Text>
        </View>

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


          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F7FF",
  },
  header: {
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E7F0",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4FF",
  },
  backText: {
    fontSize: 32,
    lineHeight: 36,
    color: "#4169E1",
    marginTop: -2,
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 10,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#4169E1",
    marginBottom: 3,
  },
  title: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
    color: "#101B3A",
  },
  editButton: {
    minWidth: 64,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4FF",
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#4169E1",
  },
  headerSpacer: {
    width: 44,
  },
  container: {
    padding: 20,
    paddingBottom: 36,
    gap: 16,
  },
  profileCard: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 26,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 2,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    borderWidth: 5,
    borderColor: "#EEF4FF",
  },
  avatarText: {
    fontSize: 29,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  name: {
    marginTop: 15,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
    color: "#101B3A",
  },
  secondary: {
    marginTop: 5,
    fontSize: 13,
    color: "#667085",
  },
  editHint: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
    textAlign: "center",
  },
  formCard: {
    padding: 19,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 18,
    fontSize: 16,
    fontWeight: "900",
    color: "#101B3A",
  },
  inputLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
    color: "#344054",
  },
  input: {
    minHeight: 52,
    marginBottom: 17,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD7EA",
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    color: "#101B3A",
  },
  readOnlyField: {
    minHeight: 52,
    marginBottom: 17,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE5F5",
    backgroundColor: "#F4F7FF",
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
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#E9F8F0",
    fontSize: 11,
    fontWeight: "900",
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
    marginTop: 5,
  },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD7EA",
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
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  infoCard: {
    padding: 19,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
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
    maxWidth: "58%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "#EEF4FF",
    fontSize: 12,
    fontWeight: "900",
    color: "#4169E1",
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: "#E6EBF3",
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
