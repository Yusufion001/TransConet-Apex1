import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createReview, getBookingReviews } from "../api/reviews";
import { useAuthStore } from "../auth/auth.store";

type BookingReviewFormProps = {
  bookingId: string;
  title: string;
  revieweeLabel: string;
};

export default function BookingReviewForm({
  bookingId,
  title,
  revieweeLabel,
}: BookingReviewFormProps) {
  const user = useAuthStore((state) => state.user);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const reviewsQuery = useQuery({
    queryKey: ["booking-reviews", bookingId],
    queryFn: () => getBookingReviews(bookingId),
    enabled: Boolean(bookingId && user?.id),
  });

  const myReview = (reviewsQuery.data ?? []).find(
    (review) => review.reviewerId === user?.id,
  );

  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setComment(myReview.comment ?? "");
    }
  }, [myReview]);

  const reviewMutation = useMutation({
    mutationFn: () =>
      createReview({
        bookingId,
        rating,
        comment: comment.trim() || undefined,
      }),
    onSuccess: async () => {
      await reviewsQuery.refetch();
      Alert.alert("Review submitted", "Thank you for your feedback.");
    },
    onError: (error: unknown) => {
      Alert.alert(
        "Review failed",
        error instanceof Error ? error.message : "Unable to submit review.",
      );
    },
  });

  if (reviewsQuery.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{title}</Text>
        <ActivityIndicator />
      </View>
    );
  }

  if (reviewsQuery.isError) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{title}</Text>
        <Text style={styles.muted}>Unable to load review information.</Text>
        <Pressable
          onPress={() => reviewsQuery.refetch()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (myReview) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{title}</Text>
        <Text style={styles.reviewed}>
          You rated this {revieweeLabel.toLowerCase()} {myReview.rating}/5
        </Text>

        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Text key={star} style={styles.starFilled}>
              ★
            </Text>
          ))}
        </View>

        {myReview.comment ? (
          <Text style={styles.comment}>“{myReview.comment}”</Text>
        ) : (
          <Text style={styles.muted}>No comment provided.</Text>
        )}
      </View>
    );
  }

  const submit = () => {
    if (rating < 1) {
      Alert.alert("Rating required", "Please select a rating from 1 to 5 stars.");
      return;
    }

    reviewMutation.mutate();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <Text style={styles.prompt}>Rate your {revieweeLabel.toLowerCase()}</Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => setRating(star)}
            accessibilityRole="button"
            accessibilityLabel={`${star} star${star === 1 ? "" : "s"}`}
          >
            <Text
              style={star <= rating ? styles.starFilled : styles.starEmpty}
            >
              ★
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Add an optional comment..."
        placeholderTextColor="#98A2B3"
        multiline
        maxLength={1000}
        style={styles.input}
      />

      <Pressable
        disabled={reviewMutation.isPending}
        onPress={submit}
        style={[
          styles.primaryButton,
          reviewMutation.isPending && styles.disabled,
        ]}
      >
        {reviewMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Submit Review</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  sectionLabel: {
    color: "#667085",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 10,
  },
  prompt: {
    color: "#1D2939",
    fontSize: 16,
    fontWeight: "700",
  },
  reviewed: {
    color: "#344054",
    fontSize: 15,
    fontWeight: "600",
  },
  stars: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 14,
  },
  starFilled: {
    color: "#F79009",
    fontSize: 32,
  },
  starEmpty: {
    color: "#D0D5DD",
    fontSize: 32,
  },
  comment: {
    color: "#475467",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  muted: {
    color: "#667085",
    fontSize: 14,
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    padding: 12,
    color: "#1D2939",
    textAlignVertical: "top",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  secondaryButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#344054",
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.6,
  },
});
