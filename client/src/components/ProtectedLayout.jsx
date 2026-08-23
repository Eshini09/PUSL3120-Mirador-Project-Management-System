import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "../api";

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
                    Sign out
                </button>
            </aside>

            <section className="dashboard-main">
                <Outlet />
            </section>
        </main>
    );
}

export default ProtectedLayout;
