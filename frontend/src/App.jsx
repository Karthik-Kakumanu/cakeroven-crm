import { Routes, Route } from "react-router-dom";

import Start from "./pages/Start";
import Register from "./pages/Register";
import ExistingUser from "./pages/ExistingUser";
import Card from "./pages/Card";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  return (
    <Routes>
      {/* User side */}
      <Route path="/" element={<Start />} />
      <Route path="/start" element={<Start />} />
      <Route path="/register" element={<Register />} />
      <Route path="/existing" element={<ExistingUser />} />
      <Route path="/card" element={<Card />} />

      {/* Admin side */}
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
    </Routes>
  );
}

export default App;
