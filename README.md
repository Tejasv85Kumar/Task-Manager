# Task Manager

> Full-stack web application built with **Node.js + Express** and a premium Vanilla JS frontend. Uses a custom **NoSQL JSON database** for zero-compilation deployment.

## 🚀 Features

- **Authentication** — JWT-based signup/login with bcrypt password hashing
- **Role-Based Access Control** — Admin vs Member permissions enforced on all API routes
- **Project Management** — Create, update, delete projects; manage team members per project
- **Task Tracking** — Full CRUD for tasks with status (To Do / In Progress / Done), priority, due dates, and assignees
- **Kanban Board** — Visual task board per project with colour-coded columns
- **Dashboard** — Real-time stats (total, in-progress, done, overdue) + recent tasks
- **Team Management** — Admin can view all users and change roles

## 🗂️ Project Structure

```
Assignment/
├── server.js              # Express server entry point
├── db.js                  # Custom NoSQL JSON Database Engine
├── middleware/
│   ├── auth.js            # JWT authentication middleware
│   └── roles.js           # RBAC middleware
├── routes/
│   ├── auth.js            # POST /api/auth/signup, /login, GET /me
│   ├── projects.js        # CRUD /api/projects + member management
│   ├── tasks.js           # CRUD /api/tasks + dashboard stats
│   └── users.js           # GET /api/users (admin only)
├── public/
│   ├── index.html         # SPA shell
│   ├── css/style.css      # Dark-mode premium design
│   └── js/app.js          # Vanilla JS SPA logic
├── package.json
├── Procfile               # Railway deploy
├── railway.json           # Railway config
└── .env.example           # Environment variables template
```

## ⚙️ Setup & Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env
# Edit .env and set a strong JWT_SECRET

# 3. Start the server
npm start
# Or for development with auto-reload:
npm run dev

# 4. Open browser at http://localhost:3000
```

## 🔑 API Endpoints

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| POST | /api/auth/signup | ❌ | — |
| POST | /api/auth/login | ❌ | — |
| GET | /api/auth/me | ✅ | Any |
| GET | /api/projects | ✅ | Any |
| POST | /api/projects | ✅ | Admin |
| GET | /api/projects/:id | ✅ | Member+ |
| PUT | /api/projects/:id | ✅ | Admin/Owner |
| DELETE | /api/projects/:id | ✅ | Admin |
| POST | /api/projects/:id/members | ✅ | Admin |
| DELETE | /api/projects/:id/members/:uid | ✅ | Admin |
| GET | /api/tasks | ✅ | Any |
| GET | /api/tasks/dashboard | ✅ | Any |
| POST | /api/tasks | ✅ | Admin |
| PUT | /api/tasks/:id | ✅ | Admin / Assignee |
| DELETE | /api/tasks/:id | ✅ | Admin |
| GET | /api/users | ✅ | Admin |
| PUT | /api/users/:id/role | ✅ | Admin |

## 🚢 Deploy to Railway

1. Push this folder to a GitHub repository
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables:
   - `JWT_SECRET` → any long random string
   - `NODE_ENV` → `production`
5. Railway auto-detects the `Procfile` and deploys

## 👥 Role Permissions

| Action | Admin | Member |
|--------|:-----:|:------:|
| Create/delete projects | ✅ | ❌ |
| Add/remove project members | ✅ | ❌ |
| Create/delete tasks | ✅ | ❌ |
| Update task status | ✅ | ✅ (own tasks only) |
| View dashboard | ✅ | ✅ |
| Manage team roles | ✅ | ❌ |
