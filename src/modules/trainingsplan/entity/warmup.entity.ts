import { prop } from "@typegoose/typegoose";

import { BaseModel } from "../../common/base/base.model";

export class WarmupEntity extends BaseModel {
    @prop({ required: true })
    name!: string;

    @prop({ required: true })
    description!: string;
}
