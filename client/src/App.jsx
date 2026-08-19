import { useState } from "react";

function App() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");

    const handleLogin = async (event) => {
        event.preventDefault();

        setMessage("Logging in...");

        try {
            const response = await fetch("http://localhost:5001/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setMessage(data.message || "Login failed");
                return;
            }

            localStorage.setItem("token", data.token);

            setMessage(`Welcome, ${data.user.name}!`);
        } catch (error) {
            console.error("Login error:", error);
            setMessage("Unable to connect to the server");
        }
    };

    return (
        <div className="app">
            <div className="login-container">
                <div className="login-card">
                    <h1>Mirador</h1>
                    <p>Project Management System</p>

                    <form onSubmit={handleLogin}>
                        <label>
                            Email
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="Enter your email"
                                required
                            />
                        </label>

                        <label>
                            Password
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Enter your password"
                                required
                            />
                        </label>

                        <button type="submit">
                            Login
                        </button>
                    </form>

                    {message && (
                        <p className="login-message">
                            {message}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;