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
        <Text style={styles.title}>Support</Text>
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
  screen: { flex: 1, backgroundColor: "#F7F9FC" },
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
  backText: { fontSize: 34, lineHeight: 38, color: "#111827" },
  title: { fontSize: 19, fontWeight: "800", color: "#111827" },
  headerSpacer: { width: 44 },
  content: { padding: 16, gap: 16 },
  hero: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#0B63CE",
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  heroText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#EAF2FF",
  },
  activeText: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  bookingOption: {
    minHeight: 68,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedBookingOption: {
    borderColor: "#0B63CE",
    backgroundColor: "#F0F6FF",
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
    fontWeight: "800",
    color: "#0B63CE",
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
    width: 230,
    minHeight: 120,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    backgroundColor: "#FFFFFF",
  },
  selectedBookingCard: {
    borderColor: "#0B63CE",
    backgroundColor: "#0B63CE",
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
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
    color: "#667085",
    marginBottom: 14,
  },
  label: {
    marginTop: 12,
    marginBottom: 7,
    fontSize: 13,
    fontWeight: "800",
    color: "#344054",
  },
  chipRow: { gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
  },
  selectedChip: {
    backgroundColor: "#EAF2FF",
    borderColor: "#0B63CE",
  },
  chipText: { fontSize: 13, color: "#475467", fontWeight: "700" },
  selectedChipText: { color: "#0B63CE" },
  priorityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  priorityButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D0D5DD",
  },
  selectedPriority: {
    backgroundColor: "#EAF2FF",
    borderColor: "#0B63CE",
  },
  priorityText: { fontSize: 12, fontWeight: "800", color: "#475467" },
  selectedPriorityText: { color: "#0B63CE" },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  descriptionInput: { minHeight: 130 },
  submitButton: {
    marginTop: 18,
    minHeight: 50,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B63CE",
  },
  disabledButton: { opacity: 0.65 },
  submitText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  loading: { alignItems: "center", paddingVertical: 16 },
  loadingText: { marginTop: 8, color: "#667085" },
  errorText: { color: "#B42318", lineHeight: 20 },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#0B63CE",
  },
  retryText: { color: "#FFFFFF", fontWeight: "800" },
  emptyText: { color: "#667085", lineHeight: 20 },
  ticket: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
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
    fontWeight: "800",
    color: "#111827",
  },
  status: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0B63CE",
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
