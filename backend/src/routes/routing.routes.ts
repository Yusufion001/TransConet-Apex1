import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { autocompletePlaces, calculateRoute } from "./routing.service.js";

const router = Router();

router.use(authenticate);

const routeSchema = z.object({
  origin: z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
  destination: z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
});

router.post(
  "/autocomplete",
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = z.object({
        input: z.string().trim().min(2).max(200),
      }).parse(req.body);

      const suggestions = await autocompletePlaces(input.input);

      return res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid place search",
          details: error.issues,
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to search places";

      if (
        message === "Google Maps places is not configured" ||
        message === "Unable to search places"
      ) {
        return res.status(503).json({
          success: false,
          error: message,
        });
      }

      return res.status(502).json({
        success: false,
        error: "Unable to search places",
      });
    }
  },
);

router.post(
  "/",
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = routeSchema.parse(req.body);

      const route = await calculateRoute(input.origin, input.destination);

      return res.json({
        success: true,
        data: route,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid route coordinates",
          details: error.issues,
        });
      }

      const message =
        error instanceof Error ? error.message : "Unable to calculate route";

      if (
        message === "Google Maps routing is not configured" ||
        message === "No route found"
      ) {
        return res.status(503).json({
          success: false,
          error: message,
        });
      }

      return res.status(502).json({
        success: false,
        error: "Unable to calculate route",
      });
    }
  },
);

export default router;
