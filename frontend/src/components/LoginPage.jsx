import { useState } from "react";
import { AlertCircle, HardHat, Loader2, Lock, User } from "lucide-react";
import { login } from "../services/api.js";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    const nextErrors = {};
    if (!username.trim()) nextErrors.username = "Username wajib diisi.";
    if (!password) nextErrors.password = "Password wajib diisi.";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("Lengkapi data login terlebih dahulu.");
      return;
    }

    setLoading(true);

    try {
      const session = await login(username.trim(), password);
      onLogin(session.user);
    } catch (err) {
      setError(err.message || "Login gagal. Periksa username dan password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-8">
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-[#0d1b2a] px-8 py-7">
          <div className="w-11 h-11 rounded-lg bg-amber-400 text-[#0d1b2a] flex items-center justify-center mb-4">
            <HardHat size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white">K3 Monitoring</h1>
          <p className="text-sm text-slate-300 mt-1">
            Masuk untuk melihat dashboard, validasi, dan laporan pelanggaran.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-bold uppercase text-slate-500">
              Username
            </span>
            <div className="relative mt-2">
              <User
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setFieldErrors((prev) => ({ ...prev, username: "" }));
                }}
                autoComplete="username"
                aria-invalid={Boolean(fieldErrors.username)}
                className={`w-full rounded-lg border bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 ${
                  fieldErrors.username
                    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                    : "border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                }`}
                placeholder="admin"
              />
            </div>
            {fieldErrors.username && (
              <p className="text-xs text-red-600 mt-1">
                {fieldErrors.username}
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase text-slate-500">
              Password
            </span>
            <div className="relative mt-2">
              <Lock
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: "" }));
                }}
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(fieldErrors.password)}
                className={`w-full rounded-lg border bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 ${
                  fieldErrors.password
                    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                    : "border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                }`}
                placeholder="Password"
              />
            </div>
            {fieldErrors.password && (
              <p className="text-xs text-red-600 mt-1">
                {fieldErrors.password}
              </p>
            )}
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Login
          </button>
        </form>
      </section>
    </main>
  );
}
