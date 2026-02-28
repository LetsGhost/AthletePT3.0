import { prop } from "@typegoose/typegoose";

import { ExerciseEntity } from "../../trainingsplan/entity/exercise.entity";

export class ProtocolExerciseEntity extends ExerciseEntity {
    @prop({ default: false })
    isSkipped!: boolean;
}
