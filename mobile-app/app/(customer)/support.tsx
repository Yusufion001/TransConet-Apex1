import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSupportTicket,
  getCustomerSupportTickets,
  type SupportPriority,
  type SupportStatus,
} from "../../src/api/support";
import { getCustomerBookings, type Booking } from "../../src/api/bookings";
import { useAuthStore } from "../../src/auth/auth.store";

const CATEGORIES = [
  "Booking",
  "Payment",
  "Transporter",
  "Trip",
  "Account",
  "Technical",
  "Other",
];

const PRIORITIES: SupportPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

function statusLabel(status: SupportStatus) {
  return status.replace("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function CustomerSupport() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [category, setCategory] = useState("Booking");
  const [priority, setPriority] = useState<SupportPriority>("MEDIUM");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [bookingId, setBookingId] = useState("");

  const bookingsQuery = useQuery({
    queryKey: ["customer-bookings", user?.id],
    queryFn: () => getCustomerBookings(user!.id),
    enabled: Boolean(user?.id),
  });

  const ticketsQuery = useQuery({
    queryKey: ["customer-support-tickets", user?.id],
    queryFn: () => getCustomerSupportTickets(user!.id),
    enabled: Boolean(user?.id),
  });

  const createMutation = useMutation({
    mutationFn: createSupportTicket,
    onSuccess: async () => {
      setSubject("");
      setDescription("");
      setBookingId("");
      setPriority("MEDIUM");
      setCategory("Booking");

      await queryClient.invalidateQueries({
        queryKey: ["customer-support-tickets", user?.id],
      });

      Alert.alert(
        "Support ticket created",
        "Your support request has been submitted successfully.",
      );
    },
    onError: (error: any) => {
      Alert.alert(
        "Unable to create ticket",
        error?.response?.data?.error ?? "Please try again.",
      );
    },
  });

  const tickets = ticketsQuery.data ?? [];

  const activeCount = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          ticket.status === "OPEN" || ticket.status === "IN_PROGRESS",
      ).length,
    [tickets],
  );

  function submitTicket() {
    const trimmedSubject = subject.trim();
    const trimmedDescription = description.trim();
    const trimmedBookingId = bookingId.trim();

    if (trimmedSubject.length < 3) {
      Alert.alert("Subject required", "Enter at least 3 characters.");
      return;
    }

    if (trimmedDescription.length < 5) {
      Alert.alert(
        "Description required",
        "Please describe the issue in more detail.",
      );
      return;
    }

    createMutation.mutate({
      category,
      priority,
      subject: trimmedSubject,
      description: trimmedDescription,
      ...(trimmedBookingId ? { bookingId: trimmedBookingId } : {}),
    });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.eyebrow}>CUSTOMER CARE</Text>
          <Text style={styles.title}>Support</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroText}>
            Create a support ticket and track the progress of your request.
          </Text>
          <Text style={styles.activeText}>
            {activeCount} active {activeCount === 1 ? "ticket" : "tickets"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>CREATE SUPPORT TICKET</Text>

          <Text style={styles.label}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {CATEGORIES.map((item) => (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[
                  styles.chip,
                  category === item && styles.selectedChip,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    category === item && styles.selectedChipText,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((item) => (
              <Pressable
                key={item}
                onPress={() => setPriority(item)}
                style={[
                  styles.priorityButton,
                  priority === item && styles.selectedPriority,
                ]}
              >
                <Text
                  style={[
                    styles.priorityText,
                    priority === item && styles.selectedPriorityText,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Related Shipment (optional)</Text>

          <Pressable
            onPress={() => setBookingId("")}
            style={[
              styles.bookingOption,
              !bookingId && styles.selectedBookingOption,
            ]}
          >
            <View style={styles.bookingOptionContent}>
              <Text style={styles.bookingOptionTitle}>
                No specific shipment
              </Text>
              <Text style={styles.bookingOptionText}>
                This issue is not related to a particular shipment.
              </Text>
            </View>
            {!bookingId ? <Text style={styles.checkmark}>✓</Text> : null}
          </Pressable>

          {bookingsQuery.isLoading ? (
            <View style={styles.bookingLoading}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading your shipments...</Text>
            </View>
          ) : bookingsQuery.isError ? (
            <Text style={styles.bookingError}>
              Unable to load your shipments. You can still submit a general support request.
            </Text>
          ) : bookingsQuery.data?.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bookingRow}
            >
              {bookingsQuery.data.map((booking: Booking) => (
                <Pressable
                  key={booking.id}
                  onPress={() => setBookingId(booking.id)}
                  style={[
                    styles.bookingCard,
                    bookingId === booking.id && styles.selectedBookingCard,
                  ]}
                >
                  <Text
                    style={[
                      styles.bookingStatus,
                      bookingId === booking.id && styles.selectedBookingText,
                    ]}
                  >
                    {booking.status.replace("_", " ")}
                  </Text>
                  <Text
                    style={[
                      styles.bookingRoute,
                      bookingId === booking.id && styles.selectedBookingText,
                    ]}
                    numberOfLines={2}
                  >
                    {booking.pickupLocation} → {booking.destination}
                  </Text>
                  <Text
                    style={[
                      styles.bookingCategory,
                      bookingId === booking.id && styles.selectedBookingText,
                    ]}
                  >
                    {booking.truckCategory.replace("_", " ")}
                  </Text>
                  {bookingId === booking.id ? (
                    <Text style={styles.checkmark}>✓ Selected</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.bookingEmpty}>
              You have no shipments to attach to this ticket.
            </Text>
          )}

          <Text style={styles.label}>Subject</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="What do you need help with?"
            placeholderTextColor="#98A2B3"
            style={styles.input}
            maxLength={200}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue..."
            placeholderTextColor="#98A2B3"
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.descriptionInput]}
            maxLength={5000}
          />

          <Pressable
            disabled={createMutation.isPending}
            onPress={submitTicket}
            style={[
              styles.submitButton,
              createMutation.isPending && styles.disabledButton,
            ]}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Submit Ticket</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>MY SUPPORT TICKETS</Text>

          {ticketsQuery.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading tickets...</Text>
            </View>
          ) : ticketsQuery.isError ? (
            <View>
              <Text style={styles.errorText}>
                Unable to load your support tickets.
              </Text>
              <Pressable
                onPress={() => ticketsQuery.refetch()}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : tickets.length === 0 ? (
            <Text style={styles.emptyText}>
              You have not created any support tickets yet.
            </Text>
          ) : (
            tickets.map((ticket) => (
              <View key={ticket.id} style={styles.ticket}>
                <View style={styles.ticketTop}>
                  <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                  <Text style={styles.status}>{statusLabel(ticket.status)}</Text>
                </View>

                <Text style={styles.ticketCategory}>
                  {ticket.category} • {ticket.priority}
                </Text>

                <Text style={styles.ticketDescription} numberOfLines={3}>
                  {ticket.description}
                </Text>

                {ticket.bookingId ? (
                  <Text style={styles.bookingText}>
                    Booking: {ticket.bookingId}
                  </Text>
                ) : null}

                <Text style={styles.date}>
                  {formatDate(ticket.createdAt)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7FF" },
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
  headerSpacer: { width: 44 },
  content: { padding: 20, paddingBottom: 36, gap: 16 },
  hero: {
    padding: 22,
    borderRadius: 22,
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 4,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  heroText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#EAF2FF",
  },
  activeText: {
    alignSelf: "flex-start",
    marginTop: 15,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    color: "#4169E1",
  },
  card: {
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
  bookingOption: {
    minHeight: 70,
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#DCE5F5",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedBookingOption: {
    borderColor: "#4169E1",
    backgroundColor: "#EEF4FF",
  },
  bookingOptionContent: {
    flex: 1,
  },
  bookingOptionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  bookingOptionText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: "#667085",
  },
  checkmark: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "900",
    color: "#4169E1",
  },
  bookingLoading: {
    minHeight: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  bookingError: {
    fontSize: 12,
    lineHeight: 18,
    color: "#B42318",
  },
  bookingRow: {
    gap: 10,
    paddingVertical: 2,
  },
  bookingCard: {
    width: 238,
    minHeight: 124,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCE5F5",
    backgroundColor: "#FFFFFF",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 1,
  },
  selectedBookingCard: {
    borderColor: "#4169E1",
    backgroundColor: "#4169E1",
  },
  bookingStatus: {
    fontSize: 11,
    fontWeight: "800",
    color: "#667085",
  },
  bookingRoute: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#111827",
  },
  bookingCategory: {
    marginTop: 8,
    fontSize: 11,
    color: "#667085",
  },
  selectedBookingText: {
    color: "#FFFFFF",
  },
  bookingEmpty: {
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#4169E1",
    marginBottom: 15,
  },
  label: {
    marginTop: 13,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    color: "#344054",
  },
  chipRow: { gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#CBD7EA",
    backgroundColor: "#FFFFFF",
  },
  selectedChip: {
    backgroundColor: "#EEF4FF",
    borderColor: "#4169E1",
  },
  chipText: { fontSize: 13, color: "#475467", fontWeight: "800" },
  selectedChipText: { color: "#4169E1" },
  priorityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  priorityButton: {
    minHeight: 40,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#CBD7EA",
    backgroundColor: "#FFFFFF",
  },
  selectedPriority: {
    backgroundColor: "#EEF4FF",
    borderColor: "#4169E1",
  },
  priorityText: { fontSize: 11, fontWeight: "900", color: "#475467" },
  selectedPriorityText: { color: "#4169E1" },
  input: {
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#CBD7EA",
    borderRadius: 14,
    color: "#101B3A",
    backgroundColor: "#FFFFFF",
    fontSize: 15,
  },
  descriptionInput: { minHeight: 135 },
  submitButton: {
    marginTop: 19,
    minHeight: 54,
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
  disabledButton: { opacity: 0.65 },
  submitText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  loading: { alignItems: "center", paddingVertical: 16 },
  loadingText: { marginTop: 8, color: "#667085" },
  errorText: { color: "#B42318", lineHeight: 20 },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 13,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
  },
  retryText: { color: "#FFFFFF", fontWeight: "800" },
  emptyText: { color: "#667085", lineHeight: 20 },
  ticket: {
    marginTop: 2,
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E1E7F0",
    backgroundColor: "#F9FBFF",
  },
  ticketTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  ticketSubject: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#101B3A",
  },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#EEF4FF",
    fontSize: 10,
    fontWeight: "900",
    color: "#4169E1",
  },
  ticketCategory: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: "700",
    color: "#667085",
  },
  ticketDescription: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: "#475467",
  },
  bookingText: {
    marginTop: 7,
    fontSize: 12,
    color: "#667085",
  },
  date: {
    marginTop: 8,
    fontSize: 11,
    color: "#98A2B3",
  },
});
