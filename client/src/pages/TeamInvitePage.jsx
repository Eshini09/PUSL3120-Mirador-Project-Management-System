import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiUrl } from "../api";

function TeamInvitePage() {
    const { token: inviteToken } = useParams();
    const navigate = useNavigate();

    const [invite, setInvite] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [linkedProjects, setLinkedProjects] = useState([]);

    const token = localStorage.getItem("token");

    const loadInvite = useCallback(async () => {
        try {
            const response = await fetch(
                apiUrl(`/api/team-invites/${inviteToken}`),
                {
                    cache: "no-store"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to load invitation"
                );
            }

            setInvite(data.invite);
        } catch (requestError) {
            console.error("Team invite loading error:", requestError);
            setError(
                requestError.message || "Unable to load invitation"
            );
        } finally {
            setLoading(false);
        }
    }, [inviteToken]);

    useEffect(() => {
        queueMicrotask(() => {
            loadInvite();
        });
    }, [loadInvite]);

    const respondToInvite = async (action) => {
        if (!token) {
            localStorage.setItem(
                "pendingRedirect",
                `/team-invites/${inviteToken}`
            );
            navigate("/");
            return;
        }

        setError("");
        setMessage("");

        try {
            const response = await fetch(
                apiUrl(`/api/team-invites/${inviteToken}/${action}`),
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
                    data.message || "Failed to respond to invitation"
                );
            }

            setMessage(data.message);
            setLinkedProjects(data.projects || []);
        } catch (requestError) {
            console.error("Team invite response error:", requestError);
            setError(
                requestError.message ||
                    "Unable to respond to invitation"
            );
        }
    };

    if (loading) {
        return (
            <main className="workspace-page dashboard-loading">
                <div className="loading-state">
                    <div className="loading-spinner" />
                    <p>Loading invitation...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="workspace-page">
            <section className="workspace-content">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-eyebrow">
                            TEAM INVITATION
                        </p>
                        <h1>{invite?.team?.name || "Invitation"}</h1>
                        <p className="dashboard-welcome">
                            Review this team invitation and choose whether
                            to join.
                        </p>
                    </div>
                </header>

                {error && <div className="dashboard-error">{error}</div>}
                {message && (
                    <div className="dashboard-success">{message}</div>
                )}

                {invite && (
                    <section className="project-form-panel invite-panel">
                        <p className="panel-label">INVITED BY</p>
                        <h2>{invite.createdBy?.name || "A team owner"}</h2>
                        <p>
                            {invite.team?.description ||
                                "No description provided."}
                        </p>

                        <div className="dashboard-actions">
                            <button
                                type="button"
                                className="dashboard-action primary"
                                onClick={() => respondToInvite("accept")}
                            >
                                {token
                                    ? "Accept invitation"
                                    : "Sign in to accept"}
                            </button>
                            <button
                                type="button"
                                className="dashboard-action secondary"
                                onClick={() => respondToInvite("decline")}
                            >
                                {token
                                    ? "Decline"
                                    : "Sign in to decline"}
                            </button>
                            {token && (
                                <Link
                                    to="/projects"
                                    className="dashboard-action primary"
                                >
                                    View projects
                                </Link>
                            )}
                            {token && (
                                <Link
                                    to="/teams"
                                    className="dashboard-action secondary"
                                >
                                    View teams
                                </Link>
                            )}
                        </div>

                        {linkedProjects.length > 0 && (
                            <div className="project-integration">
                                <div className="project-linked-section">
                                    <span>Projects now available</span>
                                    {linkedProjects.map((project) => (
                                        <p key={project._id}>
                                            {project.name} ·{" "}
                                            {project.status} · Manager:{" "}
                                            {project.manager?.name ||
                                                "Unassigned"}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </section>
        </main>
    );
}

export default TeamInvitePage;
