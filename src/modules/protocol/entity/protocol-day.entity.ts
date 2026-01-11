import { prop } from "@typegoose/typegoose";

import { BaseModel } from "../../common/base/base.model";
import { ProtocolExerciseEntity } from "./protocol-exercise.entity";

export class ProtocolDayEntity extends BaseModel {
    @prop({ default: false })
    isSkipped!: boolean;

    @prop({ required: true })
    name!: string;

    @prop()
    img?: string;

    @prop({ type: () => [ProtocolExerciseEntity], default: [] })
    exercises!: ProtocolExerciseEntity[];
}
