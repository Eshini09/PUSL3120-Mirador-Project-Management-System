import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../api";
import socket from "../socket";

const statusLabels = {
    PLANNING: "Planning",
    ACTIVE: "Active",
    ON_HOLD: "On hold",
    COMPLETED: "Completed",
    TODO: "Active",
    IN_PROGRESS: "Ongoing",
    ACHIEVED: "Achieved",
    MISSED: "Missed"
};

const dayInMs = 1000 * 60 * 60 * 24;

const normalizeDate = (dateValue) => {
    const date = new Date(dateValue);
    date.setHours(0, 0, 0, 0);
    return date;
};

const getProjectId = (item) => item.project?._id || item.project;

const getPercentPosition = (dateValue, startDate, totalDays) => {
    const offset = Math.max(
        0,
        Math.round((normalizeDate(dateValue) - startDate) / dayInMs)
    );

    return Math.min(100, (offset / totalDays) * 100);
};

function TimelinePage() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [milestones, setMilestones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadTimeline = useCallback(async () => {
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
                milestonesResponse
            ] = await Promise.all([
                fetch(apiUrl("/api/auth/me"), { headers, cache: "no-store" }),
                fetch(apiUrl("/api/projects"), { headers, cache: "no-store" }),
                fetch(apiUrl("/api/tasks"), { headers, cache: "no-store" }),
                fetch(apiUrl("/api/milestones"), {
                    headers,
                    cache: "no-store"
                })
            ]);

            if (
                userResponse.status === 401 ||
                projectsResponse.status === 401 ||
                tasksResponse.status === 401 ||
                milestonesResponse.status === 401
            ) {
                localStorage.removeItem("token");
                navigate("/");
                return;
            }

            const userData = await userResponse.json();
            const projectsData = await projectsResponse.json();
            const tasksData = await tasksResponse.json();
            const milestonesData = await milestonesResponse.json();

            if (
                !projectsResponse.ok ||
                !tasksResponse.ok ||
                !milestonesResponse.ok
            ) {
                throw new Error("Unable to load timeline data.");
            }

            setUser(userData.user);
            setProjects(projectsData.projects || []);
            setTasks(tasksData.tasks || []);
            setMilestones(milestonesData.milestones || []);
        } catch (requestError) {
            console.error("Timeline loading error:", requestError);
            setError(requestError.message || "Unable to load timeline.");
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        queueMicrotask(loadTimeline);
    }, [loadTimeline]);

    useEffect(() => {
        const refreshTimeline = () => loadTimeline();
        const events = [
            "projectCreated",
            "projectUpdated",
            "projectDeleted",
            "taskCreated",
            "taskUpdated",
            "taskDeleted",
            "milestoneCreated",
            "milestoneUpdated",
            "milestoneDeleted"
        ];

        events.forEach((eventName) => {
            socket.on(eventName, refreshTimeline);
        });

        return () => {
            events.forEach((eventName) => {
                socket.off(eventName, refreshTimeline);
            });
        };
    }, [loadTimeline]);

    const timelineBounds = useMemo(() => {
        const dates = [
            ...projects.flatMap((project) => [
                project.startDate,
                project.dueDate
            ]),
            ...tasks.map((task) => task.dueDate),
            ...milestones.map((milestone) => milestone.dueDate)
        ]
            .filter(Boolean)
            .map(normalizeDate);

        if (dates.length === 0) {
            const today = normalizeDate(new Date());
            const end = new Date(today);
            end.setDate(today.getDate() + 30);

            return {
                start: today,
                end,
                totalDays: 30
            };
        }

        const start = new Date(Math.min(...dates));
        const end = new Date(Math.max(...dates));
        start.setDate(start.getDate() - 3);
        end.setDate(end.getDate() + 3);

        return {
            start,
            end,
            totalDays: Math.max(1, Math.round((end - start) / dayInMs))
        };
    }, [milestones, projects, tasks]);

    if (loading) {
        return (
            <div className="loading-state">
                <div className="loading-spinner" />
                <p>Loading timeline...</p>
            </div>
        );
    }

    const today = normalizeDate(new Date());
    const todayPosition =
        today >= timelineBounds.start && today <= timelineBounds.end
            ? getPercentPosition(
                  today,
                  timelineBounds.start,
                  timelineBounds.totalDays
              )
            : null;
    const monthLabels = [
        timelineBounds.start,
        new Date(
            timelineBounds.start.getTime() +
                (timelineBounds.end - timelineBounds.start) / 2
        ),
        timelineBounds.end
    ];

    return (
        <>
            <header className="dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">DELIVERY TIMELINE</p>
                    <h1>Timeline</h1>
                    <p className="dashboard-welcome">
                        Gantt-style view of project schedules, task deadlines
                        and milestone checkpoints.
                    </p>
                </div>

                <div className="user-badge">{user?.role}</div>
            </header>

            {error && <div className="dashboard-error">{error}</div>}

            <section className="dashboard-card timeline-card">
                <div className="timeline-scale">
                    {monthLabels.map((date) => (
                        <span key={date.toISOString()}>
                            {date.toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric"
                            })}
                        </span>
                    ))}
                </div>

                {todayPosition !== null && (
                    <div
                        className="timeline-today"
                        style={{
                            left: `calc(230px + ((100% - 230px) * ${
                                todayPosition / 100
                            }))`
                        }}
                    >
                        Today
                    </div>
                )}

                <div className="timeline-list">
                    {projects.length === 0 ? (
                        <div className="dashboard-empty">
                            <span>○</span>
                            <p>No projects are available for the timeline.</p>
                        </div>
                    ) : (
                        projects.map((project) => {
                            const projectTasks = tasks.filter(
                                (task) =>
                                    getProjectId(task)?.toString() ===
                                    project._id
                            );
                            const projectMilestones = milestones.filter(
                                (milestone) =>
                                    getProjectId(milestone)?.toString() ===
                                    project._id
                            );
                            const left = getPercentPosition(
                                project.startDate,
                                timelineBounds.start,
                                timelineBounds.totalDays
                            );
                            const right = getPercentPosition(
                                project.dueDate,
                                timelineBounds.start,
                                timelineBounds.totalDays
                            );
                            const width = Math.max(4, right - left);

                            return (
                                <article
                                    className="timeline-row"
                                    key={project._id}
                                >
                                    <div className="timeline-row-label">
                                        <strong>{project.name}</strong>
                                        <span>
                                            {statusLabels[project.status] ||
                                                project.status}{" "}
                                            · {project.manager?.name ||
                                                "No manager"}
                                        </span>
                                    </div>

                                    <div className="timeline-track">
                                        <div
                                            className={`timeline-bar ${project.status.toLowerCase()}`}
                                            style={{
                                                left: `${left}%`,
                                                width: `${width}%`
                                            }}
                                        >
                                            <span>
                                                {new Date(
                                                    project.dueDate
                                                ).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {projectTasks
                                            .filter((task) => task.dueDate)
                                            .map((task) => (
                                                <span
                                                    key={task._id}
                                                    className={`timeline-dot task ${task.status.toLowerCase()}`}
                                                    style={{
                                                        left: `${getPercentPosition(
                                                            task.dueDate,
                                                            timelineBounds.start,
                                                            timelineBounds.totalDays
                                                        )}%`
                                                    }}
                                                    title={`${task.title} · ${
                                                        statusLabels[
                                                            task.status
                                                        ] || task.status
                                                    }`}
                                                />
                                            ))}

                                        {projectMilestones.map((milestone) => (
                                            <span
                                                key={milestone._id}
                                                className={`timeline-dot milestone ${milestone.status.toLowerCase()}`}
                                                style={{
                                                    left: `${getPercentPosition(
                                                        milestone.dueDate,
                                                        timelineBounds.start,
                                                        timelineBounds.totalDays
                                                    )}%`
                                                }}
                                                title={`${milestone.title} · ${
                                                    statusLabels[
                                                        milestone.status
                                                    ] || milestone.status
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </article>
                            );
                        })
                    )}
                </div>

                <div className="timeline-legend">
                    <span>
                        <i className="timeline-dot task" /> Task deadline
                    </span>
                    <span>
                        <i className="timeline-dot milestone" /> Milestone
                    </span>
                    <span>
                        <i className="timeline-bar active" /> Project duration
                    </span>
                </div>
            </section>
        </>
    );
}

export default TimelinePage;
