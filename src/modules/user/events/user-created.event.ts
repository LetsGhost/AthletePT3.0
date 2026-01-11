import { BaseDomainEvent } from "../../common/messaging/event";

export class UserCreatedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      email: string;
      role: string;
    }
  ) {
    super("user.created", aggregateId, payload);
  }
}
