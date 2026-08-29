import bcrypt from "bcryptjs";
import crypto from "crypto";

import { prisma } from "../config/prisma.js";
import { sendAdminInvitationEmail } from "../services/email.service.js";

function hashInvitationToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}


export async function acceptAdminInvitation(
  invitationToken: string,
  password: string,
) {
  const tokenHash = hashInvitationToken(invitationToken);

  const invitation = await prisma.adminInvitation.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          adminProfile: true,
        },
      },
    },
  });

  if (
    !invitation ||
    invitation.consumedAt ||
    invitation.expiresAt <= new Date()
  ) {
    throw new Error("Invalid or expired administrator invitation");
  }

  if (invitation.user.role !== "ADMIN") {
    throw new Error("Invalid administrator invitation");
  }

  if (!invitation.user.adminProfile) {
    throw new Error("Administrator profile not found");
  }

  if (invitation.user.adminProfile.status !== "ACTIVE") {
    throw new Error("Administrator account is not active");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const consumed = await tx.adminInvitation.updateMany({
      where: {
        id: invitation.id,
        tokenHash,
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        consumedAt: now,
      },
    });

    if (consumed.count !== 1) {
      throw new Error("Invalid or expired administrator invitation");
    }

    const user = await tx.user.update({
      where: {
        id: invitation.userId,
      },
      data: {
        passwordHash,
        emailVerifiedAt: now,
        status: "ACTIVE",
      },
      include: {
        adminProfile: true,
      },
    });

    await tx.refreshSession.updateMany({
      where: {
        userId: invitation.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId: invitation.createdBy,
        action: "ADMINISTRATOR_INVITATION_ACCEPTED",
        affectedUserId: invitation.userId,
        newValue: {
          invitationId: invitation.id,
          emailVerifiedAt: now,
          status: "ACTIVE",
        },
      },
    });

    return user;
  });

  return {
    user: result,
    message: "Administrator invitation accepted successfully",
  };
}

export async function resendAdminInvitation(
  creatorId: string,
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      email: true,
      role: true,
      adminProfile: {
        select: {
          userId: true,
          status: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role !== "ADMIN") {
    throw new Error("The user role must be ADMIN");
  }

  if (!user.email) {
    throw new Error(
      "Administrator must have an email address before an invitation can be sent",
    );
  }

  if (!user.adminProfile) {
    throw new Error("Administrator profile not found");
  }

  if (user.adminProfile.status !== "ACTIVE") {
    throw new Error("Administrator account is not active");
  }

  const existingInvitation = await prisma.adminInvitation.findUnique({
    where: { userId },
  });

  if (!existingInvitation) {
    throw new Error("Administrator invitation not found");
  }

  const invitationToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInvitationToken(invitationToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const invitation = await prisma.$transaction(async (tx) => {
    const result = await tx.adminInvitation.update({
      where: {
        id: existingInvitation.id,
      },
      data: {
        createdBy: creatorId,
        tokenHash,
        expiresAt,
        consumedAt: null,
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId: creatorId,
        action: "ADMINISTRATOR_INVITATION_RESENT",
        affectedUserId: userId,
        newValue: {
          invitationId: result.id,
          expiresAt: result.expiresAt,
        },
      },
    });

    return result;
  });

  try {
    await sendAdminInvitationEmail(
      user.email,
      user.firstName,
      invitationToken,
      invitation.expiresAt,
    );
  } catch {
    throw new Error(
      "Administrator invitation was renewed, but the invitation email could not be sent",
    );
  }

  return {
    invitationId: invitation.id,
    expiresAt: invitation.expiresAt,
    message: "Administrator invitation email has been resent",
  };
}

export async function createAdminInvitation(
  creatorId: string,
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      email: true,
      role: true,
      adminProfile: {
        select: {
          userId: true,
          status: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role !== "ADMIN") {
    throw new Error("The user role must be ADMIN");
  }

  if (!user.email) {
    throw new Error(
      "Administrator must have an email address before an invitation can be sent",
    );
  }

  if (!user.adminProfile) {
    throw new Error(
      "Administrator profile not found",
    );
  }

  if (user.adminProfile.status !== "ACTIVE") {
    throw new Error(
      "Administrator account is not active",
    );
  }

  const existingInvitation =
    await prisma.adminInvitation.findUnique({
      where: { userId },
    });

  const now = new Date();

  if (
    existingInvitation &&
    !existingInvitation.consumedAt &&
    existingInvitation.expiresAt > now
  ) {
    throw new Error(
      "An active administrator invitation already exists",
    );
  }

  const invitationToken =
    crypto.randomBytes(32).toString("hex");

  const tokenHash =
    hashInvitationToken(invitationToken);

  const expiresAt =
    new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

  const invitation =
    await prisma.$transaction(async (tx) => {
      const result =
        existingInvitation
          ? await tx.adminInvitation.update({
              where: {
                id: existingInvitation.id,
              },
              data: {
                createdBy: creatorId,
                tokenHash,
                expiresAt,
                consumedAt: null,
              },
            })
          : await tx.adminInvitation.create({
              data: {
                userId,
                createdBy: creatorId,
                tokenHash,
                expiresAt,
              },
            });

      await tx.auditLog.create({
        data: {
          administratorId: creatorId,
          action: "ADMINISTRATOR_INVITATION_CREATED",
          affectedUserId: userId,
          newValue: {
            invitationId: result.id,
            expiresAt: result.expiresAt,
          },
        },
      });

      return result;
    });

  try {
    await sendAdminInvitationEmail(
      user.email,
      user.firstName,
      invitationToken,
      invitation.expiresAt,
    );
  } catch {
    throw new Error(
      "Administrator invitation was created, but the invitation email could not be sent",
    );
  }

  return {
    invitationId: invitation.id,
    expiresAt: invitation.expiresAt,
    message:
      "Administrator invitation email has been sent",
  };
}
