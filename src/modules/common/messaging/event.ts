import { randomUUID } from "crypto";

import { Message } from "./message";

export interface DomainEvent extends Message {
  aggregateId: string;
  version: number;
}

export abstract class BaseDomainEvent implements DomainEvent {
  id: string;
  timestamp: Date;
  version: number = 1;
  correlationId?: string;

  constructor(
    public type: string,
    public aggregateId: string,
    public payload: Record<string, unknown>
  ) {
    this.id = randomUUID();
    this.timestamp = new Date();
  }
}
