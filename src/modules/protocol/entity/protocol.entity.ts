import { prop } from "@typegoose/typegoose";
import { Types } from "mongoose";

import { BaseModel } from "../../common/base/base.model";
import { ProtocolDayEntity } from "./protocol-day.entity";

export class ProtocolEntity extends BaseModel {
    @prop({ type: () => [ProtocolDayEntity], default: [] })
    protocolDays!: ProtocolDayEntity[];
}
