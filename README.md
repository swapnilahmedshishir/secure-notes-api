# Secure Notes API

REST API for a note-taking app: JWT auth, bcrypt password hashing, role-based access (`user` / `admin`),
paginated lists, explicit MongoDB indexes, and two aggregation pipelines.

Stack: Node.js (>= 20), Express 5, MongoDB + Mongoose, zod for validation.

## Run it

```bash
npm install
cp .env.example .env        # set MONGODB_URI and a JWT_SECRET of 32+ characters
npm run seed:admin          # creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm start                   # or: npm run dev
```

`npm test` runs the integration suite against an in-memory MongoDB.
`npm run explain` prints which index each query/pipeline uses on your real database (run it after adding some data).

## Structure

```
src/
  config/       env validation, mongoose connection
  models/       User, Note, Post (all indexes declared with schema.index)
  middleware/   authenticate, requireRole, validate, errorHandler
  validators/   zod schemas per resource
  controllers/  request handlers
  routes/       express routers
  utils/        ApiError, JWT helpers, pagination helpers
scripts/        seedAdmin, explainQueries
test/           integration tests
```

## Endpoints

All list endpoints accept `?page=1&limit=10` (limit max 100) and respond with `{ data, pagination }`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | Sign up (always role `user`) |
| POST | `/api/auth/login` | public | Get a JWT |
| GET | `/api/auth/me` | any user | Own profile |
| POST | `/api/notes` | user, admin | Create a note |
| GET | `/api/notes` | user, admin | List **own** notes |
| GET | `/api/notes/all?author=<id>` | admin | List everyone's notes |
| GET | `/api/notes/:id` | owner, admin | Read a note |
| PATCH | `/api/notes/:id` | owner | Update a note |
| DELETE | `/api/notes/:id` | owner | Delete a note |
| POST | `/api/users` | admin | Add a user (can set role) |
| GET | `/api/users` | admin | List all users |
| GET | `/api/users/:id` | admin | Read a user |
| PATCH | `/api/users/:id` | admin | Update a user |
| DELETE | `/api/users/:id` | admin | Remove a user (and their notes/posts) |
| GET | `/api/users/by-interests?interest=chess` | admin | **Scenario 1** — users grouped by interest |
| POST | `/api/posts` | user, admin | Create a post |
| GET | `/api/posts` | public | List all posts |
| GET | `/api/posts/user/:id` | public | **Scenario 2** — all posts of one user |

Send the token as `Authorization: Bearer <jwt>`.

## Indexes

Four explicit indexes, every one tied to a query:

| Collection | Index | Used by |
| --- | --- | --- |
| `users` | `{ email: 1 }` unique | login lookup, email uniqueness |
| `users` | `{ interests: 1 }` (multikey) | Scenario 1 `$match` |
| `notes` | `{ author: 1, _id: -1 }` | "my notes" list, admin filter by author, cascade delete |
| `posts` | `{ author: 1, _id: -1 }` | Scenario 2 `$lookup` join key + newest-first sort, cascade delete |

Everything else rides on the default `_id` index: fetching a note/user by id, the auth middleware's user
load, the admin users list, the admin all-notes list, and the global posts list. Lists sort by `_id: -1`
(ObjectIds are time-ordered), so no separate `createdAt` index is needed.
`username` is deliberately not unique/indexed because no query or requirement depends on it.

## Aggregations

**Scenario 1 – `GET /api/users/by-interests`** (`user.controller.js#groupByInterests`)
One `User.aggregate()` call: `$match` → `$unwind` → `$group` → `$sort` → `$facet` (page of groups + total).
The leading `$match` is what the multikey index serves: with `?interest=` it is an exact index lookup; without it,
it skips users that have no interests. The full unfiltered view still has to read every user that has interests,
which no index can avoid because the grouped output includes user fields.

**Scenario 2 – `GET /api/posts/user/:id`** (`post.controller.js#listPostsByUser`)
One pipeline on `users`: `$match` by `_id`, a single correlated `$lookup` into `posts` (match on
`author`, sort newest first) and a `$project` with `$size` for the total and `$slice` for the page.
The lookup equality match on `author` uses `{ author: 1, _id: -1 }`.

## Design decisions

- Roles inherit: `requireRole('user')` admits admins too.
- Ownership is strict: admins can *read* all notes but only edit/delete their own, matching the brief.
  Non-owners get `404` rather than `403` so note ids can't be probed.
- The authenticated user is reloaded on every request, so deleting a user or changing a role takes effect immediately.
- Registration can never set a role; admins are created with `seed:admin` or by another admin via `POST /api/users`.
  Admins can't delete or demote themselves.
- Deleting a user also deletes their notes and posts.
- Input is validated with strict zod schemas (unknown fields are rejected), Mongoose `sanitizeFilter` is on,
  and login/register are rate limited. Login does a dummy bcrypt compare for unknown emails.
- Unfiltered totals use `estimatedDocumentCount()` (metadata, O(1)); filtered totals use `countDocuments()`.
