import bcrypt from "bcrypt";

import { BaseService } from "../../common/base/base.service";
import { UserModel } from "../model/user.model";
import { UserEntity } from "../entity/user.entity";

export class UserService extends BaseService<UserEntity> {
  constructor() {
    super(UserModel);
  }

  async createUser(email: string, password: string) {
    if (await this.model.exists({ email })) {
      throw new Error("Email already exists");
    }

    return this.create({
      email,
      password: await bcrypt.hash(password, 10),
    });
  }

  async validateUser(email: string, password: string) {
    const user = await this.model.findOne({ email });
    if (!user) {
      return null;
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }
    return user;
  }
}

export const userService = new UserService();
