import { Router } from "express";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import {
  listSubscriptionPlans,
  getTransporterSubscription,
  createSubscription,
  cancelSubscription,
  getTransporterInvoices,
} from "./subscription.service.js";

const router = Router();

router.use(authenticate);
router.use(authorize("TRANSPORTER"));

router.get("/plans", async (_req, res) => {
  try {
    const plans = await listSubscriptionPlans();
    return res.json({ success: true, data: plans });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/me", async (req: AuthenticatedRequest, res) => {
  try {
    const subscription = await getTransporterSubscription(req.user!.id);
    return res.json({ success: true, data: subscription });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/invoices", async (req: AuthenticatedRequest, res) => {
  try {
    const invoices = await getTransporterInvoices(req.user!.id);
    return res.json({ success: true, data: invoices });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const planId = String(req.body?.planId ?? "");

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: "planId is required",
      });
    }

    const result = await createSubscription(req.user!.id, planId);

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Subscription failed",
    });
  }
});

router.post("/cancel", async (req: AuthenticatedRequest, res) => {
  try {
    const subscription = await cancelSubscription(req.user!.id);

    return res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Cancellation failed",
    });
  }
});

export default router;
