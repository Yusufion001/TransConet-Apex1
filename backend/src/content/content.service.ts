import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function createContent(data: {
  title: string;
  slug: string;
  type: any;
  summary?: string;
  body: string;
  imageUrl?: string;
  metadata?: any;
  createdBy: string;
}) {
  const content = await prisma.contentItem.create({
    data: {
      title: data.title,
      slug: data.slug,
      type: data.type,
      summary: data.summary,
      body: data.body,
      imageUrl: data.imageUrl,
      metadata: data.metadata,
      createdBy: data.createdBy,
    },
  });

  publishEvent("admin", {
    eventType: "CONTENT_CREATED",
    module: "CONTENT_MANAGEMENT",
    entityType: "CONTENT",
    entityId: content.id,
    actorId: data.createdBy,
    data: content,
  });

  return content;
}

export async function getContentById(id: string) {
  return prisma.contentItem.findUnique({
    where: { id },
  });
}

export async function getContentList(filters?: {
  type?: any;
  status?: any;
}) {
  return prisma.contentItem.findMany({
    where: {
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function updateContent(
  id: string,
  data: {
    title?: string;
    slug?: string;
    type?: any;
    summary?: string;
    body?: string;
    imageUrl?: string;
    metadata?: any;
    updatedBy: string;
  },
) {
  const content = await prisma.contentItem.update({
    where: { id },
    data,
  });

  publishEvent("admin", {
    eventType: "CONTENT_UPDATED",
    module: "CONTENT_MANAGEMENT",
    entityType: "CONTENT",
    entityId: id,
    actorId: data.updatedBy,
    data: content,
  });

  return content;
}

export async function publishContent(
  id: string,
  administratorId: string,
) {
  const content = await prisma.contentItem.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      updatedBy: administratorId,
    },
  });

  publishEvent("admin", {
    eventType: "CONTENT_PUBLISHED",
    module: "CONTENT_MANAGEMENT",
    entityType: "CONTENT",
    entityId: id,
    actorId: administratorId,
    data: content,
  });

  return content;
}
