import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createSupportTicket,
  getTransporterSupportTickets,
  type SupportTicket,
} from "../../src/api/transporter";
import { useAuthStore } from "../../src/auth/auth.store";

const priorities: SupportTicket["priority"][] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function TransporterSupport() {
  const user = useAuthStore((state) => state.user);

  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<SupportTicket["priority"]>("MEDIUM");

  const ticketsQuery = useQuery({
    queryKey: ["transporter-support-tickets", user?.id],
    queryFn: () => getTransporterSupportTickets(user!.id),
    enabled: Boolean(user?.id),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createSupportTicket({
        category: category.trim(),
        subject: subject.trim(),
        description: description.trim(),
        priority,
      }),
    onSuccess: async () => {
      setCategory("");
      setSubject("");
      setDescription("");
      setPriority("MEDIUM");
      await ticketsQuery.refetch();

      Alert.alert(
        "Support request submitted",
        "Your support ticket has been sent to the TransConet support team.",
      );
    },
    onError: (error: unknown) => {
      Alert.alert(
        "Unable to submit",
        error instanceof Error
          ? error.message
          : "Unable to create the support ticket.",
      );
    },
  });

  const submit = () => {
    if (!user?.id) {
      Alert.alert("Session unavailable", "Please sign in again.");
      return;
    }

    if (category.trim().length < 2) {
      Alert.alert("Category required", "Enter a support category.");
      return;
    }

    if (subject.trim().length < 3) {
      Alert.alert("Subject required", "Enter a clear support subject.");
      return;
    }

    if (description.trim().length < 5) {
      Alert.alert(
        "Description required",
        "Please describe the problem or request.",
      );
      return;
    }

    createMutation.mutate();
  };

  const tickets = ticketsQuery.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={ticketsQuery.isFetching}
          onRefresh={() => void ticketsQuery.refetch()}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>HELP & SUPPORT</Text>
      <Text style={styles.title}>Support Centre</Text>
      <Text style={styles.subtitle}>
        Contact TransConet support about your account, assignments, fleet,
        payments, or other platform issues.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>New Support Request</Text>

        <Text style={styles.label}>CATEGORY</Text>
        <TextInput
          value={category}
          onChangeText={setCategory}
          placeholder="e.g. Assignment, Fleet, Payment"
          style={styles.input}
          autoCapitalize="sentences"
        />

        <Text style={styles.label}>SUBJECT</Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder="Briefly describe the issue"
          style={styles.input}
          autoCapitalize="sentences"
        />

        <Text style={styles.label}>DESCRIPTION</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Explain what happened and what assistance you need"
          style={[styles.input, styles.textArea]}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>PRIORITY</Text>
        <View style={styles.priorityRow}>
          {priorities.map((item) => (
            <Pressable
              key={item}
              onPress={() => setPriority(item)}
              style={[
                styles.priorityButton,
                priority === item && styles.priorityButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.priorityText,
                  priority === item && styles.priorityTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={submit}
          disabled={createMutation.isPending}
          style={[
            styles.submitButton,
            createMutation.isPending && styles.disabled,
          ]}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Submit Support Request</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>My Support Requests</Text>
        <Text style={styles.count}>{tickets.length}</Text>
      </View>

      {ticketsQuery.isLoading ? (
        <ActivityIndicator size="small" />
      ) : tickets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No support requests</Text>
          <Text style={styles.emptyText}>
            Your submitted support requests will appear here.
          </Text>
        </View>
      ) : (
        tickets.map((ticket) => (
          <View key={ticket.id} style={styles.ticketCard}>
            <View style={styles.ticketHeader}>
              <Text style={styles.ticketSubject}>{ticket.subject}</Text>
              <Text style={styles.status}>
                {formatStatus(ticket.status)}
              </Text>
            </View>

            <Text style={styles.ticketCategory}>
              {ticket.category} · {ticket.priority}
            </Text>

            <Text style={styles.ticketDescription}>
              {ticket.description}
            </Text>

            {ticket.createdAt && (
              <Text style={styles.date}>
                Submitted {formatDate(ticket.createdAt)}
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#F8FAFC",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#0B63CE",
  },
  title: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "900",
    color: "#101828",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#101828",
  },
  label: {
    marginTop: 16,
    marginBottom: 7,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#667085",
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    fontSize: 14,
    color: "#101828",
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  priorityButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
  },
  priorityButtonActive: {
    borderColor: "#0B63CE",
    backgroundColor: "#EAF2FF",
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475467",
  },
  priorityTextActive: {
    color: "#0B63CE",
  },
  submitButton: {
    minHeight: 50,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#0B63CE",
  },
  submitText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  disabled: {
    opacity: 0.6,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 28,
    marginBottom: 12,
  },
  count: {
    minWidth: 26,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    textAlign: "center",
    overflow: "hidden",
    backgroundColor: "#EAF2FF",
    color: "#0B63CE",
    fontSize: 12,
    fontWeight: "800",
  },
  ticketCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  ticketHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  ticketSubject: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#101828",
  },
  status: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0B63CE",
  },
  ticketCategory: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: "#667085",
  },
  ticketDescription: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "#475467",
  },
  date: {
    marginTop: 10,
    fontSize: 11,
    color: "#98A2B3",
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#101828",
  },
  emptyText: {
    marginTop: 5,
    textAlign: "center",
    fontSize: 13,
    color: "#667085",
  },
});
