import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Accueil from "./pages/Accueil";
import ConfigurationMetriques from "./pages/ConfigurationMetriques";
import Alertes from "./pages/Alertes";
import Utilisateurs from "./pages/Utilisateurs";
import Roles from "./pages/Roles";
import AnalyseurSQL from "./pages/AnalyseurSQL";
import VueGlobaleBD from "./pages/VueGlobaleBD";
import Dashboard from "./Dashboard";
import ConfigBD from "./pages/ConfigBD";
import DbTypes from "./pages/DbTypes";
import TestDB from "./pages/TestDB";
import DetailBase from "./pages/DetailBase";
import AiAnalysis from "./pages/AiAnalysis";

import MiseEnPage from "./components/MiseEnPage";

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/accueil" replace />;
  }

  return children;
}

function App() {
  const [isLogged, setIsLogged] = useState(!!localStorage.getItem("token"));

  if (!isLogged) {
    return <Login onLogin={() => setIsLogged(true)} />;
  }

  return (
    <MiseEnPage>
      <Routes>
        <Route path="/" element={<Navigate to="/accueil" replace />} />
        <Route path="/login" element={<Navigate to="/accueil" replace />} />

        <Route
          path="/accueil"
          element={
            <ProtectedRoute
              allowedRoles={["SUPER_ADMIN", "ADMIN", "CONSULTANT", "SIMPLE_USER"]}
            >
              <Accueil />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={["SUPER_ADMIN", "ADMIN", "CONSULTANT", "SIMPLE_USER"]}
            >
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/config-bd"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
              <ConfigBD />
            </ProtectedRoute>
          }
        />

        <Route
          path="/db-types"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
              <DbTypes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/test-db"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
              <TestDB />
            </ProtectedRoute>
          }
        />

        <Route
          path="/bases-surveillees"
          element={<Navigate to="/vue-globale-bd" replace />}
        />

        <Route
          path="/configuration-metriques"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
              <ConfigurationMetriques />
            </ProtectedRoute>
          }
        />

        <Route
          path="/alertes"
          element={
            <ProtectedRoute
              allowedRoles={["SUPER_ADMIN", "ADMIN", "CONSULTANT", "SIMPLE_USER"]}
            >
              <Alertes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/utilisateurs"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
              <Utilisateurs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/roles"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
              <Roles />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analyseur-sql"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "CONSULTANT"]}>
              <AnalyseurSQL />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vue-globale-bd"
          element={
            <ProtectedRoute
              allowedRoles={["SUPER_ADMIN", "ADMIN", "CONSULTANT", "SIMPLE_USER"]}
            >
              <VueGlobaleBD />
            </ProtectedRoute>
          }
        />

        <Route
          path="/bases/:id"
          element={
            <ProtectedRoute
              allowedRoles={["SUPER_ADMIN", "ADMIN", "CONSULTANT", "SIMPLE_USER"]}
            >
              <DetailBase />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai-analysis"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "CONSULTANT"]}>
              <AiAnalysis />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/accueil" replace />} />
      </Routes>
    </MiseEnPage>
  );
}

export default App;