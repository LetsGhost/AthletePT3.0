import { BaseService } from "../../common/base/base.service";
import { ProtocolDayEntity } from "../entity/protocol-day.entity";
import { ProtocolEntity } from "../entity/protocol.entity";
import { ProtocolModel } from "../model/protocol.model";
import { ProtocolCreatedEvent } from "../events/protocol-created.event";
import { eventBus } from "../../common/messaging/event-bus";

export class ProtocolService extends BaseService<ProtocolEntity> {
    constructor() {
        super(ProtocolModel);
    }

    async createProtocol(userId: string, protocolDays: ProtocolDayEntity[] = []) {
        const protocol = await this.create({
            protocolDays,
        });

        const event = new ProtocolCreatedEvent(
            protocol._id.toString(),
            { userId }
        );
        await eventBus.publish(event);

        return protocol;
    }

    async findByIdWithPopulate(id: string) {
        return this.model.findById(id).exec();
    }
}

export const protocolService = new ProtocolService();
