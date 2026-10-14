require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User, Note, Post } = require('../src/models');

// collects every stage/index used by the winning plan(s) found anywhere in an explain document
function winningPlans(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.winningPlan) found.push(describePlan(node.winningPlan));
  Object.values(node).forEach((child) => winningPlans(child, found));
  return found;
}

function describePlan(plan, stages = []) {
  if (!plan || typeof plan !== 'object') return stages;
  if (plan.stage) stages.push(plan.indexName ? `${plan.stage}(${plan.indexName})` : plan.stage);
  Object.values(plan).forEach((child) => describePlan(child, stages));
  return stages;
}

function report(label, explain) {
  const plans = winningPlans(explain).map((stages) => stages.join(' <- '));
  console.log(`\n${label}`);
  plans.forEach((plan) => console.log(`  ${plan}`));
}

async function run() {
  await connectDB();

  const someUser = (await User.findOne().select('_id')) ?? { _id: new mongoose.Types.ObjectId() };
  const authorId = someUser._id;

  report('Own notes (sort newest first)', await Note.find({ author: authorId }).sort({ _id: -1 }).limit(10).explain('queryPlanner'));
  report('Admin: all notes', await Note.find().sort({ _id: -1 }).limit(10).explain('queryPlanner'));
  report('Admin: notes by author', await Note.find({ author: authorId }).sort({ _id: -1 }).limit(10).explain('queryPlanner'));
  report('Note by id + owner', await Note.findOne({ _id: new mongoose.Types.ObjectId(), author: authorId }).explain('queryPlanner'));
  report('Admin: list users', await User.find().sort({ _id: -1 }).limit(10).explain('queryPlanner'));
  report('Login by email', await User.findOne({ email: 'someone@example.com' }).explain('queryPlanner'));
  report('Global posts list', await Post.find().sort({ _id: -1 }).limit(10).explain('queryPlanner'));
  report(
    'Scenario 1: group by interest (filtered by interest)',
    await User.aggregate([
      { $match: { interests: 'chess' } },
      { $unwind: '$interests' },
      { $match: { interests: 'chess' } },
      { $group: { _id: '$interests', count: { $sum: 1 } } },
    ]).explain('queryPlanner')
  );
  report(
    'Scenario 1: group by interest (all)',
    await User.aggregate([
      { $match: { interests: { $type: 'string' } } },
      { $unwind: '$interests' },
      { $group: { _id: '$interests', count: { $sum: 1 } } },
    ]).explain('queryPlanner')
  );
  report(
    'Scenario 2: posts of a user ($lookup)',
    await User.aggregate([
      { $match: { _id: authorId } },
      {
        $lookup: {
          from: Post.collection.name,
          let: { authorId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$author', '$$authorId'] } } },
            { $sort: { _id: -1 } },
          ],
          as: 'posts',
        },
      },
      { $project: { username: 1, total: { $size: '$posts' } } },
    ]).explain('queryPlanner')
  );
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
