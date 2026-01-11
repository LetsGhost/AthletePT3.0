import { prop } from "@typegoose/typegoose";

import { BaseModel } from "../../common/base/base.model";
import { ExerciseEntity } from "./exercise.entity";
import { WarmupEntity } from "./warmup.entity";

export class TrainingsdayEntity extends BaseModel {
    @prop({ required: true })
    name!: string;

    @prop()
    img?: string;

    @prop({ type: () => [ExerciseEntity], default: [] })
    exercises!: ExerciseEntity[];

    @prop({ type: () => [WarmupEntity], default: [] })
    warmups!: WarmupEntity[];

    @prop()
    finishedAt?: Date;
}