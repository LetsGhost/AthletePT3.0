import { DomainEvent } from "./event";
import { MessageHandler } from "./message";

export abstract class EventHandler<T extends DomainEvent = DomainEvent>
  implements MessageHandler<T>
{
  abstract handle(event: T): Promise<void>;

  getEventType(): string {
    throw new Error("getEventType() must be implemented");
  }
}
