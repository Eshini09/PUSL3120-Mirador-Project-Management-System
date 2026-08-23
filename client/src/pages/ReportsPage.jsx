import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../api";
import socket from "../socket";

const isTaskOpen = (task) => task.status !== "COMPLETED";

const getProjectId = (item) => item.project?._id || item.project;

const getDaysUntil = (dateValue) => {
    const today = new Date();
    const target = new Date(dateValue);

    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

function ReportsPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [milestones, setMilestones] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadReports = useCallback(async () => {
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

            if (!projectsResponse.ok || !tasksResponse.ok) {
                throw new Error("Unable to load report data.");
            }

            setUser(userData.user);
            setProjects(projectsData.projects || []);
            setTasks(tasksData.tasks || []);
            setMilestones(milestonesData.milestones || []);
            setTeams(teamsData.teams || []);
        } catch (requestError) {
            console.error("Reports loading error:", requestError);
            setError(requestError.message || "Unable to load reports.");
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        queueMicrotask(loadReports);
    }, [loadReports]);

    useEffect(() => {
        const refreshReports = () => loadReports();
        const events = [
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
            "teamDeleted"
        ];

        events.forEach((eventName) => {
            socket.on(eventName, refreshReports);
        });

        return () => {
            events.forEach((eventName) => {
                socket.off(eventName, refreshReports);
            });
        };
    }, [loadReports]);

    if (loading) {
        return (
            <div className="loading-state">
                <div className="loading-spinner" />
                <p>Loading reports...</p>
            </div>
        );
    }

    const completedTasks = tasks.filter((task) => task.status === "COMPLETED");
    const overdueTasks = tasks.filter(
        (task) => task.dueDate && isTaskOpen(task) && getDaysUntil(task.dueDate) < 0
    );
    const activeProjects = projects.filter(
        (project) => !["COMPLETED", "ON_HOLD"].includes(project.status)
    );
    const achievedMilestones = milestones.filter(
        (milestone) => milestone.status === "ACHIEVED"
    );
    const totalWork = tasks.length + milestones.length;
    const completedWork = completedTasks.length + achievedMilestones.length;
    const progress =
        totalWork > 0 ? Math.round((completedWork / totalWork) * 100) : 0;
    const projectRows = projects.map((project) => {
        const projectTasks = tasks.filter(
            (task) => getProjectId(task)?.toString() === project._id
        );
        const projectMilestones = milestones.filter(
            (milestone) => getProjectId(milestone)?.toString() === project._id
        );
        const projectTotal = projectTasks.length + projectMilestones.length;
        const projectDone =
            projectTasks.filter((task) => task.status === "COMPLETED").length +
            projectMilestones.filter(
                (milestone) => milestone.status === "ACHIEVED"
            ).length;
        const projectProgress =
            projectTotal > 0
                ? Math.round((projectDone / projectTotal) * 100)
                : project.status === "COMPLETED"
                  ? 100
                  : 0;

        return {
            project,
            taskCount: projectTasks.length,
            milestoneCount: projectMilestones.length,
            overdueCount: projectTasks.filter(
                (task) =>
                    task.dueDate &&
                    isTaskOpen(task) &&
                    getDaysUntil(task.dueDate) < 0
            ).length,
            progress: projectProgress
        };
    });
    const workload = tasks
        .filter(isTaskOpen)
        .reduce((map, task) => {
            const name = task.assignedTo?.name || "Unassigned";
            map.set(name, (map.get(name) || 0) + 1);
            return map;
        }, new Map());

    return (
        <>
            <header className="dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">REPORTING</p>
                    <h1>Reports</h1>
                    <p className="dashboard-welcome">
                        Live progress, workload and risk indicators for your
                        visible workspace.
                    </p>
                </div>

                <div className="user-badge">{user?.role}</div>
            </header>

            {error && <div className="dashboard-error">{error}</div>}

            <section className="dashboard-stat-grid compact-dashboard-stats">
                <article className="dashboard-stat-card">
                    <div className="stat-card-top">
                        <span>Workspace progress</span>
                        <span className="stat-icon">%</span>
                    </div>
                    <strong>{progress}%</strong>
                    <p>
                        {completedWork} of {totalWork} tasks and milestones done
                    </p>
                </article>

                <article className="dashboard-stat-card">
                    <div className="stat-card-top">
                        <span>Active projects</span>
                        <span className="stat-icon">P</span>
                    </div>
                    <strong>{activeProjects.length}</strong>
                    <p>{projects.length} projects visible to you</p>
                </article>

                <article
                    className={`dashboard-stat-card ${
                        overdueTasks.length > 0 ? "stat-warning" : ""
                    }`}
                >
                    <div className="stat-card-top">
                        <span>Overdue tasks</span>
                        <span className="stat-icon">!</span>
                    </div>
                    <strong>{overdueTasks.length}</strong>
                    <p>Incomplete tasks past their due date</p>
                </article>

                <article className="dashboard-stat-card">
                    <div className="stat-card-top">
                        <span>Teams</span>
                        <span className="stat-icon">T</span>
                    </div>
                    <strong>{teams.length}</strong>
                    <p>Teams connected to your workspace</p>
                </article>
            </section>

            <section className="dashboard-main-grid">
                <article className="dashboard-card">
                    <div className="dashboard-card-header">
                        <div>
                            <p className="card-eyebrow">PROJECT HEALTH</p>
                            <h2>Progress by project</h2>
                        </div>
                    </div>

                    <div className="report-table">
                        {projectRows.length === 0 ? (
                            <p>No projects available for reporting yet.</p>
                        ) : (
                            projectRows.map((row) => (
                                <div
                                    className="report-row"
                                    key={row.project._id}
                                >
                                    <div>
                                        <strong>{row.project.name}</strong>
                                        <span>
                                            {row.taskCount} tasks ·{" "}
                                            {row.milestoneCount} milestones ·{" "}
                                            {row.overdueCount} overdue
                                        </span>
                                    </div>

                                    <div className="report-progress">
                                        <span>{row.progress}%</span>
                                        <div>
                                            <i
                                                style={{
                                                    width: `${row.progress}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </article>

                <article className="dashboard-card">
                    <div className="dashboard-card-header">
                        <div>
                            <p className="card-eyebrow">WORKLOAD</p>
                            <h2>Open tasks by person</h2>
                        </div>
                    </div>

                    <div className="report-table compact">
                        {[...workload.entries()].length === 0 ? (
                            <p>No open tasks to report.</p>
                        ) : (
                            [...workload.entries()]
                                .sort((first, second) => second[1] - first[1])
                                .map(([name, count]) => (
                                    <div className="report-row" key={name}>
                                        <div>
                                            <strong>{name}</strong>
                                            <span>{count} active task{count === 1 ? "" : "s"}</span>
                                        </div>
                                        <span className="task-pill warning">
                                            {count}
                                        </span>
                                    </div>
                                ))
                        )}
                    </div>
                </article>
            </section>
        </>
    );
}

export default ReportsPage;
