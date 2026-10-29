import {
  nicknameSchema,
  type ChallengeSettings,
  type NicknameCheckResponse,
  type updateChallengeSettingsRequestSchema,
} from "@athletept/shared";
import type { z } from "zod";

import { ConflictError, NotFoundError } from "../../lib/errors";
import { UserModel } from "../users/user.model";

type UpdateInput = z.output<typeof updateChallengeSettingsRequestSchema>;

interface SettingsFields {
  name: string;
  nickname?: string | null;
  challengeMails?: boolean;
}

function toDto(user: SettingsFields): ChallengeSettings {
  return { nickname: user.nickname ?? null, challengeMails: user.challengeMails !== false };
}

async function findUser(userId: string) {
  const user = await UserModel.findById(userId, {
    name: 1,
    nickname: 1,
    challengeMails: 1,
  }).lean<SettingsFields>();
  if (!user) throw new NotFoundError("Konto nicht gefunden");
  return user;
}

export async function getSettings(userId: string) {
  return toDto(await findUser(userId));
}

async function isTaken(userId: string, nickname: string) {
  return Boolean(
    await UserModel.exists({ nicknameLower: nickname.toLowerCase(), _id: { $ne: userId } }),
  );
}

export async function updateSettings(userId: string, input: UpdateInput) {
  const set: Record<string, unknown> = {};
  if (input.challengeMails !== undefined) set.challengeMails = input.challengeMails;
  if (input.nickname !== undefined) {
    if (await isTaken(userId, input.nickname)) {
      throw new ConflictError(`„${input.nickname}“ ist leider schon vergeben.`, "nickname_taken");
    }
    set.nickname = input.nickname;
    set.nicknameLower = input.nickname.toLowerCase();
  }
  try {
    await UserModel.updateOne({ _id: userId }, { $set: set });
  } catch (error) {
    // Gleichzeitig vergeben: der eindeutige Index entscheidet.
    if ((error as { code?: number }).code === 11000) {
      throw new ConflictError(`„${input.nickname}“ ist leider schon vergeben.`, "nickname_taken");
    }
    throw error;
  }
  return getSettings(userId);
}

/** Vorschläge aus dem Vornamen, z. B. „Max_M“, „MaxLifts“, „Max_27“. */
function candidates(name: string, seed: string) {
  const [first = "Athlet", ...rest] = name
    .normalize("NFD")
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const base = first.slice(0, 14);
  const initial = rest.at(-1)?.[0]?.toUpperCase() ?? "X";
  const number = (parseInt(seed.slice(-4), 16) % 90) + 10;
  return [
    `${base}_${initial}`,
    `${base}Lifts`,
    `${base}_${number}`,
    `${base}${initial}${number}`,
  ].filter((c) => nicknameSchema.safeParse(c).success);
}

export async function checkNickname(
  userId: string,
  nickname: string,
): Promise<NicknameCheckResponse> {
  const parsed = nicknameSchema.safeParse(nickname);
  const available = parsed.success && !(await isTaken(userId, parsed.data));
  if (available) return { available, suggestions: [] };
  const user = await findUser(userId);
  const suggestions: string[] = [];
  for (const candidate of candidates(user.name, userId)) {
    if (!(await isTaken(userId, candidate))) suggestions.push(candidate);
    if (suggestions.length === 3) break;
  }
  return { available, suggestions };
}
