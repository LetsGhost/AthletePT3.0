import { prop } from "@typegoose/typegoose";
import { BaseModel } from "../../common/base/base.model";

export class UserEntity extends BaseModel {
    @prop({ required: true, unique: true })
    email!: string;

    @prop({ required: true })
    password!: string;

    @prop({ default: "user" })
    role!: string;
}