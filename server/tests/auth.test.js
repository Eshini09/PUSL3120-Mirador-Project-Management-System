const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../src/models/User");
const { app } = require("../server");
const connectDB = require("../src/config/db");

let mongoServer;
let teamMemberToken;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();

    process.env.MONGODB_URI = mongoServer.getUri();

    await connectDB();

    const passwordHash = await bcrypt.hash(
        "TestPassword123",
        10
    );

    await User.create({
        name: "Test Team Member",
        email: "member@example.com",
        password: passwordHash,
        role: "TEAM_MEMBER"
    });

    const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
            email: "member@example.com",
            password: "TestPassword123"
        });

    teamMemberToken = loginResponse.body.token;
});

afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
});

describe("Authentication API", () => {
    test("GET /api/health returns server health status", async () => {
        const response = await request(app)
            .get("/api/health");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("OK");
    });

    test("GET /api/auth/me rejects unauthenticated requests", async () => {
        const response = await request(app)
            .get("/api/auth/me");

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

    test("TEAM_MEMBER cannot create a project", async () => {
        const response = await request(app)
            .post("/api/projects")
            .set("Authorization", `Bearer ${teamMemberToken}`)
            .send({
                name: "Unauthorized Project",
                description: "Should not be created",
                status: "PLANNING",
                startDate: "2026-08-20",
                dueDate: "2026-09-20",
                manager: "000000000000000000000000"
            });

        expect(response.statusCode).toBe(403);
        expect(response.body.message).toBe("Access denied");
    });

    test("TEAM_MEMBER cannot create a task", async () => {
        const response = await request(app)
            .post("/api/tasks")
            .set("Authorization", `Bearer ${teamMemberToken}`)
            .send({
                title: "Unauthorized Task",
                project: "000000000000000000000000"
            });

        expect(response.statusCode).toBe(403);
        expect(response.body.message).toBe("Access denied");
    });
});