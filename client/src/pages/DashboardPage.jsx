import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function DashboardPage() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [projectCount, setProjectCount] = useState(0);
    const [taskCount, setTaskCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadDashboard = async () => {
            const token = localStorage.getItem("token");

            if (!token) {
                navigate("/");
                return;
            }

            try {
                const headers = {
                    Authorization: `Bearer ${token}`
                };

                const [userResponse, projectResponse, taskResponse] =
                    await Promise.all([
                        fetch("http://localhost:5001/api/auth/me", {
                            headers
                        }),
                        fetch("http://localhost:5001/api/projects", {
                            headers
                        }),
                        fetch("http://localhost:5001/api/tasks", {
                            headers
                        })
                    ]);

                if (
                    userResponse.status === 401 ||
                    projectResponse.status === 401 ||
                    taskResponse.status === 401
                ) {
                    localStorage.removeItem("token");
                    navigate("/");
                    return;
                }

                const userData = await userResponse.json();
                const projectData = await projectResponse.json();
                const taskData = await taskResponse.json();

                setUser(userData.user);
                setProjectCount(projectData.projects?.length || 0);
                setTaskCount(taskData.tasks?.length || 0);
            } catch (requestError) {
                console.error("Dashboard loading error:", requestError);
                setError("Unable to load dashboard data.");
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/");
    };

    if (loading) {
        return (
            <main className="dashboard-page dashboard-loading">
                <p>Loading your workspace...</p>
            </main>
        );
    }

    return (
        <main className="dashboard-page">
            <aside className="dashboard-sidebar">
                <div>
                    <div className="sidebar-brand">
                        <span className="sidebar-mark">M</span>
                        <span>Mirador</span>
                    </div>

                    <nav className="dashboard-nav">
                        <Link to="/dashboard" className="nav-item active">
                            Dashboard
                        </Link>

                        <Link to="/projects" className="nav-item">
                            Projects
                        </Link>

                        <Link to="/tasks" className="nav-item">
                            Tasks
                        </Link>
                    </nav>
                </div>

                <button
                    type="button"
                    className="sidebar-logout"
                    onClick={handleLogout}
                >
                    Sign out
                </button>
            </aside>

            <section className="dashboard-main">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-eyebrow">WORKSPACE</p>

                        <h1>Dashboard</h1>

                        <p className="dashboard-welcome">
                            Welcome back, {user?.name}.
                        </p>
                    </div>

                    <div className="user-badge">
                        {user?.role}
                    </div>
                </header>

                {error && (
                    <div className="dashboard-error">
                        {error}
                    </div>
                )}

                <section className="dashboard-summary">
                    <article className="summary-card">
                        <span>Projects</span>
                        <strong>{projectCount}</strong>
                        <Link to="/projects">View projects →</Link>
                    </article>

                    <article className="summary-card">
                        <span>Tasks</span>
                        <strong>{taskCount}</strong>
                        <Link to="/tasks">View tasks →</Link>
                    </article>

                    <article className="summary-card highlight">
                        <span>Your role</span>
                        <strong>{user?.role || "-"}</strong>
                        <small>Access based on your permissions</small>
                    </article>
                </section>

                <section className="dashboard-panel">
                    <p className="panel-label">MIRADOR WORKSPACE</p>

                    <h2>
                        Keep projects moving.
                    </h2>

                    <p>
                        Manage projects, organise tasks and keep your team
                        aligned from one workspace.
                    </p>

                    <div className="dashboard-actions">
                        <Link
                            to="/projects"
                            className="dashboard-action primary"
                        >
                            Manage projects
                        </Link>

                        <Link
                            to="/tasks"
                            className="dashboard-action secondary"
                        >
                            Manage tasks
                        </Link>
                    </div>
                </section>
            </section>
        </main>
    );
}

export default DashboardPage;