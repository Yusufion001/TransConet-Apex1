import { Router } from "express";
import { z } from "zod";
import { AdminModule } from "../../generated/prisma/enums.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  changeCustomerStatus,
  getCustomerBookings,
  getCustomerManagementRecord,
  listCustomers,
} from "./customer-management.service.js";

const router = Router();

const customerIdSchema = z.object({
  id: z.string().uuid(),
});

const listCustomersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "BLOCKED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

router.use(requireAdmin);
router.use(requireAdminModule(AdminModule.CUSTOMER_MANAGEMENT));

router.get("/", async (req, res) => {
  try {
    const query = listCustomersSchema.parse(req.query);

    const result = await listCustomers(query);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to load customers",
    });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = customerIdSchema.parse(req.params);

    const customer = await getCustomerManagementRecord(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    return res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to load customer",
    });
  }
});


router.post("/:id/activate", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = customerIdSchema.parse(req.params);

    const customer = await changeCustomerStatus(
      req.user!.id,
      id,
      "ACTIVE",
    );

    return res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    const message =
      error instanceof Error ? error.message : "Failed to activate customer";

    return res.status(message === "Customer not found" ? 404 : 500).json({
      success: false,
      error: message,
    });
  }
});

router.post("/:id/suspend", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = customerIdSchema.parse(req.params);

    const customer = await changeCustomerStatus(
      req.user!.id,
      id,
      "SUSPENDED",
    );

    return res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    const message =
      error instanceof Error ? error.message : "Failed to suspend customer";

    return res.status(message === "Customer not found" ? 404 : 500).json({
      success: false,
      error: message,
    });
  }
});

router.post("/:id/block", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = customerIdSchema.parse(req.params);

    const customer = await changeCustomerStatus(
      req.user!.id,
      id,
      "BLOCKED",
    );

    return res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    const message =
      error instanceof Error ? error.message : "Failed to block customer";

    return res.status(message === "Customer not found" ? 404 : 500).json({
      success: false,
      error: message,
    });
  }
});

router.get("/:id/bookings", async (req, res) => {
  try {
    const { id } = customerIdSchema.parse(req.params);

    const customer = await getCustomerManagementRecord(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    const bookings = await getCustomerBookings(id);

    return res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to load customer bookings",
    });
  }
});

export default router;
