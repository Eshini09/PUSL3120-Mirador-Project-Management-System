import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "../api";

const getInitials = (name = "") =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "M";

function ProtectedLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem("token");

        if (!token) {
            return;
        }

        fetch(apiUrl("/api/auth/me"), {
            headers: {
                Authorization: `Bearer ${token}`
            },
            cache: "no-store"
        })
            .then((response) => response.json())
            .then((data) => {
                setUser(data.user);
            })
            .catch(() => {
                setUser(null);
            });
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/");
    };

    return (
        <main className="dashboard-page">
            <aside className="dashboard-sidebar">
                <div>
                    <div className="sidebar-brand">
                        <span className="sidebar-mark">M</span>
                        <span>Mirador</span>
                    </div>

                    <nav className="dashboard-nav">
                        <Link
                            to="/dashboard"
                            className={`nav-item ${
                                location.pathname === "/dashboard"
                                    ? "active"
                                    : ""
                            }`}
                        >
                            Dashboard
                        </Link>

                        <Link
                            to="/projects"
                            className={`nav-item ${
                                location.pathname === "/projects"
                                    ? "active"
                                    : ""
                            }`}
                        >
                            Projects
                        </Link>

                        <Link
                            to="/tasks"
                            className={`nav-item ${
                                location.pathname === "/tasks"
                                    ? "active"
                                    : ""
                            }`}
                        >
                            Tasks
                        </Link>

                        <Link
                            to="/teams"
                            className={`nav-item ${
                                location.pathname === "/teams"
                                    ? "active"
                                    : ""
                            }`}
                        >
                            Teams
                        </Link>

                        <Link
                            to="/milestones"
                            className={`nav-item ${
                                location.pathname === "/milestones"
                                    ? "active"
                                    : ""
                            }`}
                        >
                            Milestones
                        </Link>

                        <Link
                            to="/reports"
                            className={`nav-item ${
                                location.pathname === "/reports"
                                    ? "active"
                                    : ""
                            }`}
                        >
                            Reports
                        </Link>

                        <Link
                            to="/timeline"
                            className={`nav-item ${
                                location.pathname === "/timeline"
                                    ? "active"
                                    : ""
                            }`}
                        >
                            Timeline
                        </Link>

                        <Link
                            to="/activity"
                            className={`nav-item ${
                                location.pathname === "/activity"
                                    ? "active"
                                    : ""
                            }`}
                        >
                            Activity
                        </Link>

                        <Link
                            to="/settings"
                            className={`nav-item ${
                                location.pathname === "/settings"
                                    ? "active"
                                    : ""
                            }`}
                        >
                            Settings
                        </Link>

                        <Link
                            to="/help"
                            className={`nav-item ${
                                location.pathname === "/help"
                                    ? "active"
                                    : ""
                            }`}
                        >
                            Help
                        </Link>

                        {user?.role === "ADMIN" && (
                            <Link
                                to="/users"
                                className={`nav-item ${
                                    location.pathname === "/users"
                                        ? "active"
                                        : ""
                                }`}
                            >
                                Users
                            </Link>
                        )}
                    </nav>
                </div>

                <button
                    type="button"
                    className="sidebar-logout"
                    onClick={handleLogout}
                >
                    <span
                        className={`profile-avatar sidebar-avatar ${(user?.avatarColor || "INDIGO").toLowerCase()}`}
                    >
                        {getInitials(user?.name)}
                    </span>

                    <span>Sign out</span>
                </button>
            </aside>

            <section className="dashboard-main">
                <Outlet />
            </section>
        </main>
    );
}

export default ProtectedLayout;
