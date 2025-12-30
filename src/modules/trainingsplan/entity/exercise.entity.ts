import { prop } from "@typegoose/typegoose";

import { BaseModel } from "../../common/base/base.model";
import { SetEntity } from "./set.entity";

export class ExerciseEntity extends BaseModel {
    @prop({ required: true })
    name!: string;

    @prop({ required: true })
    type!: string;

    @prop({ default: false })
    isSkipped!: boolean;

    @prop({ type: () => [SetEntity], default: [] })
    sets!: SetEntity[];

    @prop({ type: () => [SetEntity], default: [] })
    warmupSets!: SetEntity[];
}
