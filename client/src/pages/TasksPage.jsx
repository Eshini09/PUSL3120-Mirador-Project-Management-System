import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../api";
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

const getProjectAssignableUsers = (projects, projectId) => {
    const project = projects.find(
        (currentProject) => currentProject._id === projectId
    );

    if (!project) {
        return [];
    }

    const userMap = new Map();

    const addUser = (selectedUser) => {
        if (selectedUser?._id && selectedUser.role !== "ADMIN") {
            userMap.set(selectedUser._id, selectedUser);
        }
    };

    addUser(project.manager);
    (project.members || []).forEach(addUser);
    (project.teams || []).forEach((team) => {
        addUser(team.owner);
        (team.members || []).forEach(addUser);
    });

    return [...userMap.values()].sort((firstUser, secondUser) =>
        firstUser.name.localeCompare(secondUser.name)
    );
};

const getTaskDueState = (task) => {
    if (!task.dueDate || task.status === "COMPLETED") {
        return "";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today) {
        return "Overdue";
    }

    if (dueDate.getTime() === today.getTime()) {
        return "Due today";
    }

    return `Due ${dueDate.toLocaleDateString()}`;
};

const getTaskStatusLabel = (status) => {
    const labels = {
        TODO: "Active",
        IN_PROGRESS: "Ongoing",
        COMPLETED: "Completed"
    };

    return labels[status] || status;
};

function TasksPage() {
    const navigate = useNavigate();

    const [tasks, setTasks] = useState([]);
    const [user, setUser] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [viewMode, setViewMode] = useState("LIST");
    const [projects, setProjects] = useState([]);
    const [comments, setComments] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
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

            const [
                userResponse,
                tasksResponse,
                projectsResponse,
                commentsResponse
            ] = await Promise.all([
                fetch(apiUrl("/api/auth/me"), {
                    headers,
                    cache: "no-store"
                }),
                fetch(apiUrl("/api/tasks"), {
                    headers,
                    cache: "no-store"
                }),
                fetch(apiUrl("/api/projects"), {
                    headers,
                    cache: "no-store"
                }),
                fetch(apiUrl("/api/comments"), {
                    headers,
                    cache: "no-store"
                })
            ]);

            if (
                userResponse.status === 401 ||
                tasksResponse.status === 401 ||
                projectsResponse.status === 401 ||
                commentsResponse.status === 401
            ) {
                localStorage.removeItem("token");
                navigate("/");
                return;
            }

            const userData = await userResponse.json();
            const tasksData = await tasksResponse.json();
            const projectsData = await projectsResponse.json();
            const commentsData = await commentsResponse.json();

            if (!tasksResponse.ok) {
                throw new Error(
                    tasksData.message || "Failed to load tasks"
                );
            }

            if (!projectsResponse.ok) {
                throw new Error(
                    projectsData.message ||
                        "Failed to load projects"
                );
            }

            setUser(userData.user);
            setTasks(tasksData.tasks || []);
            setProjects(projectsData.projects || []);
            setComments(
                commentsResponse.ok ? commentsData.comments || [] : []
            );

            if (!commentsResponse.ok) {
                console.warn(
                    "Comments unavailable:",
                    commentsData.message || "Failed to load comments"
                );
            }
        } catch (requestError) {
            console.error(
                "Tasks loading error:",
                requestError
            );

            setError(
                requestError.message ||
                    "Unable to load tasks"
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

        const handleCommentChanged = () => {
            loadData();
        };

        socket.on("taskUpdated", handleTaskUpdated);
        socket.on("taskCreated", handleTaskCreated);
        socket.on("taskDeleted", handleTaskDeleted);
        socket.on("commentCreated", handleCommentChanged);
        socket.on("commentUpdated", handleCommentChanged);
        socket.on("commentDeleted", handleCommentChanged);

        return () => {
            socket.off(
                "taskUpdated",
                handleTaskUpdated
            );

            socket.off(
                "taskCreated",
                handleTaskCreated
            );

            socket.off(
                "taskDeleted",
                handleTaskDeleted
            );

            socket.off(
                "commentCreated",
                handleCommentChanged
            );

            socket.off(
                "commentUpdated",
                handleCommentChanged
            );

            socket.off(
                "commentDeleted",
                handleCommentChanged
            );
        };
    }, [loadData]);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setForm((currentForm) => ({
            ...currentForm,
            [name]: value,
            ...(name === "project" ? { assignedTo: "" } : {})
        }));
    };

    const resetForm = () => {
        setForm(emptyForm);
        setIsFormOpen(false);
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
                ? apiUrl(`/api/tasks/${editingTaskId}`)
                : apiUrl("/api/tasks");

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
                        `Failed to ${
                            isEditing ? "update" : "create"
                        } task`
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
            console.error(
                "Task save error:",
                requestError
            );

            setError(
                requestError.message ||
                    "Unable to save task"
            );
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (task) => {
        setEditingTaskId(task._id);
        setIsFormOpen(true);

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
                apiUrl(`/api/tasks/${taskId}`),
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
                    data.message ||
                        "Failed to delete task"
                );
            }

            setMessage(
                "Task deleted successfully."
            );

            if (editingTaskId === taskId) {
                resetForm();
            }

            await loadData();
        } catch (requestError) {
            console.error(
                "Task delete error:",
                requestError
            );

            setError(
                requestError.message ||
                    "Unable to delete task"
            );
        }
    };

    const handleStatusUpdate = async (taskId, status) => {
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                apiUrl(`/api/tasks/${taskId}`),
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        status
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to update task status"
                );
            }

            setMessage("Task status updated successfully.");
            await loadData();
        } catch (requestError) {
            console.error(
                "Task status update error:",
                requestError
            );

            setError(
                requestError.message ||
                    "Unable to update task status"
            );
        }
    };

    const relatedProjects = projects;

    const canCreateTasks = relatedProjects.length > 0;
    const assignableUsers = getProjectAssignableUsers(
        projects,
        form.project
    );
    const taskFilters = [
        {
            key: "ALL",
            label: "All",
            count: tasks.length
        },
        {
            key: "DUE",
            label: "Due",
            count: tasks.filter(
                (task) => task.status !== "COMPLETED" && task.dueDate
            ).length
        },
        {
            key: "TODO",
            label: "Active",
            count: tasks.filter((task) => task.status === "TODO").length
        },
        {
            key: "IN_PROGRESS",
            label: "Ongoing",
            count: tasks.filter((task) => task.status === "IN_PROGRESS")
                .length
        },
        {
            key: "COMPLETED",
            label: "Completed",
            count: tasks.filter((task) => task.status === "COMPLETED")
                .length
        }
    ];
    const filteredTasks = tasks
        .filter((task) => {
            if (activeFilter === "ALL") {
                return true;
            }

            if (activeFilter === "DUE") {
                return task.status !== "COMPLETED" && task.dueDate;
            }

            return task.status === activeFilter;
        })
        .sort((firstTask, secondTask) => {
            if (activeFilter === "DUE") {
                return (
                    new Date(firstTask.dueDate || 0) -
                    new Date(secondTask.dueDate || 0)
                );
            }

            return (
                new Date(secondTask.updatedAt || secondTask.createdAt || 0) -
                new Date(firstTask.updatedAt || firstTask.createdAt || 0)
            );
        });
    const kanbanColumns = [
        {
            key: "TODO",
            label: "Active",
            helper: "Ready to start"
        },
        {
            key: "IN_PROGRESS",
            label: "Ongoing",
            helper: "Currently moving"
        },
        {
            key: "COMPLETED",
            label: "Completed",
            helper: "Finished work"
        }
    ];

    if (loading) {
        return (
            <div className="dashboard-loading">
                <p>Loading tasks...</p>
            </div>
        );
    }

    return (
        <>
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

            {!canCreateTasks && (
                <div className="dashboard-info">
                    Create a project first, then you can add tasks to
                    that project. Team members can also view assigned
                    tasks and update their status.
                </div>
            )}

            {(canCreateTasks || tasks.length > 0) && (
                <div className="page-toolbar">
                    {tasks.length > 0 && (
                        <div className="view-switcher">
                            <button
                                type="button"
                                className={
                                    viewMode === "LIST" ? "active" : ""
                                }
                                onClick={() => setViewMode("LIST")}
                            >
                                List
                            </button>

                            <button
                                type="button"
                                className={
                                    viewMode === "BOARD" ? "active" : ""
                                }
                                onClick={() => setViewMode("BOARD")}
                            >
                                Kanban
                            </button>
                        </div>
                    )}

                    {canCreateTasks && (
                        <button
                            type="button"
                            className="quick-action primary"
                            onClick={() => {
                                setForm(emptyForm);
                                setEditingTaskId(null);
                                setIsFormOpen(true);
                            }}
                        >
                            New task
                        </button>
                    )}
                </div>
            )}

            {canCreateTasks && isFormOpen && (
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

                                    {relatedProjects.map(
                                        (project) => (
                                            <option
                                                key={
                                                    project._id
                                                }
                                                value={
                                                    project._id
                                                }
                                            >
                                                {
                                                    project.name
                                                }
                                            </option>
                                        )
                                    )}
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

                                    {assignableUsers.map(
                                        (selectedUser) => (
                                            <option
                                                key={
                                                    selectedUser._id
                                                }
                                                value={
                                                    selectedUser._id
                                                }
                                            >
                                                {
                                                    selectedUser.name
                                                }{" "}
                                                (
                                                {
                                                    selectedUser.role
                                                }
                                                )
                                            </option>
                                        )
                                    )}
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

            {tasks.length > 0 && (
                <div className="task-filter-bar">
                    {taskFilters.map((filter) => (
                        <button
                            key={filter.key}
                            type="button"
                            className={
                                activeFilter === filter.key ? "active" : ""
                            }
                            onClick={() => setActiveFilter(filter.key)}
                        >
                            {filter.label}
                            <span>{filter.count}</span>
                        </button>
                    ))}
                </div>
            )}

            {viewMode === "BOARD" && tasks.length > 0 ? (
                <section className="kanban-board">
                    {kanbanColumns.map((column) => {
                        const columnTasks = filteredTasks.filter(
                            (task) => task.status === column.key
                        );

                        return (
                            <article className="kanban-column" key={column.key}>
                                <div className="kanban-column-header">
                                    <div>
                                        <h2>{column.label}</h2>
                                        <p>{column.helper}</p>
                                    </div>

                                    <span>{columnTasks.length}</span>
                                </div>

                                <div className="kanban-card-list kanban-table-list">
                                    {columnTasks.length === 0 ? (
                                        <p className="kanban-empty">
                                            No tasks here.
                                        </p>
                                    ) : (
                                        columnTasks.map((task) => {
                                            const canManageTask =
                                                user?.role === "ADMIN" ||
                                                task.project?.manager?._id ===
                                                    user?.userId ||
                                                task.createdBy?._id ===
                                                    user?.userId;
                                            const canUpdateTask =
                                                canManageTask ||
                                                task.assignedTo?._id ===
                                                    user?.userId;

                                            return (
                                                <article
                                                    className="kanban-card kanban-table-row"
                                                    key={task._id}
                                                >
                                                    <div className="kanban-task-cell">
                                                        <span
                                                            className={`priority-badge ${task.priority.toLowerCase()}`}
                                                        >
                                                            {task.priority}
                                                        </span>

                                                        <h3>{task.title}</h3>

                                                        <p>
                                                            {task.project?.name ||
                                                                "No project"}
                                                        </p>
                                                    </div>

                                                    <div className="kanban-card-meta">
                                                        <span>
                                                            {task.assignedTo
                                                                ?.name ||
                                                                "Unassigned"}
                                                        </span>

                                                        {getTaskDueState(
                                                            task
                                                        ) && (
                                                            <span>
                                                                {getTaskDueState(
                                                                    task
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {(canUpdateTask ||
                                                        canManageTask) && (
                                                        <div className="kanban-actions">
                                                            {canUpdateTask &&
                                                                kanbanColumns
                                                                    .filter(
                                                                        (
                                                                            nextColumn
                                                                        ) =>
                                                                            nextColumn.key !==
                                                                            task.status
                                                                    )
                                                                    .map(
                                                                        (
                                                                            nextColumn
                                                                        ) => (
                                                                            <button
                                                                                key={
                                                                                    nextColumn.key
                                                                                }
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    handleStatusUpdate(
                                                                                        task._id,
                                                                                        nextColumn.key
                                                                                    )
                                                                                }
                                                                            >
                                                                                {
                                                                                    nextColumn.label
                                                                                }
                                                                            </button>
                                                                        )
                                                                    )}

                                                            {canManageTask && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleEdit(
                                                                                task
                                                                            )
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
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </article>
                                            );
                                        })
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </section>
            ) : (
            <section className="simple-task-list">
                {tasks.length === 0 ? (
                    <div className="dashboard-panel">
                        <p className="panel-label">
                            NO TASKS
                        </p>

                        <h2>No tasks found.</h2>

                        <p>
                            {canCreateTasks
                                ? "No tasks are visible yet. Create the first task for one of your projects."
                                : "No tasks are assigned to your account yet."}
                        </p>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="dashboard-panel">
                        <p className="panel-label">NO MATCHES</p>
                        <h2>No tasks in this view.</h2>
                        <p>Choose another filter to continue.</p>
                    </div>
                ) : (
                    filteredTasks.map((task) => {
                        const taskComments = comments.filter(
                            (comment) => comment.task?._id === task._id
                        );
                        const canManageTask =
                            user?.role === "ADMIN" ||
                            task.project?.manager?._id === user?.userId ||
                            task.createdBy?._id === user?.userId;
                        const canUpdateTask =
                            canManageTask ||
                            task.assignedTo?._id === user?.userId;

                        return (
                            <article
                                key={task._id}
                                className="simple-task-row"
                            >
                                <div className="simple-task-main">
                                    <span className="task-status">
                                        {getTaskStatusLabel(task.status)}
                                    </span>

                                    <h2>{task.title}</h2>

                                    <p>
                                        {task.project?.name || "No project"} ·{" "}
                                        {task.assignedTo?.name ||
                                            "Unassigned"}
                                    </p>
                                </div>

                                <div className="simple-task-meta">
                                    {getTaskDueState(task) && (
                                        <span
                                            className={
                                                getTaskDueState(task) ===
                                                "Overdue"
                                                    ? "task-pill warning"
                                                    : "task-pill"
                                            }
                                        >
                                            {getTaskDueState(task)}
                                        </span>
                                    )}

                                    <span
                                        className={`priority-badge ${task.priority.toLowerCase()}`}
                                    >
                                        {task.priority}
                                    </span>

                                    <span className="task-pill">
                                        {taskComments.length} note
                                        {taskComments.length === 1 ? "" : "s"}
                                    </span>
                                </div>

                                <div className="simple-task-controls">
                                    <select
                                        value={task.status}
                                        onChange={(event) =>
                                            handleStatusUpdate(
                                                task._id,
                                                event.target.value
                                            )
                                        }
                                        disabled={!canUpdateTask}
                                    >
                                        <option value="TODO">Active</option>
                                        <option value="IN_PROGRESS">
                                            Ongoing
                                        </option>
                                        <option value="COMPLETED">
                                            Completed
                                        </option>
                                    </select>

                                    {canManageTask && (
                                        <>
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
                                                    handleDelete(task._id)
                                                }
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </article>
                        );
                    })
                )}
            </section>
            )}
        </>
    );
}

export default TasksPage;
