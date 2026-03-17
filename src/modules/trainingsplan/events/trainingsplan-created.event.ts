import { BaseDomainEvent } from "../../common/messaging/event";

type TrainingsplanCreatedPayload = {
  userId: string;
  type: string;
};

export class TrainingsplanCreatedEvent extends BaseDomainEvent<TrainingsplanCreatedPayload> {
  constructor(
    aggregateId: string,
    payload: TrainingsplanCreatedPayload
  ) {
    super("trainingsplan.created", aggregateId, payload);
  }
}
