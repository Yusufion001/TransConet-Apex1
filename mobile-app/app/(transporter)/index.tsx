import { Link } from "expo-router";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useAuthStore } from "../../src/auth/auth.store";

export default function TransporterHome() {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.firstName?.trim() || "Transporter";

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>TRANSCONET</Text>
          <Text style={styles.greeting}>Good morning, {firstName}</Text>
          <Text style={styles.tagline}>
            Your transport network, intelligently connected.
          </Text>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusTitle}>NETWORK READY</Text>
        </View>

        <Text style={styles.statusText}>
          Your transporter operations center is ready for the next movement.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.eyebrow}>OPERATIONS</Text>
        <Text style={styles.sectionTitle}>Transport network</Text>
      </View>

      <Link href="/(transporter)/marketplace" asChild>
        <Pressable style={styles.primaryCard}>
          <Text style={styles.cardIndex}>01</Text>
          <Text style={styles.cardTitle}>Capacity Exchange</Text>
          <Text style={styles.cardText}>
            Discover transport opportunities matched to your operational
            capacity and submit competitive bids.
          </Text>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
      </Link>

      <Link href="/(transporter)/bookings" asChild>
        <Pressable style={styles.card}>
          <Text style={styles.cardIndex}>02</Text>
          <Text style={styles.cardTitle}>Assignments</Text>
          <Text style={styles.cardText}>
            Monitor your active and upcoming shipment assignments.
          </Text>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
      </Link>

      <Link href="/(transporter)/vehicles" asChild>
        <Pressable style={styles.card}>
          <Text style={styles.cardIndex}>03</Text>
          <Text style={styles.cardTitle}>Fleet</Text>
          <Text style={styles.cardText}>
            Manage your vehicles, availability and operational readiness.
          </Text>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
      </Link>

      <View style={styles.footer}>
        <Text style={styles.footerBrand}>TRANSCONET</Text>
        <Text style={styles.footerText}>
          Connected logistics. Built for movement.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 40,
    backgroundColor: "#F5F7FA",
  },
  header: {
    marginBottom: 24,
  },
  brand: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2.2,
    color: "#0B63CE",
    marginBottom: 10,
  },
  greeting: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#101828",
  },
  tagline: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: "#667085",
  },
  statusCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#101828",
    marginBottom: 30,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#12B76A",
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#FFFFFF",
  },
  statusText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#D0D5DD",
  },
  sectionHeader: {
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#0B63CE",
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 23,
    fontWeight: "800",
    color: "#101828",
  },
  primaryCard: {
    position: "relative",
    padding: 22,
    borderRadius: 18,
    backgroundColor: "#0B63CE",
    marginBottom: 14,
  },
  card: {
    position: "relative",
    padding: 22,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  cardIndex: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#98A2B3",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#101828",
  },
  primaryCardTitle: {
    color: "#FFFFFF",
  },
  cardText: {
    marginTop: 8,
    paddingRight: 28,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  arrow: {
    position: "absolute",
    right: 20,
    bottom: 20,
    fontSize: 25,
    color: "#0B63CE",
  },
  footer: {
    alignItems: "center",
    marginTop: 24,
  },
  footerBrand: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#98A2B3",
  },
  footerText: {
    marginTop: 5,
    fontSize: 12,
    color: "#98A2B3",
  },
});
