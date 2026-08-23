# Mirador Project Management System

This is my PUSL3120 full-stack project. I built Mirador as a project
management system for planning projects, creating teams, assigning tasks,
tracking milestones and checking progress from one workspace.

The system uses React for the frontend, Node.js/Express for the backend,
MongoDB with Mongoose for storage, and Socket.IO for real-time updates.

## Main Features

- User registration and login using JWT authentication.
- Role-based access for admins, project managers and team members.
- Project CRUD with manager, members, teams, dates and project status.
- Task CRUD with assignee, priority, due date and status.
- Milestone CRUD linked to projects.
- Team CRUD with reusable teams.
- Team invite links where invited users can accept or decline after login.
- Comments/notes on tasks.
- Dashboard with live project, task and milestone summaries.
- Kanban view for tasks using Active, Ongoing and Completed columns.
- Timeline/Gantt-style view showing projects, task deadlines and milestones.
- Reports page for progress, overdue work and workload.
- Activity page for recent project, task, milestone and team changes.
- Settings page with profile avatar colour and bio.
- Help page with simple usage guidance.
- Admin user management page.
- Socket.IO events refresh the workspace after create/update/delete actions.

## Folder Structure

```text
Mirador/
  client/      React + Vite frontend
  server/      Express API, Socket.IO and MongoDB models
  .github/     GitHub Actions workflow
```

## Main Technologies

- React
- React Router
- Node.js
- Express
- MongoDB
- Mongoose
- Socket.IO
- Jest and Supertest
- ESLint
- GitHub Actions

## How To Run Locally

Start MongoDB first. I used a local MongoDB database during development.

Backend:

```bash
cd server
npm ci
cp .env.example .env
node server.js
```

Example `server/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/mirador
PORT=5001
JWT_SECRET=replace-this-with-a-secret-key
```

Frontend, in another terminal:

```bash
cd client
npm ci
cp .env.example .env
npm run dev
```

The frontend normally runs at:

```text
http://localhost:5173
```

## User Roles

- `ADMIN`: can manage users and has access across the system.
- `PROJECT_MANAGER`: can create/manage projects they are responsible for.
- `TEAM_MEMBER`: can join teams, view related projects and update assigned task status.

The first registered user becomes the admin. Later users can register as project
manager or team member.

## CRUD Entities

The project includes CRUD for more than the minimum requirement:

- Projects
- Tasks
- Milestones
- Teams
- Task comments
- Users/admin role management

## Real-Time Features

Socket.IO is used so that updates are broadcast after actions such as:

- project created/updated/deleted
- task created/updated/deleted
- milestone created/updated/deleted
- team created/updated/deleted
- team invite updated
- comment created/updated/deleted

This is used to refresh pages like Dashboard, Tasks, Projects, Reports,
Timeline and Activity.

## Testing And Checks

Backend lint:

```bash
cd server
npm run lint
```

Backend tests:

```bash
cd server
npm test
```

Frontend lint:

```bash
cd client
npm run lint
```

Frontend production build:

```bash
cd client
npm run build
```

The backend tests are written with Jest and Supertest. They cover authentication,
CRUD operations, team invites, access control and comments. In the Codex sandbox,
`mongodb-memory-server` could not open its local server, so I used lint/build
checks here and kept the test suite ready to run locally or in GitHub Actions.

## CI/CD

The GitHub Actions workflow is in:

```text
.github/workflows/ci.yml
```

It runs backend lint/tests and frontend lint/build when code is pushed or a pull
request is opened against `main`.

## Demo Flow For The Video

This is the route I plan to use in the demo video:

1. Register/login and show the dashboard.
2. Create a team and generate an invite link.
3. Accept the invite as another user.
4. Create a project and link the team.
5. Create tasks and milestones for the project.
6. Show the task list and Kanban table view.
7. Update a task status and show the change.
8. Show the Timeline page with project bars and milestone markers.
9. Show Reports and Activity.
10. Show Settings profile avatar/bio.
11. Briefly show tests/lint/build or GitHub Actions evidence.

## Notes

I tried to keep the system close to common project management tools. The main
focus was not only CRUD, but making the different parts work together: teams
connect to projects, projects contain tasks and milestones, task changes affect
reports/dashboard, and users only see work that is related to them.
