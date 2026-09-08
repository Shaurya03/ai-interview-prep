import mongoose from "mongoose";

export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is required. Copy .env.example to .env and set it.");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  return mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
}
