import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../api";
import socket from "../socket";

const emptyForm = {
    title: "",
    description: "",
    status: "PLANNED",
    dueDate: "",
    project: "",
    owner: ""
};

const statusLabels = {
    PLANNED: "Planned",
    IN_PROGRESS: "Ongoing",
    ACHIEVED: "Achieved",
    MISSED: "Missed"
};

const milestoneFilters = [
    {
        key: "ALL",
        label: "All"
    },
    {
        key: "DUE",
        label: "Due"
    },
    {
        key: "PLANNED",
        label: "Planned"
    },
    {
        key: "IN_PROGRESS",
        label: "Ongoing"
    },
    {
        key: "ACHIEVED",
        label: "Achieved"
    },
    {
        key: "MISSED",
        label: "Missed"
    }
];

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

const getDaysUntil = (dateValue) => {
    const today = new Date();
    const targetDate = new Date(dateValue);

    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);

    return Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
};

const getDueState = (milestone) => {
    if (!milestone.dueDate) {
        return {
            label: "No date",
            tone: "neutral"
        };
    }

    const daysUntil = getDaysUntil(milestone.dueDate);

    if (milestone.status === "ACHIEVED") {
        return {
            label: "Complete",
            tone: "complete"
        };
    }

    if (milestone.status === "MISSED") {
        return {
            label: "Missed",
            tone: "danger"
        };
    }

    if (daysUntil < 0) {
        return {
            label: "Overdue",
            tone: "danger"
        };
    }

    if (daysUntil === 0) {
        return {
            label: "Due today",
            tone: "warning"
        };
    }

    if (daysUntil <= 7) {
        return {
            label: `Due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
            tone: "warning"
        };
    }

    return {
        label: new Date(milestone.dueDate).toLocaleDateString(),
        tone: "neutral"
    };
};

function MilestonesPage() {
    const navigate = useNavigate();

    const [milestones, setMilestones] = useState([]);
    const [projects, setProjects] = useState([]);
    const [user, setUser] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingMilestoneId, setEditingMilestoneId] = useState(null);
    const [expandedMilestoneId, setExpandedMilestoneId] = useState(null);
    const [activeFilter, setActiveFilter] = useState("ALL");

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
                milestonesResponse,
                projectsResponse
            ] = await Promise.all([
                fetch(apiUrl("/api/auth/me"), {
                    headers,
                    cache: "no-store"
                }),
                fetch(apiUrl("/api/milestones"), {
                    headers,
                    cache: "no-store"
                }),
                fetch(apiUrl("/api/projects"), {
                    headers,
                    cache: "no-store"
                })
            ]);

            if (
                userResponse.status === 401 ||
                milestonesResponse.status === 401 ||
                projectsResponse.status === 401
            ) {
                localStorage.removeItem("token");
                navigate("/");
                return;
            }

            const userData = await userResponse.json();
            const milestonesData = await milestonesResponse.json();
            const projectsData = await projectsResponse.json();

            if (!milestonesResponse.ok) {
                throw new Error(
                    milestonesData.message ||
                        "Failed to load milestones"
                );
            }

            if (!projectsResponse.ok) {
                throw new Error(
                    projectsData.message || "Failed to load projects"
                );
            }

            setUser(userData.user);
            setMilestones(milestonesData.milestones || []);
            setProjects(projectsData.projects || []);
        } catch (requestError) {
            console.error("Milestones loading error:", requestError);
            setError(
                requestError.message || "Unable to load milestones"
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
        const handleMilestoneChange = () => {
            loadData();
        };

        socket.on("milestoneCreated", handleMilestoneChange);
        socket.on("milestoneUpdated", handleMilestoneChange);
        socket.on("milestoneDeleted", handleMilestoneChange);

        return () => {
            socket.off("milestoneCreated", handleMilestoneChange);
            socket.off("milestoneUpdated", handleMilestoneChange);
            socket.off("milestoneDeleted", handleMilestoneChange);
        };
    }, [loadData]);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setForm((currentForm) => ({
            ...currentForm,
            [name]: value,
            ...(name === "project" ? { owner: "" } : {})
        }));
    };

    const resetForm = () => {
        setForm(emptyForm);
        setIsFormOpen(false);
        setEditingMilestoneId(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setSaving(true);
        setError("");
        setMessage("");

        try {
            const isEditing = Boolean(editingMilestoneId);
            const url = isEditing
                ? apiUrl(`/api/milestones/${editingMilestoneId}`)
                : apiUrl("/api/milestones");

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
                        } milestone`
                );
            }

            setMessage(
                isEditing
                    ? "Milestone updated successfully."
                    : "Milestone created successfully."
            );

            resetForm();
            await loadData();
        } catch (requestError) {
            console.error("Milestone save error:", requestError);
            setError(
                requestError.message || "Unable to save milestone"
            );
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (milestone) => {
        setEditingMilestoneId(milestone._id);
        setIsFormOpen(true);

        setForm({
            title: milestone.title || "",
            description: milestone.description || "",
            status: milestone.status || "PLANNED",
            dueDate: milestone.dueDate
                ? milestone.dueDate.slice(0, 10)
                : "",
            project: milestone.project?._id || "",
            owner: milestone.owner?._id || ""
        });

        setMessage("");
        setError("");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    const handleDelete = async (milestoneId) => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this milestone?"
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setMessage("");

        try {
            const response = await fetch(
                apiUrl(`/api/milestones/${milestoneId}`),
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
                    data.message || "Failed to delete milestone"
                );
            }

            setMessage("Milestone deleted successfully.");

            if (editingMilestoneId === milestoneId) {
                resetForm();
            }

            await loadData();
        } catch (requestError) {
            console.error("Milestone delete error:", requestError);
            setError(
                requestError.message || "Unable to delete milestone"
            );
        }
    };

    const managedProjects = projects.filter(
        (project) =>
            user?.role === "ADMIN" ||
            project.manager?._id === user?.userId
    );

    const canManageMilestones = managedProjects.length > 0;
    const assignableUsers = getProjectAssignableUsers(
        projects,
        form.project
    );
    const filteredMilestones = milestones.filter((milestone) => {
        if (activeFilter === "ALL") {
            return true;
        }

        if (activeFilter === "DUE") {
            return (
                milestone.status !== "ACHIEVED" &&
                milestone.dueDate &&
                getDaysUntil(milestone.dueDate) <= 7
            );
        }

        return milestone.status === activeFilter;
    });
    const getFilterCount = (filterKey) => {
        if (filterKey === "ALL") {
            return milestones.length;
        }

        if (filterKey === "DUE") {
            return milestones.filter(
                (milestone) =>
                    milestone.status !== "ACHIEVED" &&
                    milestone.dueDate &&
                    getDaysUntil(milestone.dueDate) <= 7
            ).length;
        }

        return milestones.filter(
            (milestone) => milestone.status === filterKey
        ).length;
    };
    const canEditMilestone = (milestone) =>
        user?.role === "ADMIN" ||
        milestone.project?.manager?._id === user?.userId;

    if (loading) {
        return (
            <div className="dashboard-loading">
                <p>Loading milestones...</p>
            </div>
        );
    }

    return (
        <>
            <header className="dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">
                        DELIVERY PLAN
                    </p>

                    <h1>Milestones</h1>

                    <p className="dashboard-welcome">
                        Track major checkpoints and delivery dates across
                        projects.
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

            {!canManageMilestones && (
                <div className="dashboard-info">
                    Create a project first, then you can add milestones
                    to that project. Team members can also view
                    milestones for assigned projects.
                </div>
            )}

            {canManageMilestones && (
                <div className="page-toolbar">
                    <button
                        type="button"
                        className="quick-action primary"
                        onClick={() => {
                            setForm(emptyForm);
                            setEditingMilestoneId(null);
                            setIsFormOpen(true);
                        }}
                    >
                        New milestone
                    </button>
                </div>
            )}

            {canManageMilestones && isFormOpen && (
                <section className="project-form-panel">
                    <div className="panel-heading">
                        <div>
                            <p className="panel-label">
                                {editingMilestoneId
                                    ? "EDIT MILESTONE"
                                    : "NEW MILESTONE"}
                            </p>

                            <h2>
                                {editingMilestoneId
                                    ? "Update milestone"
                                    : "Create a milestone"}
                            </h2>
                        </div>

                        {editingMilestoneId && (
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
                            <label htmlFor="milestone-title">
                                Milestone title
                            </label>

                            <input
                                id="milestone-title"
                                name="title"
                                value={form.title}
                                onChange={handleChange}
                                placeholder="Enter milestone title"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="milestone-description">
                                Description
                            </label>

                            <textarea
                                id="milestone-description"
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                placeholder="Describe the checkpoint"
                                rows="4"
                            />
                        </div>

                        <div className="project-form-grid">
                            <div className="form-group">
                                <label htmlFor="milestone-status">
                                    Status
                                </label>

                                <select
                                    id="milestone-status"
                                    name="status"
                                    value={form.status}
                                    onChange={handleChange}
                                >
                                    <option value="PLANNED">
                                        Planned
                                    </option>

                                    <option value="IN_PROGRESS">
                                        In progress
                                    </option>

                                    <option value="ACHIEVED">
                                        Achieved
                                    </option>

                                    <option value="MISSED">
                                        Missed
                                    </option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="milestone-project">
                                    Project
                                </label>

                                <select
                                    id="milestone-project"
                                    name="project"
                                    value={form.project}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">
                                        Select a project
                                    </option>

                                    {managedProjects.map((project) => (
                                        <option
                                            key={project._id}
                                            value={project._id}
                                        >
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="project-form-grid">
                            <div className="form-group">
                                <label htmlFor="milestone-owner">
                                    Owner
                                </label>

                                <select
                                    id="milestone-owner"
                                    name="owner"
                                    value={form.owner}
                                    onChange={handleChange}
                                >
                                    <option value="">
                                        Unassigned
                                    </option>

                                    {assignableUsers
                                        .map((selectedUser) => (
                                            <option
                                                key={selectedUser._id}
                                                value={selectedUser._id}
                                            >
                                                {selectedUser.name} (
                                                {selectedUser.role})
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="milestone-due-date">
                                    Due date
                                </label>

                                <input
                                    id="milestone-due-date"
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
                                : editingMilestoneId
                                  ? "Update milestone"
                                  : "Create milestone"}
                        </button>
                    </form>
                </section>
            )}

            <div className="task-filter-bar">
                {milestoneFilters.map((filter) => (
                    <button
                        key={filter.key}
                        type="button"
                        className={
                            activeFilter === filter.key ? "active" : ""
                        }
                        onClick={() => setActiveFilter(filter.key)}
                    >
                        {filter.label}
                        <span>{getFilterCount(filter.key)}</span>
                    </button>
                ))}
            </div>

            <section className="simple-task-list">
                {milestones.length === 0 ? (
                    <div className="dashboard-panel">
                        <p className="panel-label">
                            NO MILESTONES
                        </p>

                        <h2>No milestones found.</h2>

                        <p>
                            No milestones are visible for your account yet.
                        </p>
                    </div>
                ) : filteredMilestones.length === 0 ? (
                    <div className="dashboard-panel">
                        <p className="panel-label">NO MATCHES</p>

                        <h2>No milestones in this view.</h2>

                        <p>
                            Choose another filter to see the rest of your
                            delivery plan.
                        </p>
                    </div>
                ) : (
                    filteredMilestones.map((milestone) => {
                        const dueState = getDueState(milestone);
                        const isExpanded =
                            expandedMilestoneId === milestone._id;
                        const canManageThisMilestone =
                            canEditMilestone(milestone);

                        return (
                            <article
                                key={milestone._id}
                                className={`simple-task-row project-list-row ${
                                    isExpanded
                                        ? "project-list-row-open"
                                        : ""
                                }`}
                            >
                                <button
                                    type="button"
                                    className="project-row-main"
                                    onClick={() =>
                                        setExpandedMilestoneId(
                                            isExpanded
                                                ? null
                                                : milestone._id
                                        )
                                    }
                                >
                                    <span className="task-status">
                                        {statusLabels[milestone.status] ||
                                            milestone.status}
                                    </span>

                                    <h2>{milestone.title}</h2>

                                    <p>
                                        {milestone.project?.name ||
                                            "Unassigned project"}{" "}
                                        ·{" "}
                                        {milestone.owner?.name ||
                                            "No owner"}{" "}
                                        ·{" "}
                                        {milestone.dueDate
                                            ? new Date(
                                                  milestone.dueDate
                                              ).toLocaleDateString()
                                            : "No deadline"}
                                    </p>
                                </button>

                                <div className="simple-task-meta">
                                    <span
                                        className={`task-pill ${dueState.tone}`}
                                    >
                                        {dueState.label}
                                    </span>

                                    <span className="task-pill">
                                        {milestone.project?.status ||
                                            "No project status"}
                                    </span>
                                </div>

                                {canManageThisMilestone && (
                                    <div className="simple-task-controls">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleEdit(milestone)
                                            }
                                        >
                                            Edit
                                        </button>

                                        <button
                                            type="button"
                                            className="danger-button"
                                            onClick={() =>
                                                handleDelete(
                                                    milestone._id
                                                )
                                            }
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}

                                {isExpanded && (
                                    <div className="project-expanded-details">
                                        <div>
                                            <span>Description</span>

                                            <strong>
                                                {milestone.description ||
                                                    "No description provided."}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Owner</span>

                                            <strong>
                                                {milestone.owner?.name ||
                                                    "Unassigned"}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Project</span>

                                            <strong>
                                                {milestone.project?.name ||
                                                    "Unassigned"}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Project due</span>

                                            <strong>
                                                {milestone.project?.dueDate
                                                    ? new Date(
                                                          milestone.project.dueDate
                                                      ).toLocaleDateString()
                                                    : "No project deadline"}
                                            </strong>
                                        </div>
                                    </div>
                                )}
                            </article>
                        );
                    })
                )}
            </section>
        </>
    );
}

export default MilestonesPage;
