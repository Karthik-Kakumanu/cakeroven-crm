// Register.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE } from "../apiConfig"; // adjust path if needed
import { motion } from "framer-motion";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    if (!name.trim() || !phone.trim()) {
      setErr("Name and phone are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customer/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), dob: dob || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");
      // persist member code & phone for subsequent Card view
      localStorage.setItem("cr_memberCode", data.memberCode);
      localStorage.setItem("cr_phone", phone.trim());
      navigate(`/card/${encodeURIComponent(data.memberCode)}`, { replace: true });
    } catch (error) {
      setErr(error.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <motion.div
        className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h2 className="text-2xl font-bold mb-2">Create your Loyalty Card</h2>
        <p className="text-sm text-slate-500 mb-6">Enter your details to join.</p>

        {err && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-md border p-2" placeholder="Full name" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full rounded-md border p-2" placeholder="Mobile number" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Date of birth (optional)</span>
            <input value={dob} onChange={(e) => setDob(e.target.value)} type="date" className="mt-1 block w-full rounded-md border p-2" />
          </label>

          <div className="flex items-center justify-between mt-4">
            <button disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow hover:bg-indigo-700 disabled:opacity-60">
              {loading ? "Creating..." : "Create Card"}
            </button>
            <Link to="/existing" className="text-sm text-slate-600 hover:underline">I already have a card</Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
