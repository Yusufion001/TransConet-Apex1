function date(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toMessageDto(message: any) {
  return {
    id: message.id,
    senderId: message.senderId,
    recipientId: message.recipientId,
    bookingId: message.bookingId,
    type: message.type,
    content: message.content,
    createdAt: date(message.createdAt),
    readAt: date(message.readAt),
  };
}
