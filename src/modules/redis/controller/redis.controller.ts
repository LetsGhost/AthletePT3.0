import { Request, Response } from "express";

import { BaseController } from "../../common/base/base.controller";
import { backendStateService } from "../service/backend-state.service";
import { authenticate } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/role.middleware";

/**
 * @openapi
 * tags:
 *   name: Backend State
 *   description: Backend state and monitoring endpoints
 */
class RedisController extends BaseController {
  constructor() {
    super();
    this.getState = this.getState.bind(this);
    this.getRoutes = this.getRoutes.bind(this);
    this.getJobs = this.getJobs.bind(this);
  }

  protected routes(): void {
    /**
     * @openapi
     * /api/redis/state:
     *   get:
     *     summary: Get complete backend state
     *     tags: [Backend State]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Backend state retrieved
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 routes:
     *                   type: array
     *                 jobs:
     *                   type: array
     *                 timestamp:
     *                   type: string
     *                 uptime:
     *                   type: number
     *       401:
     *         description: Unauthorized
     */
    this.router.get(
      "/state",
      authenticate,
      authorize("admin"),
      this.getState
    );

    /**
     * @openapi
     * /api/redis/routes:
     *   get:
     *     summary: Get registered routes
     *     tags: [Backend State]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Routes list
     *       401:
     *         description: Unauthorized
     */
    this.router.get(
      "/routes",
      authenticate,
      authorize("admin"),
      this.getRoutes
    );

    /**
     * @openapi
     * /api/redis/jobs:
     *   get:
     *     summary: Get scheduled jobs
     *     tags: [Backend State]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Jobs list
     *       401:
     *         description: Unauthorized
     */
    this.router.get(
      "/jobs",
      authenticate,
      authorize("admin"),
      this.getJobs
    );
  }

  private async getState(req: Request, res: Response) {
    const state = await backendStateService.getBackendState();
    res.json(state);
  }

  private async getRoutes(req: Request, res: Response) {
    const routes = await backendStateService.getRoutes();
    res.json(routes);
  }

  private async getJobs(req: Request, res: Response) {
    const jobs = await backendStateService.getJobs();
    res.json(jobs);
  }
}

export const redisController = new RedisController();
