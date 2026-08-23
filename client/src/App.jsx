import { useState } from "react";
import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
    useNavigate
} from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import ActivityPage from "./pages/ActivityPage";
import HelpPage from "./pages/HelpPage";
import MilestonesPage from "./pages/MilestonesPage";
import ProjectsPage from "./pages/ProjectsPage";
import RegisterPage from "./pages/RegisterPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import TasksPage from "./pages/TasksPage";
import UsersPage from "./pages/UsersPage";
import TeamsPage from "./pages/TeamsPage";
import TeamInvitePage from "./pages/TeamInvitePage";

import ProtectedLayout from "./components/ProtectedLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { apiUrl } from "./api";

import "./App.css";

function LoginPage() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);

    const handleLogin = async (event) => {
        event.preventDefault();

        setMessage("Signing in...");
        setIsError(false);

        try {
            const response = await fetch(
                apiUrl("/api/auth/login"),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setIsError(true);
                setMessage(data.message || "Login failed");
                return;
            }

            localStorage.setItem("token", data.token);

            const pendingRedirect =
                localStorage.getItem("pendingRedirect");

            if (pendingRedirect) {
                localStorage.removeItem("pendingRedirect");
                navigate(pendingRedirect);
            } else {
                navigate("/dashboard");
            }
        } catch (error) {
            console.error("Login error:", error);
            setIsError(true);
            setMessage("Unable to connect to the server");
        }
    };

    return (
        <main className="login-page">
            <section className="brand-panel">
                <div className="brand-content">
                    <span className="brand-mark">M</span>

                    <p className="eyebrow">
                        PROJECT MANAGEMENT SYSTEM
                    </p>

                    <h1>Mirador</h1>

                    <p className="brand-description">
                        Plan work, manage projects, and keep your team moving
                        forward.
                    </p>

                    <div className="brand-line" />
                </div>
            </section>

            <section className="form-panel">
                <div className="login-card">
                    <div className="login-header">
                        <p className="form-eyebrow">WELCOME BACK</p>

                        <h2>Sign in</h2>

                        <p>
                            Access your Mirador workspace.
                        </p>
                    </div>

                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label htmlFor="email">Email</label>

                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                placeholder="you@example.com"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>

                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="login-button"
                        >
                            Sign in
                        </button>
                    </form>

                    {message && (
                        <p
                            className={`login-message ${
                                isError ? "error" : "success"
                            }`}
                        >
                            {message}
                        </p>
                    )}

                    <p className="auth-switch">
                        Don't have an account?{" "}
                        <button
                            type="button"
                            className="auth-link"
                            onClick={() => navigate("/register")}
                        >
                            Create one
                        </button>
                    </p>
                </div>
            </section>
        </main>
    );
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public routes */}
                <Route
                    path="/"
                    element={<LoginPage />}
                />

                <Route
                    path="/register"
                    element={<RegisterPage />}
                />

                <Route
                    path="/team-invites/:token"
                    element={<TeamInvitePage />}
                />

                {/* Protected application routes */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<ProtectedLayout />}>
                        <Route
                            path="/dashboard"
                            element={<DashboardPage />}
                        />

                        <Route
                            path="/projects"
                            element={<ProjectsPage />}
                        />

                        <Route
                            path="/tasks"
                            element={<TasksPage />}
                        />

                        <Route
                            path="/teams"
                            element={<TeamsPage />}
                        />

                        <Route
                            path="/milestones"
                            element={<MilestonesPage />}
                        />

                        <Route
                            path="/reports"
                            element={<ReportsPage />}
                        />

                        <Route
                            path="/activity"
                            element={<ActivityPage />}
                        />

                        <Route
                            path="/settings"
                            element={<SettingsPage />}
                        />

                        <Route
                            path="/help"
                            element={<HelpPage />}
                        />

                        <Route
                            path="/users"
                            element={<UsersPage />}
                        />
                    </Route>
                </Route>

                {/* Unknown route */}
                <Route
                    path="*"
                    element={<Navigate to="/" replace />}
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
