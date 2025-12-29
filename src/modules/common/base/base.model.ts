import { getModelForClass, modelOptions } from "@typegoose/typegoose";
import { BaseEntity } from "./base.entity";

@modelOptions({
  schemaOptions: {
    timestamps: true,
    versionKey: false,
  },
})
export abstract class BaseModel extends BaseEntity {}

export function createModel<T extends typeof BaseModel>(cls: T) {
  return getModelForClass(cls);
}
