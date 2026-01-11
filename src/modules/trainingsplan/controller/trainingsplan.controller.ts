import { Request, Response } from "express";
import { BaseController } from "../../common/base/base.controller";
import { trainingsPlanService } from "../service/trainingsplan.service";
import { createTrainingsPlanSchema } from "../schema/trainingsplan.schema";
import { authenticate, AuthRequest } from "../../../middleware/auth.middleware";

/**
 * @openapi
 * tags:
 *   name: TrainingPlans
 *   description: Training plan management endpoints
 */
class TrainingsPlanController extends BaseController {
  constructor() {
    super();
    this.create = this.create.bind(this);
    this.getById = this.getById.bind(this);
  }

  protected routes(): void {
    /**
     * @openapi
     * /api/trainingsplans:
     *   post:
     *     summary: Create a new training plan
     *     tags: [TrainingPlans]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateTrainingsPlanDTO'
     *     responses:
     *       201:
     *         description: Training plan created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/TrainingsPlan'
     *       400:
     *         description: Bad request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized
     */
    this.router.post("/", authenticate, this.create);

    /**
     * @openapi
     * /api/trainingsplans/{id}:
     *   get:
     *     summary: Get training plan by ID
     *     tags: [TrainingPlans]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Training Plan ID
     *     responses:
     *       200:
     *         description: Training plan found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/TrainingsPlan'
     *       400:
     *         description: Training plan not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized
     */
    this.router.get("/:id", authenticate, this.getById);
  }

  private async create(req: AuthRequest, res: Response) {
    const dto = createTrainingsPlanSchema.parse(req.body);
    
    const userId = req.user?.id;
    if (!userId) throw new Error("User not authenticated");

    const plan = await trainingsPlanService.createTrainingsPlan(
        userId,
        dto.trainingDays,
        dto.warmups
    );

    res.status(201).json(plan);
  }

  private async getById(req: AuthRequest, res: Response) {
    const plan = await trainingsPlanService.findById(req.params.id);
    if (!plan) throw new Error("Training plan not found");

    res.json(plan);
  }
}

export const trainingsPlanController = new TrainingsPlanController();
