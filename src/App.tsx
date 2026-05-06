import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/layout";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import ProjectSetup from "@/pages/ProjectSetup";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/project/:id" element={<ProjectSetup />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
