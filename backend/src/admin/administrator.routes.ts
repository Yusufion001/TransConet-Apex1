import { Router } from "express";
import { z } from "zod";

import {
  AdminModule,
  AdminStatus,
  AdminType,
} from "../../generated/prisma/enums.js";

import {
  AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireSuperAdmin } from "../middleware/super-admin.middleware.js";

import {
  changeAdministratorStatus,
  createAdministrator,
  getAdministrator,
  listAdministrators,
  updateAdministrator,
} from "./administrator.service.js";

const router = Router();

router.use(requireSuperAdmin);

const createAdministratorSchema = z.object({
  userId: z.string().uuid(),
  administratorType: z.nativeEnum(AdminType),
  assignedModules: z
    .array(z.nativeEnum(AdminModule))
    .min(1),
});

const administratorIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

const updateAdministratorSchema = z.object({
  administratorType: z
    .nativeEnum(AdminType)
    .optional(),
  assignedModules: z
    .array(z.nativeEnum(AdminModule))
    .min(1)
    .optional(),
}).refine(
  (value) =>
    value.administratorType !== undefined ||
    value.assignedModules !== undefined,
  {
    message:
      "At least one administrator field must be provided",
  },
);

async function handleError(
  error: unknown,
  res: Parameters<import("express").RequestHandler>[1],
) {
  const message =
    error instanceof Error
      ? error.message
      : "Administrator operation failed";

  return res.status(400).json({
    success: false,
    error: message,
  });
}

router.post(
  "/",
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const input =
        createAdministratorSchema.parse(
          req.body,
        );

      const administrator =
        await createAdministrator({
          creatorId: req.user!.id,
          userId: input.userId,
          administratorType:
            input.administratorType,
          assignedModules:
            input.assignedModules,
        });

      return res.status(201).json({
        success: true,
        data: administrator,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      return handleError(error, res);
    }
  },
);

router.get(
  "/",
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const administrators =
        await listAdministrators(
          req.user!.id,
        );

      return res.json({
        success: true,
        data: administrators,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
);

router.get(
  "/:userId",
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const administrator =
        await getAdministrator(
          req.user!.id,
          String(req.params.userId),
        );

      return res.json({
        success: true,
        data: administrator,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
);

router.patch(
  "/:userId",
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const input =
        updateAdministratorSchema.parse(
          req.body,
        );

      const administrator =
        await updateAdministrator(
          req.user!.id,
          String(req.params.userId),
          input,
        );

      return res.json({
        success: true,
        data: administrator,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      return handleError(error, res);
    }
  },
);

router.post(
  "/:userId/suspend",
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const params = administratorIdParamsSchema.parse(req.params);

      const administrator =
        await changeAdministratorStatus(
          req.user!.id,
          params.userId,
          AdminStatus.SUSPENDED,
        );

      return res.json({
        success: true,
        data: administrator,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      return handleError(error, res);
    }
  },
);

router.post(
  "/:userId/activate",
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const params = administratorIdParamsSchema.parse(req.params);

      const administrator =
        await changeAdministratorStatus(
          req.user!.id,
          params.userId,
          AdminStatus.ACTIVE,
        );

      return res.json({
        success: true,
        data: administrator,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      return handleError(error, res);
    }
  },
);

router.post(
  "/:userId/disable",
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const params = administratorIdParamsSchema.parse(req.params);

      const administrator =
        await changeAdministratorStatus(
          req.user!.id,
          params.userId,
          AdminStatus.DISABLED,
        );

      return res.json({
        success: true,
        data: administrator,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      return handleError(error, res);
    }
  },
);

export default router;
