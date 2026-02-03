import { Types } from "mongoose";

import { logger } from "../../common/logger/logger";
import { EventHandler } from "../../common/messaging/event-handler";
import { TrainingsplanCreatedEvent } from "../../trainingsplan/events/trainingsplan-created.event";
import { userService } from "../service/user.service";

export class UserTrainingsplanCreatedHandler extends EventHandler<TrainingsplanCreatedEvent> {
  getEventType(): string {
    return "trainingsplan.created";
  }

  async handle(event: TrainingsplanCreatedEvent): Promise<void> {
    logger.info(`Linking trainingsplan to user`, {
      userId: event.payload.userId,
      planId: event.aggregateId,
    });

    await userService.updateById(event.payload.userId, {
      trainingPlan: new Types.ObjectId(event.aggregateId),
    });
  }
}

export const userTrainingsplanCreatedHandler = new UserTrainingsplanCreatedHandler();
