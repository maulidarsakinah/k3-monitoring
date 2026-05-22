import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Camera,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import {
  createCamera,
  createRule,
  createUser,
  deleteCamera,
  deleteRule,
  deleteUser,
  getCameras,
  getRules,
  getUsers,
  updateCamera,
  updateRule,
  updateUserRole,
} from "../../services/api.js";

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager / Admin" },
  { value: "operator", label: "Staff Operasional" },
];

const APD_OPTIONS = ["Hardhat", "Gloves", "Goggles", "Mask", "Safety Vest"];

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function inputClass() {
  return "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-100";
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
      <Icon size={30} className="mx-auto text-slate-300 mb-3" />
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-400 mt-1">{text}</p>
    </div>
  );
}

export default function ManagementPage({ user, onChanged }) {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    role: "operator",
  });
  const [cameraForm, setCameraForm] = useState({
    name: "",
    location: "",
    rtsp_url: "",
    description: "",
  });
  const [ruleForm, setRuleForm] = useState({
    camera_id: "",
    name: "",
    required_apd: ["Hardhat", "Safety Vest"],
    description: "",
  });

  const isManager = ["admin", "manager"].includes(user?.role);

  const loadData = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [userData, cameraData, ruleData] = await Promise.all([
        getUsers(),
        getCameras(),
        getRules(),
      ]);
      setUsers(userData);
      setCameras(cameraData);
      setRules(ruleData);
      if (!ruleForm.camera_id && cameraData[0]?.id) {
        setRuleForm((prev) => ({ ...prev, camera_id: String(cameraData[0].id) }));
      }
    } catch (err) {
      setMessage(err.message || "Gagal memuat data manajemen.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isManager) loadData();
  }, [isManager]);

  const cameraNameById = useMemo(
    () =>
      cameras.reduce((acc, camera) => {
        acc[camera.id] = `${camera.name} - ${camera.location}`;
        return acc;
      }, {}),
    [cameras],
  );

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (!userForm.username || !userForm.password) {
      setMessage("Username dan password wajib diisi.");
      return;
    }
    setSaving("user");
    try {
      await createUser(userForm);
      setUserForm({ username: "", password: "", role: "operator" });
      await loadData();
      onChanged?.();
      setMessage("User berhasil ditambahkan.");
    } catch (err) {
      setMessage(err.message || "Gagal menambahkan user.");
    } finally {
      setSaving("");
    }
  };

  const handleCreateCamera = async (event) => {
    event.preventDefault();
    if (!cameraForm.name || !cameraForm.location) {
      setMessage("Nama dan lokasi kamera wajib diisi.");
      return;
    }
    setSaving("camera");
    try {
      await createCamera(cameraForm);
      setCameraForm({ name: "", location: "", rtsp_url: "", description: "" });
      await loadData();
      onChanged?.();
      setMessage("Kamera berhasil ditambahkan.");
    } catch (err) {
      setMessage(err.message || "Gagal menambahkan kamera.");
    } finally {
      setSaving("");
    }
  };

  const handleCreateRule = async (event) => {
    event.preventDefault();
    if (!ruleForm.camera_id || !ruleForm.name || ruleForm.required_apd.length === 0) {
      setMessage("Kamera, nama aturan, dan APD wajib diisi.");
      return;
    }
    setSaving("rule");
    try {
      await createRule({
        ...ruleForm,
        camera_id: Number(ruleForm.camera_id),
      });
      setRuleForm((prev) => ({ ...prev, name: "", description: "" }));
      await loadData();
      onChanged?.();
      setMessage("Aturan APD berhasil ditambahkan.");
    } catch (err) {
      setMessage(err.message || "Gagal menambahkan aturan.");
    } finally {
      setSaving("");
    }
  };

  const confirmAndRun = async (text, task) => {
    if (!window.confirm(text)) return;
    setSaving("action");
    setMessage("");
    try {
      await task();
      await loadData();
      onChanged?.();
      setMessage("Perubahan berhasil disimpan.");
    } catch (err) {
      setMessage(err.message || "Aksi gagal diproses.");
    } finally {
      setSaving("");
    }
  };

  if (!isManager) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
        <ShieldCheck size={36} className="mx-auto text-slate-300 mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Akses Manager</h2>
        <p className="text-sm text-slate-400 mt-1">
          Halaman manajemen hanya tersedia untuk Manager/Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Manajemen Sistem</h2>
            <p className="text-sm text-slate-400 mt-1">
              Kelola user, kamera, dan aturan APD per kamera.
            </p>
          </div>
          <div className="flex rounded-xl bg-slate-100 p-1">
            {[
              { id: "users", label: "User" },
              { id: "cameras", label: "Kamera" },
              { id: "rules", label: "Aturan APD" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold ${
                  activeTab === tab.id
                    ? "bg-white text-violet-700 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {message && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <Loader2 size={28} className="mx-auto text-violet-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-5 items-start">
          {activeTab === "users" && (
            <>
              <form onSubmit={handleCreateUser} className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                <h3 className="font-bold text-slate-900">Tambah User</h3>
                <Field label="Username">
                  <input className={inputClass()} value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
                </Field>
                <Field label="Password">
                  <input type="password" className={inputClass()} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                </Field>
                <Field label="Role">
                  <select className={inputClass()} value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                    {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                </Field>
                <button disabled={saving === "user"} className="w-full h-10 rounded-lg bg-violet-600 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
                  {saving === "user" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  Simpan User
                </button>
              </form>
              <section className="bg-white rounded-2xl border border-slate-100 p-6">
                <h3 className="font-bold text-slate-900 mb-4">Daftar User</h3>
                {users.length === 0 ? <EmptyState icon={Users} title="Belum ada user" text="Tambahkan user manager atau staff." /> : (
                  <div className="space-y-3">
                    {users.filter((item) => ["admin", "manager", "operator"].includes(item.role)).map((item) => (
                      <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.username}</p>
                          <p className="text-xs text-slate-400">{item.created_at}</p>
                        </div>
                        <select
                          className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-semibold"
                          value={item.role === "admin" ? "manager" : item.role}
                          disabled={item.role === "admin"}
                          onChange={(e) => confirmAndRun("Ubah role user ini?", () => updateUserRole(item.id, e.target.value))}
                        >
                          {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                        </select>
                        <button
                          disabled={item.role === "admin"}
                          onClick={() => confirmAndRun("Hapus user ini?", () => deleteUser(item.id))}
                          className="w-9 h-9 rounded-lg bg-red-50 text-red-600 disabled:opacity-30 flex items-center justify-center"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === "cameras" && (
            <>
              <form onSubmit={handleCreateCamera} className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                <h3 className="font-bold text-slate-900">Tambah Kamera</h3>
                <Field label="Nama Kamera">
                  <input className={inputClass()} value={cameraForm.name} onChange={(e) => setCameraForm({ ...cameraForm, name: e.target.value })} />
                </Field>
                <Field label="Lokasi">
                  <input className={inputClass()} value={cameraForm.location} onChange={(e) => setCameraForm({ ...cameraForm, location: e.target.value })} />
                </Field>
                <Field label="RTSP URL">
                  <input className={inputClass()} value={cameraForm.rtsp_url} onChange={(e) => setCameraForm({ ...cameraForm, rtsp_url: e.target.value })} />
                </Field>
                <Field label="Deskripsi">
                  <textarea className={inputClass()} rows={3} value={cameraForm.description} onChange={(e) => setCameraForm({ ...cameraForm, description: e.target.value })} />
                </Field>
                <button disabled={saving === "camera"} className="w-full h-10 rounded-lg bg-violet-600 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
                  {saving === "camera" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  Simpan Kamera
                </button>
              </form>
              <section className="bg-white rounded-2xl border border-slate-100 p-6">
                <h3 className="font-bold text-slate-900 mb-4">Daftar Kamera</h3>
                {cameras.length === 0 ? <EmptyState icon={Camera} title="Belum ada kamera" text="Tambahkan kamera untuk monitoring area." /> : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {cameras.map((camera) => (
                      <div key={camera.id} className="rounded-xl border border-slate-100 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">{camera.name}</p>
                            <p className="text-sm text-slate-500">{camera.location}</p>
                            <p className="text-xs text-slate-400 mt-1">{camera.description || "Tanpa deskripsi"}</p>
                          </div>
                          <button onClick={() => confirmAndRun("Nonaktifkan kamera ini?", () => updateCamera(camera.id, { is_active: !camera.is_active }))} className={`text-[10px] font-bold px-2 py-1 rounded-full ${camera.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {camera.is_active ? "Aktif" : "Nonaktif"}
                          </button>
                        </div>
                        <button onClick={() => confirmAndRun("Hapus kamera ini?", () => deleteCamera(camera.id))} className="mt-3 text-xs font-bold text-red-600">
                          Hapus kamera
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === "rules" && (
            <>
              <form onSubmit={handleCreateRule} className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                <h3 className="font-bold text-slate-900">Tambah Aturan APD</h3>
                <Field label="Kamera">
                  <select className={inputClass()} value={ruleForm.camera_id} onChange={(e) => setRuleForm({ ...ruleForm, camera_id: e.target.value })}>
                    <option value="">Pilih kamera</option>
                    {cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name} - {camera.location}</option>)}
                  </select>
                </Field>
                <Field label="Nama Aturan">
                  <input className={inputClass()} value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} />
                </Field>
                <Field label="APD Wajib">
                  <div className="grid grid-cols-2 gap-2">
                    {APD_OPTIONS.map((apd) => (
                      <label key={apd} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={ruleForm.required_apd.includes(apd)}
                          onChange={(e) => {
                            setRuleForm((prev) => ({
                              ...prev,
                              required_apd: e.target.checked
                                ? [...prev.required_apd, apd]
                                : prev.required_apd.filter((item) => item !== apd),
                            }));
                          }}
                        />
                        {apd}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Deskripsi">
                  <textarea className={inputClass()} rows={3} value={ruleForm.description} onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })} />
                </Field>
                <button disabled={saving === "rule"} className="w-full h-10 rounded-lg bg-violet-600 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
                  {saving === "rule" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  Simpan Aturan
                </button>
              </form>
              <section className="bg-white rounded-2xl border border-slate-100 p-6">
                <h3 className="font-bold text-slate-900 mb-4">Daftar Aturan APD</h3>
                {rules.length === 0 ? <EmptyState icon={ShieldCheck} title="Belum ada aturan" text="Atur APD wajib per kamera." /> : (
                  <div className="space-y-3">
                    {rules.map((rule) => (
                      <div key={rule.id} className="rounded-xl border border-slate-100 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">{rule.name}</p>
                            <p className="text-xs text-slate-400">{cameraNameById[rule.camera_id] || `Camera ID ${rule.camera_id}`}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {rule.required_apd.map((apd) => <span key={apd} className="rounded-full bg-violet-50 text-violet-700 px-2.5 py-1 text-[10px] font-bold">{apd}</span>)}
                            </div>
                          </div>
                          <button onClick={() => confirmAndRun("Nonaktifkan aturan ini?", () => updateRule(rule.id, { is_active: !rule.is_active }))} className={`text-[10px] font-bold px-2 py-1 rounded-full ${rule.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {rule.is_active ? "Aktif" : "Nonaktif"}
                          </button>
                        </div>
                        <button onClick={() => confirmAndRun("Hapus aturan ini?", () => deleteRule(rule.id))} className="mt-3 text-xs font-bold text-red-600">
                          Hapus aturan
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
