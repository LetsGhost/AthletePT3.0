import { DomainEvent } from "./event";
import { EventHandler } from "./event-handler";
import { InMemoryMessageBus } from "./message-bus";
import { logger } from "../logger/logger";

export class EventBus extends InMemoryMessageBus {
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();

  subscribeToEvent<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void {
    this.subscribe(eventType, handler);

    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
    logger.info(`Event handler registered for: ${eventType}`);
  }

  unsubscribeFromEvent(eventType: string, handler: EventHandler): void {
    this.unsubscribe(eventType, handler);

    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  getHandlersForEvent(eventType: string): EventHandler[] {
    const handlers = this.eventHandlers.get(eventType);
    return handlers ? Array.from(handlers) : [];
  }
}

export const eventBus = new EventBus();
