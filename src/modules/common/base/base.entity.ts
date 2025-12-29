import { prop } from "@typegoose/typegoose";

export abstract class BaseEntity {
  @prop()
  createdAt?: Date;

  @prop()
  updatedAt?: Date;
}
