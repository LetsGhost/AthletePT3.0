import { BaseService } from "../../common/base/base.service";
import { TrainingsdayEntity } from "../entity/trainingsday.entity";
import { TrainingsplanEntity } from "../entity/trainingsplan.entity";
import { TrainingsplanModel } from "../model/trainingsplan.model";
import { TrainingsplanTypeEnum } from "../enum/trainingsplan-type.enum";
import { WarmupEntity } from "../entity/warmup.entity";
import { TrainingsplanTypeUtil } from "../utils/trainingsplan-type.util";
import { TrainingsplanCreatedEvent } from "../events/trainingsplan-created.event";
import { eventBus } from "../../common/messaging/event-bus";

export class TrainingsPlanService extends BaseService<TrainingsplanEntity> {
    constructor() {
        super(TrainingsplanModel);
    }

    private calculateTrainingType(
        trainingDays: TrainingsdayEntity[],
        warmups: WarmupEntity[]
    ): TrainingsplanTypeEnum {
        void warmups;
        return TrainingsplanTypeUtil.calculateType(trainingDays);
    }

    async createTrainingsPlan(
        userId: string,
        trainingDays: TrainingsdayEntity[] = [],
        warmups: WarmupEntity[] = []
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

    getMuscleGroupTypes() {
        return TrainingsplanTypeUtil.getMuscleGroupTypes();
    }
}

export const trainingsPlanService = new TrainingsPlanService();