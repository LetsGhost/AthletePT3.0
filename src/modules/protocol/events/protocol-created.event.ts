import { BaseDomainEvent } from "../../common/messaging/event";

type ProtocolCreatedPayload = {
  userId: string;
};

export class ProtocolCreatedEvent extends BaseDomainEvent<ProtocolCreatedPayload> {
  constructor(
    aggregateId: string,
    payload: ProtocolCreatedPayload
  ) {
    super("protocol.created", aggregateId, payload);
  }
}
