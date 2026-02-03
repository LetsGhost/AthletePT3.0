import { Response } from "express";

import { BaseController } from "../../common/base/base.controller";
import { protocolService } from "../service/protocol.service";
import { createProtocolSchema, updateProtocolSchema } from "../schema/protocol.schema";
import { authenticate, AuthRequest } from "../../../middleware/auth.middleware";

/**
 * @openapi
 * tags:
 *   name: Protocols
 *   description: Protocol management endpoints
 */
class ProtocolController extends BaseController {
  constructor() {
    super();
    this.create = this.create.bind(this);
    this.getById = this.getById.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
  }

  protected routes(): void {
    /**
     * @openapi
     * /api/protocols:
     *   post:
     *     summary: Create a new protocol
     *     tags: [Protocols]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateProtocolDTO'
     *     responses:
     *       201:
     *         description: Protocol created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Protocol'
     *       400:
     *         description: Bad request
     *       401:
     *         description: Unauthorized
     */
    this.router.post("/", authenticate, this.create);

    /**
     * @openapi
     * /api/protocols/{id}:
     *   get:
     *     summary: Get protocol by ID
     *     tags: [Protocols]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Protocol ID
     *     responses:
     *       200:
     *         description: Protocol found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Protocol'
     *       400:
     *         description: Protocol not found
     *       401:
     *         description: Unauthorized
     */
    this.router.get("/:id", authenticate, this.getById);

    /**
     * @openapi
     * /api/protocols/{id}:
     *   put:
     *     summary: Update protocol by ID
     *     tags: [Protocols]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Protocol ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateProtocolDTO'
     *     responses:
     *       200:
     *         description: Protocol updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Protocol'
     *       400:
     *         description: Protocol not found
     *       401:
     *         description: Unauthorized
     */
    this.router.put("/:id", authenticate, this.update);

    /**
     * @openapi
     * /api/protocols/{id}:
     *   delete:
     *     summary: Delete protocol by ID
     *     tags: [Protocols]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Protocol ID
     *     responses:
     *       200:
     *         description: Protocol deleted successfully
     *       400:
     *         description: Protocol not found
     *       401:
     *         description: Unauthorized
     */
    this.router.delete("/:id", authenticate, this.delete);
  }

  private async create(req: AuthRequest, res: Response) {
    const dto = createProtocolSchema.parse(req.body);
    
    const userId = req.user?.id;
    if (!userId) throw new Error("User not authenticated");

    const protocol = await protocolService.createProtocol(
        userId,
        dto.protocolDays
    );

    res.status(201).json(protocol);
  }

  private async getById(req: AuthRequest, res: Response) {
    const protocol = await protocolService.findById(req.params.id);
    if (!protocol) throw new Error("Protocol not found");

    res.json(protocol);
  }

  private async update(req: AuthRequest, res: Response) {
    const dto = updateProtocolSchema.parse(req.body);
    const protocol = await protocolService.updateById(req.params.id, dto);
    
    if (!protocol) throw new Error("Protocol not found");

    res.json(protocol);
  }

  private async delete(req: AuthRequest, res: Response) {
    const protocol = await protocolService.deleteById(req.params.id);
    if (!protocol) throw new Error("Protocol not found");

    res.json({ message: "Protocol deleted successfully" });
  }
}

export const protocolController = new ProtocolController();
