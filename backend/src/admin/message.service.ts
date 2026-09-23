import { prisma } from "../config/prisma.js";
import {
  createMessage,
  getBookingMessages,
} from "../messages/message.service.js";
import {
  sendSms,
} from "../services/termii.service.js";
import {
  sendBusinessEmail,
} from "../services/email.service.js";

type AdminMessageType = "TEXT" | "SYSTEM" | "SUPPORT";
type ExternalChannel = "EMAIL" | "SMS";

async function getBookingContext(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customerId: true,
      transporterId: true,
      status: true,
      pickupLocation: true,
      destination: true,
      createdAt: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  return booking;
}

async function assertBookingRecipient(
  bookingId: string,
  recipientId: string,
) {
  const booking = await getBookingContext(bookingId);

  if (
    recipientId !== booking.customerId &&
    recipientId !== booking.transporterId
  ) {
    throw new Error("Recipient is not a participant in this shipment");
  }

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
    },
  });

  if (!recipient) {
    throw new Error("Recipient not found");
  }

  if (recipient.status !== "ACTIVE") {
    throw new Error("Recipient account is not active");
  }

  return { booking, recipient };
}

export async function getAdminMessageConversations(options: {
  search?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const search = options.search?.trim();

  const messages = await prisma.message.findMany({
    where: search
      ? {
          OR: [
            { content: { contains: search, mode: "insensitive" } },
            { bookingId: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      senderId: true,
      recipientId: true,
      bookingId: true,
      type: true,
      content: true,
      createdAt: true,
      readAt: true,
    },
  });

  const communicationLogs = await prisma.communicationLog.findMany({
    where: search
      ? {
          OR: [
            { content: { contains: search, mode: "insensitive" } },
            { subject: { contains: search, mode: "insensitive" } },
            { bookingId: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      bookingId: true,
      administratorId: true,
      recipientId: true,
      channel: true,
      status: true,
      subject: true,
      content: true,
      providerMessageId: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  const bookingIds = [
    ...new Set([
      ...messages
        .map((message) => message.bookingId)
        .filter((id): id is string => Boolean(id)),
      ...communicationLogs.map((entry) => entry.bookingId),
    ]),
  ];

  if (!bookingIds.length) return [];

  const userIds = [
    ...new Set([
      ...messages.flatMap((message) => [
        message.senderId,
        message.recipientId,
      ]),
      ...communicationLogs.flatMap((entry) => [
        entry.administratorId,
        entry.recipientId,
      ]),
    ]),
  ];

  const [users, bookings] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
      },
    }),
    prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      select: {
        id: true,
        customerId: true,
        transporterId: true,
        status: true,
        pickupLocation: true,
        destination: true,
        createdAt: true,
      },
    }),
  ]);

  const userMap = new Map(users.map((user) => [user.id, user]));
  const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));

  const conversations = new Map<
    string,
    {
      bookingId: string;
      latestMessage: (typeof messages)[number] | null;
      latestCommunication: (typeof communicationLogs)[number] | null;
      messageCount: number;
      communicationCount: number;
      participants: string[];
    }
  >();

  for (const message of messages) {
    if (!message.bookingId) continue;

    const existing = conversations.get(message.bookingId);

    if (existing) {
      existing.messageCount += 1;

      if (!existing.participants.includes(message.senderId)) {
        existing.participants.push(message.senderId);
      }

      if (!existing.participants.includes(message.recipientId)) {
        existing.participants.push(message.recipientId);
      }

      if (
        !existing.latestMessage ||
        message.createdAt > existing.latestMessage.createdAt
      ) {
        existing.latestMessage = message;
      }
    } else {
      conversations.set(message.bookingId, {
        bookingId: message.bookingId,
        latestMessage: message,
        latestCommunication: null,
        messageCount: 1,
        communicationCount: 0,
        participants: [message.senderId, message.recipientId],
      });
    }
  }

  for (const entry of communicationLogs) {
    const existing = conversations.get(entry.bookingId);

    if (existing) {
      existing.communicationCount += 1;

      if (!existing.participants.includes(entry.administratorId)) {
        existing.participants.push(entry.administratorId);
      }

      if (!existing.participants.includes(entry.recipientId)) {
        existing.participants.push(entry.recipientId);
      }

      if (
        !existing.latestCommunication ||
        entry.createdAt > existing.latestCommunication.createdAt
      ) {
        existing.latestCommunication = entry;
      }
    } else {
      conversations.set(entry.bookingId, {
        bookingId: entry.bookingId,
        latestMessage: null,
        latestCommunication: entry,
        messageCount: 0,
        communicationCount: 1,
        participants: [entry.administratorId, entry.recipientId],
      });
    }
  }

  return [...conversations.values()]
    .map((conversation) => {
      const booking = bookingMap.get(conversation.bookingId);

      const participants = conversation.participants
        .map((id) => userMap.get(id))
        .filter(Boolean);

      return {
        booking: booking
          ? {
              id: booking.id,
              status: booking.status,
              pickupLocation: booking.pickupLocation,
              destination: booking.destination,
              createdAt: booking.createdAt,
            }
          : null,
        customer: booking
          ? userMap.get(booking.customerId) ?? null
          : null,
        transporter: booking?.transporterId
          ? userMap.get(booking.transporterId) ?? null
          : null,
        participants,
        latestMessage: conversation.latestMessage,
        latestCommunication: conversation.latestCommunication,
        messageCount: conversation.messageCount,
        communicationCount: conversation.communicationCount,
        latestActivity:
          conversation.latestMessage &&
          conversation.latestCommunication
            ? conversation.latestMessage.createdAt >
              conversation.latestCommunication.createdAt
              ? conversation.latestMessage
              : conversation.latestCommunication
            : conversation.latestMessage ?? conversation.latestCommunication,
      };
    })
    .filter((conversation) => {
      if (!search) return true;

      const haystack = [
        conversation.booking?.id,
        conversation.customer?.firstName,
        conversation.customer?.lastName,
        conversation.customer?.email,
        conversation.transporter?.firstName,
        conversation.transporter?.lastName,
        conversation.transporter?.email,
        conversation.latestMessage?.content,
        conversation.latestCommunication?.subject,
        conversation.latestCommunication?.content,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const aDate = a.latestActivity?.createdAt?.getTime() ?? 0;
      const bDate = b.latestActivity?.createdAt?.getTime() ?? 0;
      return bDate - aDate;
    })
    .slice(0, limit);
}

export async function getAdminBookingMessages(bookingId: string) {
  const booking = await getBookingContext(bookingId);
  const [messages, communications] = await Promise.all([
    getBookingMessages(bookingId),
    prisma.communicationLog.findMany({
      where: { bookingId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        bookingId: true,
        administratorId: true,
        recipientId: true,
        channel: true,
        status: true,
        subject: true,
        content: true,
        providerMessageId: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
  ]);

  const userIds = [
    ...new Set([
      ...messages.flatMap((message) => [
        message.senderId,
        message.recipientId,
      ]),
      ...communications.flatMap((entry) => [
        entry.administratorId,
        entry.recipientId,
      ]),
      booking.customerId,
      ...(booking.transporterId ? [booking.transporterId] : []),
    ]),
  ];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
    },
  });

  const userMap = new Map(users.map((user) => [user.id, user]));

  return {
    booking,
    customer: userMap.get(booking.customerId) ?? null,
    transporter: booking.transporterId
      ? userMap.get(booking.transporterId) ?? null
      : null,
    messages: messages.map((message) => ({
      ...message,
      sender: userMap.get(message.senderId) ?? null,
      recipient: userMap.get(message.recipientId) ?? null,
    })),
    communications: communications.map((entry) => ({
      ...entry,
      administrator: userMap.get(entry.administratorId) ?? null,
      recipient: userMap.get(entry.recipientId) ?? null,
    })),
  };
}

export async function sendAdminMessage(data: {
  administratorId: string;
  bookingId: string;
  recipientId: string;
  content: string;
  type?: AdminMessageType;
}) {
  const content = data.content.trim();

  if (!content) {
    throw new Error("Message content is required");
  }

  if (content.length > 5000) {
    throw new Error("Message content is too long");
  }

  const { booking } = await assertBookingRecipient(
    data.bookingId,
    data.recipientId,
  );

  const message = await createMessage({
    senderId: data.administratorId,
    recipientId: data.recipientId,
    bookingId: booking.id,
    type: data.type ?? "TEXT",
    content,
  });

  await prisma.communicationLog.create({
    data: {
      bookingId: booking.id,
      administratorId: data.administratorId,
      recipientId: data.recipientId,
      channel: "IN_APP",
      status: "SENT",
      content,
    },
  });

  await prisma.auditLog.create({
    data: {
      administratorId: data.administratorId,
      affectedUserId: data.recipientId,
      affectedBookingId: booking.id,
      action: "SHIPMENT_MESSAGE_SENT",
      newValue: {
        channel: "IN_APP",
        messageId: message.id,
        type: message.type,
      },
    },
  });

  return message;
}

export async function sendAdminExternalCommunication(data: {
  administratorId: string;
  bookingId: string;
  recipientId: string;
  channel: ExternalChannel;
  content: string;
  subject?: string;
}) {
  const content = data.content.trim();

  if (!content) {
    throw new Error("Message content is required");
  }

  if (content.length > 5000) {
    throw new Error("Message content is too long");
  }

  if (data.channel === "EMAIL" && !data.subject?.trim()) {
    throw new Error("Email subject is required");
  }

  if (data.channel === "SMS" && content.length > 1600) {
    throw new Error("SMS message is too long");
  }

  const { booking, recipient } = await assertBookingRecipient(
    data.bookingId,
    data.recipientId,
  );

  if (data.channel === "EMAIL" && !recipient.email) {
    throw new Error("Recipient does not have an email address");
  }

  if (data.channel === "SMS" && !recipient.phone) {
    throw new Error("Recipient does not have a phone number");
  }

  let providerMessageId: string | undefined;
  let errorMessage: string | undefined;

  try {
    if (data.channel === "EMAIL") {
      const result = await sendBusinessEmail(
        recipient.email!,
        data.subject!.trim(),
        content,
      );
      providerMessageId =
        typeof result === "object" &&
        result !== null &&
        "id" in result &&
        typeof result.id === "string"
          ? result.id
          : undefined;
    } else {
      const result = await sendSms(recipient.phone!, content);
      providerMessageId =
        typeof result === "object" &&
        result !== null &&
        "messageId" in result &&
        typeof result.messageId === "string"
          ? result.messageId
          : undefined;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Communication delivery failed";

    await prisma.communicationLog.create({
      data: {
        bookingId: booking.id,
        administratorId: data.administratorId,
        recipientId: data.recipientId,
        channel: data.channel,
        status: "FAILED",
        subject: data.subject?.trim(),
        content,
        errorMessage,
      },
    });

    await prisma.auditLog.create({
      data: {
        administratorId: data.administratorId,
        affectedUserId: data.recipientId,
        affectedBookingId: booking.id,
        action: "SHIPMENT_COMMUNICATION_FAILED",
        newValue: {
          channel: data.channel,
          error: errorMessage,
        },
      },
    });

    throw new Error(errorMessage);
  }

  const communication = await prisma.communicationLog.create({
    data: {
      bookingId: booking.id,
      administratorId: data.administratorId,
      recipientId: data.recipientId,
      channel: data.channel,
      status: "SENT",
      subject: data.subject?.trim(),
      content,
      providerMessageId,
    },
  });

  await prisma.auditLog.create({
    data: {
      administratorId: data.administratorId,
      affectedUserId: data.recipientId,
      affectedBookingId: booking.id,
      action: "SHIPMENT_COMMUNICATION_SENT",
      newValue: {
        channel: data.channel,
        communicationId: communication.id,
        providerMessageId,
      },
    },
  });

  return communication;
}
