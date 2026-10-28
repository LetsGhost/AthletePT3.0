import {
  challengeDetailSchema,
  challengeEntryRequestSchema,
  challengeListResponseSchema,
  createCoachChallengeRequestSchema,
  createDuelRequestSchema,
  createSystemTemplateRequestSchema,
  badgeListResponseSchema,
  challengeSettingsSchema,
  nicknameCheckQuerySchema,
  nicknameCheckResponseSchema,
  systemTemplateListResponseSchema,
  systemTemplateSchema,
  updateChallengeSettingsRequestSchema,
  updateSystemTemplateRequestSchema,
  isoDateSchema,
  objectIdSchema,
  teamDuelListResponseSchema,
  updateCoachChallengeRequestSchema,
} from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import * as challengeService from "./challenge.service";
import * as badgeService from "./badge.service";
import * as duelService from "./duel.service";
import * as settingsService from "./settings.service";
import * as systemService from "./system.service";

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

// Vor `/:id`, sonst würde „duels“ als ID geprüft.
coach.route({
  method: "get",
  path: "/duels",
  summary: "Duelle der eigenen Athleten",
  description:
    "Offene Einladungen, laufende und beendete Duelle, je Athlet aus dessen Sicht. Gegner anderer " +
    "Coaches erscheinen gekürzt („Lena B.“).",
  auth: ["coach"],
  response: teamDuelListResponseSchema,
  handler: ({ auth }) => duelService.listTeamDuels(auth.userId),
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

athletes.route({
  method: "get",
  path: "/:athleteId/badges",
  summary: "Abzeichen eines Athleten",
  auth: ["coach"],
  params: z.object({ athleteId: objectIdSchema }),
  response: badgeListResponseSchema,
  errors: [404],
  handler: ({ auth, params }) => badgeService.listAthleteBadges(auth.userId, params.athleteId),
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

// Vor `/:id`, sonst würde „discover“ als ID geprüft.
me.route({
  method: "get",
  path: "/discover",
  summary: "System-Challenges zum Beitreten",
  description: "Laufende und geplante System-Runden, bei denen der Athlet noch nicht dabei ist.",
  auth: ["athlete"],
  response: challengeListResponseSchema,
  handler: ({ auth }) => systemService.listDiscover(auth.userId),
});

me.route({
  method: "post",
  path: "/:id/join",
  summary: "System-Challenge beitreten",
  description:
    "Vor und während der Runde. Ohne Spitzname: 409 `nickname_required`, beendet: 409 " +
    "`challenge_finished`.",
  auth: ["athlete"],
  params: idParams,
  response: challengeDetailSchema,
  errors: [404, 409],
  handler: ({ auth, params }) => systemService.joinRound(auth.userId, params.id),
});

me.route({
  method: "post",
  path: "/:id/leave",
  summary: "System-Challenge verlassen",
  description: "Verschwindet aus der Rangliste. Erneutes Beitreten geht, solange sie läuft.",
  auth: ["athlete"],
  params: idParams,
  response: challengeDetailSchema,
  errors: [404, 409],
  handler: ({ auth, params }) => systemService.leaveRound(auth.userId, params.id),
});

me.route({
  method: "get",
  path: "/:id",
  summary: "Eigene Challenge mit Rangliste abrufen",
  description:
    "Bei einer freien Vorgabe mit den eigenen Einträgen (`entries`). System-Challenges lassen " +
    "sich auch ohne Teilnahme abrufen, ihre Rangliste zeigt die besten 10 und die eigene Umgebung.",
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

const duels = createModuleRouter("/me/duels", "Duelle");

duels.route({
  method: "post",
  path: "/",
  summary: "Zum Duell herausfordern",
  description:
    "Per E-Mail. Die Antwort ist immer gleich, auch wenn zur Adresse kein Athlet gehört: Dann " +
    "verfällt die Einladung nach 3 Tagen einfach. Höchstens 3 offene Duelle (409 `duel_limit`), " +
    "nicht mit sich selbst (400 `duel_self`). Bei e1RM nur globale oder selbst trainierte Übungen.",
  auth: ["athlete"],
  body: createDuelRequestSchema,
  status: 201,
  response: challengeDetailSchema,
  errors: [404, 409],
  handler: ({ auth, body }) => duelService.createDuel(auth.userId, body),
});

duels.route({
  method: "post",
  path: "/:id/accept",
  summary: "Einladung annehmen",
  description:
    "Das Duell startet heute. Abgelaufen: 409 `duel_expired`, schon beantwortet: 409 " +
    "`duel_not_pending`, zu viele offene Duelle: 409 `duel_limit`.",
  auth: ["athlete"],
  params: idParams,
  response: challengeDetailSchema,
  errors: [404, 409],
  handler: ({ auth, params }) => duelService.acceptDuel(auth.userId, params.id),
});

duels.route({
  method: "post",
  path: "/:id/decline",
  summary: "Einladung ablehnen",
  auth: ["athlete"],
  params: idParams,
  status: 204,
  errors: [404, 409],
  handler: async ({ auth, params }) => {
    await duelService.declineDuel(auth.userId, params.id);
  },
});

duels.route({
  method: "post",
  path: "/:id/give-up",
  summary: "Duell aufgeben",
  description: "Der Gegner gewinnt sofort. Läuft das Duell nicht: 409 `duel_not_active`.",
  auth: ["athlete"],
  params: idParams,
  response: challengeDetailSchema,
  errors: [404, 409],
  handler: ({ auth, params }) => duelService.giveUpDuel(auth.userId, params.id),
});

duels.route({
  method: "post",
  path: "/:id/rematch",
  summary: "Revanche fordern",
  description:
    "Neue Einladung an denselben Gegner mit gleicher Wertung und Laufzeit. Erst nach dem Ende " +
    "(409 `duel_not_finished`).",
  auth: ["athlete"],
  params: idParams,
  status: 201,
  response: challengeDetailSchema,
  errors: [404, 409],
  handler: ({ auth, params }) => duelService.rematchDuel(auth.userId, params.id),
});

export const myDuelRouter = duels;

const profile = createModuleRouter("/me", "Eigene Challenges");

profile.route({
  method: "get",
  path: "/challenge-settings",
  summary: "Spitzname und Challenge-Mails",
  auth: ["athlete"],
  response: challengeSettingsSchema,
  handler: ({ auth }) => settingsService.getSettings(auth.userId),
});

profile.route({
  method: "put",
  path: "/challenge-settings",
  summary: "Spitzname oder Challenge-Mails ändern",
  description:
    "Spitzname vergeben: 409 `nickname_taken` (ohne Rücksicht auf Groß-/Kleinschreibung).",
  auth: ["athlete"],
  body: updateChallengeSettingsRequestSchema,
  response: challengeSettingsSchema,
  errors: [409],
  handler: ({ auth, body }) => settingsService.updateSettings(auth.userId, body),
});

profile.route({
  method: "get",
  path: "/challenge-settings/nickname-check",
  summary: "Spitzname prüfen",
  description: "Frei und gültig? Sonst bis zu drei freie Vorschläge.",
  auth: ["athlete"],
  query: nicknameCheckQuerySchema,
  response: nicknameCheckResponseSchema,
  handler: ({ auth, query }) => settingsService.checkNickname(auth.userId, query.nickname),
});

profile.route({
  method: "get",
  path: "/badges",
  summary: "Eigene Abzeichen",
  description: "Berechnet aus Trainings und Challenges, nichts davon ist gespeichert.",
  auth: ["athlete"],
  response: badgeListResponseSchema,
  handler: ({ auth }) => badgeService.listMyBadges(auth.userId),
});

export const myChallengeProfileRouter = profile;

const admin = createModuleRouter("/admin/system-challenges", "System-Challenges");
const templateParams = z.object({ id: objectIdSchema });

admin.route({
  method: "get",
  path: "/",
  summary: "Vorlagen und Events",
  auth: ["sysadmin"],
  response: systemTemplateListResponseSchema,
  handler: () => systemService.listTemplates(),
});

admin.route({
  method: "post",
  path: "/",
  summary: "Vorlage anlegen",
  description:
    "Als Entwurf oder gleich aktiv. Aktive Vorlagen bekommen sofort die laufende und die nächste " +
    "Runde. Einmalige Events nicht in der Vergangenheit (400 `start_in_past`).",
  auth: ["sysadmin"],
  body: createSystemTemplateRequestSchema,
  status: 201,
  response: systemTemplateSchema,
  handler: ({ body }) => systemService.createTemplate(body),
});

admin.route({
  method: "patch",
  path: "/:id",
  summary: "Vorlage ändern, aktivieren oder pausieren",
  description:
    "Änderungen gelten für geplante Runden, laufende enden regulär. Zurück zum Entwurf geht nicht " +
    "(409 `template_published`).",
  auth: ["sysadmin"],
  params: templateParams,
  body: updateSystemTemplateRequestSchema,
  response: systemTemplateSchema,
  errors: [404, 409],
  handler: ({ params, body }) => systemService.updateTemplate(params.id, body),
});

admin.route({
  method: "delete",
  path: "/:id",
  summary: "Entwurf löschen",
  description: "Veröffentlichte Vorlagen lassen sich nur pausieren (409 `template_published`).",
  auth: ["sysadmin"],
  params: templateParams,
  status: 204,
  errors: [404, 409],
  handler: async ({ params }) => {
    await systemService.deleteTemplate(params.id);
  },
});

export const systemTemplateRouter = admin;
