# Mirador Test Plan

## Automated Unit and Integration Tests

The backend Jest/Supertest suite covers:

- health check endpoint
- unauthenticated request rejection
- invalid login handling
- project create/read/update/delete
- task create/read/update/delete
- milestone create/read/update/delete
- team create/read/update/delete
- team invitation link creation, acceptance and decline
- project access through reusable team membership
- task comment create/read/update/delete
- role boundaries for team members and project managers

Run with:

```bash
cd server
npm test
```

## Static Analysis

Backend:

```bash
cd server
npm run lint
```

Frontend:

```bash
cd client
npm run lint
```

## Frontend Build Test

The production build confirms the React app compiles:

```bash
cd client
npm run build
```

## Manual System Test Cases

| ID | Scenario | Expected Result |
| --- | --- | --- |
| ST-01 | Register and log in as a user | User receives a token and reaches the dashboard |
| ST-02 | Create a project as admin | Project appears in the project list and dashboard count |
| ST-03 | Add members to a project | Selected members can view the project |
| ST-04 | Create a task as project manager | Task appears under the selected project |
| ST-05 | Assign task to team member | Team member can view assigned task |
| ST-06 | Create a milestone | Milestone appears in milestone page and dashboard |
| ST-07 | Add a task comment in one client | Another signed-in client refreshes after the socket event |
| ST-08 | Attempt restricted action as team member | API returns access denied and UI does not show manager-only forms |

## Known Local Limitation

In the Codex sandbox, `mongodb-memory-server` could not open a local port, so `npm test` was blocked before assertions ran. The suite is intended to run in a normal local shell and in GitHub Actions.
