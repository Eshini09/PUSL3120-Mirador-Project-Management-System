import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../api";
import socket from "../socket";

const activityFilters = [
    {
        key: "ALL",
        label: "All"
    },
    {
        key: "Task",
        label: "Tasks"
    },
    {
        key: "Project",
        label: "Projects"
    },
    {
        key: "Milestone",
        label: "Milestones"
    },
    {
        key: "Team",
        label: "Teams"
    }
];

const statusLabels = {
    TODO: "Active",
    IN_PROGRESS: "Ongoing",
    COMPLETED: "Completed",
    PLANNING: "Planning",
    ACTIVE: "Active",
    ON_HOLD: "On hold",
    PLANNED: "Planned",
    ACHIEVED: "Achieved",
    MISSED: "Missed"
};

const socketEvents = [
    "projectCreated",
    "projectUpdated",
    "projectDeleted",
    "taskCreated",
    "taskUpdated",
    "taskDeleted",
    "milestoneCreated",
    "milestoneUpdated",
    "milestoneDeleted",
    "teamCreated",
    "teamUpdated",
    "teamDeleted",
    "teamInviteCreated",
    "teamInviteUpdated"
];

const formatActivityDate = (dateValue) =>
    new Date(dateValue).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    });

const formatRelativeTime = (dateValue) => {
    const diffInMinutes = Math.round(
        (Date.now() - new Date(dateValue).getTime()) / 60000
    );

    if (diffInMinutes < 1) {
        return "Just now";
    }

    if (diffInMinutes < 60) {
        return `${diffInMinutes} min ago`;
    }

    const diffInHours = Math.round(diffInMinutes / 60);

    if (diffInHours < 24) {
        return `${diffInHours} hr ago`;
    }

    const diffInDays = Math.round(diffInHours / 24);

    if (diffInDays === 1) {
        return "Yesterday";
    }

    return `${diffInDays} days ago`;
};

const makeActivityItem = ({
    id,
    type,
    verb,
    title,
    detail,
    updatedAt,
    createdAt
}) => ({
    id,
    type,
    verb,
    title,
    detail,
    happenedAt: updatedAt || createdAt,
    createdAt,
    isCreated:
        createdAt &&
        updatedAt &&
        new Date(updatedAt).getTime() === new Date(createdAt).getTime()
});

const getActivityVerb = (type, record, fallback = "updated") => {
    const wasCreated =
        record.createdAt &&
        record.updatedAt &&
        new Date(record.createdAt).getTime() ===
            new Date(record.updatedAt).getTime();

    if (wasCreated) {
        return `${type} created`;
    }

    if (type === "Task" && record.status === "COMPLETED") {
        return "Task completed";
    }

    if (type === "Milestone" && record.status === "ACHIEVED") {
        return "Milestone achieved";
    }

    if (type === "Project" && record.status === "COMPLETED") {
        return "Project completed";
    }

    return `${type} ${fallback}`;
};

function ActivityPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [activity, setActivity] = useState([]);
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadActivity = useCallback(async () => {
        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/");
            return;
        }

        try {
            setError("");

            const headers = {
                Authorization: `Bearer ${token}`
            };

            const [
                userResponse,
                projectsResponse,
                tasksResponse,
                milestonesResponse,
                teamsResponse
            ] = await Promise.all([
                fetch(apiUrl("/api/auth/me"), { headers, cache: "no-store" }),
                fetch(apiUrl("/api/projects"), { headers, cache: "no-store" }),
                fetch(apiUrl("/api/tasks"), { headers, cache: "no-store" }),
                fetch(apiUrl("/api/milestones"), {
                    headers,
                    cache: "no-store"
                }),
                fetch(apiUrl("/api/teams"), { headers, cache: "no-store" })
            ]);

            if (
                userResponse.status === 401 ||
                projectsResponse.status === 401 ||
                tasksResponse.status === 401 ||
                milestonesResponse.status === 401 ||
                teamsResponse.status === 401
            ) {
                localStorage.removeItem("token");
                navigate("/");
                return;
            }

            const userData = await userResponse.json();
            const projectsData = await projectsResponse.json();
            const tasksData = await tasksResponse.json();
            const milestonesData = await milestonesResponse.json();
            const teamsData = await teamsResponse.json();

            if (
                !projectsResponse.ok ||
                !tasksResponse.ok ||
                !milestonesResponse.ok ||
                !teamsResponse.ok
            ) {
                throw new Error("Unable to load workspace activity.");
            }

            const projectItems = (projectsData.projects || []).map(
                (project) =>
                    makeActivityItem({
                        id: `project-${project._id}`,
                        type: "Project",
                        verb: getActivityVerb("Project", project),
                        title: project.name,
                        detail: `${statusLabels[project.status] || project.status} · Manager ${
                            project.manager?.name || "Unassigned"
                        }`,
                        updatedAt: project.updatedAt,
                        createdAt: project.createdAt
                    })
            );
            const taskItems = (tasksData.tasks || []).map((task) =>
                makeActivityItem({
                    id: `task-${task._id}`,
                    type: "Task",
                    verb: getActivityVerb("Task", task),
                    title: task.title,
                    detail: `${statusLabels[task.status] || task.status} · ${
                        task.project?.name || "No project"
                    } · ${task.assignedTo?.name || "Unassigned"}`,
                    updatedAt: task.updatedAt,
                    createdAt: task.createdAt
                })
            );
            const milestoneItems = (milestonesData.milestones || []).map(
                (milestone) =>
                    makeActivityItem({
                        id: `milestone-${milestone._id}`,
                        type: "Milestone",
                        verb: getActivityVerb("Milestone", milestone),
                        title: milestone.title,
                        detail: `${statusLabels[milestone.status] || milestone.status} · ${
                            milestone.project?.name || "No project"
                        }`,
                        updatedAt: milestone.updatedAt,
                        createdAt: milestone.createdAt
                    })
            );
            const teamItems = (teamsData.teams || []).map((team) =>
                makeActivityItem({
                    id: `team-${team._id}`,
                    type: "Team",
                    verb: getActivityVerb("Team", team),
                    title: team.name,
                    detail: `${(team.members || []).length + 1} people · ${
                        team.owner?.name || "No owner"
                    }`,
                    updatedAt: team.updatedAt,
                    createdAt: team.createdAt
                })
            );

            setUser(userData.user);
            setActivity(
                [
                    ...projectItems,
                    ...taskItems,
                    ...milestoneItems,
                    ...teamItems
                ]
                    .filter((item) => item.happenedAt)
                    .sort(
                        (first, second) =>
                            new Date(second.happenedAt) -
                            new Date(first.happenedAt)
                    )
                    .slice(0, 40)
            );
        } catch (requestError) {
            console.error("Activity loading error:", requestError);
            setError(
                requestError.message || "Unable to load activity."
            );
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        queueMicrotask(loadActivity);
    }, [loadActivity]);

    useEffect(() => {
        const refreshActivity = () => loadActivity();

        socketEvents.forEach((eventName) => {
            socket.on(eventName, refreshActivity);
        });

        return () => {
            socketEvents.forEach((eventName) => {
                socket.off(eventName, refreshActivity);
            });
        };
    }, [loadActivity]);

    if (loading) {
        return (
            <div className="loading-state">
                <div className="loading-spinner" />
                <p>Loading activity...</p>
            </div>
        );
    }

    const filteredActivity =
        activeFilter === "ALL"
            ? activity
            : activity.filter((item) => item.type === activeFilter);
    const todayCount = activity.filter((item) => {
        const itemDate = new Date(item.happenedAt);
        const today = new Date();

        return itemDate.toDateString() === today.toDateString();
    }).length;
    const taskCount = activity.filter((item) => item.type === "Task").length;
    const teamCount = activity.filter((item) => item.type === "Team").length;
    const getFilterCount = (filterKey) =>
        filterKey === "ALL"
            ? activity.length
            : activity.filter((item) => item.type === filterKey).length;

    return (
        <>
            <header className="dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">REALTIME HISTORY</p>
                    <h1>Activity</h1>
                    <p className="dashboard-welcome">
                        Recent project, task, milestone and team changes from
                        your visible workspace.
                    </p>
                </div>

                <div className="user-badge">{user?.role}</div>
            </header>

            {error && <div className="dashboard-error">{error}</div>}

            <section className="dashboard-stat-grid compact-dashboard-stats">
                <article className="dashboard-stat-card">
                    <div className="stat-card-top">
                        <span>Recent updates</span>
                        <span className="stat-icon">A</span>
                    </div>
                    <strong>{activity.length}</strong>
                    <p>Latest visible workspace changes</p>
                </article>

                <article className="dashboard-stat-card">
                    <div className="stat-card-top">
                        <span>Today</span>
                        <span className="stat-icon">T</span>
                    </div>
                    <strong>{todayCount}</strong>
                    <p>Changes recorded today</p>
                </article>

                <article className="dashboard-stat-card">
                    <div className="stat-card-top">
                        <span>Task activity</span>
                        <span className="stat-icon">✓</span>
                    </div>
                    <strong>{taskCount}</strong>
                    <p>Task updates in this feed</p>
                </article>

                <article className="dashboard-stat-card">
                    <div className="stat-card-top">
                        <span>Team activity</span>
                        <span className="stat-icon">+</span>
                    </div>
                    <strong>{teamCount}</strong>
                    <p>Team changes in this feed</p>
                </article>
            </section>

            <div className="task-filter-bar">
                {activityFilters.map((filter) => (
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

            <section className="dashboard-card">
                {activity.length === 0 ? (
                    <div className="dashboard-empty">
                        <span>○</span>
                        <p>No activity has been recorded yet.</p>
                    </div>
                ) : filteredActivity.length === 0 ? (
                    <div className="dashboard-empty">
                        <span>○</span>
                        <p>No activity matches this filter.</p>
                    </div>
                ) : (
                    <div className="activity-feed">
                        {filteredActivity.map((item) => (
                            <article className="activity-item" key={item.id}>
                                <span
                                    className={`activity-type ${item.type.toLowerCase()}`}
                                >
                                    {item.type}
                                </span>
                                <div>
                                    <strong>{item.verb}</strong>
                                    <p>
                                        {item.title} · {item.detail}
                                    </p>
                                </div>
                                <time title={formatActivityDate(item.happenedAt)}>
                                    {formatRelativeTime(item.happenedAt)}
                                </time>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}

export default ActivityPage;
