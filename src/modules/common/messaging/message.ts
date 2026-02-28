export interface Message {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  correlationId?: string;
}

export interface MessageHandler<T extends Message = Message> {
  handle(message: T): Promise<void>;
}

export interface MessageBus {
  publish<T extends Message>(message: T): Promise<void>;
  subscribe<T extends Message>(
    messageType: string,
    handler: MessageHandler<T>
  ): void;
  unsubscribe(messageType: string, handler: MessageHandler): void;
}
