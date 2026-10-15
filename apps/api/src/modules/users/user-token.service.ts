import type { ClientSession, Types } from "mongoose";

import { BadRequestError } from "../../lib/errors";
import { generateToken, hashToken } from "../../lib/tokens";
import { UserModel, type UserDocument } from "./user.model";
import { UserTokenModel, type UserTokenType } from "./user-token.model";

export const TOKEN_LIFETIME: Record<UserTokenType, number> = {
  invitation: 7 * 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

/** Erzeugt ein neues Token. Ältere Tokens desselben Typs für den User werden ungültig. */
export async function issueUserToken(
  userId: Types.ObjectId,
  type: UserTokenType,
  session?: ClientSession,
) {
  const token = generateToken();
  await UserTokenModel.deleteMany({ userId, type }, { session });
  await UserTokenModel.create(
    [
      {
        userId,
        type,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_LIFETIME[type]),
      },
    ],
    { session },
  );
  return token;
}

function invalidLink() {
  return new BadRequestError(
    "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
    "invalid_token",
  );
}

/** Prüft ein Token, ohne es zu verbrauchen. */
export async function findUserByToken(token: string, type: UserTokenType): Promise<UserDocument> {
  const record = await UserTokenModel.findOne({ tokenHash: hashToken(token), type });
  if (!record || record.expiresAt.getTime() <= Date.now()) {
    throw invalidLink();
  }
  const user = await UserModel.findById(record.userId);
  if (!user) {
    throw invalidLink();
  }
  return user;
}

/**
 * Verbraucht ein Token atomar. Zwei gleichzeitige Einlösungen desselben Links
 * können so nicht beide gelingen.
 */
export async function consumeUserToken(
  token: string,
  type: UserTokenType,
  session?: ClientSession,
): Promise<UserDocument> {
  const record = await UserTokenModel.findOneAndDelete(
    { tokenHash: hashToken(token), type, expiresAt: { $gt: new Date() } },
    { session },
  );
  if (!record) {
    throw invalidLink();
  }
  const user = await UserModel.findById(record.userId).session(session ?? null);
  if (!user) {
    throw invalidLink();
  }
  return user;
}
