import bcrypt from "bcrypt";
import { BaseService } from "../../common/base/base.service";
import { UserModel } from "../model/user.model";
import { UserEntity } from "../entity/user.entity";
import { eventBus } from "../../common/messaging/event-bus";
import { UserCreatedEvent } from "../events/user-created.event";

export class UserService extends BaseService<UserEntity> {
  constructor() {
    super(UserModel);
  }

  async createUser(email: string, password: string) {
    if (await this.model.exists({ email })) {
      throw new Error("Email already exists");
    }

    const user = await this.create({
      email,
      password: await bcrypt.hash(password, 10),
    });

    // Emit domain event
    const event = new UserCreatedEvent(user._id.toString(), {
      email: user.email,
      role: user.role,
    });
    await eventBus.publish(event);

    return user;
  }
}

export const userService = new UserService();
