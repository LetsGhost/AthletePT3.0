import { EventHandler } from "../../common/messaging/event-handler";
import { UserCreatedEvent } from "./user-created.event";
import { logger } from "../../common/logger/logger";

export class UserCreatedHandler extends EventHandler<UserCreatedEvent> {
  getEventType(): string {
    return "user.created";
  }

  async handle(event: UserCreatedEvent): Promise<void> {
    logger.info(`User created event received`, {
      userId: event.aggregateId,
      email: event.payload.email,
      role: event.payload.role,
    });

    // Example: Send welcome email, update search index, update analytics, etc.
    // await emailService.sendWelcomeEmail(event.payload.email);
    // await analyticsService.trackUserCreation(event.aggregateId);
  }
}

export const userCreatedHandler = new UserCreatedHandler();
