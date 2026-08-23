# PUSL3120 Assessment Checklist

## Software Evidence

- React frontend: `client/`
- Node.js/Express backend: `server/`
- MongoDB/Mongoose database models: `User`, `Project`, `Task`, `Milestone`, `TaskComment`
- WebSockets: Socket.IO create/update/delete events for projects, tasks, milestones and comments
- Security: registration, login, JWT authentication and role authorization
- Admin-only user management and scoped assignable-user lookup
- Project-specific ownership so any user can create and plan their own project
- Team/group membership with invite links and accept/decline workflow
- CRUD entities: projects, tasks, milestones and teams

## Report Evidence To Include

- GitHub repository link on the first page.
- YouTube video link on the first page.
- Requirements by user role: admin, project manager, team member.
- Component architecture diagram showing React client, Express API, Socket.IO and MongoDB.
- Data model or class diagram for users, projects, tasks, milestones and comments.
- Explanation of MVC-style separation through routes, controllers, models and middleware.
- Testing section with examples from `server/tests/auth.test.js`.
- CI/CD section with `.github/workflows/ci.yml`.
- Evaluation comparing planned and delivered functionality.

## Video Evidence To Show

- Sign in and protected dashboard.
- Project CRUD with team members.
- Task CRUD with assignment.
- Milestone CRUD.
- Task comments updating between two browser sessions.
- Automated checks or GitHub Actions workflow.
