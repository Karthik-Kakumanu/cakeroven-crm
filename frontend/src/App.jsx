import { Routes, Route } from "react-router-dom";

import Start from "./pages/Start";
import Register from "./pages/Register";
import ExistingUser from "./pages/ExistingUser";
import Card from "./pages/Card";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import CancellationRefunds from "./pages/CancellationRefunds";
import ContactUs from "./pages/ContactUs";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ShippingPolicy from "./pages/ShippingPolicy";
import TermsConditions from "./pages/TermsConditions";  


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
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/refunds" element={<CancellationRefunds />} />
      <Route path="/terms" element={<TermsConditions />} />
      <Route path="/shipping" element={<ShippingPolicy />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/contact" element={<ContactUs />} />
    </Routes>
  );
}


export default App;
