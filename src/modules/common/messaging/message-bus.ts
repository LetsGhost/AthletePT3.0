import { Message, MessageHandler, MessageBus } from "./message";
import { logger } from "../logger/logger";

export class InMemoryMessageBus implements MessageBus {
  private handlers: Map<string, Set<MessageHandler>> = new Map();

  subscribe<T extends Message>(
    messageType: string,
    handler: MessageHandler<T>
  ): void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set());
    }
    this.handlers.get(messageType)!.add(handler);
    logger.debug(`Handler subscribed to message type: ${messageType}`);
  }

  unsubscribe(messageType: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(messageType);
    if (handlers) {
      handlers.delete(handler);
      logger.debug(`Handler unsubscribed from message type: ${messageType}`);
    }
  }

  async publish<T extends Message>(message: T): Promise<void> {
    const handlers = this.handlers.get(message.type);
    if (!handlers || handlers.size === 0) {
      logger.warn(`No handlers found for message type: ${message.type}`);
      return;
    }

    logger.debug(`Publishing message: ${message.type} [${message.id}]`);

    const promises = Array.from(handlers).map((handler) =>
      Promise.resolve()
        .then(() => handler.handle(message))
        .catch((error) => {
          logger.error(
            `Error handling message ${message.type}: ${error.message}`,
            { messageId: message.id, stack: error.stack }
          );
          throw error;
        })
    );

    await Promise.all(promises);
  }
}

export const messageBus = new InMemoryMessageBus();
