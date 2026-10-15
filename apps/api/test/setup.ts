import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";

// Muss vor dem ersten Import von src/config/env gesetzt sein.
const uri = new URL(inject("mongoUri"));
uri.pathname = `/athletept_test_${process.env.VITEST_POOL_ID ?? "0"}`;

process.env.NODE_ENV = "test";
process.env.MONGO_URI = uri.toString();
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-validation";
process.env.APP_URL = "http://localhost:5173";
process.env.MAIL_TRANSPORT = "memory";

beforeAll(async () => {
  // Models registrieren, bevor Indizes synchronisiert werden.
  await import("../src/app");
  await mongoose.connect(process.env.MONGO_URI!);
  await mongoose.syncIndexes();
});

beforeEach(async () => {
  const { sentMails } = await import("../src/lib/mail/mailer");
  sentMails.length = 0;
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});
