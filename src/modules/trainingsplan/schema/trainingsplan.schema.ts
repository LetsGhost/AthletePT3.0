import { z } from "zod";

import { TrainingsplanTypeEnum } from "../enum/trainingsplan-type.enum";

/**
 * @openapi
 * components:
 *   schemas:
 *     Set:
 *       type: object
 *       required:
 *         - weight
 *         - reps
 *       properties:
 *         weight:
 *           type: number
 *           example: 80
 *         reps:
 *           type: number
 *           example: 10
 *     Exercise:
 *       type: object
 *       required:
 *         - name
 *         - type
 *       properties:
 *         name:
 *           type: string
 *           example: Bench Press
 *         type:
 *           type: string
 *           example: compound
 *         isSkipped:
 *           type: boolean
 *           default: false
 *         sets:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Set'
 *         warmupSets:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Set'
 *     Warmup:
 *       type: object
 *       required:
 *         - name
 *         - description
 *       properties:
 *         name:
 *           type: string
 *           example: Dynamic Stretching
 *         description:
 *           type: string
 *           example: 5 minutes of dynamic stretching
 *     TrainingDay:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: Push Day
 *         img:
 *           type: string
 *           example: push-day.jpg
 *         isSkipped:
 *           type: boolean
 *           default: false
 *         exercises:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Exercise'
 *         warmups:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Warmup'
 *         finishedAt:
 *           type: string
 *           format: date-time
 *     CreateTrainingsPlanDTO:
 *       type: object
 *       required:
 *         - type
 *       properties:
 *         type:
 *           type: string
 *           enum: [PUSH, PULL, LEGS, UPPER, LOWER, FULLBODY]
 *           example: PUSH
 *         trainingDays:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TrainingDay'
 *         warmups:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Warmup'
 *     TrainingsPlan:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         type:
 *           type: string
 *           enum: [PUSH, PULL, LEGS, UPPER, LOWER, FULLBODY]
 *         trainingDays:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TrainingDay'
 *         warmups:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Warmup'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export const setSchema = z.object({
  weight: z.number().min(0),
  reps: z.number().min(0),
});

export const exerciseSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1),
  isSkipped: z.boolean().optional().default(false),
  sets: z.array(setSchema).optional().default([]),
  warmupSets: z.array(setSchema).optional().default([]),
});

export const warmupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
});

export const trainingDaySchema = z.object({
  name: z.string().min(1).max(100),
  img: z.string().optional(),
  isSkipped: z.boolean().optional().default(false),
  exercises: z.array(exerciseSchema).optional().default([]),
  warmups: z.array(warmupSchema).optional().default([]),
  finishedAt: z.date().optional(),
});

export const createTrainingsPlanSchema = z.object({
  trainingDays: z.array(trainingDaySchema).optional().default([]),
  warmups: z.array(warmupSchema).optional().default([]),
});

export const updateTrainingsPlanSchema = z.object({
  type: z.nativeEnum(TrainingsplanTypeEnum).optional(),
  trainingDays: z.array(trainingDaySchema).optional(),
  warmups: z.array(warmupSchema).optional(),
});
