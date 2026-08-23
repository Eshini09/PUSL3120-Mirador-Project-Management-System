import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../api";

const defaultSettings = {
    emailDigest: true,
    deadlineWarnings: true,
    compactRows: false,
    defaultLanding: "dashboard"
};

const avatarColors = [
    {
        value: "INDIGO",
        label: "Indigo"
    },
    {
        value: "TEAL",
        label: "Teal"
    },
    {
        value: "CORAL",
        label: "Coral"
    },
    {
        value: "AMBER",
        label: "Amber"
    },
    {
        value: "GREEN",
        label: "Green"
    },
    {
        value: "LAVENDER",
        label: "Lavender"
    },
    {
        value: "ROSE",
        label: "Rose"
    },
    {
        value: "PEACH",
        label: "Peach"
    },
    {
        value: "MINT",
        label: "Mint"
    },
    {
        value: "SKY",
        label: "Sky"
    },
    {
        value: "LILAC",
        label: "Lilac"
    },
    {
        value: "LEMON",
        label: "Lemon"
    }
];

const getInitials = (name = "") =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "M";

function SettingsPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [profileForm, setProfileForm] = useState({
        name: "",
        bio: "",
        avatarColor: "INDIGO"
    });
    const [profileSaving, setProfileSaving] = useState(false);
    const [settings, setSettings] = useState(() => {
        const savedSettings = localStorage.getItem("miradorSettings");

        if (!savedSettings) {
            return defaultSettings;
        }

        try {
            return {
                ...defaultSettings,
                ...JSON.parse(savedSettings)
            };
        } catch {
            return defaultSettings;
        }
    });
    const [message, setMessage] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/");
            return;
        }

        fetch(apiUrl("/api/auth/me"), {
            headers: {
                Authorization: `Bearer ${token}`
            },
            cache: "no-store"
        })
            .then((response) => {
                if (response.status === 401) {
                    localStorage.removeItem("token");
                    navigate("/");
                    return null;
                }

                return response.json();
            })
            .then((data) => {
                if (data?.user) {
                    setUser(data.user);
                    setProfileForm({
                        name: data.user.name || "",
                        bio: data.user.bio || "",
                        avatarColor: data.user.avatarColor || "INDIGO"
                    });
                }
            })
            .catch(() => {
                setUser(null);
            });
    }, [navigate]);

    const updateSetting = (key, value) => {
        const nextSettings = {
            ...settings,
            [key]: value
        };

        setSettings(nextSettings);
        localStorage.setItem(
            "miradorSettings",
            JSON.stringify(nextSettings)
        );
        setMessage("Settings saved.");
    };

    const handleProfileChange = (event) => {
        const { name, value } = event.target;

        setProfileForm((currentProfile) => ({
            ...currentProfile,
            [name]: value
        }));
    };

    const handleProfileSubmit = async (event) => {
        event.preventDefault();

        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/");
            return;
        }

        setProfileSaving(true);
        setMessage("");

        try {
            const response = await fetch(apiUrl("/api/users/me"), {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(profileForm)
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Unable to update profile");
            }

            setUser(data.user);
            setMessage("Profile updated.");
        } catch (requestError) {
            setMessage(requestError.message || "Unable to update profile.");
        } finally {
            setProfileSaving(false);
        }
    };

    return (
        <>
            <header className="dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">WORKSPACE CONTROL</p>
                    <h1>Settings</h1>
                    <p className="dashboard-welcome">
                        Manage your account context and workspace preferences.
                    </p>
                </div>

                <div className="user-badge">{user?.role}</div>
            </header>

            {message && <div className="dashboard-success">{message}</div>}

            <section className="settings-grid">
                <article className="dashboard-card">
                    <div className="dashboard-card-header">
                        <div>
                            <p className="card-eyebrow">ACCOUNT</p>
                            <h2>Your profile</h2>
                        </div>
                    </div>

                    <form
                        className="settings-profile-form"
                        onSubmit={handleProfileSubmit}
                    >
                        <div className="profile-preview">
                            <span
                                className={`profile-avatar ${profileForm.avatarColor.toLowerCase()}`}
                            >
                                {getInitials(profileForm.name || user?.name)}
                            </span>

                            <div>
                                <strong>{user?.email || "Loading..."}</strong>
                                <p>{user?.role || "Loading..."}</p>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="profile-name">Display name</label>
                            <input
                                id="profile-name"
                                name="name"
                                value={profileForm.name}
                                onChange={handleProfileChange}
                                placeholder="Your name"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="profile-bio">Bio</label>
                            <textarea
                                id="profile-bio"
                                name="bio"
                                value={profileForm.bio}
                                onChange={handleProfileChange}
                                maxLength="240"
                                rows="4"
                                placeholder="What do you work on? What should teammates know?"
                            />
                            <small>{profileForm.bio.length}/240</small>
                        </div>

                        <div className="avatar-picker">
                            <span>Avatar colour</span>
                            <div>
                                {avatarColors.map((color) => (
                                    <button
                                        key={color.value}
                                        type="button"
                                        className={`profile-avatar small ${color.value.toLowerCase()} ${
                                            profileForm.avatarColor ===
                                            color.value
                                                ? "selected"
                                                : ""
                                        }`}
                                        aria-label={color.label}
                                        onClick={() =>
                                            setProfileForm(
                                                (currentProfile) => ({
                                                    ...currentProfile,
                                                    avatarColor: color.value
                                                })
                                            )
                                        }
                                    >
                                        {getInitials(
                                            profileForm.name || user?.name
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="login-button"
                            disabled={profileSaving}
                        >
                            {profileSaving ? "Saving..." : "Save profile"}
                        </button>
                    </form>
                </article>

                <article className="dashboard-card">
                    <div className="dashboard-card-header">
                        <div>
                            <p className="card-eyebrow">PREFERENCES</p>
                            <h2>Workspace behaviour</h2>
                        </div>
                    </div>

                    <div className="settings-list">
                        <label className="settings-toggle">
                            <div>
                                <strong>Deadline warnings</strong>
                                <span>
                                    Highlight due and overdue work across the
                                    dashboard.
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.deadlineWarnings}
                                onChange={(event) =>
                                    updateSetting(
                                        "deadlineWarnings",
                                        event.target.checked
                                    )
                                }
                            />
                        </label>

                        <label className="settings-toggle">
                            <div>
                                <strong>Email digest</strong>
                                <span>
                                    Keep this preference ready for notification
                                    integration.
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.emailDigest}
                                onChange={(event) =>
                                    updateSetting(
                                        "emailDigest",
                                        event.target.checked
                                    )
                                }
                            />
                        </label>

                        <label className="settings-toggle">
                            <div>
                                <strong>Compact rows</strong>
                                <span>
                                    Prefer denser project and task lists.
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.compactRows}
                                onChange={(event) =>
                                    updateSetting(
                                        "compactRows",
                                        event.target.checked
                                    )
                                }
                            />
                        </label>

                        <div className="form-group settings-select">
                            <label htmlFor="default-landing">
                                Default landing page
                            </label>
                            <select
                                id="default-landing"
                                value={settings.defaultLanding}
                                onChange={(event) =>
                                    updateSetting(
                                        "defaultLanding",
                                        event.target.value
                                    )
                                }
                            >
                                <option value="dashboard">Dashboard</option>
                                <option value="projects">Projects</option>
                                <option value="tasks">Tasks</option>
                                <option value="reports">Reports</option>
                            </select>
                        </div>
                    </div>
                </article>
            </section>
        </>
    );
}

export default SettingsPage;
