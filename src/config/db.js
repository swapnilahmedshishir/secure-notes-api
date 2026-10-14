const mongoose = require('mongoose');
const env = require('./env');
require('../models');

mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);

async function connectDB() {
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    autoIndex: true,
  });

  // make sure declared indexes exist (and email uniqueness is enforced) before serving traffic
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
