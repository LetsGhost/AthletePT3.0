import {
  getModelForClass,
  modelOptions,
  ReturnModelType,
} from "@typegoose/typegoose";

import { BaseEntity } from "./base.entity";

@modelOptions({
  schemaOptions: {
    timestamps: true,
    versionKey: false,
  },
})
export abstract class BaseModel extends BaseEntity {}

type ModelConstructor<T> = new (...args: unknown[]) => T;

export function createModel<TClass extends ModelConstructor<BaseModel>>(
  cls: TClass
): ReturnModelType<TClass> {
  return getModelForClass(cls);
}
