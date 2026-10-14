const app = require("../src/app");
const { connectDB } = require("../src/config/db");

// Serverless: cache the connection promise on globalThis so warm invocations reuse
// the socket and every cold start connects exactly once before handling traffic.
let connectPromise = global.__mongooseConnect || null;

module.exports = async (req, res) => {
  if (!connectPromise) {
    connectPromise = connectDB().catch((err) => {
      global.__mongooseConnect = null; // let the next invocation retry
      throw err;
    });
    global.__mongooseConnect = connectPromise;
  }
  await connectPromise;
  return app(req, res);
};
