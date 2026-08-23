# Mirador Project Management System

Mirador is a full-stack project management system built with React, Node.js, Express, MongoDB, Mongoose and Socket.IO. It supports role-based access for administrators, project managers and team members.

## Core Features

- Registration and login with JWT authentication.
- Role-based authorization for `ADMIN`, `PROJECT_MANAGER` and `TEAM_MEMBER`.
- Any signed-in user can create a project and becomes that project's manager.
- Full CRUD for projects, tasks and milestones.
- Team CRUD for creating reusable groups of people.
- Invite links that let users accept or decline joining a team.
- Admin-only account management for appointing admins and project managers.
- Scoped assignable-user lists for project and task forms instead of a public user directory.
- Project membership through individual members, reusable teams, project managers and assigned task owners.
- Task comments for collaboration between users.
- Real-time refresh events through WebSockets for projects, tasks, milestones and comments.
- Dashboard summaries for project status, task progress, milestone status and deadlines.

## Architecture

- `client/`: React single-page application built with Vite.
- `server/`: Express API server, Socket.IO server and Mongoose data models.
- MongoDB stores users, projects, tasks, milestones and task comments.
- REST APIs move structured JSON data between client and server.
- Socket.IO broadcasts create/update/delete events so multiple clients can see changes quickly.

## Local Setup

1. Install backend dependencies:

```bash
cd server
npm ci
```

2. Create `server/.env` from `server/.env.example`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/mirador
PORT=5001
JWT_SECRET=replace-this-with-a-long-secret
```

3. Start the backend:

```bash
npm run lint
node server.js
```

4. Install and start the frontend in another terminal:

```bash
cd client
npm ci
cp .env.example .env
npm run dev
```

5. Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Quality Checks

Backend:

```bash
cd server
npm run lint
npm test
```

Frontend:

```bash
cd client
npm run lint
npm run build
```

## Demo Flow

1. Register users for each role.
2. Log in as an admin or project manager.
3. Create a project and add team members.
4. Create tasks and assign them to team members.
5. Create milestones for the project.
6. Open a second browser/client session as another user.
7. Add or update a task comment and show the other client refreshing from the Socket.IO event.
8. Show the dashboard reflecting projects, tasks, milestones and deadlines.
