import {
  challengeDetailSchema,
  challengeEntryRequestSchema,
  challengeListResponseSchema,
  createCoachChallengeRequestSchema,
  isoDateSchema,
  objectIdSchema,
  updateCoachChallengeRequestSchema,
} from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import * as challengeService from "./challenge.service";

const idParams = z.object({ id: objectIdSchema });

const coach = createModuleRouter("/coach/challenges", "Challenges (Coach)");

coach.route({
  method: "get",
  path: "/",
  summary: "Eigene Challenges auflisten",
  description: "Laufende zuerst, dann geplante, dann beendete. Mit Stand aller Teilnehmer.",
  auth: ["coach"],
  response: challengeListResponseSchema,
  handler: ({ auth }) => challengeService.listCoachChallenges(auth.userId),
});

coach.route({
  method: "post",
  path: "/",
  summary: "Challenge anlegen",
  description:
    "Für eigene, nicht archivierte Athleten (sonst 400 `invalid_participants`). Der Start darf " +
    "nicht in der Vergangenheit liegen (400 `start_in_past`). Teilnehmer sind sofort dabei und " +
    "bekommen eine Mail.",
  auth: ["coach"],
  body: createCoachChallengeRequestSchema,
  status: 201,
  response: challengeDetailSchema,
  errors: [404],
  handler: ({ auth, body }) => challengeService.createCoachChallenge(auth, body),
});

coach.route({
  method: "get",
  path: "/:id",
  summary: "Challenge mit Rangliste abrufen",
  auth: ["coach"],
  params: idParams,
  response: challengeDetailSchema,
  errors: [404],
  handler: ({ auth, params }) => challengeService.getCoachChallenge(auth.userId, params.id),
});

coach.route({
  method: "patch",
  path: "/:id",
  summary: "Challenge ändern",
  description:
    "Titel, Nachricht und Preis bis zum Ende. Zeitraum, Ziel und Teilnehmer nur vor dem Start " +
    "(sonst 409 `challenge_started`). Neue Teilnehmer bekommen eine Mail.",
  auth: ["coach"],
  params: idParams,
  body: updateCoachChallengeRequestSchema,
  response: challengeDetailSchema,
  errors: [404, 409],
  handler: ({ auth, params, body }) => challengeService.updateCoachChallenge(auth, params.id, body),
});

coach.route({
  method: "post",
  path: "/:id/end",
  summary: "Challenge vorzeitig beenden",
  description: "Gewertet wird bis einschließlich heute. Geplante: 409 `challenge_not_started`.",
  auth: ["coach"],
  params: idParams,
  response: challengeDetailSchema,
  errors: [404, 409],
  handler: ({ auth, params }) => challengeService.endCoachChallenge(auth.userId, params.id),
});

coach.route({
  method: "delete",
  path: "/:id",
  summary: "Geplante Challenge löschen",
  description: "Gestartete lassen sich nur beenden (409 `challenge_started`).",
  auth: ["coach"],
  params: idParams,
  status: 204,
  errors: [404, 409],
  handler: async ({ auth, params }) => {
    await challengeService.deleteCoachChallenge(auth.userId, params.id);
  },
});

export const coachChallengeRouter = coach;

const athletes = createModuleRouter("/athletes", "Challenges (Coach)");

athletes.route({
  method: "get",
  path: "/:athleteId/challenges",
  summary: "Challenges eines Athleten",
  description: "Alle Challenges, in denen der Athlet dabei ist, mit seinem Stand (`me`).",
  auth: ["coach"],
  params: z.object({ athleteId: objectIdSchema }),
  response: challengeListResponseSchema,
  errors: [404],
  handler: ({ auth, params }) =>
    challengeService.listAthleteChallenges(auth.userId, params.athleteId),
});

export const athleteChallengeRouter = athletes;

const me = createModuleRouter("/me/challenges", "Eigene Challenges");

me.route({
  method: "get",
  path: "/",
  summary: "Eigene Challenges auflisten",
  description: "Laufende zuerst, dann geplante, dann beendete. `me` ist der eigene Stand.",
  auth: ["athlete"],
  response: challengeListResponseSchema,
  handler: ({ auth }) => challengeService.listMyChallenges(auth.userId),
});

me.route({
  method: "get",
  path: "/:id",
  summary: "Eigene Challenge mit Rangliste abrufen",
  description: "Bei einer freien Vorgabe mit den eigenen Einträgen (`entries`).",
  auth: ["athlete"],
  params: idParams,
  response: challengeDetailSchema,
  errors: [404],
  handler: ({ auth, params }) => challengeService.getMyChallenge(auth.userId, params.id),
});

me.route({
  method: "put",
  path: "/:id/entries/:date",
  summary: "Tageswert einer freien Vorgabe eintragen",
  description:
    "Nur für heute und solange die Challenge läuft (sonst 409 `entry_not_today` bzw. " +
    "`challenge_not_running`). Beim Abhaken zählt 1 als erledigt, 0 nimmt es zurück.",
  auth: ["athlete"],
  params: idParams.extend({ date: isoDateSchema }),
  body: challengeEntryRequestSchema,
  response: challengeDetailSchema,
  errors: [404, 409],
  handler: ({ auth, params, body }) =>
    challengeService.setMyEntry(auth.userId, params.id, params.date, body.value),
});

export const myChallengeRouter = me;
