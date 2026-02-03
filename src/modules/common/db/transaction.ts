import mongoose from "mongoose";

export async function runTransaction<T>(
  fn: (session: mongoose.ClientSession | null) => Promise<T>
) {
  const session = await mongoose.startSession();

  try {
    // Check if the deployment supports transactions
    const serverStatus = await mongoose.connection.getClient().db("admin").admin().serverStatus();
    const supportsTransactions = !!(serverStatus.replicaSet || serverStatus.msg === "isdbgrid");

    if (supportsTransactions) {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } else {
      // Fallback: run without transaction
      const result = await fn(null);
      return result;
    }
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (abortErr) {
      void abortErr;
      // Session might not have active transaction
    }
    throw err;
  } finally {
    session.endSession();
  }
}
