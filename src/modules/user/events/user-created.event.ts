import { BaseDomainEvent } from "../../common/messaging/event";

type UserCreatedPayload = {
  email: string;
  role: string;
};

export class UserCreatedEvent extends BaseDomainEvent<UserCreatedPayload> {
  constructor(
    aggregateId: string,
    payload: UserCreatedPayload
  ) {
    super("user.created", aggregateId, payload);
  }
}
