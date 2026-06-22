import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import Start from "./pages/Start";
import Register from "./pages/Register";
import ExistingUser from "./pages/ExistingUser";
import Card from "./pages/Card";

const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CancellationRefunds = lazy(() => import("./pages/CancellationRefunds"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const ShippingPolicy = lazy(() => import("./pages/ShippingPolicy"));
const TermsConditions = lazy(() => import("./pages/TermsConditions"));

function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f5e6c8]" />}>
      <Routes>
        {/* User side */}
        <Route path="/" element={<Start />} />
        <Route path="/start" element={<Start />} />
        <Route path="/register" element={<Register />} />
        <Route path="/existing" element={<ExistingUser />} />
        <Route path="/card" element={<Card />} />

        {/* Admin / static pages */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/refunds" element={<CancellationRefunds />} />
        <Route path="/terms" element={<TermsConditions />} />
        <Route path="/shipping" element={<ShippingPolicy />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/contact" element={<ContactUs />} />
      </Routes>
    </Suspense>
  );
}

export default App;
