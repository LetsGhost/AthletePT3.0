import { BaseService } from "../../common/base/base.service";
import { TrainingsplanEntity } from "../entity/trainingsplan.entity";
import { TrainingsplanModel } from "../model/trainingsplan.model";
import { TrainingsplanTypeEnum } from "../enum/trainingsplan-type.enum";
import { TrainingsplanCreatedEvent } from "../events/trainingsplan-created.event";
import { eventBus } from "../../common/messaging/event-bus";

export class TrainingsPlanService extends BaseService<TrainingsplanEntity> {
    constructor() {
        super(TrainingsplanModel);
    }

    private calculateTrainingType(
        trainingDays: any[],
        warmups: any[]
    ): TrainingsplanTypeEnum {
        // TODO: Implement your type calculation logic here
        return TrainingsplanTypeEnum.PUSH;
    }

    async createTrainingsPlan(
        userId: string,
        trainingDays: any[] = [],
        warmups: any[] = []
    ) {
        // Calculate type based on business logic
        const type = this.calculateTrainingType(trainingDays, warmups);

        // Create the training plan
        const plan = await this.create({
            type,
            trainingDays,
            warmups,
        });

        // Emit domain event for other modules to react
        const event = new TrainingsplanCreatedEvent(
            plan._id.toString(),
            {
                userId,
                type: plan.type,
            }
        );
        await eventBus.publish(event);

        return plan;
    }

    async findByIdWithPopulate(id: string) {
        return this.model.findById(id).exec();
    }
}

export const trainingsPlanService = new TrainingsPlanService();