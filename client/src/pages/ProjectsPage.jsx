import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../api";
import socket from "../socket";

const emptyForm = {
    name: "",
    description: "",
    status: "PLANNING",
    startDate: "",
    dueDate: "",
    manager: "",
    members: [],
    teams: []
};

const getProjectManagerOptions = (form, teams, users, user) => {
    const options = new Map();

    const addUser = (selectedUser) => {
        if (selectedUser?._id && selectedUser.role !== "ADMIN") {
            options.set(selectedUser._id, selectedUser);
        }
    };

    addUser(user);
    users.forEach(addUser);
    teams
        .filter((team) => form.teams.includes(team._id))
        .forEach((team) => {
            addUser(team.owner);
            (team.members || []).forEach(addUser);
        });

    return [...options.values()].sort((firstUser, secondUser) =>
        firstUser.name.localeCompare(secondUser.name)
    );
};

const getProjectPeople = (project) => {
    const people = new Map();

    const addPerson = (person, source) => {
        if (person?._id) {
            const existingPerson = people.get(person._id);

            people.set(person._id, {
                ...person,
                source: existingPerson
                    ? `${existingPerson.source}, ${source}`
                    : source
            });
        }
    };

    addPerson(project.manager, "Manager");
    (project.members || []).forEach((member) => {
        addPerson(member, "Project member");
    });
    (project.teams || []).forEach((team) => {
        addPerson(team.owner, `${team.name} owner`);
        (team.members || []).forEach((member) => {
            addPerson(member, team.name);
        });
    });

    return [...people.values()].sort((firstPerson, secondPerson) =>
        firstPerson.name.localeCompare(secondPerson.name)
    );
};

const getProjectWork = (project, tasks, milestones) => {
    const projectTasks = tasks.filter(
        (task) => task.project?._id === project._id
    );
    const projectMilestones = milestones.filter(
        (milestone) => milestone.project?._id === project._id
    );
    const upcomingMilestones = projectMilestones
        .filter((milestone) => milestone.status !== "ACHIEVED")
        .sort(
            (firstMilestone, secondMilestone) =>
                new Date(firstMilestone.dueDate) -
                new Date(secondMilestone.dueDate)
        );

    return {
        tasks: projectTasks,
        todoTasks: projectTasks.filter((task) => task.status === "TODO"),
        inProgressTasks: projectTasks.filter(
            (task) => task.status === "IN_PROGRESS"
        ),
        completedTasks: projectTasks.filter(
            (task) => task.status === "COMPLETED"
        ),
        milestones: projectMilestones,
        upcomingMilestones
    };
};

function ProjectsPage() {
    const navigate = useNavigate();

    const [projects, setProjects] = useState([]);
    const [user, setUser] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [expandedProjectId, setExpandedProjectId] = useState(null);
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [users, setUsers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [milestones, setMilestones] = useState([]);

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
                projectsResponse,
                usersResponse,
                teamsResponse,
                tasksResponse,
                milestonesResponse
            ] = await Promise.all([
                fetch(apiUrl("/api/auth/me"), {
                    headers,
                    cache: "no-store"
                }),
                fetch(apiUrl("/api/projects"), {
                    headers,
                    cache: "no-store"
                }),
                fetch(apiUrl("/api/users/assignable"), {
                    headers,
                    cache: "no-store"
                }),
                fetch(apiUrl("/api/teams"), {
                    headers,
                    cache: "no-store"
                }),
                fetch(apiUrl("/api/tasks"), {
                    headers,
                    cache: "no-store"
                }),
                fetch(apiUrl("/api/milestones"), {
                    headers,
                    cache: "no-store"
                })
            ]);

            if (
                userResponse.status === 401 ||
                projectsResponse.status === 401 ||
                usersResponse.status === 401 ||
                teamsResponse.status === 401 ||
                tasksResponse.status === 401 ||
                milestonesResponse.status === 401
            ) {
                localStorage.removeItem("token");
                navigate("/");
                return;
            }

            const userData = await userResponse.json();
            const projectsData = await projectsResponse.json();
            const usersData = await usersResponse.json();
            const teamsData = await teamsResponse.json();
            const tasksData = await tasksResponse.json();
            const milestonesData = await milestonesResponse.json();

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

            if (!teamsResponse.ok) {
                throw new Error(
                    teamsData.message || "Failed to load teams"
                );
            }

            if (!tasksResponse.ok) {
                throw new Error(
                    tasksData.message || "Failed to load tasks"
                );
            }

            if (!milestonesResponse.ok) {
                throw new Error(
                    milestonesData.message ||
                        "Failed to load milestones"
                );
            }

            setUser(userData.user);
            setProjects(projectsData.projects || []);
            setUsers(usersData.users || []);
            setTeams(teamsData.teams || []);
            setTasks(tasksData.tasks || []);
            setMilestones(milestonesData.milestones || []);
        } catch (requestError) {
            console.error("Projects loading error:", requestError);
            setError(
                requestError.message || "Unable to load projects"
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
        const handleWorkspaceChange = () => {
            loadData();
        };

        socket.on("projectCreated", handleWorkspaceChange);
        socket.on("projectUpdated", handleWorkspaceChange);
        socket.on("projectDeleted", handleWorkspaceChange);
        socket.on("teamCreated", handleWorkspaceChange);
        socket.on("teamUpdated", handleWorkspaceChange);
        socket.on("teamDeleted", handleWorkspaceChange);
        socket.on("teamInviteUpdated", handleWorkspaceChange);
        socket.on("taskCreated", handleWorkspaceChange);
        socket.on("taskUpdated", handleWorkspaceChange);
        socket.on("taskDeleted", handleWorkspaceChange);
        socket.on("milestoneCreated", handleWorkspaceChange);
        socket.on("milestoneUpdated", handleWorkspaceChange);
        socket.on("milestoneDeleted", handleWorkspaceChange);

        return () => {
            socket.off("projectCreated", handleWorkspaceChange);
            socket.off("projectUpdated", handleWorkspaceChange);
            socket.off("projectDeleted", handleWorkspaceChange);
            socket.off("teamCreated", handleWorkspaceChange);
            socket.off("teamUpdated", handleWorkspaceChange);
            socket.off("teamDeleted", handleWorkspaceChange);
            socket.off("teamInviteUpdated", handleWorkspaceChange);
            socket.off("taskCreated", handleWorkspaceChange);
            socket.off("taskUpdated", handleWorkspaceChange);
            socket.off("taskDeleted", handleWorkspaceChange);
            socket.off("milestoneCreated", handleWorkspaceChange);
            socket.off("milestoneUpdated", handleWorkspaceChange);
            socket.off("milestoneDeleted", handleWorkspaceChange);
        };
    }, [loadData]);

    const handleChange = (event) => {
        const { name, value, selectedOptions } = event.target;

        setForm((currentForm) => ({
            ...currentForm,
            [name]:
                name === "members" || name === "teams"
                    ? Array.from(
                          selectedOptions,
                          (option) => option.value
                      )
                    : value
        }));
    };

    const resetForm = () => {
        setForm(emptyForm);
        setIsFormOpen(false);
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
                ? apiUrl(`/api/projects/${editingProjectId}`)
                : apiUrl("/api/projects");

            const payload = {
                ...form
            };

            if (form.manager) {
                payload.manager = form.manager;
            }

            const response = await fetch(url, {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        `Failed to ${
                            isEditing ? "update" : "create"
                        } project`
                );
            }

            setMessage(
                isEditing
                    ? "Project updated successfully."
                    : "Project created successfully."
            );

            resetForm();
            setExpandedProjectId(data.project?._id || editingProjectId);
            await loadData();
        } catch (requestError) {
            console.error("Project save error:", requestError);
            setError(
                requestError.message || "Unable to save project"
            );
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (project) => {
        setEditingProjectId(project._id);
        setIsFormOpen(true);

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
            manager: project.manager?._id || "",
            members: (project.members || []).map(
                (member) => member._id
            ),
            teams: (project.teams || []).map(
                (team) => team._id
            )
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
                apiUrl(`/api/projects/${projectId}`),
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

            if (expandedProjectId === projectId) {
                setExpandedProjectId(null);
            }

            await loadData();
        } catch (requestError) {
            console.error("Project delete error:", requestError);
            setError(
                requestError.message || "Unable to delete project"
            );
        }
    };

    const handleStatusUpdate = async (projectId, status) => {
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                apiUrl(`/api/projects/${projectId}`),
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
                    data.message || "Failed to update project status"
                );
            }

            setMessage("Project status updated successfully.");
            await loadData();
        } catch (requestError) {
            console.error("Project status update error:", requestError);
            setError(
                requestError.message ||
                    "Unable to update project status"
            );
        }
    };

    const canCreateProjects = Boolean(user);
    const managerOptions = getProjectManagerOptions(
        form,
        teams,
        users,
        user
    );
    const projectFilters = [
        {
            key: "ALL",
            label: "All",
            count: projects.length
        },
        {
            key: "PLANNING",
            label: "Planning",
            count: projects.filter(
                (project) => project.status === "PLANNING"
            ).length
        },
        {
            key: "ACTIVE",
            label: "Active",
            count: projects.filter((project) => project.status === "ACTIVE")
                .length
        },
        {
            key: "ON_HOLD",
            label: "On hold",
            count: projects.filter(
                (project) => project.status === "ON_HOLD"
            ).length
        },
        {
            key: "COMPLETED",
            label: "Completed",
            count: projects.filter(
                (project) => project.status === "COMPLETED"
            ).length
        }
    ];
    const filteredProjects = projects.filter((project) =>
        activeFilter === "ALL" ? true : project.status === activeFilter
    );

    if (loading) {
        return (
            <div className="dashboard-loading">
                <p>Loading projects...</p>
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

            {canCreateProjects && (
                <div className="page-toolbar">
                    <button
                        type="button"
                        className="quick-action primary"
                        onClick={() => {
                            setForm(emptyForm);
                            setEditingProjectId(null);
                            setIsFormOpen(true);
                        }}
                    >
                        New project
                    </button>
                </div>
            )}

            {canCreateProjects && isFormOpen && (
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

                            {user?.role === "ADMIN" || editingProjectId ? (
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

                                        {(user?.role === "ADMIN"
                                            ? users.filter(
                                                  (selectedUser) =>
                                                      selectedUser.role !==
                                                      "ADMIN"
                                              )
                                            : managerOptions
                                        ).map((selectedUser) => (
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
                            ) : (
                                <div className="dashboard-info compact-info">
                                    You will manage this project.
                                </div>
                            )}
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

                        {user?.role === "ADMIN" && (
                            <div className="form-group">
                                <label htmlFor="project-members">
                                    Individual members
                                </label>

                                <select
                                    id="project-members"
                                    name="members"
                                    value={form.members}
                                    onChange={handleChange}
                                    multiple
                                    size="4"
                                >
                                    {users
                                        .filter(
                                            (selectedUser) =>
                                                selectedUser.role !==
                                                "ADMIN"
                                        )
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
                        )}

                        <div className="form-group">
                            <label htmlFor="project-teams">
                                Project teams
                            </label>

                            <select
                                id="project-teams"
                                name="teams"
                                value={form.teams}
                                onChange={handleChange}
                                multiple
                                size="4"
                            >
                                {teams.map((team) => (
                                    <option
                                        key={team._id}
                                        value={team._id}
                                    >
                                        {team.name}
                                    </option>
                                ))}
                            </select>
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

            {projects.length > 0 && (
                <div className="task-filter-bar">
                    {projectFilters.map((filter) => (
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

            <section className="simple-task-list">
                {projects.length === 0 ? (
                    <div className="dashboard-panel">
                        <p className="panel-label">
                            NO PROJECTS
                        </p>

                        <h2>No projects found.</h2>

                        <p>
                            No projects are assigned to your account yet.
                        </p>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="dashboard-panel">
                        <p className="panel-label">
                            NO MATCHES
                        </p>

                        <h2>No projects in this view.</h2>

                        <p>
                            Choose another filter to continue.
                        </p>
                    </div>
                ) : (
                    filteredProjects.map((project) => {
                        const projectPeople = getProjectPeople(project);
                        const projectWork = getProjectWork(
                            project,
                            tasks,
                            milestones
                        );
                        const isExpanded =
                            expandedProjectId === project._id;
                        const totalTasks = projectWork.tasks.length;
                        const completionRate =
                            totalTasks > 0
                                ? Math.round(
                                      (projectWork.completedTasks.length /
                                          totalTasks) *
                                          100
                                  )
                                : 0;

                        return (
                            <article
                                key={project._id}
                                className={`simple-task-row project-list-row ${
                                    isExpanded ? "project-list-row-open" : ""
                                }`}
                            >
                                <button
                                    type="button"
                                    className="project-row-main"
                                    onClick={() =>
                                        setExpandedProjectId(
                                            isExpanded ? null : project._id
                                        )
                                    }
                                >
                                    <span className="task-status">
                                        {project.status}
                                    </span>

                                    <h2>{project.name}</h2>

                                    <p>
                                        {project.manager?.name ||
                                            "Unassigned"}{" "}
                                        ·{" "}
                                        {project.dueDate
                                            ? new Date(
                                                  project.dueDate
                                              ).toLocaleDateString()
                                            : "No deadline"}
                                    </p>
                                </button>

                                <div className="simple-task-meta">
                                    <span className="task-pill">
                                        {completionRate}% done
                                    </span>
                                    <span className="task-pill">
                                        {totalTasks} task
                                        {totalTasks === 1 ? "" : "s"}
                                    </span>
                                    <span className="task-pill">
                                        {project.teams?.length || 0} team
                                        {(project.teams?.length || 0) === 1
                                            ? ""
                                            : "s"}
                                    </span>
                                </div>

                                <div className="simple-task-controls">
                                    {(user?.role === "ADMIN" ||
                                        project.manager?._id ===
                                            user?.userId) && (
                                        <>
                                            <select
                                                value={project.status}
                                                onChange={(event) =>
                                                    handleStatusUpdate(
                                                        project._id,
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                <option value="PLANNING">
                                                    Planning
                                                </option>
                                                <option value="ACTIVE">
                                                    Active
                                                </option>
                                                <option value="ON_HOLD">
                                                    On hold
                                                </option>
                                                <option value="COMPLETED">
                                                    Completed
                                                </option>
                                            </select>

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
                                                    handleDelete(project._id)
                                                }
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </div>

                                {isExpanded && (
                                    <div className="project-expanded-details">
                                        <div className="project-work-stats">
                                            <div>
                                                <span>To do</span>
                                                <strong>
                                                    {
                                                        projectWork.todoTasks
                                                            .length
                                                    }
                                                </strong>
                                            </div>
                                            <div>
                                                <span>In progress</span>
                                                <strong>
                                                    {
                                                        projectWork
                                                            .inProgressTasks
                                                            .length
                                                    }
                                                </strong>
                                            </div>
                                            <div>
                                                <span>Completed</span>
                                                <strong>
                                                    {
                                                        projectWork
                                                            .completedTasks
                                                            .length
                                                    }
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="project-linked-section">
                                            <span>Teams</span>
                                            {project.teams?.length ? (
                                                project.teams.map((team) => (
                                                    <p key={team._id}>
                                                        {team.name} ·{" "}
                                                        {team.members?.length ||
                                                            0}{" "}
                                                        members
                                                    </p>
                                                ))
                                            ) : (
                                                <p>No team attached yet.</p>
                                            )}
                                        </div>

                                        <div className="project-linked-section">
                                            <span>People</span>
                                            {projectPeople
                                                .slice(0, 5)
                                                .map((person) => (
                                                    <p key={person._id}>
                                                        {person.name} ·{" "}
                                                        {person.source}
                                                    </p>
                                                ))}
                                        </div>

                                        <div className="project-linked-section">
                                            <span>Next milestone</span>
                                            {projectWork
                                                .upcomingMilestones[0] ? (
                                                <p>
                                                    {
                                                        projectWork
                                                            .upcomingMilestones[0]
                                                            .title
                                                    }{" "}
                                                    ·{" "}
                                                    {new Date(
                                                        projectWork.upcomingMilestones[0].dueDate
                                                    ).toLocaleDateString()}
                                                </p>
                                            ) : (
                                                <p>No upcoming milestone.</p>
                                            )}
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

export default ProjectsPage;
