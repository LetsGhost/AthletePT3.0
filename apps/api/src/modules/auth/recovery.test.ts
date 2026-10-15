import { describe, expect, it } from "vitest";

import { api, createAndLogin, createUser, lastMailTo, login } from "../../../test/helpers";
import { sentMails } from "../../lib/mail/mailer";
import { UserTokenModel } from "../users/user-token.model";

/** Der Mailversand läuft im Hintergrund; kurz warten, bis er im Speicher-Transport angekommen ist. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("Passwort vergessen", () => {
  it("antwortet für unbekannte Adressen gleich und verschickt nichts", async () => {
    const res = await api()
      .post("/api/v1/auth/password-reset/request")
      .send({ email: "niemand@example.com" });
    await flush();

    expect(res.status).toBe(204);
    expect(sentMails).toHaveLength(0);
  });

  it("verschickt nichts an eingeladene oder gesperrte Konten", async () => {
    const invited = await createUser({ status: "invited" });
    const disabled = await createUser({ status: "disabled" });

    for (const user of [invited, disabled]) {
      await api().post("/api/v1/auth/password-reset/request").send({ email: user.email });
    }
    await flush();

    expect(sentMails).toHaveLength(0);
  });

  it("setzt das Passwort über den Link und meldet alle Geräte ab", async () => {
    const { user, cookie } = await createAndLogin();

    await api().post("/api/v1/auth/password-reset/request").send({ email: user.email });
    await flush();
    const { mail, token } = lastMailTo(user.email);
    expect(mail.text).toContain("http://localhost:5173/reset-password#token=");

    const confirm = await api()
      .post("/api/v1/auth/password-reset/confirm")
      .send({ token, password: "ganz-neues-passwort" });

    expect(confirm.status).toBe(204);
    expect((await api().post("/api/v1/auth/refresh").set("Cookie", cookie)).status).toBe(401);
    await expect(login(user.email, "ganz-neues-passwort")).resolves.toBeDefined();

    const reuse = await api()
      .post("/api/v1/auth/password-reset/confirm")
      .send({ token, password: "noch-ein-passwort" });
    expect(reuse.status).toBe(400);
  });

  it("lässt einen frischen Link gültig und schickt keine zweite Mail", async () => {
    const user = await createUser();
    const request = () =>
      api().post("/api/v1/auth/password-reset/request").send({ email: user.email });

    await request();
    await flush();
    const { token } = lastMailTo(user.email);
    const second = await request();
    await flush();

    expect(second.status).toBe(204);
    expect(sentMails).toHaveLength(1);
    const confirm = await api()
      .post("/api/v1/auth/password-reset/confirm")
      .send({ token, password: "ganz-neues-passwort" });
    expect(confirm.status).toBe(204);
  });

  it("stellt nach Ablauf der Sperrzeit einen neuen Link aus", async () => {
    const user = await createUser();
    const request = () =>
      api().post("/api/v1/auth/password-reset/request").send({ email: user.email });

    await request();
    await flush();
    await UserTokenModel.collection.updateMany(
      {},
      { $set: { createdAt: new Date(Date.now() - 6 * 60 * 1000) } },
    );
    await request();
    await flush();

    expect(sentMails).toHaveLength(2);
  });

  it("lehnt abgelaufene Links ab", async () => {
    const { user } = await createAndLogin();
    await api().post("/api/v1/auth/password-reset/request").send({ email: user.email });
    await flush();
    const { token } = lastMailTo(user.email);
    await UserTokenModel.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });

    const res = await api()
      .post("/api/v1/auth/password-reset/confirm")
      .send({ token, password: "ganz-neues-passwort" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_token");
  });

  it("prüft die Passwort-Policy auch beim Annehmen einer Einladung", async () => {
    const res = await api()
      .post("/api/v1/auth/invitations/accept")
      .send({ token: "x".repeat(43), password: "kurz" });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe("password");
  });
});
