import { BaseService } from "../../common/base/base.service";
import { TrainingsplanEntity } from "../entity/trainingsplan.entity";
import { TrainingsplanModel } from "../model/trainingsplan.model";
import { TrainingsplanTypeEnum } from "../enum/trainingsplan-type.enum";
import { userService } from "../../user/service/user.service";
import { runTransaction } from "../../common/db/transaction";

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
        return runTransaction(async (session) => {
            // Calculate type based on business logic
            const type = this.calculateTrainingType(trainingDays, warmups);

            // Create the training plan
            const plan = await this.create({
                type,
                trainingDays,
                warmups,
            }, session);

            // Update user with the new training plan reference
            await userService.updateById(userId, {
                trainingPlan: plan._id,
            }, session);

            return plan;
        });
    }

    async findByIdWithPopulate(id: string) {
        return this.model.findById(id).exec();
    }
}

export const trainingsPlanService = new TrainingsPlanService();