import { Model, ClientSession } from "mongoose";

export abstract class BaseService<T> {
  protected constructor(protected readonly model: Model<T>) {}

  async create(data: Partial<T>, session?: ClientSession) {
    const result = await this.model.create([data as any], { session });
    return result[0];
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
    data: Partial<T>,
    session?: ClientSession
  ) {
    return this.model.findByIdAndUpdate(id, data, {
      new: true,
      session,
    });
  }

  async deleteById(id: string, session?: ClientSession) {
    return this.model.findByIdAndDelete(id, { session });
  }
}
