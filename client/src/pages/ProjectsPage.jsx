import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const emptyForm = {
    name: "",
    description: "",
    status: "PLANNING",
    startDate: "",
    dueDate: "",
    manager: ""
};

function ProjectsPage() {
    const navigate = useNavigate();

    const [projects, setProjects] = useState([]);
    const [user, setUser] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [users, setUsers] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const token = localStorage.getItem("token");

    const loadData = async () => {
    if (!token) {
        navigate("/");
        return;
    }

    try {
        const headers = {
            Authorization: `Bearer ${token}`
        };

        const [
            userResponse,
            projectsResponse,
            usersResponse
        ] = await Promise.all([
            fetch("http://localhost:5001/api/auth/me", { headers }),
            fetch("http://localhost:5001/api/projects", { headers }),
            fetch("http://localhost:5001/api/users", { headers })
        ]);

        if (
            userResponse.status === 401 ||
            projectsResponse.status === 401 ||
            usersResponse.status === 401
        ) {
            localStorage.removeItem("token");
            navigate("/");
            return;
        }

        const userData = await userResponse.json();
        const projectsData = await projectsResponse.json();
        const usersData = await usersResponse.json();

        if (!projectsResponse.ok) {
            throw new Error(
                projectsData.message || "Failed to load projects"
            );
        }

        if (!usersResponse.ok) {
            throw new Error(
                usersData.message || "Failed to load users"
            );
        }

        setUser(userData.user);
        setProjects(projectsData.projects || []);
        setUsers(usersData.users || []);
    } catch (requestError) {
        console.error("Projects loading error:", requestError);
        setError(
            requestError.message || "Unable to load projects"
        );
    } finally {
        setLoading(false);
    }
};

    useEffect(() => {
        loadData();
    }, []);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setForm((currentForm) => ({
            ...currentForm,
            [name]: value
        }));
    };

    const resetForm = () => {
        setForm(emptyForm);
        setEditingProjectId(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setSaving(true);
        setError("");
        setMessage("");

        try {
            const isEditing = Boolean(editingProjectId);

            const url = isEditing
                ? `http://localhost:5001/api/projects/${editingProjectId}`
                : "http://localhost:5001/api/projects";

            const response = await fetch(url, {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(form)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        `Failed to ${isEditing ? "update" : "create"} project`
                );
            }

            setMessage(
                isEditing
                    ? "Project updated successfully."
                    : "Project created successfully."
            );

            resetForm();
            await loadData();
        } catch (requestError) {
            console.error("Project save error:", requestError);
            setError(requestError.message || "Unable to save project");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (project) => {
        setEditingProjectId(project._id);

        setForm({
            name: project.name || "",
            description: project.description || "",
            status: project.status || "PLANNING",
            startDate: project.startDate
                ? project.startDate.slice(0, 10)
                : "",
            dueDate: project.dueDate
                ? project.dueDate.slice(0, 10)
                : "",
            manager: project.manager?._id || ""
        });

        setMessage("");
        setError("");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    const handleDelete = async (projectId) => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this project?"
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setMessage("");

        try {
            const response = await fetch(
                `http://localhost:5001/api/projects/${projectId}`,
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
                    data.message || "Failed to delete project"
                );
            }

            setMessage("Project deleted successfully.");

            if (editingProjectId === projectId) {
                resetForm();
            }

            await loadData();
        } catch (requestError) {
            console.error("Project delete error:", requestError);
            setError(
                requestError.message || "Unable to delete project"
            );
        }
    };

    const canManageProjects =
        user?.role === "ADMIN" ||
        user?.role === "PROJECT_MANAGER";

    if (loading) {
        return (
            <main className="dashboard-page dashboard-loading">
                <p>Loading projects...</p>
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
                        <Link
                            to="/dashboard"
                            className="nav-item"
                        >
                            Dashboard
                        </Link>

                        <Link
                            to="/projects"
                            className="nav-item active"
                        >
                            Projects
                        </Link>

                        <Link
                            to="/tasks"
                            className="nav-item"
                        >
                            Tasks
                        </Link>
                    </nav>
                </div>

                <button
                    type="button"
                    className="sidebar-logout"
                    onClick={() => {
                        localStorage.removeItem("token");
                        navigate("/");
                    }}
                >
                    Sign out
                </button>
            </aside>

            <section className="dashboard-main">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-eyebrow">
                            WORKSPACE
                        </p>

                        <h1>Projects</h1>

                        <p className="dashboard-welcome">
                            View and manage your projects.
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

                {message && (
                    <div className="dashboard-success">
                        {message}
                    </div>
                )}

                {canManageProjects && (
                    <section className="project-form-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="panel-label">
                                    {editingProjectId
                                        ? "EDIT PROJECT"
                                        : "NEW PROJECT"}
                                </p>

                                <h2>
                                    {editingProjectId
                                        ? "Update project"
                                        : "Create a project"}
                                </h2>
                            </div>

                            {editingProjectId && (
                                <button
                                    type="button"
                                    className="form-cancel-button"
                                    onClick={resetForm}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>

                        <form
                            className="project-form"
                            onSubmit={handleSubmit}
                        >
                            <div className="form-group">
                                <label htmlFor="project-name">
                                    Project name
                                </label>

                                <input
                                    id="project-name"
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    placeholder="Enter project name"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="project-description">
                                    Description
                                </label>

                                <textarea
                                    id="project-description"
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="Describe the project"
                                    rows="4"
                                    required
                                />
                            </div>

                            <div className="project-form-grid">
                                <div className="form-group">
                                    <label htmlFor="project-status">
                                        Status
                                    </label>

                                    <select
                                        id="project-status"
                                        name="status"
                                        value={form.status}
                                        onChange={handleChange}
                                    >
                                        <option value="PLANNING">
                                            Planning
                                        </option>
                                        <option value="ACTIVE">
                                            Active
                                        </option>
                                        <option value="COMPLETED">
                                            Completed
                                        </option>
                                        <option value="ON_HOLD">
                                            On hold
                                        </option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="project-manager">
                                        Manager
                                    </label>

                                    <select
                                        id="project-manager"
                                        name="manager"
                                        value={form.manager}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">
                                            Select a project manager
                                        </option>

                                        {users
                                            .filter(
                                                (selectedUser) =>
                                                    selectedUser.role === "ADMIN" ||
                                                    selectedUser.role === "PROJECT_MANAGER"
                                            )
                                            .map((selectedUser) => (
                                                <option
                                                    key={selectedUser._id}
                                                    value={selectedUser._id}
                                                >
                                                    {selectedUser.name} ({selectedUser.role})
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            <div className="project-form-grid">
                                <div className="form-group">
                                    <label htmlFor="project-start-date">
                                        Start date
                                    </label>

                                    <input
                                        id="project-start-date"
                                        name="startDate"
                                        type="date"
                                        value={form.startDate}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="project-due-date">
                                        Due date
                                    </label>

                                    <input
                                        id="project-due-date"
                                        name="dueDate"
                                        type="date"
                                        value={form.dueDate}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="login-button"
                                disabled={saving}
                            >
                                {saving
                                    ? "Saving..."
                                    : editingProjectId
                                      ? "Update project"
                                      : "Create project"}
                            </button>
                        </form>
                    </section>
                )}

                <section className="project-grid">
                    {projects.length === 0 ? (
                        <div className="dashboard-panel">
                            <p className="panel-label">
                                NO PROJECTS
                            </p>

                            <h2>No projects found.</h2>

                            <p>
                                Create a project to get started.
                            </p>
                        </div>
                    ) : (
                        projects.map((project) => (
                            <article
                                key={project._id}
                                className="project-card"
                            >
                                <p className="project-status">
                                    {project.status}
                                </p>

                                <h2>{project.name}</h2>

                                <p className="project-description">
                                    {project.description}
                                </p>

                                <div className="project-details">
                                    <div>
                                        <span>Manager</span>

                                        <strong>
                                            {project.manager?.name ||
                                                "Unassigned"}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Due</span>

                                        <strong>
                                            {project.dueDate
                                                ? new Date(
                                                      project.dueDate
                                                  ).toLocaleDateString()
                                                : "No deadline"}
                                        </strong>
                                    </div>
                                </div>

                                {canManageProjects && (
                                    <div className="project-actions">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleEdit(project)
                                            }
                                        >
                                            Edit
                                        </button>

                                        <button
                                            type="button"
                                            className="danger-button"
                                            onClick={() =>
                                                handleDelete(
                                                    project._id
                                                )
                                            }
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </article>
                        ))
                    )}
                </section>
            </section>
        </main>
    );
}

export default ProjectsPage;