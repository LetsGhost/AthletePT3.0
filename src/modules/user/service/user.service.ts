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
}

export const userService = new UserService();
