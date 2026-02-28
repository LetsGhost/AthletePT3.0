import { prop } from "@typegoose/typegoose";

export class SetEntity {
    @prop({ required: true })
    weight!: number;

    @prop({ required: true })
    reps!: number;
}
