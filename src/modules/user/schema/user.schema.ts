import { z } from "zod";

/**
 * @openapi
 * components:
 *   schemas:
 *     CreateUserDTO:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         name:
 *          type: string
 *          example: John Doe
 *         password:
 *           type: string
 *           minLength: 8
 *           example: password123
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         role:
 *           type: string
 *           example: user
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export type CreateUserDTO = z.infer<typeof createUserSchema>;
