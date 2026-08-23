import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "../api";
import socket from "../socket";

const taskLabels = {
    TODO: "To do",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed"
};

const roleLabels = {
    ADMIN: "Administrator",
    PROJECT_MANAGER: "Project manager",
    TEAM_MEMBER: "Team member"
};

const getEntityId = (entity) => entity?._id || entity?.id || entity;

const isSameId = (firstValue, secondValue) =>
    Boolean(firstValue) &&
    Boolean(secondValue) &&
    getEntityId(firstValue)?.toString() ===
        getEntityId(secondValue)?.toString();

const isTaskOpen = (task) => task.status !== "COMPLETED";

const isMilestoneOpen = (milestone) => milestone.status !== "ACHIEVED";

const isProjectOpen = (project) =>
    !["COMPLETED", "ON_HOLD"].includes(project.status);

const getProjectIdFromWorkItem = (workItem) =>
    getEntityId(workItem.project)?.toString();

const getProjectMetrics = (project, tasks, milestones) => {
    const projectId = project._id?.toString();
    const projectTasks = tasks.filter(
        (task) => getProjectIdFromWorkItem(task) === projectId
    );
    const projectMilestones = milestones.filter(
        (milestone) => getProjectIdFromWorkItem(milestone) === projectId
    );
    const openTasks = projectTasks.filter(isTaskOpen);
    const openMilestones = projectMilestones.filter(isMilestoneOpen);
    const completedTasks = projectTasks.filter(
        (task) => task.status === "COMPLETED"
    );
    const completedMilestones = projectMilestones.filter(
        (milestone) => milestone.status === "ACHIEVED"
    );
    const totalWorkItems =
        projectTasks.length + projectMilestones.length;
    const completedWorkItems =
        completedTasks.length + completedMilestones.length;
    const completion =
        totalWorkItems > 0
            ? Math.round((completedWorkItems / totalWorkItems) * 100)
            : project.status === "COMPLETED"
              ? 100
              : 0;

    return {
        projectTasks,
        projectMilestones,
        openTasks,
        openMilestones,
        completedTasks,
        completedMilestones,
        totalWorkItems,
        completedWorkItems,
        completion,
        hasLiveWork: openTasks.length > 0 || openMilestones.length > 0
    };
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

function DashboardPage() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [milestones, setMilestones] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadDashboard = useCallback(async () => {
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
                fetch(apiUrl("/api/auth/me"), {
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
                }),
                fetch(apiUrl("/api/teams"), {
                    headers,
                    cache: "no-store"
                })
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

            if (!projectsResponse.ok) {
                throw new Error(
                    projectsData.message || "Unable to load projects."
                );
            }

            if (!tasksResponse.ok) {
                throw new Error(
                    tasksData.message || "Unable to load tasks."
                );
            }

            if (!milestonesResponse.ok) {
                throw new Error(
                    milestonesData.message || "Unable to load milestones."
                );
            }

            if (!teamsResponse.ok) {
                throw new Error(
                    teamsData.message || "Unable to load teams."
                );
            }

            setUser(userData.user);
            setProjects(projectsData.projects || []);
            setTasks(tasksData.tasks || []);
            setMilestones(milestonesData.milestones || []);
            setTeams(teamsData.teams || []);
        } catch (requestError) {
            console.error("Dashboard loading error:", requestError);
            setError(
                requestError.message || "Unable to load dashboard data."
            );
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        queueMicrotask(() => {
            loadDashboard();
        });
    }, [loadDashboard]);

    useEffect(() => {
        const refreshDashboard = () => {
            loadDashboard();
        };

        socketEvents.forEach((eventName) => {
            socket.on(eventName, refreshDashboard);
        });

        return () => {
            socketEvents.forEach((eventName) => {
                socket.off(eventName, refreshDashboard);
            });
        };
    }, [loadDashboard]);

    if (loading) {
        return (
            <main className="workspace-page dashboard-loading">
                <div className="loading-state">
                    <div className="loading-spinner" />
                    <p>Loading your workspace...</p>
                </div>
            </main>
        );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getDaysUntil = (dateValue) => {
        const targetDate = new Date(dateValue);
        targetDate.setHours(0, 0, 0, 0);

        return Math.ceil(
            (targetDate - today) / (1000 * 60 * 60 * 24)
        );
    };

    const getDueLabel = (dateValue) => {
        const daysUntil = getDaysUntil(dateValue);

        if (daysUntil < 0) {
            return `${Math.abs(daysUntil)} day${
                Math.abs(daysUntil) === 1 ? "" : "s"
            } overdue`;
        }

        if (daysUntil === 0) {
            return "Due today";
        }

        if (daysUntil === 1) {
            return "Due tomorrow";
        }

        return `Due in ${daysUntil} days`;
    };

    const hour = new Date().getHours();
    const greeting =
        hour < 12
            ? "Good morning"
            : hour < 17
              ? "Good afternoon"
              : "Good evening";
    const firstName = user?.name?.split(" ")[0] || "there";
    const roleLabel = roleLabels[user?.role] || "Team member";

    const myTasks = tasks.filter((task) =>
        isSameId(task.assignedTo, user?.userId)
    );
    const myActiveTasks = myTasks.filter(isTaskOpen);
    const overdueTasks = tasks.filter(
        (task) =>
            task.dueDate &&
            isTaskOpen(task) &&
            getDaysUntil(task.dueDate) < 0
    );
    const upcomingTasks = tasks
        .filter(
            (task) =>
                task.dueDate &&
                isTaskOpen(task) &&
                getDaysUntil(task.dueDate) <= 7
        )
        .sort(
            (firstTask, secondTask) =>
                new Date(firstTask.dueDate) -
                new Date(secondTask.dueDate)
        )
        .slice(0, 5);
    const upcomingMilestones = milestones
        .filter(
            (milestone) =>
                milestone.dueDate &&
                isMilestoneOpen(milestone) &&
                getDaysUntil(milestone.dueDate) <= 14
        )
        .sort(
            (firstMilestone, secondMilestone) =>
                new Date(firstMilestone.dueDate) -
                new Date(secondMilestone.dueDate)
        )
        .slice(0, 5);
    const managedProjects = projects.filter((project) =>
        isSameId(project.manager, user?.userId)
    );
    const teamMemberships = teams.filter(
        (team) =>
            isSameId(team.owner, user?.userId) ||
            (team.members || []).some((member) =>
                isSameId(member, user?.userId)
            )
    );
    const projectMetrics = projects.map((project) => ({
        project,
        ...getProjectMetrics(project, tasks, milestones)
    }));
    const activeProjects = projectMetrics.filter(
        ({ project, hasLiveWork }) =>
            isProjectOpen(project) &&
            (project.status === "ACTIVE" ||
                project.status === "PLANNING" ||
                hasLiveWork)
    );
    const completedWorkItems = projectMetrics.reduce(
        (total, metric) => total + metric.completedWorkItems,
        0
    );
    const totalWorkItems = projectMetrics.reduce(
        (total, metric) => total + metric.totalWorkItems,
        0
    );
    const completedProjects = projects.filter(
        (project) => project.status === "COMPLETED"
    );
    const completionRate =
        totalWorkItems > 0
            ? Math.round((completedWorkItems / totalWorkItems) * 100)
            : projects.length > 0
              ? Math.round(
                    (completedProjects.length / projects.length) * 100
                )
              : 0;
    const recentTasks = [...tasks]
        .sort(
            (firstTask, secondTask) =>
                new Date(secondTask.updatedAt || secondTask.createdAt || 0) -
                new Date(firstTask.updatedAt || firstTask.createdAt || 0)
        )
        .slice(0, 5);
    const focusItems = [
        ...myActiveTasks
            .filter((task) => task.dueDate && getDaysUntil(task.dueDate) <= 7)
            .map((task) => ({
                id: task._id,
                title: task.title,
                meta: `${task.project?.name || "No project"} · ${getDueLabel(
                    task.dueDate
                )}`,
                to: "/tasks",
                warning: getDaysUntil(task.dueDate) < 0
            })),
        ...upcomingMilestones.map((milestone) => ({
            id: milestone._id,
            title: milestone.title,
            meta: `${milestone.project?.name || "No project"} · ${getDueLabel(
                milestone.dueDate
            )}`,
            to: "/milestones",
            warning: getDaysUntil(milestone.dueDate) < 0
        }))
    ].slice(0, 5);

    return (
        <main className="workspace-page">
            <section className="workspace-content">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-eyebrow">
                            LIVE WORKSPACE
                        </p>

                        <h1>
                            {greeting}, {firstName}.
                        </h1>

                        <p className="dashboard-welcome">
                            {roleLabel} view · {projects.length} related
                            projects · {myActiveTasks.length} active tasks
                            assigned to you.
                        </p>
                    </div>

                    <div className="dashboard-header-actions">
                        <Link
                            to="/projects"
                            className="quick-action secondary"
                        >
                            Projects
                        </Link>

                        <Link
                            to="/tasks"
                            className="quick-action primary"
                        >
                            New task
                        </Link>
                    </div>
                </header>

                {error && (
                    <div className="dashboard-error">{error}</div>
                )}

                <section className="dashboard-live-grid">
                    <article className="dashboard-focus-card">
                        <div className="dashboard-card-header">
                            <div>
                                <p className="card-eyebrow">
                                    FOCUS QUEUE
                                </p>

                                <h2>
                                    {focusItems.length > 0
                                        ? "Work that needs attention"
                                        : "No urgent work right now"}
                                </h2>
                            </div>

                            <Link to="/tasks">Tasks</Link>
                        </div>

                        {focusItems.length === 0 ? (
                            <div className="dashboard-empty">
                                <span>✓</span>
                                <p>
                                    You have no overdue tasks or urgent
                                    milestones.
                                </p>
                            </div>
                        ) : (
                            <div className="dashboard-focus-list">
                                {focusItems.map((item) => (
                                    <Link
                                        key={item.id}
                                        to={item.to}
                                        className={`dashboard-focus-item ${
                                            item.warning ? "warning" : ""
                                        }`}
                                    >
                                        <strong>{item.title}</strong>
                                        <span>{item.meta}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </article>

                    <article className="dashboard-card dashboard-personal-card">
                        <p className="card-eyebrow">MY SNAPSHOT</p>

                        <div className="personal-metrics">
                            <div>
                                <strong>{myActiveTasks.length}</strong>
                                <span>active tasks</span>
                            </div>

                            <div>
                                <strong>{managedProjects.length}</strong>
                                <span>managed projects</span>
                            </div>

                            <div>
                                <strong>{teamMemberships.length}</strong>
                                <span>teams</span>
                            </div>
                        </div>

                        <div className="team-strip">
                            {teamMemberships.length === 0 ? (
                                <p>No team membership yet.</p>
                            ) : (
                                teamMemberships.slice(0, 4).map((team) => (
                                    <span key={team._id}>{team.name}</span>
                                ))
                            )}
                        </div>
                    </article>
                </section>

                <section className="dashboard-stat-grid compact-dashboard-stats">
                    <Link
                        to="/tasks"
                        className={`dashboard-stat-card ${
                            overdueTasks.length > 0 ? "stat-warning" : ""
                        }`}
                    >
                        <div className="stat-card-top">
                            <span>Overdue</span>
                            <span className="stat-icon">!</span>
                        </div>

                        <strong>{overdueTasks.length}</strong>

                        <p>tasks need attention</p>
                    </Link>

                    <Link
                        to="/projects"
                        className="dashboard-stat-card"
                    >
                        <div className="stat-card-top">
                            <span>Active projects</span>
                            <span className="stat-icon">▦</span>
                        </div>

                        <strong>{activeProjects.length}</strong>

                        <p>{projects.length} visible, excluding closed work</p>
                    </Link>

                    <Link
                        to="/tasks"
                        className="dashboard-stat-card"
                    >
                        <div className="stat-card-top">
                            <span>Progress</span>
                            <span className="stat-icon">↗</span>
                        </div>

                        <strong>{completionRate}%</strong>

                        <p>
                            {totalWorkItems > 0
                                ? `${completedWorkItems} of ${totalWorkItems} work items done`
                                : `${completedProjects.length} of ${projects.length} projects completed`}
                        </p>
                    </Link>
                </section>

                <section className="dashboard-main-grid">
                    <article className="dashboard-card">
                        <div className="dashboard-card-header">
                            <div>
                                <p className="card-eyebrow">NEXT UP</p>
                                <h2>Upcoming deadlines</h2>
                            </div>

                            <Link to="/tasks">Tasks →</Link>
                        </div>

                        {upcomingTasks.length === 0 ? (
                            <div className="dashboard-empty">
                                <span>✓</span>
                                <p>No task deadlines in the next week.</p>
                            </div>
                        ) : (
                            <div className="deadline-list">
                                {upcomingTasks.map((task) => (
                                    <div
                                        className="deadline-item"
                                        key={task._id}
                                    >
                                        <div className="deadline-date">
                                            <strong>
                                                {new Date(
                                                    task.dueDate
                                                ).getDate()}
                                            </strong>
                                            <span>
                                                {new Date(
                                                    task.dueDate
                                                ).toLocaleDateString(
                                                    undefined,
                                                    { month: "short" }
                                                )}
                                            </span>
                                        </div>

                                        <div className="deadline-content">
                                            <strong>{task.title}</strong>
                                            <span>
                                                {task.project?.name ||
                                                    "No project"}{" "}
                                                ·{" "}
                                                {taskLabels[task.status] ||
                                                    task.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>

                    <article className="dashboard-card">
                        <div className="dashboard-card-header">
                            <div>
                                <p className="card-eyebrow">RECENT</p>
                                <h2>Latest task activity</h2>
                            </div>

                            <Link to="/tasks">View all →</Link>
                        </div>

                        {recentTasks.length === 0 ? (
                            <div className="dashboard-empty">
                                <span>○</span>
                                <p>No task activity yet.</p>
                            </div>
                        ) : (
                            <div className="recent-task-list">
                                {recentTasks.map((task) => (
                                    <div
                                        className="recent-task-item"
                                        key={task._id}
                                    >
                                        <div className="recent-task-status">
                                            <span
                                                className={`task-status-dot ${task.status.toLowerCase()}`}
                                            />
                                        </div>

                                        <div className="recent-task-content">
                                            <strong>{task.title}</strong>
                                            <span>
                                                {task.project?.name ||
                                                    "No project"}
                                            </span>
                                        </div>

                                        <span
                                            className={`mini-priority ${task.priority?.toLowerCase()}`}
                                        >
                                            {task.priority}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>
                </section>
            </section>
        </main>
    );
}

export default DashboardPage;
