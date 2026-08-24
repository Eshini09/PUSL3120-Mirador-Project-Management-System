const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = "test-secret-for-ci";

const User = require("../src/models/User");
const Project = require("../src/models/Project");
const Task = require("../src/models/Task");
const Milestone = require("../src/models/Milestone");
const TaskComment = require("../src/models/TaskComment");
const Team = require("../src/models/Team");
const { app } = require("../server");
const connectDB = require("../src/config/db");

let mongoServer;
let admin;
let projectManager;
let teamMember;
let adminToken;
let projectManagerToken;
let otherProjectManagerToken;
let teamMemberToken;

const futureDate = "2030-09-20";
const laterFutureDate = "2030-10-20";

const createUser = async (name, email, role) => {
    const password = "TestPassword123";
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
        name,
        email,
        password: passwordHash,
        role
    });

    const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
            email,
            password
        });

    return {
        user,
        token: loginResponse.body.token
    };
};

const authHeader = (token) => ({
    Authorization: `Bearer ${token}`
});

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
        instance: {
            ip: "127.0.0.1"
        }
    });

    process.env.MONGODB_URI = mongoServer.getUri();

    await connectDB();

    const adminAccount = await createUser(
        "Test Admin",
        "admin@example.com",
        "ADMIN"
    );

    const managerAccount = await createUser(
        "Test Project Manager",
        "manager@example.com",
        "PROJECT_MANAGER"
    );

    const otherManagerAccount = await createUser(
        "Other Project Manager",
        "other.manager@example.com",
        "PROJECT_MANAGER"
    );

    const memberAccount = await createUser(
        "Test Team Member",
        "member@example.com",
        "TEAM_MEMBER"
    );

    admin = adminAccount.user;
    projectManager = managerAccount.user;
    teamMember = memberAccount.user;

    adminToken = adminAccount.token;
    projectManagerToken = managerAccount.token;
    otherProjectManagerToken = otherManagerAccount.token;
    teamMemberToken = memberAccount.token;
});

afterAll(async () => {
    await mongoose.connection.close();

    if (mongoServer) {
        await mongoServer.stop();
    }
});

describe("Authentication API", () => {
    test("GET /api/health returns server health status", async () => {
        const response = await request(app).get("/api/health");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("OK");
    });

    test("GET /api/auth/me rejects unauthenticated requests", async () => {
        const response = await request(app).get("/api/auth/me");

        expect(response.statusCode).toBe(401);
        expect(response.body.message).toBe("Authentication required");
    });

    test("POST /api/auth/login rejects invalid credentials", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({
                email: "member@example.com",
                password: "WrongPassword123"
            });

        expect(response.statusCode).toBe(401);
        expect(response.body.message).toBe("Invalid email or password");
    });

    test("POST /api/auth/register allows project manager self-registration", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .send({
                name: "Registered Project Manager",
                email: "registered.manager@example.com",
                password: "TestPassword123",
                role: "PROJECT_MANAGER"
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.user.role).toBe("PROJECT_MANAGER");
    });

    test("POST /api/auth/register does not allow later users to self-register as admin", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .send({
                name: "Blocked Admin",
                email: "blocked.admin@example.com",
                password: "TestPassword123",
                role: "ADMIN"
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.user.role).toBe("TEAM_MEMBER");
    });

    test("ADMIN can appoint a team member as project manager", async () => {
        const response = await request(app)
            .patch(`/api/users/${teamMember._id}/role`)
            .set(authHeader(adminToken))
            .send({
                role: "PROJECT_MANAGER"
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.user.role).toBe("PROJECT_MANAGER");

        await User.findByIdAndUpdate(teamMember._id, {
            role: "TEAM_MEMBER"
        });
    });

    test("TEAM_MEMBER cannot appoint user roles", async () => {
        const response = await request(app)
            .patch(`/api/users/${projectManager._id}/role`)
            .set(authHeader(teamMemberToken))
            .send({
                role: "ADMIN"
            });

        expect(response.statusCode).toBe(403);
        expect(response.body.message).toBe("Access denied");
    });

    test("TEAM_MEMBER cannot view the admin user directory", async () => {
        const response = await request(app)
            .get("/api/users")
            .set(authHeader(teamMemberToken));

        expect(response.statusCode).toBe(403);
        expect(response.body.message).toBe("Access denied");
    });

    test("PROJECT_MANAGER can load assignable non-admin users", async () => {
        const response = await request(app)
            .get("/api/users/assignable")
            .set(authHeader(projectManagerToken));

        expect(response.statusCode).toBe(200);
        expect(
            response.body.users.every(
                (listedUser) => listedUser.role !== "ADMIN"
            )
        ).toBe(true);
    });
});

describe("Project CRUD and authorization", () => {
    test("ADMIN can create, update, read and delete a project", async () => {
        const createResponse = await request(app)
            .post("/api/projects")
            .set(authHeader(adminToken))
            .send({
                name: "Assessment Evidence Portal",
                description: "Project used to validate project CRUD.",
                status: "PLANNING",
                startDate: futureDate,
                dueDate: laterFutureDate,
                manager: projectManager._id
            });

        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.body.project.name).toBe(
            "Assessment Evidence Portal"
        );

        const projectId = createResponse.body.project._id;

        const updateResponse = await request(app)
            .put(`/api/projects/${projectId}`)
            .set(authHeader(adminToken))
            .send({
                status: "ACTIVE"
            });

        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.project.status).toBe("ACTIVE");

        const getResponse = await request(app)
            .get(`/api/projects/${projectId}`)
            .set(authHeader(adminToken));

        expect(getResponse.statusCode).toBe(200);
        expect(getResponse.body.project._id).toBe(projectId);

        const deleteResponse = await request(app)
            .delete(`/api/projects/${projectId}`)
            .set(authHeader(adminToken));

        expect(deleteResponse.statusCode).toBe(200);

        const deletedProject = await Project.findById(projectId);
        expect(deletedProject).toBeNull();
    });

    test("TEAM_MEMBER can create and manage their own project", async () => {
        const response = await request(app)
            .post("/api/projects")
            .set(authHeader(teamMemberToken))
            .send({
                name: "Unauthorized Project",
                description: "Should not be created",
                status: "PLANNING",
                startDate: futureDate,
                dueDate: laterFutureDate,
                members: []
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.project.manager.toString()).toBe(
            teamMember._id.toString()
        );

        const deleteResponse = await request(app)
            .delete(`/api/projects/${response.body.project._id}`)
            .set(authHeader(teamMemberToken));

        expect(deleteResponse.statusCode).toBe(200);
    });

    test("Project can include a team so team members can see it", async () => {
        const team = await Team.create({
            name: "Assessment Team",
            description: "Reusable team for project access.",
            owner: projectManager._id,
            members: [projectManager._id, teamMember._id]
        });

        const createResponse = await request(app)
            .post("/api/projects")
            .set(authHeader(projectManagerToken))
            .send({
                name: "Team Project",
                description: "Project shared through a team.",
                status: "ACTIVE",
                startDate: futureDate,
                dueDate: laterFutureDate,
                teams: [team._id]
            });

        expect(createResponse.statusCode).toBe(201);

        const listResponse = await request(app)
            .get("/api/projects")
            .set(authHeader(teamMemberToken));

        expect(listResponse.statusCode).toBe(200);
        expect(
            listResponse.body.projects.some(
                (project) => project.name === "Team Project"
            )
        ).toBe(true);
    });
});

describe("Team CRUD and authorization", () => {
    test("User can create, update and delete a team they own", async () => {
        const createResponse = await request(app)
            .post("/api/teams")
            .set(authHeader(teamMemberToken))
            .send({
                name: "Personal Planning Team",
                description: "A reusable planning group.",
                members: [projectManager._id]
            });

        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.body.team.name).toBe(
            "Personal Planning Team"
        );

        const teamId = createResponse.body.team._id;

        const updateResponse = await request(app)
            .put(`/api/teams/${teamId}`)
            .set(authHeader(teamMemberToken))
            .send({
                name: "Updated Planning Team"
            });

        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.team.name).toBe(
            "Updated Planning Team"
        );

        const deleteResponse = await request(app)
            .delete(`/api/teams/${teamId}`)
            .set(authHeader(teamMemberToken));

        expect(deleteResponse.statusCode).toBe(200);
    });

    test("Team owner can create an invite link and another user can accept", async () => {
        const createTeamResponse = await request(app)
            .post("/api/teams")
            .set(authHeader(projectManagerToken))
            .send({
                name: "Invite Link Team",
                description: "Team joined through a link."
            });

        expect(createTeamResponse.statusCode).toBe(201);

        const inviteResponse = await request(app)
            .post(
                `/api/teams/${createTeamResponse.body.team._id}/invites`
            )
            .set(authHeader(projectManagerToken));

        expect(inviteResponse.statusCode).toBe(201);
        expect(inviteResponse.body.invite.token).toBeTruthy();

        const acceptResponse = await request(app)
            .post(
                `/api/team-invites/${inviteResponse.body.invite.token}/accept`
            )
            .set(authHeader(teamMemberToken));

        expect(acceptResponse.statusCode).toBe(200);
    });
});

describe("Task CRUD and authorization", () => {
    test("PROJECT_MANAGER can create, update, read and delete a task", async () => {
        const project = await Project.create({
            name: "Task CRUD Project",
            description: "Project used to validate task CRUD.",
            status: "ACTIVE",
            startDate: futureDate,
            dueDate: laterFutureDate,
            manager: projectManager._id,
            members: [teamMember._id],
            createdBy: admin._id
        });

        const createResponse = await request(app)
            .post("/api/tasks")
            .set(authHeader(projectManagerToken))
            .send({
                title: "Write testing section",
                description: "Document automated test evidence.",
                status: "TODO",
                priority: "HIGH",
                dueDate: futureDate,
                project: project._id,
                assignedTo: teamMember._id
            });

        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.body.task.title).toBe(
            "Write testing section"
        );

        const taskId = createResponse.body.task._id;

        const getResponse = await request(app)
            .get(`/api/tasks/${taskId}`)
            .set(authHeader(teamMemberToken));

        expect(getResponse.statusCode).toBe(200);
        expect(getResponse.body.task._id).toBe(taskId);

        const updateResponse = await request(app)
            .put(`/api/tasks/${taskId}`)
            .set(authHeader(projectManagerToken))
            .send({
                status: "IN_PROGRESS"
            });

        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.task.status).toBe("IN_PROGRESS");

        const memberStatusResponse = await request(app)
            .put(`/api/tasks/${taskId}`)
            .set(authHeader(teamMemberToken))
            .send({
                status: "COMPLETED"
            });

        expect(memberStatusResponse.statusCode).toBe(200);
        expect(memberStatusResponse.body.task.status).toBe("COMPLETED");

        const restrictedMemberUpdateResponse = await request(app)
            .put(`/api/tasks/${taskId}`)
            .set(authHeader(teamMemberToken))
            .send({
                title: "Changed by team member"
            });

        expect(restrictedMemberUpdateResponse.statusCode).toBe(403);

        const commentResponse = await request(app)
            .post("/api/comments")
            .set(authHeader(teamMemberToken))
            .send({
                task: taskId,
                body: "I have started this task."
            });

        expect(commentResponse.statusCode).toBe(201);
        expect(commentResponse.body.comment.body).toBe(
            "I have started this task."
        );

        const commentId = commentResponse.body.comment._id;

        const getCommentsResponse = await request(app)
            .get("/api/comments")
            .set(authHeader(projectManagerToken));

        expect(getCommentsResponse.statusCode).toBe(200);
        expect(
            getCommentsResponse.body.comments.some(
                (comment) => comment._id === commentId
            )
        ).toBe(true);

        const updateCommentResponse = await request(app)
            .put(`/api/comments/${commentId}`)
            .set(authHeader(teamMemberToken))
            .send({
                body: "I have finished the first draft."
            });

        expect(updateCommentResponse.statusCode).toBe(200);
        expect(updateCommentResponse.body.comment.body).toBe(
            "I have finished the first draft."
        );

        const deleteCommentResponse = await request(app)
            .delete(`/api/comments/${commentId}`)
            .set(authHeader(teamMemberToken));

        expect(deleteCommentResponse.statusCode).toBe(200);

        const deletedComment = await TaskComment.findById(commentId);
        expect(deletedComment).toBeNull();

        const blockedMemberDeleteResponse = await request(app)
            .delete(`/api/tasks/${taskId}`)
            .set(authHeader(teamMemberToken));

        expect(blockedMemberDeleteResponse.statusCode).toBe(403);

        const deleteResponse = await request(app)
            .delete(`/api/tasks/${taskId}`)
            .set(authHeader(projectManagerToken));

        expect(deleteResponse.statusCode).toBe(200);

        const deletedTask = await Task.findById(taskId);
        expect(deletedTask).toBeNull();
    });

    test("TEAM_MEMBER can create a task in a project they manage", async () => {
        const project = await Project.create({
            name: "Member Owned Project",
            description: "Project owned by a regular user.",
            status: "ACTIVE",
            startDate: futureDate,
            dueDate: laterFutureDate,
            manager: teamMember._id,
            createdBy: teamMember._id
        });

        const response = await request(app)
            .post("/api/tasks")
            .set(authHeader(teamMemberToken))
            .send({
                title: "Plan my own work",
                project: project._id
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.task.title).toBe("Plan my own work");
    });
});

describe("Milestone CRUD and authorization", () => {
    test("PROJECT_MANAGER can create, update, read and delete a milestone", async () => {
        const project = await Project.create({
            name: "Milestone CRUD Project",
            description: "Project used to validate milestone CRUD.",
            status: "ACTIVE",
            startDate: futureDate,
            dueDate: laterFutureDate,
            manager: projectManager._id,
            members: [teamMember._id],
            createdBy: admin._id
        });

        await Task.create({
            title: "Assigned task for milestone visibility",
            description: "Lets the team member view the project milestone.",
            status: "TODO",
            priority: "MEDIUM",
            dueDate: futureDate,
            project: project._id,
            assignedTo: teamMember._id,
            createdBy: projectManager._id
        });

        const createResponse = await request(app)
            .post("/api/milestones")
            .set(authHeader(projectManagerToken))
            .send({
                title: "Referral submission ready",
                description: "All report and video evidence is complete.",
                status: "PLANNED",
                dueDate: futureDate,
                project: project._id,
                owner: teamMember._id
            });

        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.body.milestone.title).toBe(
            "Referral submission ready"
        );

        const milestoneId = createResponse.body.milestone._id;

        const memberReadResponse = await request(app)
            .get(`/api/milestones/${milestoneId}`)
            .set(authHeader(teamMemberToken));

        expect(memberReadResponse.statusCode).toBe(200);
        expect(memberReadResponse.body.milestone._id).toBe(milestoneId);

        const updateResponse = await request(app)
            .put(`/api/milestones/${milestoneId}`)
            .set(authHeader(projectManagerToken))
            .send({
                status: "ACHIEVED"
            });

        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.milestone.status).toBe("ACHIEVED");

        const blockedUpdateResponse = await request(app)
            .put(`/api/milestones/${milestoneId}`)
            .set(authHeader(otherProjectManagerToken))
            .send({
                status: "MISSED"
            });

        expect(blockedUpdateResponse.statusCode).toBe(403);

        const deleteResponse = await request(app)
            .delete(`/api/milestones/${milestoneId}`)
            .set(authHeader(projectManagerToken));

        expect(deleteResponse.statusCode).toBe(200);

        const deletedMilestone = await Milestone.findById(milestoneId);
        expect(deletedMilestone).toBeNull();
    });

    test("TEAM_MEMBER can create a milestone in a project they manage", async () => {
        const project = await Project.create({
            name: "Member Milestone Project",
            description: "Project owned by a regular user.",
            status: "ACTIVE",
            startDate: futureDate,
            dueDate: laterFutureDate,
            manager: teamMember._id,
            createdBy: teamMember._id
        });

        const response = await request(app)
            .post("/api/milestones")
            .set(authHeader(teamMemberToken))
            .send({
                title: "Personal delivery checkpoint",
                dueDate: futureDate,
                project: project._id
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.milestone.title).toBe(
            "Personal delivery checkpoint"
        );
    });
});
