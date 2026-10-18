import type { ClientSession, Types } from "mongoose";

import { SessionModel } from "../auth/session.model";
import { ExerciseNoticeModel } from "../exercises/exercise-notice.model";
import { ExerciseModel } from "../exercises/exercise.model";
import { TrainingPlanModel, TrainingPlanVersionModel } from "../plans/plan.model";
import { UserModel } from "../users/user.model";
import { UserTokenModel } from "../users/user-token.model";
import { WeeklyActivitiesModel, WorkoutLogModel } from "../workouts/workout-log.model";
import { AthleteProfileModel } from "./athlete-profile.model";

/**
 * Löscht alle Daten eines Athleten (DSGVO: Recht auf Löschung). Jedes Modul, das
 * Athletendaten speichert, muss hier ergänzt werden.
 */
export async function deleteAllAthleteData(athleteId: Types.ObjectId, session: ClientSession) {
  await WorkoutLogModel.deleteMany({ athleteId }, { session });
  await WeeklyActivitiesModel.deleteMany({ athleteId }, { session });
  await TrainingPlanVersionModel.deleteMany({ athleteId }, { session });
  await TrainingPlanModel.deleteMany({ athleteId }, { session });
  await AthleteProfileModel.deleteMany({ athleteId }, { session });
  // Private Übungen verwenden nur seine eigenen Pläne und Protokolle, übernommene gehören dem Coach.
  await ExerciseModel.deleteMany({ ownerAthleteId: athleteId }, { session });
  await ExerciseNoticeModel.deleteMany({ recipientId: athleteId }, { session });
  await UserTokenModel.deleteMany({ userId: athleteId }, { session });
  await SessionModel.deleteMany({ userId: athleteId }, { session });
  await UserModel.deleteOne({ _id: athleteId }, { session });
}
