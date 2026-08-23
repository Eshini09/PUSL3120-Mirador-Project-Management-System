import { useMemo, useState } from "react";

const helpTopics = [
    {
        title: "Plan a project",
        category: "Projects",
        steps: [
            "Open Projects and create a project with a start date and due date.",
            "Attach a team if the work belongs to a group.",
            "Use the project row to review people, milestones and task progress."
        ]
    },
    {
        title: "Invite team members",
        category: "Teams",
        steps: [
            "Create a team from Teams.",
            "Use Invite link and share it with the right people.",
            "Members must sign in before accepting or declining the invitation."
        ]
    },
    {
        title: "Manage tasks",
        category: "Tasks",
        steps: [
            "Open Tasks and create work under a visible project.",
            "Assign the task to a project participant.",
            "Move work between Active, Ongoing and Completed as it progresses."
        ]
    },
    {
        title: "Track milestones",
        category: "Milestones",
        steps: [
            "Create milestones for major delivery checkpoints.",
            "Assign an owner and keep the milestone due date inside the project dates.",
            "Use Due, Ongoing, Achieved and Missed filters to monitor delivery."
        ]
    },
    {
        title: "Use reports",
        category: "Reports",
        steps: [
            "Open Reports to review progress, overdue work and team workload.",
            "Use project health to identify projects that need attention.",
            "Use the report page as evidence of project monitoring in the demo."
        ]
    },
    {
        title: "Understand roles",
        category: "Access",
        steps: [
            "Admins can manage the full workspace.",
            "Project managers can create and manage their own projects.",
            "Team members can view related work and update assigned task status."
        ]
    }
];

function HelpPage() {
    const [query, setQuery] = useState("");

    const filteredTopics = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return helpTopics;
        }

        return helpTopics.filter(
            (topic) =>
                topic.title.toLowerCase().includes(normalizedQuery) ||
                topic.category.toLowerCase().includes(normalizedQuery) ||
                topic.steps.some((step) =>
                    step.toLowerCase().includes(normalizedQuery)
                )
        );
    }, [query]);

    return (
        <>
            <header className="dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">SUPPORT</p>
                    <h1>Help</h1>
                    <p className="dashboard-welcome">
                        Quick guidance for planning work, inviting teams and
                        tracking delivery in Mirador.
                    </p>
                </div>
            </header>

            <section className="dashboard-card help-search-card">
                <div className="form-group">
                    <label htmlFor="help-search">Search help</label>
                    <input
                        id="help-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search projects, teams, tasks, reports..."
                    />
                </div>
            </section>

            <section className="help-grid">
                {filteredTopics.length === 0 ? (
                    <article className="dashboard-panel">
                        <p className="panel-label">NO HELP TOPICS</p>
                        <h2>No matching guidance.</h2>
                        <p>Try searching for projects, tasks, teams or reports.</p>
                    </article>
                ) : (
                    filteredTopics.map((topic) => (
                        <article className="dashboard-card" key={topic.title}>
                            <div className="dashboard-card-header">
                                <div>
                                    <p className="card-eyebrow">
                                        {topic.category}
                                    </p>
                                    <h2>{topic.title}</h2>
                                </div>
                            </div>

                            <ol className="help-steps">
                                {topic.steps.map((step) => (
                                    <li key={step}>{step}</li>
                                ))}
                            </ol>
                        </article>
                    ))
                )}
            </section>
        </>
    );
}

export default HelpPage;
