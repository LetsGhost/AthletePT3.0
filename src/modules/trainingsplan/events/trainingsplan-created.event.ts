import { BaseDomainEvent } from "../../common/messaging/event";

export class TrainingsplanCreatedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      userId: string;
      type: string;
    }
  ) {
    super("trainingsplan.created", aggregateId, payload);
  }
}
