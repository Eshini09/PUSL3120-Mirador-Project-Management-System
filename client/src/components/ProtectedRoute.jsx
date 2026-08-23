import { Navigate, Outlet } from "react-router-dom";

function ProtectedRoute() {
    const token = localStorage.getItem("token");

    if (!token) {
        localStorage.setItem(
            "pendingRedirect",
            window.location.pathname
        );
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}

export default ProtectedRoute;
