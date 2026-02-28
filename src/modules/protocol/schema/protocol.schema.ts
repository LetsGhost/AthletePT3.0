import { z } from "zod";

import { exerciseSchema } from "../../trainingsplan/schema/trainingsplan.schema";

/**
 * @openapi
 * components:
 *   schemas:
 *     ProtocolDay:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         isSkipped:
 *           type: boolean
 *           default: false
 *         name:
 *           type: string
 *           example: Push Day
 *         img:
 *           type: string
 *           example: push-day.jpg
 *         exercises:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Exercise'
 *     CreateProtocolDTO:
 *       type: object
 *       properties:
 *         protocolDays:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProtocolDay'
 *     Protocol:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         protocolDays:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProtocolDay'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export const protocolDaySchema = z.object({
  isSkipped: z.boolean().optional().default(false),
  name: z.string().min(1).max(100),
  img: z.string().optional(),
  exercises: z.array(exerciseSchema).optional().default([]),
});

export const createProtocolSchema = z.object({
  protocolDays: z.array(protocolDaySchema).optional().default([]),
});

export const updateProtocolSchema = z.object({
  protocolDays: z.array(protocolDaySchema).optional(),
});

export type CreateProtocolDTO = z.infer<typeof createProtocolSchema>;
export type UpdateProtocolDTO = z.infer<typeof updateProtocolSchema>;
