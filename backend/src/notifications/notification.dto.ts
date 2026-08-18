function date(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toNotificationDto(notification: any) {
  return {
    id: notification.id,
    recipientId: notification.recipientId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read: notification.read,
    relatedType: notification.relatedType,
    relatedId: notification.relatedId,
    createdAt: date(notification.createdAt),
  };
}
