import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Accueil from "./pages/Accueil";
import BasesSurveillees from "./pages/BasesSurveillees";
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

import MiseEnPage from "./components/MiseEnPage";

function App() {
  const [isLogged, setIsLogged] = useState(false);

  if (!isLogged) {
    return <Login onLogin={() => setIsLogged(true)} />;
  }

  return (
    <MiseEnPage>
      <Routes>
        <Route path="/" element={<Navigate to="/accueil" replace />} />
        <Route path="/accueil" element={<Accueil />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/config-bd" element={<ConfigBD />} />
        <Route path="/db-types" element={<DbTypes />} />
        <Route path="/test-db" element={<TestDB />} />
        <Route path="/bases-surveillees" element={<BasesSurveillees />} />
        <Route path="/configuration-metriques" element={<ConfigurationMetriques />} />
        <Route path="/alertes" element={<Alertes />} />
        <Route path="/utilisateurs" element={<Utilisateurs />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/analyseur-sql" element={<AnalyseurSQL />} />
        <Route path="/vue-globale-bd" element={<VueGlobaleBD />} />
        <Route path="/bases/:id" element={<DetailBase />} />
      </Routes>
    </MiseEnPage>
  );
}

export default App;