import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../api";
import socket from "../socket";

const emptyForm = {
    name: "",
    description: ""
};

const isSameId = (leftId, rightId) =>
    (leftId?._id || leftId)?.toString() ===
    (rightId?._id || rightId)?.toString();

const getTeamProjectWork = (team, projects, tasks, milestones) => {
    const memberIds = new Set(
        (team.members || []).map((member) => member._id)
    );

    const linkedProjects = projects.filter((project) =>
        (project.teams || []).some((projectTeam) =>
            isSameId(projectTeam, team._id)
        )
    );

    const linkedProjectIds = new Set(
        linkedProjects.map((project) => project._id)
    );

    const teamTasks = tasks.filter(
        (task) =>
            linkedProjectIds.has(task.project?._id) &&
            (!task.assignedTo?._id ||
                memberIds.has(task.assignedTo._id))
    );

    const teamMilestones = milestones.filter((milestone) =>
        linkedProjectIds.has(milestone.project?._id)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueTasks = teamTasks.filter((task) => {
        if (!task.dueDate || task.status === "COMPLETED") {
            return false;
        }

        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        return dueDate < today;
    });

    return {
        linkedProjects,
        teamTasks,
        activeTasks: teamTasks.filter(
            (task) => task.status !== "COMPLETED"
        ),
        completedTasks: teamTasks.filter(
            (task) => task.status === "COMPLETED"
        ),
        overdueTasks,
        teamMilestones: teamMilestones
            .filter((milestone) => milestone.status !== "ACHIEVED")
            .sort(
                (firstMilestone, secondMilestone) =>
                    new Date(firstMilestone.dueDate) -
                    new Date(secondMilestone.dueDate)
            )
    };
};

function TeamsPage() {
    const navigate = useNavigate();

    const [teams, setTeams] = useState([]);
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [milestones, setMilestones] = useState([]);
    const [user, setUser] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [expandedTeamId, setExpandedTeamId] = useState(null);
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [inviteLinks, setInviteLinks] = useState({});
    const [inviteRecords, setInviteRecords] = useState({});

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
                meResponse,
                teamsResponse,
                projectsResponse,
                tasksResponse,
                milestonesResponse
            ] =
                await Promise.all([
                    fetch(apiUrl("/api/auth/me"), {
                        headers,
                        cache: "no-store"
                    }),
                    fetch(apiUrl("/api/teams"), {
                        headers,
                        cache: "no-store"
                    }),
                    fetch(apiUrl("/api/projects"), {
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
                meResponse.status === 401 ||
                teamsResponse.status === 401 ||
                projectsResponse.status === 401 ||
                tasksResponse.status === 401 ||
                milestonesResponse.status === 401
            ) {
                localStorage.removeItem("token");
                navigate("/");
                return;
            }

            const meData = await meResponse.json();
            const teamsData = await teamsResponse.json();
            const projectsData = await projectsResponse.json();
            const tasksData = await tasksResponse.json();
            const milestonesData = await milestonesResponse.json();

            if (!teamsResponse.ok) {
                throw new Error(
                    teamsData.message || "Failed to load teams"
                );
            }

            if (!projectsResponse.ok) {
                throw new Error(
                    projectsData.message || "Failed to load projects"
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

            setUser(meData.user);
            setTeams(teamsData.teams || []);
            setProjects(projectsData.projects || []);
            setTasks(tasksData.tasks || []);
            setMilestones(milestonesData.milestones || []);

            const manageableTeams = (teamsData.teams || []).filter(
                (team) =>
                    meData.user?.role === "ADMIN" ||
                    team.owner?._id === meData.user?.userId
            );

            const inviteResponses = await Promise.all(
                manageableTeams.map((team) =>
                    fetch(apiUrl(`/api/teams/${team._id}/invites`), {
                        headers,
                        cache: "no-store"
                    })
                        .then(async (response) => {
                            const data = await response.json();

                            return [
                                team._id,
                                response.ok ? data.invites || [] : []
                            ];
                        })
                        .catch(() => [team._id, []])
                )
            );

            setInviteRecords(Object.fromEntries(inviteResponses));
        } catch (requestError) {
            console.error("Teams loading error:", requestError);
            setError(
                requestError.message || "Unable to load teams"
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
        const handleTeamChange = () => {
            loadData();
        };

        socket.on("teamCreated", handleTeamChange);
        socket.on("teamUpdated", handleTeamChange);
        socket.on("teamDeleted", handleTeamChange);
        socket.on("teamInviteCreated", handleTeamChange);
        socket.on("teamInviteUpdated", handleTeamChange);
        socket.on("projectCreated", handleTeamChange);
        socket.on("projectUpdated", handleTeamChange);
        socket.on("projectDeleted", handleTeamChange);
        socket.on("taskCreated", handleTeamChange);
        socket.on("taskUpdated", handleTeamChange);
        socket.on("taskDeleted", handleTeamChange);
        socket.on("milestoneCreated", handleTeamChange);
        socket.on("milestoneUpdated", handleTeamChange);
        socket.on("milestoneDeleted", handleTeamChange);

        return () => {
            socket.off("teamCreated", handleTeamChange);
            socket.off("teamUpdated", handleTeamChange);
            socket.off("teamDeleted", handleTeamChange);
            socket.off("teamInviteCreated", handleTeamChange);
            socket.off("teamInviteUpdated", handleTeamChange);
            socket.off("projectCreated", handleTeamChange);
            socket.off("projectUpdated", handleTeamChange);
            socket.off("projectDeleted", handleTeamChange);
            socket.off("taskCreated", handleTeamChange);
            socket.off("taskUpdated", handleTeamChange);
            socket.off("taskDeleted", handleTeamChange);
            socket.off("milestoneCreated", handleTeamChange);
            socket.off("milestoneUpdated", handleTeamChange);
            socket.off("milestoneDeleted", handleTeamChange);
        };
    }, [loadData]);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setForm((currentForm) => ({
            ...currentForm,
            [name]: value
        }));
    };

    const resetForm = () => {
        setForm(emptyForm);
        setIsFormOpen(false);
        setEditingTeamId(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setMessage("");

        try {
            const isEditing = Boolean(editingTeamId);
            const response = await fetch(
                isEditing
                    ? apiUrl(`/api/teams/${editingTeamId}`)
                    : apiUrl("/api/teams"),
                {
                    method: isEditing ? "PUT" : "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(form)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        `Failed to ${
                            isEditing ? "update" : "create"
                        } team`
                );
            }

            setMessage(
                isEditing
                    ? "Team updated successfully."
                    : "Team created successfully."
            );
            resetForm();
            setExpandedTeamId(data.team?._id || editingTeamId);
            await loadData();
        } catch (requestError) {
            console.error("Team save error:", requestError);
            setError(requestError.message || "Unable to save team");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (team) => {
        setEditingTeamId(team._id);
        setIsFormOpen(true);
        setForm({
            name: team.name || "",
            description: team.description || ""
        });
        setMessage("");
        setError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const createInviteLink = async (teamId) => {
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                apiUrl(`/api/teams/${teamId}/invites`),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to create invite link"
                );
            }

            const inviteUrl = `${window.location.origin}/team-invites/${data.invite.token}`;

            setInviteLinks((currentLinks) => ({
                ...currentLinks,
                [teamId]: inviteUrl
            }));
            setMessage("Invite link created successfully.");
            await loadData();
        } catch (requestError) {
            console.error("Team invite error:", requestError);
            setError(
                requestError.message || "Unable to create invite link"
            );
        }
    };

    const removeMember = async (teamId, userId) => {
        const confirmed = window.confirm(
            "Remove this person from the team?"
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setMessage("");

        try {
            const response = await fetch(
                apiUrl(`/api/teams/${teamId}/members/${userId}`),
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
                    data.message || "Failed to remove team member"
                );
            }

            setMessage("Team member removed successfully.");
            await loadData();
        } catch (requestError) {
            console.error("Team member remove error:", requestError);
            setError(
                requestError.message || "Unable to remove team member"
            );
        }
    };

    const handleDelete = async (teamId) => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this team?"
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setMessage("");

        try {
            const response = await fetch(apiUrl(`/api/teams/${teamId}`), {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to delete team"
                );
            }

            setMessage("Team deleted successfully.");
            if (editingTeamId === teamId) {
                resetForm();
            }
            if (expandedTeamId === teamId) {
                setExpandedTeamId(null);
            }
            await loadData();
        } catch (requestError) {
            console.error("Team delete error:", requestError);
            setError(requestError.message || "Unable to delete team");
        }
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <p>Loading teams...</p>
            </div>
        );
    }

    const ownedTeams = teams.filter(
        (team) =>
            user?.role === "ADMIN" || team.owner?._id === user?.userId
    );
    const joinedTeams = teams.filter((team) =>
        (team.members || []).some((member) => member._id === user?.userId)
    );
    const activeTeams = teams.filter((team) => {
        const teamWork = getTeamProjectWork(
            team,
            projects,
            tasks,
            milestones
        );

        return (
            teamWork.linkedProjects.length > 0 ||
            teamWork.activeTasks.length > 0
        );
    });
    const teamFilters = [
        {
            key: "ALL",
            label: "All",
            count: teams.length
        },
        {
            key: "ACTIVE",
            label: "Active",
            count: activeTeams.length
        },
        {
            key: "MINE",
            label: "My teams",
            count: joinedTeams.length
        },
        {
            key: "OWNED",
            label: "Managed",
            count: ownedTeams.length
        }
    ];
    const filteredTeams = teams.filter((team) => {
        if (activeFilter === "ALL") {
            return true;
        }

        if (activeFilter === "ACTIVE") {
            return activeTeams.some((activeTeam) => activeTeam._id === team._id);
        }

        if (activeFilter === "MINE") {
            return joinedTeams.some((joinedTeam) => joinedTeam._id === team._id);
        }

        return ownedTeams.some((ownedTeam) => ownedTeam._id === team._id);
    });

    return (
        <>
            <header className="dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">
                        COLLABORATION
                    </p>
                    <h1>Teams</h1>
                    <p className="dashboard-welcome">
                        Create reusable groups and attach them to projects.
                    </p>
                </div>

                <div className="user-badge">{user?.role}</div>
            </header>

            {error && <div className="dashboard-error">{error}</div>}
            {message && (
                <div className="dashboard-success">{message}</div>
            )}

            <div className="page-toolbar">
                <button
                    type="button"
                    className="quick-action primary"
                    onClick={() => {
                        setForm(emptyForm);
                        setEditingTeamId(null);
                        setIsFormOpen(true);
                    }}
                >
                    New team
                </button>
            </div>

            {isFormOpen && (
                <section className="project-form-panel">
                    <div className="panel-heading">
                        <div>
                            <p className="panel-label">
                                {editingTeamId ? "EDIT TEAM" : "NEW TEAM"}
                            </p>
                            <h2>
                                {editingTeamId
                                    ? "Update team"
                                    : "Create a team"}
                            </h2>
                        </div>

                        <button
                            type="button"
                            className="form-cancel-button"
                            onClick={resetForm}
                        >
                            Cancel
                        </button>
                    </div>

                    <form
                        className="project-form"
                        onSubmit={handleSubmit}
                    >
                        <div className="form-group">
                            <label htmlFor="team-name">Team name</label>
                            <input
                                id="team-name"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                placeholder="Enter team name"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="team-description">
                                Description
                            </label>
                            <textarea
                                id="team-description"
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                placeholder="What does this team work on?"
                                rows="4"
                            />
                        </div>

                        <button
                            type="submit"
                            className="login-button"
                            disabled={saving}
                        >
                            {saving
                                ? "Saving..."
                                : editingTeamId
                                  ? "Update team"
                                  : "Create team"}
                        </button>
                    </form>
                </section>
            )}

            {teams.length > 0 && (
                <div className="task-filter-bar">
                    {teamFilters.map((filter) => (
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
                {teams.length === 0 ? (
                    <div className="dashboard-panel">
                        <p className="panel-label">NO TEAMS</p>
                        <h2>No teams found.</h2>
                        <p>Create a team to group people for projects.</p>
                    </div>
                ) : filteredTeams.length === 0 ? (
                    <div className="dashboard-panel">
                        <p className="panel-label">NO MATCHES</p>
                        <h2>No teams in this view.</h2>
                        <p>Choose another filter to continue.</p>
                    </div>
                ) : (
                    filteredTeams.map((team) => {
                        const canManageTeam =
                            user?.role === "ADMIN" ||
                            team.owner?._id === user?.userId;
                        const openInvites = (
                            inviteRecords[team._id] || []
                        ).filter((invite) => invite.status === "OPEN");
                        const teamWork = getTeamProjectWork(
                            team,
                            projects,
                            tasks,
                            milestones
                        );
                        const isExpanded = expandedTeamId === team._id;

                        return (
                            <article
                                key={team._id}
                                className={`simple-task-row project-list-row ${
                                    isExpanded ? "project-list-row-open" : ""
                                }`}
                            >
                                <button
                                    type="button"
                                    className="project-row-main"
                                    onClick={() =>
                                        setExpandedTeamId(
                                            isExpanded ? null : team._id
                                        )
                                    }
                                >
                                    <span className="task-status">Team</span>
                                    <h2>{team.name}</h2>
                                    <p>
                                        {team.owner?.name || "Unassigned"} ·{" "}
                                        {team.description ||
                                            "No description provided."}
                                    </p>
                                </button>

                                <div className="simple-task-meta">
                                    <span className="task-pill">
                                        {team.members?.length || 0} member
                                        {(team.members?.length || 0) === 1
                                            ? ""
                                            : "s"}
                                    </span>
                                    <span className="task-pill">
                                        {teamWork.linkedProjects.length} project
                                        {teamWork.linkedProjects.length === 1
                                            ? ""
                                            : "s"}
                                    </span>
                                    <span className="task-pill">
                                        {teamWork.activeTasks.length} active
                                    </span>
                                </div>

                                <div className="simple-task-controls">
                                    {canManageTeam && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleEdit(team)
                                                }
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    createInviteLink(team._id)
                                                }
                                            >
                                                Invite
                                            </button>
                                            <button
                                                type="button"
                                                className="danger-button"
                                                onClick={() =>
                                                    handleDelete(team._id)
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
                                                <span>Completed</span>
                                                <strong>
                                                    {
                                                        teamWork.completedTasks
                                                            .length
                                                    }
                                                </strong>
                                            </div>
                                            <div>
                                                <span>Overdue</span>
                                                <strong>
                                                    {
                                                        teamWork.overdueTasks
                                                            .length
                                                    }
                                                </strong>
                                            </div>
                                            <div>
                                                <span>Milestones</span>
                                                <strong>
                                                    {
                                                        teamWork.teamMilestones
                                                            .length
                                                    }
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="project-linked-section">
                                            <span>Linked projects</span>
                                            {teamWork.linkedProjects.length ===
                                            0 ? (
                                                <p>
                                                    Attach this team while
                                                    creating or editing a
                                                    project.
                                                </p>
                                            ) : (
                                                teamWork.linkedProjects.map(
                                                    (project) => (
                                                        <p key={project._id}>
                                                            {project.name} ·{" "}
                                                            {project.status}
                                                        </p>
                                                    )
                                                )
                                            )}
                                        </div>

                                        <div className="project-linked-section">
                                            <span>Members</span>
                                            {(team.members || []).map(
                                                (member) => {
                                                    const memberTasks =
                                                        teamWork.activeTasks.filter(
                                                            (task) =>
                                                                task.assignedTo
                                                                    ?._id ===
                                                                member._id
                                                        );

                                                    return (
                                                        <div
                                                            key={member._id}
                                                            className="member-row"
                                                        >
                                                            <div>
                                                                <strong>
                                                                    {
                                                                        member.name
                                                                    }
                                                                </strong>
                                                                <span>
                                                                    {
                                                                        member.email
                                                                    }{" "}
                                                                    ·{" "}
                                                                    {
                                                                        memberTasks.length
                                                                    }{" "}
                                                                    active
                                                                </span>
                                                            </div>

                                                            {canManageTeam &&
                                                                member._id !==
                                                                    team.owner
                                                                        ?._id && (
                                                                    <button
                                                                        type="button"
                                                                        className="danger-button"
                                                                        onClick={() =>
                                                                            removeMember(
                                                                                team._id,
                                                                                member._id
                                                                            )
                                                                        }
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                )}
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>

                                        {(inviteLinks[team._id] ||
                                            openInvites.length > 0) && (
                                            <div className="invite-link-box">
                                                <input
                                                    value={
                                                        inviteLinks[
                                                            team._id
                                                        ] ||
                                                        `${window.location.origin}/team-invites/${openInvites[0]?.token}`
                                                    }
                                                    readOnly
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard?.writeText(
                                                            inviteLinks[
                                                                team._id
                                                            ] ||
                                                                `${window.location.origin}/team-invites/${openInvites[0]?.token}`
                                                        );
                                                        setMessage(
                                                            "Invite link copied."
                                                        );
                                                    }}
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        )}
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

export default TeamsPage;
