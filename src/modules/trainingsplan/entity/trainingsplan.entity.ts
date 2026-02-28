import { prop } from "@typegoose/typegoose";

import { BaseModel } from "../../common/base/base.model";
import { TrainingsplanTypeEnum } from "../enum/trainingsplan-type.enum";
import { TrainingsdayEntity } from "./trainingsday.entity";
import { WarmupEntity } from "./warmup.entity";

export class TrainingsplanEntity extends BaseModel {
    @prop({ 
        enum: TrainingsplanTypeEnum,
        required: true,
        type: String, 
    })
    type!: TrainingsplanTypeEnum;

    @prop({ type: () => [TrainingsdayEntity], default: [] })
    trainingDays!: TrainingsdayEntity[];

    @prop({ type: () => [WarmupEntity], default: [] })
    warmups!: WarmupEntity[];
}