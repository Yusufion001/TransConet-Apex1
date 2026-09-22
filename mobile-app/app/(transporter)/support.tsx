import { useState } from "react";
import { Pressable as TabPressable, StyleSheet as TabStyleSheet, Text as TabText, View as TabView } from "react-native";
import TransporterDisputes from "./disputes";
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

function TransporterSupport() {
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 44,
    backgroundColor: "#F4F7FF",
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#4169E1",
  },

  title: {
    marginTop: 5,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    color: "#101B3A",
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },

  card: {
    padding: 19,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#101B3A",
  },

  label: {
    marginTop: 17,
    marginBottom: 7,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#667085",
  },

  input: {
    minHeight: 51,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D9E0EF",
    borderRadius: 13,
    backgroundColor: "#FBFCFF",
    fontSize: 14,
    color: "#101B3A",
  },

  textArea: {
    minHeight: 125,
    paddingTop: 13,
    paddingBottom: 13,
  },

  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  priorityButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9E0EF",
    backgroundColor: "#FFFFFF",
  },

  priorityButtonActive: {
    borderColor: "#4169E1",
    backgroundColor: "#EEF3FF",
  },

  priorityText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.15,
    color: "#475467",
  },

  priorityTextActive: {
    color: "#4169E1",
  },

  submitButton: {
    minHeight: 52,
    marginTop: 21,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },

  submitText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.15,
    color: "#FFFFFF",
  },

  disabled: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },

  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 29,
    marginBottom: 13,
  },

  count: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    textAlign: "center",
    overflow: "hidden",
    backgroundColor: "#EEF3FF",
    color: "#4169E1",
    fontSize: 12,
    fontWeight: "900",
  },

  ticketCard: {
    marginBottom: 13,
    padding: 17,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 11,
    elevation: 2,
  },

  ticketHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
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
    overflow: "hidden",
    backgroundColor: "#EEF3FF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: "#4169E1",
  },

  ticketCategory: {
    marginTop: 7,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "800",
    color: "#667085",
  },

  ticketDescription: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: "#475467",
  },

  date: {
    marginTop: 11,
    fontSize: 11,
    color: "#98A2B3",
  },

  emptyCard: {
    paddingHorizontal: 22,
    paddingVertical: 27,
    alignItems: "center",
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#101B3A",
  },

  emptyText: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    color: "#667085",
  },
});

function TransporterSupportDisputes() {
  const [activeTab, setActiveTab] = useState<"support" | "disputes">("support");

  return (
    <TabView style={combinedStyles.screen}>
      <TabView style={combinedStyles.header}>
        <TabText style={combinedStyles.eyebrow}>TRANSPORTER SERVICES</TabText>
        <TabText style={combinedStyles.title}>Support & Disputes</TabText>
        <TabText style={combinedStyles.subtitle}>
          Get help or manage assignment disputes from one place.
        </TabText>
      </TabView>

      <TabView style={combinedStyles.tabs}>
        <TabPressable
          style={[
            combinedStyles.tab,
            activeTab === "support" && combinedStyles.activeTab,
          ]}
          onPress={() => setActiveTab("support")}
        >
          <TabText
            style={[
              combinedStyles.tabText,
              activeTab === "support" && combinedStyles.activeTabText,
            ]}
          >
            Support
          </TabText>
        </TabPressable>

        <TabPressable
          style={[
            combinedStyles.tab,
            activeTab === "disputes" && combinedStyles.activeTab,
          ]}
          onPress={() => setActiveTab("disputes")}
        >
          <TabText
            style={[
              combinedStyles.tabText,
              activeTab === "disputes" && combinedStyles.activeTabText,
            ]}
          >
            Disputes
          </TabText>
        </TabPressable>
      </TabView>

      <TabView style={combinedStyles.content}>
        {activeTab === "support" ? (
          <TransporterSupport />
        ) : (
          <TransporterDisputes />
        )}
      </TabView>
    </TabView>
  );
}

const combinedStyles = TabStyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F7FF",
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 15,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8ECF5",
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#4169E1",
  },

  title: {
    marginTop: 5,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: "#101B3A",
  },

  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
  },

  tabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 5,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "#E8ECF5",
    borderWidth: 1,
    borderColor: "#DDE4F2",
  },

  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },

  activeTab: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 1,
  },

  tabText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#667085",
  },

  activeTabText: {
    color: "#4169E1",
    fontWeight: "900",
  },

  content: {
    flex: 1,
  },
});

export default TransporterSupportDisputes;
