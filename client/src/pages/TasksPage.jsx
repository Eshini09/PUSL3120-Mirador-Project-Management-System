import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import socket from "../socket";

const emptyForm = {
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    dueDate: "",
    project: "",
    assignedTo: ""
};

function TasksPage() {
    const navigate = useNavigate();

    const [tasks, setTasks] = useState([]);
    const [user, setUser] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [projects, setProjects] = useState([]);
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
            tasksResponse,
            projectsResponse,
            usersResponse
        ] = await Promise.all([
            fetch("http://localhost:5001/api/auth/me", { headers }),
            fetch("http://localhost:5001/api/tasks", { headers }),
            fetch("http://localhost:5001/api/projects", { headers }),
            fetch("http://localhost:5001/api/users", { headers })
        ]);

        if (
            userResponse.status === 401 ||
            tasksResponse.status === 401 ||
            projectsResponse.status === 401 ||
            usersResponse.status === 401
        ) {
            localStorage.removeItem("token");
            navigate("/");
            return;
        }

        const userData = await userResponse.json();
        const tasksData = await tasksResponse.json();
        const projectsData = await projectsResponse.json();
        const usersData = await usersResponse.json();

        if (!tasksResponse.ok) {
            throw new Error(
                tasksData.message || "Failed to load tasks"
            );
        }

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
        setTasks(tasksData.tasks || []);
        setProjects(projectsData.projects || []);
        setUsers(usersData.users || []);
    } catch (requestError) {
        console.error("Tasks loading error:", requestError);
        setError(
            requestError.message || "Unable to load tasks"
        );
    } finally {
        setLoading(false);
    }
};

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const handleTaskUpdated = () => {
            loadData();
        };

        const handleTaskCreated = () => {
            loadData();
        };

        const handleTaskDeleted = () => {
            loadData();
        };

        socket.on("taskUpdated", handleTaskUpdated);
        socket.on("taskCreated", handleTaskCreated);
        socket.on("taskDeleted", handleTaskDeleted);

        return () => {
            socket.off("taskUpdated", handleTaskUpdated);
            socket.off("taskCreated", handleTaskCreated);
            socket.off("taskDeleted", handleTaskDeleted);
        };
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
        setEditingTaskId(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setSaving(true);
        setError("");
        setMessage("");

        try {
            const isEditing = Boolean(editingTaskId);

            const url = isEditing
                ? `http://localhost:5001/api/tasks/${editingTaskId}`
                : "http://localhost:5001/api/tasks";

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
                        `Failed to ${isEditing ? "update" : "create"} task`
                );
            }

            setMessage(
                isEditing
                    ? "Task updated successfully."
                    : "Task created successfully."
            );

            resetForm();
            await loadData();
        } catch (requestError) {
            console.error("Task save error:", requestError);
            setError(requestError.message || "Unable to save task");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (task) => {
        setEditingTaskId(task._id);

        setForm({
            title: task.title || "",
            description: task.description || "",
            status: task.status || "TODO",
            priority: task.priority || "MEDIUM",
            dueDate: task.dueDate
                ? task.dueDate.slice(0, 10)
                : "",
            project: task.project?._id || "",
            assignedTo: task.assignedTo?._id || ""
        });

        setMessage("");
        setError("");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    const handleDelete = async (taskId) => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this task?"
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setMessage("");

        try {
            const response = await fetch(
                `http://localhost:5001/api/tasks/${taskId}`,
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
                    data.message || "Failed to delete task"
                );
            }

            setMessage("Task deleted successfully.");

            if (editingTaskId === taskId) {
                resetForm();
            }

            await loadData();
        } catch (requestError) {
            console.error("Task delete error:", requestError);
            setError(
                requestError.message || "Unable to delete task"
            );
        }
    };

    const canCreateTasks =
        user?.role === "ADMIN" ||
        user?.role === "PROJECT_MANAGER";

    const canManageTasks =
        user?.role === "ADMIN" ||
        user?.role === "PROJECT_MANAGER" ||
        user?.role === "TEAM_MEMBER";

    if (loading) {
        return (
            <main className="dashboard-page dashboard-loading">
                <p>Loading tasks...</p>
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
                            className="nav-item"
                        >
                            Projects
                        </Link>

                        <Link
                            to="/tasks"
                            className="nav-item active"
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

                        <h1>Tasks</h1>

                        <p className="dashboard-welcome">
                            Organise and track project work.
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

                {canCreateTasks && (
                    <section className="project-form-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="panel-label">
                                    {editingTaskId
                                        ? "EDIT TASK"
                                        : "NEW TASK"}
                                </p>

                                <h2>
                                    {editingTaskId
                                        ? "Update task"
                                        : "Create a task"}
                                </h2>
                            </div>

                            {editingTaskId && (
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
                                <label htmlFor="task-title">
                                    Task title
                                </label>

                                <input
                                    id="task-title"
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="Enter task title"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="task-description">
                                    Description
                                </label>

                                <textarea
                                    id="task-description"
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="Describe the task"
                                    rows="4"
                                />
                            </div>

                            <div className="project-form-grid">
                                <div className="form-group">
                                    <label htmlFor="task-status">
                                        Status
                                    </label>

                                    <select
                                        id="task-status"
                                        name="status"
                                        value={form.status}
                                        onChange={handleChange}
                                    >
                                        <option value="TODO">
                                            To do
                                        </option>
                                        <option value="IN_PROGRESS">
                                            In progress
                                        </option>
                                        <option value="COMPLETED">
                                            Completed
                                        </option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="task-priority">
                                        Priority
                                    </label>

                                    <select
                                        id="task-priority"
                                        name="priority"
                                        value={form.priority}
                                        onChange={handleChange}
                                    >
                                        <option value="LOW">
                                            Low
                                        </option>
                                        <option value="MEDIUM">
                                            Medium
                                        </option>
                                        <option value="HIGH">
                                            High
                                        </option>
                                    </select>
                                </div>
                            </div>

                            <div className="project-form-grid">
                                <div className="form-group">
                                    <label htmlFor="task-project">
                                        Project
                                    </label>

                                    <select
                                        id="task-project"
                                        name="project"
                                        value={form.project}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">
                                            Select a project
                                        </option>

                                        {projects.map((project) => (
                                            <option
                                                key={project._id}
                                                value={project._id}
                                            >
                                                {project.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="task-assigned-to">
                                        Assigned to
                                    </label>

                                    <select
                                        id="task-assigned-to"
                                        name="assignedTo"
                                        value={form.assignedTo}
                                        onChange={handleChange}
                                    >
                                        <option value="">
                                            Unassigned
                                        </option>

                                        {users.map((selectedUser) => (
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

                            <div className="form-group">
                                <label htmlFor="task-due-date">
                                    Due date
                                </label>

                                <input
                                    id="task-due-date"
                                    name="dueDate"
                                    type="date"
                                    value={form.dueDate}
                                    onChange={handleChange}
                                />
                            </div>

                            <button
                                type="submit"
                                className="login-button"
                                disabled={saving}
                            >
                                {saving
                                    ? "Saving..."
                                    : editingTaskId
                                      ? "Update task"
                                      : "Create task"}
                            </button>
                        </form>
                    </section>
                )}

                <section className="task-grid">
                    {tasks.length === 0 ? (
                        <div className="dashboard-panel">
                            <p className="panel-label">
                                NO TASKS
                            </p>

                            <h2>No tasks found.</h2>

                            <p>
                                Create a task to get started.
                            </p>
                        </div>
                    ) : (
                        tasks.map((task) => (
                            <article
                                key={task._id}
                                className="task-card"
                            >
                                <div className="task-card-top">
                                    <div>
                                        <p className="task-status">
                                            {task.status}
                                        </p>

                                        <h2>{task.title}</h2>
                                    </div>

                                    <span
                                        className={`priority-badge ${task.priority.toLowerCase()}`}
                                    >
                                        {task.priority}
                                    </span>
                                </div>

                                <p className="task-description">
                                    {task.description ||
                                        "No description provided."}
                                </p>

                                <div className="task-details">
                                    <div>
                                        <span>Project</span>

                                        <strong>
                                            {task.project?.name ||
                                                "Unassigned"}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Assigned to</span>

                                        <strong>
                                            {task.assignedTo?.name ||
                                                "Unassigned"}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Due</span>

                                        <strong>
                                            {task.dueDate
                                                ? new Date(
                                                      task.dueDate
                                                  ).toLocaleDateString()
                                                : "No deadline"}
                                        </strong>
                                    </div>
                                </div>

                                {canManageTasks && (
                                    <div className="project-actions">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleEdit(task)
                                            }
                                        >
                                            Edit
                                        </button>

                                        <button
                                            type="button"
                                            className="danger-button"
                                            onClick={() =>
                                                handleDelete(
                                                    task._id
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

export default TasksPage;