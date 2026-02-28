import { Request, Response } from "express";

import { BaseController } from "../../common/base/base.controller";
import { userService } from "../service/user.service";
import { createUserSchema } from "../schema/user.schema";
import { authenticate } from "../../../middleware/auth.middleware";
import { authorize } from "../../../middleware/role.middleware";

/**
 * @openapi
 * tags:
 *   name: Users
 *   description: User management endpoints
 */
class UserController extends BaseController {
  constructor() {
    super();
    this.create = this.create.bind(this);
    this.getById = this.getById.bind(this);
  }

  protected routes(): void {
    /**
     * @openapi
     * /api/users:
     *   post:
     *     summary: Create a new user
     *     tags: [Users]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateUserDTO'
     *     responses:
     *       201:
     *         description: User created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       400:
     *         description: Bad request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Admin access required
     */
    this.router.post(
      "/",
      authenticate,
      authorize("admin"),
      this.create
    );

    /**
     * @openapi
     * /api/users/{id}:
     *   get:
     *     summary: Get user by ID
     *     tags: [Users]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: User ID
     *     responses:
     *       200:
     *         description: User found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       400:
     *         description: User not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized
     */
    this.router.get(
      "/:id",
      authenticate, 
      this.getById
    );
  }

  private async create(req: Request, res: Response) {
    const dto = createUserSchema.parse(req.body);
    const user = await userService.createUser(dto.email, dto.password);

    res.status(201).json(user);
  }

  private async getById(req: Request, res: Response) {
    const user = await userService.findById(req.params.id);
    if (!user) throw new Error("User not found");

    res.json(user);
  }
}

export const userController = new UserController();
