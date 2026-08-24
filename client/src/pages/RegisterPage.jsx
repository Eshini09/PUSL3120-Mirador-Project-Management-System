import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "../api";

function RegisterPage() {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("PROJECT_MANAGER");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async (event) => {
        event.preventDefault();

        if (password !== confirmPassword) {
            setIsError(true);
            setMessage("Passwords do not match.");
            return;
        }

        setIsLoading(true);
        setMessage("");
        setIsError(false);

        try {
            const response = await fetch(
                apiUrl("/api/auth/register"),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name,
                        email,
                        role,
                        password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setIsError(true);
                setMessage(data.message || "Registration failed.");
                return;
            }

            setMessage("Account created successfully. Redirecting...");

            setTimeout(() => {
                const pendingRedirect =
                    localStorage.getItem("pendingRedirect");

                if (pendingRedirect) {
                    navigate("/");
                } else {
                    navigate("/");
                }
            }, 1000);
        } catch (error) {
            console.error("Registration error:", error);
            setIsError(true);
            setMessage("Unable to connect to the server.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="login-page">
            <section className="brand-panel">
                <div className="brand-content">
                    <img
                        className="brand-mark logo-mark"
                        src="/mirador-logo.png"
                        alt="Mirador logo"
                    />

                    <p className="eyebrow">
                        PROJECT MANAGEMENT SYSTEM
                    </p>

                    <h1>Mirador</h1>

                    <p className="brand-description">
                        Create your workspace account and start managing
                        projects with your team.
                    </p>

                    <div className="brand-line" />
                </div>
            </section>

            <section className="form-panel">
                <div className="login-card">
                    <div className="login-header">
                        <p className="form-eyebrow">GET STARTED</p>

                        <h2>Create account</h2>

                        <p>
                            Set up your Mirador workspace account.
                        </p>
                    </div>

                    <form onSubmit={handleRegister}>
                        <div className="form-group">
                            <label htmlFor="name">Full name</label>

                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                placeholder="Your full name"
                                autoComplete="name"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="register-role">
                                Account role
                            </label>

                            <select
                                id="register-role"
                                value={role}
                                onChange={(event) =>
                                    setRole(event.target.value)
                                }
                            >
                                <option value="PROJECT_MANAGER">
                                    Project manager
                                </option>

                                <option value="TEAM_MEMBER">
                                    Team member
                                </option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="register-email">
                                Email
                            </label>

                            <input
                                id="register-email"
                                type="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                placeholder="you@example.com"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="register-password">
                                Password
                            </label>

                            <input
                                id="register-password"
                                type="password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                placeholder="Create a password"
                                autoComplete="new-password"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirm-password">
                                Confirm password
                            </label>

                            <input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(event) =>
                                    setConfirmPassword(event.target.value)
                                }
                                placeholder="Re-enter your password"
                                autoComplete="new-password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="login-button"
                            disabled={isLoading}
                        >
                            {isLoading ? "Creating account..." : "Create account"}
                        </button>
                    </form>

                    {message && (
                        <p
                            className={`login-message ${
                                isError ? "error" : "success"
                            }`}
                        >
                            {message}
                        </p>
                    )}

                    <p className="auth-switch">
                        Already using Mirador?
                        <Link className="auth-link" to="/">Sign in</Link>
                    </p>
                </div>
            </section>
        </main>
    );
}

export default RegisterPage;
