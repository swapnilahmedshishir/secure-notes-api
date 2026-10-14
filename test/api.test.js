const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let db;
let models;

const password = 'Passw0rd123';

before(async () => {
  mongod = await MongoMemoryServer.create();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: mongod.getUri('secure_notes_test'),
    JWT_SECRET: 'integration-test-secret-'.padEnd(40, 'x'),
    BCRYPT_SALT_ROUNDS: '10',
  });

  app = require('../src/app');
  db = require('../src/config/db');
  models = require('../src/models');
  await db.connectDB();
});

after(async () => {
  await db.disconnectDB();
  await mongod.stop();
});

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function signUp(username, interests = []) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@example.com`, password, interests });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { id: res.body.user._id, token: res.body.token };
}

describe('secure notes API', () => {
  let alice;
  let bob;
  let admin;

  it('registers users, hashes passwords and never exposes them', async () => {
    alice = await signUp('alice', ['Chess', 'reading']);
    bob = await signUp('bob', ['chess']);

    const stored = await models.User.findById(alice.id).select('+password');
    assert.notEqual(stored.password, password);
    assert.equal(stored.role, 'user');
    assert.deepEqual([...stored.interests], ['chess', 'reading']);

    const profile = await request(app).get('/api/auth/me').set(bearer(alice.token));
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.password, undefined);
  });

  it('rejects duplicate emails and role injection', async () => {
    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice2', email: 'alice@example.com', password });
    assert.equal(duplicate.status, 409);

    const injected = await request(app)
      .post('/api/auth/register')
      .send({ username: 'mallory', email: 'm@example.com', password, role: 'admin' });
    assert.equal(injected.status, 422);
  });

  it('logs in with valid credentials only', async () => {
    const ok = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password1' });
    assert.equal(wrongPassword.status, 401);

    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password });
    assert.equal(unknownEmail.status, 401);
  });

  it('requires a valid token on protected routes', async () => {
    assert.equal((await request(app).get('/api/notes')).status, 401);
    assert.equal((await request(app).get('/api/notes').set(bearer('not.a.token'))).status, 401);
  });

  describe('notes', () => {
    let noteIds = [];

    it('lets a user create and paginate their own notes, newest first', async () => {
      for (const n of [1, 2, 3]) {
        const res = await request(app)
          .post('/api/notes')
          .set(bearer(alice.token))
          .send({ title: `Alice note ${n}`, content: 'content' });
        assert.equal(res.status, 201);
        noteIds.push(res.body.note._id);
      }
      await request(app).post('/api/notes').set(bearer(bob.token)).send({ title: 'Bob note', content: 'content' });

      const page1 = await request(app).get('/api/notes?limit=2').set(bearer(alice.token));
      assert.equal(page1.status, 200);
      assert.deepEqual(page1.body.data.map((n) => n.title), ['Alice note 3', 'Alice note 2']);
      assert.equal(page1.body.pagination.total, 3);
      assert.equal(page1.body.pagination.totalPages, 2);
      assert.equal(page1.body.pagination.hasNextPage, true);

      const page2 = await request(app).get('/api/notes?limit=2&page=2').set(bearer(alice.token));
      assert.deepEqual(page2.body.data.map((n) => n.title), ['Alice note 1']);
    });

    it('hides other users notes behind a 404 for read, update and delete', async () => {
      const [target] = noteIds;
      assert.equal((await request(app).get(`/api/notes/${target}`).set(bearer(bob.token))).status, 404);
      assert.equal(
        (await request(app).patch(`/api/notes/${target}`).set(bearer(bob.token)).send({ title: 'hacked' })).status,
        404
      );
      assert.equal((await request(app).delete(`/api/notes/${target}`).set(bearer(bob.token))).status, 404);
    });

    it('updates and deletes own notes', async () => {
      const [target] = noteIds;
      const updated = await request(app)
        .patch(`/api/notes/${target}`)
        .set(bearer(alice.token))
        .send({ title: 'Renamed' });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.note.title, 'Renamed');

      assert.equal((await request(app).delete(`/api/notes/${target}`).set(bearer(alice.token))).status, 204);
      assert.equal((await request(app).get(`/api/notes/${target}`).set(bearer(alice.token))).status, 404);
    });

    it('validates ids, pagination and empty updates', async () => {
      assert.equal((await request(app).get('/api/notes/not-an-id').set(bearer(alice.token))).status, 422);
      assert.equal((await request(app).get('/api/notes?limit=500').set(bearer(alice.token))).status, 422);
      assert.equal((await request(app).patch(`/api/notes/${noteIds[1]}`).set(bearer(alice.token)).send({})).status, 422);
    });
  });

  describe('admin', () => {
    it('is promoted outside the public API', async () => {
      await models.User.create({ username: 'root', email: 'root@example.com', password, role: 'admin' });
      const res = await request(app).post('/api/auth/login').send({ email: 'root@example.com', password });
      admin = { id: res.body.user._id, token: res.body.token };
      assert.equal(res.body.user.role, 'admin');
    });

    it('blocks regular users from admin routes', async () => {
      for (const path of ['/api/users', '/api/users/by-interests', '/api/notes/all']) {
        assert.equal((await request(app).get(path).set(bearer(alice.token))).status, 403, path);
      }
    });

    it('views everyone\'s notes, optionally filtered by author, but cannot edit them', async () => {
      const all = await request(app).get('/api/notes/all').set(bearer(admin.token));
      assert.equal(all.status, 200);
      assert.equal(all.body.pagination.total, 3);
      assert.ok(all.body.data[0].author.username);

      const onlyBob = await request(app).get(`/api/notes/all?author=${bob.id}`).set(bearer(admin.token));
      assert.equal(onlyBob.body.pagination.total, 1);

      const aliceNote = all.body.data.find((n) => n.author.username === 'alice');
      const read = await request(app).get(`/api/notes/${aliceNote._id}`).set(bearer(admin.token));
      assert.equal(read.status, 200);

      const edit = await request(app)
        .patch(`/api/notes/${aliceNote._id}`)
        .set(bearer(admin.token))
        .send({ title: 'admin edit' });
      assert.equal(edit.status, 404);
    });

    it('manages users: create, list, update, delete', async () => {
      const created = await request(app)
        .post('/api/users')
        .set(bearer(admin.token))
        .send({ username: 'carol', email: 'carol@example.com', password, interests: ['chess'] });
      assert.equal(created.status, 201);
      assert.equal(created.body.user.role, 'user');

      const list = await request(app).get('/api/users?limit=2').set(bearer(admin.token));
      assert.equal(list.body.data.length, 2);
      assert.equal(list.body.pagination.total, 4);
      assert.ok(list.body.data.every((u) => u.password === undefined));

      const updated = await request(app)
        .patch(`/api/users/${created.body.user._id}`)
        .set(bearer(admin.token))
        .send({ username: 'carol2', password: 'NewPassw0rd9' });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.user.username, 'carol2');
      const relog = await request(app)
        .post('/api/auth/login')
        .send({ email: 'carol@example.com', password: 'NewPassw0rd9' });
      assert.equal(relog.status, 200);

      assert.equal(
        (await request(app).delete(`/api/users/${created.body.user._id}`).set(bearer(admin.token))).status,
        204
      );
      assert.equal((await request(app).get(`/api/users/${created.body.user._id}`).set(bearer(admin.token))).status, 404);
    });

    it('cannot delete or demote itself', async () => {
      assert.equal((await request(app).delete(`/api/users/${admin.id}`).set(bearer(admin.token))).status, 400);
      const demote = await request(app).patch(`/api/users/${admin.id}`).set(bearer(admin.token)).send({ role: 'user' });
      assert.equal(demote.status, 400);
    });
  });

  describe('aggregations', () => {
    it('groups users by interest in one pipeline', async () => {
      const res = await request(app).get('/api/users/by-interests').set(bearer(admin.token));
      assert.equal(res.status, 200);

      const chess = res.body.data.find((g) => g.interest === 'chess');
      assert.equal(chess.count, 2);
      assert.deepEqual(chess.users.map((u) => u.username).sort(), ['alice', 'bob']);
      assert.equal(res.body.data.find((g) => g.interest === 'reading').count, 1);
      assert.equal(res.body.pagination.total, 2);

      const filtered = await request(app).get('/api/users/by-interests?interest=Reading').set(bearer(admin.token));
      assert.deepEqual(filtered.body.data.map((g) => g.interest), ['reading']);
    });

    it('returns a user\'s posts through $lookup with pagination metadata', async () => {
      for (const n of [1, 2, 3]) {
        await request(app).post('/api/posts').set(bearer(alice.token)).send({ title: `Post ${n}`, body: 'body' });
      }
      await request(app).post('/api/posts').set(bearer(bob.token)).send({ title: 'Bob post', body: 'body' });

      const res = await request(app).get(`/api/posts/user/${alice.id}?limit=2`);
      assert.equal(res.status, 200);
      assert.equal(res.body.user.username, 'alice');
      assert.deepEqual(res.body.data.map((p) => p.title), ['Post 3', 'Post 2']);
      assert.equal(res.body.pagination.total, 3);
      assert.equal(res.body.pagination.hasNextPage, true);

      const next = await request(app).get(`/api/posts/user/${alice.id}?limit=2&page=2`);
      assert.deepEqual(next.body.data.map((p) => p.title), ['Post 1']);

      const everyone = await request(app).get('/api/posts');
      assert.equal(everyone.body.pagination.total, 4);

      const missing = await request(app).get('/api/posts/user/64b64b64b64b64b64b64b64b');
      assert.equal(missing.status, 404);
    });
  });

  it('removes a deleted user\'s notes and posts', async () => {
    assert.equal((await request(app).delete(`/api/users/${bob.id}`).set(bearer(admin.token))).status, 204);
    assert.equal(await models.Note.countDocuments({ author: bob.id }), 0);
    assert.equal(await models.Post.countDocuments({ author: bob.id }), 0);
    assert.equal((await request(app).get('/api/notes').set(bearer(bob.token))).status, 401);
  });

  it('keeps indexes to the minimum required', async () => {
    const names = async (Model) => (await Model.collection.indexes()).map((i) => i.name).sort();

    assert.deepEqual(await names(models.User), ['_id_', 'email_1', 'interests_1']);
    assert.deepEqual(await names(models.Note), ['_id_', 'author_1__id_-1']);
    assert.deepEqual(await names(models.Post), ['_id_', 'author_1__id_-1']);
  });
});
