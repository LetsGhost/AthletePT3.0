import { randomUUID } from "crypto";

import { Message } from "./message";

export interface DomainEvent<
  TPayload = Record<string, unknown>
> extends Message<TPayload> {
  aggregateId: string;
  version: number;
}

export abstract class BaseDomainEvent<
  TPayload extends Record<string, unknown> = Record<string, unknown>
> implements DomainEvent<TPayload>
{
  id: string;
  timestamp: Date;
  version: number = 1;
  correlationId?: string;

  constructor(
    public type: string,
    public aggregateId: string,
    public payload: TPayload
  ) {
    this.id = randomUUID();
    this.timestamp = new Date();
  }
}
