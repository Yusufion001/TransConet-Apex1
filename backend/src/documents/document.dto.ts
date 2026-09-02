function date(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toDocumentDto(document: any) {
  return {
    id: document.id,
    userId: document.userId,
    type: document.type,
    fileUrl: document.fileUrl,
    storagePath: document.storagePath ?? null,
    status: document.status,
    rejectionReason: document.rejectionReason,
    adminApproved: document.adminApproved,
    adminApprovedAt: date(document.adminApprovedAt),
    verifiedAt: date(document.verifiedAt),
    createdAt: date(document.createdAt),
    updatedAt: date(document.updatedAt),
  };
}
