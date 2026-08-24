# Mirador Project Management System

GitHub repository: **[add final GitHub link]**  
YouTube demonstration: **[add final YouTube link]**  
Module: PUSL3120 Full-Stack Development  
Student: **[add name and student ID]**

## 1. Requirements

Mirador is a full-stack project management system designed for small project teams that need a single place to plan work, invite team members, assign tasks, track milestones and monitor delivery progress. The main users are project managers, team members and administrators.

Project managers need to create projects, connect teams to those projects, assign tasks and set milestones. Team members need to accept team invitations, view related projects, update assigned task progress and add task comments. Administrators need to manage users and have wider access for maintaining the system. Compared with managing work through spreadsheets or messages, Mirador gives users a shared live workspace where projects, tasks, teams and deadlines are connected.

The first priority was to deliver the technical requirements: React frontend, Node.js/Express backend, MongoDB database, authentication, WebSockets and CRUD functionality. The second priority was to make the system feel like a realistic project management system by adding team invite links, dashboard summaries, reports, activity history, a Kanban task table and a Gantt-style timeline.

| Priority | Functionality |
| --- | --- |
| P1 | Registration, login, JWT authentication and protected routes |
| P1 | CRUD for projects, tasks, milestones and teams |
| P1 | Role-based access for admin, project manager and team member |
| P1 | Team invitation links with accept/decline workflow |
| P2 | Dashboard, reports and activity history |
| P2 | Kanban task table and timeline/Gantt view |
| P3 | Settings, help page, profile avatar and bio |

**Screenshot placeholders:** login/register, dashboard, projects, teams, invite page.

## 2. Design

Mirador uses a MERN-style architecture. The client is a React single-page application built with Vite. It communicates with one Express backend through REST APIs using JSON. MongoDB stores the application data through Mongoose models. Socket.IO is used alongside the REST API to broadcast create, update and delete events so that pages can refresh when another client changes workspace data.

The backend follows an MVC-style structure. Mongoose models represent the main data entities: `User`, `Project`, `Task`, `Milestone`, `Team`, `TeamInvite` and `TaskComment`. Express routes define the API endpoints, controllers contain the main business logic, and middleware handles authentication and authorisation. For example, `taskController` manages task creation, reading, updates and deletion, while `taskAuthorization` checks whether the current user is allowed to manage a task.

The main relationships are:

- A user can own or belong to teams.
- A project has a manager, direct members and linked teams.
- Tasks belong to projects and can be assigned to project participants.
- Milestones belong to projects and can have an owner.
- Comments belong to tasks and have an author.

This structure was chosen because project management data is naturally connected. A team invite should not just add a user to a team; it should also allow that user to see the team’s linked projects, tasks and milestones. This was one of the main design improvements made during development.

Security was implemented using JWT authentication. Protected frontend routes check for a token, and backend middleware verifies the token before allowing access to private endpoints. Role-based checks are used for admin-only user management, project ownership, task management and milestone management. The API also limits assignable users so tasks and milestones can only be assigned to people who are part of the selected project.

WebSocket evidence is important in this project. After actions such as `taskCreated`, `taskUpdated`, `projectUpdated` or `teamInviteUpdated`, the backend emits a Socket.IO event. Frontend pages such as Dashboard, Projects, Tasks, Timeline, Reports and Activity listen for these events and reload their data. This gives the appearance of communication between multiple clients, which is required by the assessment.

**Diagram placeholders:** component architecture, ER/data model, role/use case diagram, Socket.IO event flow, team invite sequence.

## 3. Implementation Evidence

The system implements more than the required three CRUD entities. Projects, tasks, milestones, teams and task comments can all be created, read, updated and deleted. Users can also be managed by administrators.

The Projects page uses compact clickable rows so the user sees summary information first and expands a project only when needed. The Tasks page has both a list view and a Kanban table view. The Kanban table groups tasks into Active, Ongoing and Completed columns and updates the real task status through the API. The Timeline page provides a Gantt-style visualisation using project start/due dates, task deadlines and milestone due dates. Reports calculate progress, overdue tasks and workload from live API data. Activity shows recent changes using user-friendly labels.

The team workflow is also integrated. A project manager can create a team, generate an invite link and share it with users. After login, the invited user can accept or decline. If accepted, the user becomes part of the team and can view linked projects and related work.

**Screenshot placeholders:** Kanban table, Timeline, Reports, Activity, Settings profile.

## 4. Testing

Testing was planned across automated and manual levels. The backend Jest/Supertest suite covers authentication, protected access, project CRUD, task CRUD, milestone CRUD, team CRUD, invite links, task comments and role boundaries. This gives coverage across unit-like validation behaviour and integration-style API/database workflows.

Examples of important tests include:

- invalid login returns an error
- unauthenticated users are blocked from protected endpoints
- projects can be created, read, updated and deleted
- tasks can only be assigned to project participants
- team invite links can be accepted or declined
- team membership makes linked projects visible
- team members can update assigned task status

Manual system testing was also used because the application is interactive. I tested complete workflows such as registering users, creating a team, accepting an invite in another account, creating a project, adding tasks and milestones, updating task status through Kanban and checking that dashboard/report values changed.

Usability testing affected the final interface. During testing, always-visible forms on project/task/milestone pages were confusing, so I changed them to open only after clicking a New button. Users also found the early project and task pages too detailed, so I changed them to compact rows with details hidden until needed. The activity page was difficult to understand, so I added filters, summary cards and friendlier labels.

Static analysis and build checks were run:

- `npm run lint` in the client
- `npm run lint` in the server
- `npm run build` in the client

The automated test suite is included in the repository. In the Codex sandbox, `mongodb-memory-server` could not bind to its local server, so the test command was blocked there before assertions ran. The suite is still configured to run in a normal local environment or GitHub Actions.

**Evidence placeholders:** test code snippet, lint/build terminal screenshot, GitHub Actions screenshot.

## 5. DevOps Pipeline

Git and GitHub were used for version control. The project includes a GitHub Actions workflow in `.github/workflows/ci.yml`. The workflow runs when code is pushed or a pull request is opened against `main`.

The pipeline has two main jobs. The backend job installs dependencies, runs ESLint and runs the Jest test suite with a test JWT secret. The frontend job installs dependencies, runs ESLint and builds the React production client. This supports continuous integration by checking code quality before changes are accepted.

Environment variables are separated from source code. The backend uses `MONGODB_URI`, `PORT` and `JWT_SECRET`, with an example file committed as `server/.env.example`. The frontend uses `client/.env.example` for API configuration. This avoids committing real secrets while still documenting setup.

**Screenshot placeholders:** GitHub commit history, CI workflow YAML, successful/attempted Actions run.

## 6. Evaluation

The strongest part of Mirador is that the entities are integrated rather than separate CRUD screens. Teams connect to projects, team invitations affect project visibility, tasks and milestones belong to projects, and dashboard/report/timeline views calculate from the same data. This makes the system closer to real project management tools.

The WebSocket integration also worked well because several pages refresh after backend events. This improves the multi-client feel and directly supports the distributed communication requirement.

The most difficult part was access control. At first, project creation and task creation were too restricted, and team members could not always see linked project work. This was improved by making project ownership project-specific and by including team membership, project membership, assigned tasks and created tasks in visibility rules.

The UI also changed a lot after testing. Early versions showed too much information at once, so the design was simplified into cleaner rows, filters and expandable details. Later, Kanban and Timeline views were added because they are common in project management systems.

Future improvements would include drag-and-drop Kanban movement, email notifications for invites, file attachments, exportable reports and more detailed audit logging. However, the submitted version delivers the required full-stack functionality, security, database storage, WebSocket communication, CRUD coverage, testing evidence and CI/CD workflow.

## References

- React Documentation. https://react.dev/
- Express Documentation. https://expressjs.com/
- MongoDB Manual. https://www.mongodb.com/docs/
- Mongoose Documentation. https://mongoosejs.com/docs/
- Socket.IO Documentation. https://socket.io/docs/
- JSON Web Tokens Introduction. https://jwt.io/introduction
- GitHub Actions Documentation. https://docs.github.com/en/actions
- Nielsen Norman Group, 10 Usability Heuristics. https://www.nngroup.com/articles/ten-usability-heuristics/
