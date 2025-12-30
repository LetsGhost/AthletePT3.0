import { Model, ClientSession } from "mongoose";

export abstract class BaseService<T> {
  protected constructor(protected readonly model: Model<T>) {}

  async create(data: Partial<T>, session?: ClientSession | null) {
    const options = session ? { session } : {};
    const result = await this.model.create([data as any], options);
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
