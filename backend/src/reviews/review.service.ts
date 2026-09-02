import { prisma } from "../config/prisma.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";
import type { CreateReviewInput } from "./review.validators.js";

export async function createReview(
  reviewerId: string,
  input: CreateReviewInput,
) {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        status: true,
        customerId: true,
        transporterId: true,
      },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status !== "COMPLETED") {
      throw new Error("Reviews can only be submitted for completed bookings");
    }

    if (!booking.transporterId) {
      throw new Error("Booking has no assigned transporter");
    }

    const isCustomer = booking.customerId === reviewerId;
    const isTransporter = booking.transporterId === reviewerId;

    if (!isCustomer && !isTransporter) {
      throw new Error("You are not authorized to review this booking");
    }

    const revieweeId = isCustomer
      ? booking.transporterId
      : booking.customerId;

    const existingReview = await tx.review.findUnique({
      where: {
        bookingId_reviewerId: {
          bookingId: booking.id,
          reviewerId,
        },
      },
    });

    if (existingReview) {
      throw new Error("You have already reviewed this booking");
    }

    const review = await tx.review.create({
      data: {
        bookingId: booking.id,
        reviewerId,
        revieweeId,
        rating: input.rating,
        comment: input.comment || null,
      },
    });

    const receivedReviews = await tx.review.findMany({
      where: { revieweeId },
      select: { rating: true },
    });

    const rating =
      receivedReviews.length > 0
        ? receivedReviews.reduce((sum, item) => sum + item.rating, 0) /
          receivedReviews.length
        : 0;

    if (revieweeId === booking.transporterId) {
      await tx.transporterProfile.update({
        where: { userId: revieweeId },
        data: { rating },
      });
    } else {
      await tx.customerProfile.update({
        where: { userId: revieweeId },
        data: { rating },
      });
    }

    return review;
  });

  await publishAdminEvent({
    eventType: "REVIEW_CREATED",
    module: "ACTIVITY_TIMELINE",
    actorId: reviewerId,
    entityType: "REVIEW",
    entityId: result.id,
    data: {
      id: result.id,
      bookingId: result.bookingId,
      reviewerId: result.reviewerId,
      revieweeId: result.revieweeId,
      rating: result.rating,
      comment: result.comment,
      createdAt: result.createdAt,
    },
  });

  return result;
}

export async function getBookingReviews(
  bookingId: string,
  requesterId: string,
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      customerId: true,
      transporterId: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (
    booking.customerId !== requesterId &&
    booking.transporterId !== requesterId
  ) {
    throw new Error("You are not authorized to view these reviews");
  }

  return prisma.review.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
  });
}
