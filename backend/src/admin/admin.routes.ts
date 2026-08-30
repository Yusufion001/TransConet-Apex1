import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

import { getPlatformOverview } from "./admin.service.js";
import administratorRoutes from "./administrator.routes.js";
import activityRoutes from "./activity.routes.js";
import customerManagementRoutes from "./customer-management.routes.js";
import transporterManagementRoutes from "./transporter-management.routes.js";
import bookingsShipmentsRoutes from "./bookings-shipments.routes.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use("/administrators", administratorRoutes);
router.use("/customers", customerManagementRoutes);
router.use("/transporters", transporterManagementRoutes);
router.use("/bookings", bookingsShipmentsRoutes);
router.use("/activity", activityRoutes);

router.get(
  "/platform-overview",
  async (_req, res) => {
    try {
      const overview =
        await getPlatformOverview();

      res.json({
        success: true,
        data: overview,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to load platform overview",
      });
    }
  },
);

export default router;
