import { Types } from "mongoose";

import { logger } from "../../common/logger/logger";
import { EventHandler } from "../../common/messaging/event-handler";
import { ProtocolCreatedEvent } from "../../protocol/events/protocol-created.event";
import { userService } from "../service/user.service";

export class UserProtocolCreatedHandler extends EventHandler<ProtocolCreatedEvent> {
  getEventType(): string {
    return "protocol.created";
  }

  async handle(event: ProtocolCreatedEvent): Promise<void> {
    logger.info(`Linking protocol to user`, {
      userId: event.payload.userId,
      protocolId: event.aggregateId,
    });

    await userService.updateById(event.payload.userId, {
      protocol: new Types.ObjectId(event.aggregateId),
    });
  }
}

export const userProtocolCreatedHandler = new UserProtocolCreatedHandler();
