// Legt das Datenbankkonto der API an: nur Lesen und Schreiben auf der App-Datenbank, keine
// Verwaltungsrechte. Läuft als Root über /docker-entrypoint-initdb.d beim ersten Start mit leerem
// Volume. Für eine bestehende Datenbank von Hand ausführen (siehe README, „MongoDB-Zugangsdaten“).
const { MONGO_APP_DB, MONGO_APP_USER, MONGO_APP_PASSWORD } = process.env;
if (!MONGO_APP_DB || !MONGO_APP_USER || !MONGO_APP_PASSWORD) {
  throw new Error("MONGO_APP_DB, MONGO_APP_USER und MONGO_APP_PASSWORD müssen gesetzt sein");
}

const appDb = db.getSiblingDB(MONGO_APP_DB);
if (appDb.getUser(MONGO_APP_USER)) {
  print(`Konto ${MONGO_APP_USER} existiert bereits`);
} else {
  appDb.createUser({
    user: MONGO_APP_USER,
    pwd: MONGO_APP_PASSWORD,
    roles: [{ role: "readWrite", db: MONGO_APP_DB }],
  });
  print(`Konto ${MONGO_APP_USER} angelegt`);
}
