import { prop } from "@typegoose/typegoose";
import { Types } from "mongoose";

import { BaseModel } from "../../common/base/base.model";

export class UserEntity extends BaseModel {
    @prop({ required: true, unique: true })
    email!: string;

    @prop({ required: true })
    password!: string;

    @prop({ required: true })
    name!: string;

    @prop({ default: "user" })
    role!: string;

    @prop({ ref: "TrainingsplanEntity", type: Types.ObjectId })
    trainingPlan?: Types.ObjectId;

    @prop({ ref: "StatsEntity", type: Types.ObjectId })
    stats?: Types.ObjectId;

    @prop({ ref: "WeekDisplayEntity", type: Types.ObjectId })
    weekDisplay?: Types.ObjectId;

    @prop({ ref: "AnalyticsEntity", type: Types.ObjectId })
    analytics?: Types.ObjectId;

    @prop({ ref: "ProtocolEntity", type: Types.ObjectId })
    protocol?: Types.ObjectId;
}