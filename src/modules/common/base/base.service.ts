import {
  ClientSession,
  HydratedDocument,
  Model,
  UpdateQuery,
} from "mongoose";

export abstract class BaseService<T extends object> {
  protected constructor(protected readonly model: Model<T>) {}

  async create(
    data: Partial<T>,
    session?: ClientSession | null
  ): Promise<HydratedDocument<T>> {
    const document = new this.model(data as T);
    if (session) {
      await document.save({ session });
      return document;
    }

    await document.save();
    return document;
  }

  async findById(id: string) {
    return this.model.findById(id);
  }

  async findOne(filter: Partial<T>) {
    return this.model.findOne(filter);
  }

  async findAll(filter: Partial<T> = {}) {
    return this.model.find(filter);
  }

  async updateById(
    id: string,
    data: UpdateQuery<T> | Partial<T>,
    session?: ClientSession | null
  ) {
    const options = session ? { new: true, session } : { new: true };
    return this.model.findByIdAndUpdate(id, data, options);
  }

  async deleteById(id: string, session?: ClientSession | null) {
    const options = session ? { session } : {};
    return this.model.findByIdAndDelete(id, options);
  }
}
