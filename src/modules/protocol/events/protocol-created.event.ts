import { BaseDomainEvent } from "../../common/messaging/event";

export class ProtocolCreatedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      userId: string;
    }
  ) {
    super("protocol.created", aggregateId, payload);
  }
}
