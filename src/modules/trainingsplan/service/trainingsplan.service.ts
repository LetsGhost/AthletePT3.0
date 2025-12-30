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

    async createTrainingsPlan(
        userId: string,
        type: TrainingsplanTypeEnum,
        trainingDays: any[] = [],
        warmups: any[] = []
    ) {
        return runTransaction(async (session) => {
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