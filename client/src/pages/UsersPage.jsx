import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../api";

const roles = [
    "ADMIN",
    "PROJECT_MANAGER",
    "TEAM_MEMBER"
];

function UsersPage() {
    const navigate = useNavigate();

    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const token = localStorage.getItem("token");

    const loadData = useCallback(async () => {
        if (!token) {
            navigate("/");
            return;
        }

        try {
            const headers = {
                Authorization: `Bearer ${token}`
            };

            const [meResponse, usersResponse] =
                await Promise.all([
                    fetch(apiUrl("/api/auth/me"), {
                        headers,
                        cache: "no-store"
                    }),
                    fetch(apiUrl("/api/users"), {
                        headers,
                        cache: "no-store"
                    })
                ]);

            if (
                meResponse.status === 401 ||
                usersResponse.status === 401
            ) {
                localStorage.removeItem("token");
                navigate("/");
                return;
            }

            const meData = await meResponse.json();
            const usersData = await usersResponse.json();

            if (!usersResponse.ok) {
                throw new Error(
                    usersData.message || "Failed to load users"
                );
            }

            setCurrentUser(meData.user);
            setUsers(usersData.users || []);
        } catch (requestError) {
            console.error("Users loading error:", requestError);
            setError(
                requestError.message || "Unable to load users"
            );
        } finally {
            setLoading(false);
        }
    }, [navigate, token]);

    useEffect(() => {
        queueMicrotask(() => {
            loadData();
        });
    }, [loadData]);

    const updateRole = async (userId, role) => {
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                apiUrl(`/api/users/${userId}/role`),
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        role
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to update user role"
                );
            }

            setMessage("User role updated successfully.");
            await loadData();
        } catch (requestError) {
            console.error("User role update error:", requestError);
            setError(
                requestError.message || "Unable to update user role"
            );
        }
    };

    const deleteUser = async (userId) => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this user?"
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setMessage("");

        try {
            const response = await fetch(
                apiUrl(`/api/users/${userId}`),
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to delete user"
                );
            }

            setMessage("User deleted successfully.");
            await loadData();
        } catch (requestError) {
            console.error("User delete error:", requestError);
            setError(
                requestError.message || "Unable to delete user"
            );
        }
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <p>Loading users...</p>
            </div>
        );
    }

    const isAdmin = currentUser?.role === "ADMIN";

    return (
        <>
            <header className="dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">
                        ADMINISTRATION
                    </p>

                    <h1>Users</h1>

                    <p className="dashboard-welcome">
                        Review accounts and appoint project managers or
                        administrators.
                    </p>
                </div>

                <div className="user-badge">
                    {currentUser?.role}
                </div>
            </header>

            {error && (
                <div className="dashboard-error">
                    {error}
                </div>
            )}

            {message && (
                <div className="dashboard-success">
                    {message}
                </div>
            )}

            {!isAdmin && (
                <div className="dashboard-info">
                    Only administrators can change roles. The first
                    account created in a fresh database becomes the
                    administrator automatically.
                </div>
            )}

            <section className="user-table">
                {users.map((user) => (
                    <article
                        className="user-row"
                        key={user._id}
                    >
                        <div>
                            <h2>{user.name}</h2>

                            <p>{user.email}</p>
                        </div>

                        <div className="user-role-controls">
                            <select
                                value={user.role}
                                onChange={(event) =>
                                    updateRole(
                                        user._id,
                                        event.target.value
                                    )
                                }
                                disabled={!isAdmin}
                            >
                                {roles.map((role) => (
                                    <option
                                        value={role}
                                        key={role}
                                    >
                                        {role}
                                    </option>
                                ))}
                            </select>

                            {isAdmin && (
                                <button
                                    type="button"
                                    className="danger-button"
                                    onClick={() =>
                                        deleteUser(user._id)
                                    }
                                    disabled={
                                        user._id ===
                                        currentUser?.userId
                                    }
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </article>
                ))}
            </section>
        </>
    );
}

export default UsersPage;
