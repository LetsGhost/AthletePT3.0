import { TrainingsplanTypeEnum } from "../enum/trainingsplan-type.enum";

type ExerciseLike = {
    type?: string;
};

type TrainingDayLike = {
    exercises?: ExerciseLike[];
};

type GroupCounts = {
    total: number;
    lower: number;
    upper: number;
    legs: number;
};

export const muscleGroupTypes = [
    "legs",
    "lower",
    "upper",
    "chest",
    "shoulders",
    "biceps",
    "triceps",
    "back",
    "lats",
    "traps",
    "glutes",
    "hamstrings",
    "quads",
    "calves",
] as const;

export type MuscleGroupType = typeof muscleGroupTypes[number];

export type TrainingsplanTypeConfig = {
    legsRatio: number;
    lowerRatio: number;
    upperRatio: number;
};

export const defaultTrainingsplanTypeConfig: TrainingsplanTypeConfig = {
    legsRatio: 0.75,
    lowerRatio: 0.5,
    upperRatio: 0.5,
};

export class TrainingsplanTypeUtil {
    static getMuscleGroupTypes(): MuscleGroupType[] {
        return [...muscleGroupTypes];
    }

    static calculateType(
        trainingDays: TrainingDayLike[] = [],
        config: TrainingsplanTypeConfig = defaultTrainingsplanTypeConfig
    ): TrainingsplanTypeEnum {
        const counts = this.countGroups(trainingDays);

        if (counts.total === 0) {
            return TrainingsplanTypeEnum.FULLBODY;
        }

        const lowerRatio = counts.lower / counts.total;
        const upperRatio = counts.upper / counts.total;
        const legsRatio = counts.legs / counts.total;

        if (lowerRatio >= config.legsRatio || legsRatio >= config.legsRatio) {
            return TrainingsplanTypeEnum.LEGS;
        }

        if (lowerRatio >= config.lowerRatio) {
            return TrainingsplanTypeEnum.LOWER;
        }

        if (upperRatio >= config.upperRatio) {
            return TrainingsplanTypeEnum.UPPER;
        }

        return TrainingsplanTypeEnum.FULLBODY;
    }

    private static countGroups(trainingDays: TrainingDayLike[]): GroupCounts {
        const counts: GroupCounts = {
            total: 0,
            lower: 0,
            upper: 0,
            legs: 0,
        };

        for (const day of trainingDays) {
            for (const exercise of day.exercises ?? []) {
                const rawType = (exercise.type ?? "").trim().toLowerCase();
                if (!rawType) {
                    continue;
                }

                counts.total += 1;

                if (this.isLower(rawType)) {
                    counts.lower += 1;
                    if (this.isLegs(rawType)) {
                        counts.legs += 1;
                    }
                }

                if (this.isUpper(rawType)) {
                    counts.upper += 1;
                }

            }
        }

        return counts;
    }

    private static normalize(value: string): string {
        return value.replace(/\s+/g, "").replace(/-/g, "").toLowerCase();
    }

    private static isLegs(value: string): boolean {
        const v = this.normalize(value);
        return [
            "leg",
            "legs",
            "quad",
            "quads",
            "hamstring",
            "hamstrings",
            "glute",
            "glutes",
            "calf",
            "calves",
            "adductor",
            "adductors",
            "abductor",
            "abductors",
            "hip",
            "hips",
        ].includes(v);
    }

    private static isLower(value: string): boolean {
        const v = this.normalize(value);
        if (this.isLegs(v)) {
            return true;
        }

        return ["lowerbody", "lower"].includes(v);
    }

    private static isUpper(value: string): boolean {
        const v = this.normalize(value);
        return [
            "upper",
            "upperbody",
            "chest",
            "pec",
            "pecs",
            "shoulder",
            "shoulders",
            "delts",
            "delt",
            "tricep",
            "triceps",
            "bicep",
            "biceps",
            "back",
            "lat",
            "lats",
            "trap",
            "traps",
            "rear_delt",
            "reardelt",
        ].includes(v);
    }

    static mergeConfig(
        overrides?: Partial<TrainingsplanTypeConfig>
    ): TrainingsplanTypeConfig {
        return {
            ...defaultTrainingsplanTypeConfig,
            ...overrides,
        };
    }
}