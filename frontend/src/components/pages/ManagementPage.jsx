import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Pencil,
  Loader2,
  Plus,
  Radio,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  X,
  Users,
} from "lucide-react";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import {
  createCamera,
  createRule,
  createUser,
  deleteCamera,
  deleteRule,
  deleteUser,
  getCameras,
  getCameraStreamStatus,
  getRules,
  getUsers,
  restartCameraStream,
  updateCamera,
  updateRule,
  updateUser,
} from "../../services/api.js";

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager / Admin" },
  { value: "operator", label: "Staff Operasional" },
];

const APD_OPTIONS = [
  { value: "helmet", label: "Helm" },
  { value: "vest", label: "Vest" },
  { value: "safety-shoes", label: "Safety Shoes" },
  { value: "goggles", label: "Goggles" },
  { value: "gloves", label: "Gloves" },
];
const APD_LABEL_BY_VALUE = APD_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

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
      <Icon size={30} className="mx-auto text-slate-400 mb-3" />
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1">{text}</p>
    </div>
  );
}

function streamBadgeClass(state) {
  if (state === "running") return "bg-emerald-50 text-emerald-700";
  if (state === "error") return "bg-red-50 text-red-700";
  if (state === "connecting") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function normalizeCameraList(...sources) {
  const byKey = new Map();

  sources.flat().forEach((item) => {
    if (!item) return;

    const id = item.id ?? item.camera_id;
    const name = item.name || item.camera || item.label;

    if (!id || !name) return;

    const key = String(id);
    byKey.set(key, {
      ...byKey.get(key),
      ...item,
      id,
      name,
      location: item.location || byKey.get(key)?.location || "Tanpa lokasi",
      is_active: item.is_active ?? item.isActive ?? byKey.get(key)?.is_active ?? 1,
    });
  });

  return Array.from(byKey.values());
}

export default function ManagementPage({
  user,
  onChanged,
  registeredCameras = [],
  cameraStreamStatuses: initialStreamStatuses = [],
}) {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [cameras, setCameras] = useState(() =>
    normalizeCameraList(registeredCameras, initialStreamStatuses),
  );
  const [streamStatuses, setStreamStatuses] = useState(initialStreamStatuses);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingCameraId, setEditingCameraId] = useState(null);
  const [editingRuleId, setEditingRuleId] = useState(null);
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
    required_apd: ["helmet", "vest"],
    description: "",
  });
  const [cameraEditForm, setCameraEditForm] = useState(cameraForm);
  const [ruleEditForm, setRuleEditForm] = useState(ruleForm);
  const [userEditForm, setUserEditForm] = useState({
    username: "",
    role: "operator",
    password: "",
  });

  const isManager = ["admin", "manager"].includes(user?.role);
  const canManageUsers = user?.role === "admin";
  const tabs = [
    ...(canManageUsers ? [{ id: "users", label: "User" }] : []),
    { id: "cameras", label: "Kamera" },
    { id: "rules", label: "Aturan APD" },
  ];

  const loadData = async () => {
    setLoading(true);
    setMessage("");
    const [userResult, cameraResult, ruleResult, streamResult] = await Promise.allSettled([
      canManageUsers ? getUsers() : Promise.resolve([]),
      getCameras(),
      getRules(),
      getCameraStreamStatus(),
    ]);

    const userData = userResult.status === "fulfilled" ? userResult.value : [];
    const cameraData = cameraResult.status === "fulfilled" ? cameraResult.value : [];
    const ruleData = ruleResult.status === "fulfilled" ? ruleResult.value : [];
    const streamData = streamResult.status === "fulfilled" ? streamResult.value : [];

    const nextStreamStatuses = Array.isArray(streamData) ? streamData : initialStreamStatuses;
    const nextCameras = normalizeCameraList(
      Array.isArray(cameraData) ? cameraData : [],
      registeredCameras,
      nextStreamStatuses,
    );

    setUsers(Array.isArray(userData) ? userData : []);
    setCameras(nextCameras);
    setRules(Array.isArray(ruleData) ? ruleData : []);
    setStreamStatuses(nextStreamStatuses);

    if (cameraResult.status === "rejected" || ruleResult.status === "rejected") {
      setMessage(
        cameraResult.reason?.message ||
          ruleResult.reason?.message ||
          "Sebagian data manajemen gagal dimuat.",
      );
    }

    try {
      if (!ruleForm.camera_id && nextCameras[0]?.id) {
        setRuleForm((prev) => ({ ...prev, camera_id: String(nextCameras[0].id) }));
      }
    } catch (err) {
      setMessage(err.message || "Gagal memuat data manajemen.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isManager) loadData();
  }, [isManager, canManageUsers]);

  useEffect(() => {
    const fallbackCameras = normalizeCameraList(registeredCameras, initialStreamStatuses);
    if (fallbackCameras.length) {
      setCameras((prev) => normalizeCameraList(prev, fallbackCameras));
      if (!ruleForm.camera_id) {
        setRuleForm((prev) => ({ ...prev, camera_id: String(fallbackCameras[0].id) }));
      }
    }
    if (Array.isArray(initialStreamStatuses) && initialStreamStatuses.length) {
      setStreamStatuses(initialStreamStatuses);
    }
  }, [registeredCameras, initialStreamStatuses, ruleForm.camera_id]);

  useEffect(() => {
    if (!canManageUsers && activeTab === "users") {
      setActiveTab("cameras");
    }
  }, [activeTab, canManageUsers]);

  const cameraNameById = useMemo(
    () =>
      cameras.reduce((acc, camera) => {
        acc[camera.id] = `${camera.name} - ${camera.location}`;
        return acc;
      }, {}),
    [cameras],
  );

  const streamByCameraId = useMemo(
    () =>
      streamStatuses.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [streamStatuses],
  );

  const existingRuleForSelectedCamera = useMemo(
    () =>
      rules.find(
        (rule) => String(rule.camera_id) === String(ruleForm.camera_id),
      ),
    [rules, ruleForm.camera_id],
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
      const createdCamera = await createCamera(cameraForm);
      if (createdCamera?.id) {
        setCameras((prev) => normalizeCameraList(prev, [createdCamera]));
      }
      setCameraForm({ name: "", location: "", rtsp_url: "", description: "" });
      await loadData();
      onChanged?.();
      setMessage("Kamera berhasil ditambahkan.");
    } catch (err) {
      const permissionMessage =
        err.status === 401 || err.status === 403
          ? "Gagal menambahkan kamera: login sebagai Manager/Admin diperlukan."
          : null;
      setMessage(permissionMessage || err.message || "Gagal menambahkan kamera.");
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
    if (existingRuleForSelectedCamera) {
      setMessage("Kamera ini sudah punya aturan APD. Edit aturan yang ada untuk mengubahnya.");
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

  const startEditUser = (item) => {
    setEditingUserId(item.id);
    setUserEditForm({
      username: item.username || "",
      role: item.role === "admin" ? "manager" : item.role,
      password: "",
    });
  };

  const handleUpdateUser = async (event) => {
    event.preventDefault();
    if (!editingUserId) return;
    if (!userEditForm.username) {
      setMessage("Username wajib diisi.");
      return;
    }
    setSaving("user-edit");
    try {
      await updateUser(editingUserId, {
        username: userEditForm.username,
        role: userEditForm.role,
        password: userEditForm.password || undefined,
      });
      setEditingUserId(null);
      await loadData();
      onChanged?.();
      setMessage("User berhasil diperbarui.");
    } catch (err) {
      setMessage(err.message || "Gagal memperbarui user.");
    } finally {
      setSaving("");
    }
  };

  const startEditCamera = (camera) => {
    setEditingCameraId(camera.id);
    setCameraEditForm({
      name: camera.name || "",
      location: camera.location || "",
      rtsp_url: camera.rtsp_url || "",
      description: camera.description || "",
    });
  };

  const handleUpdateCamera = async (event) => {
    event.preventDefault();
    if (!editingCameraId) return;
    if (!cameraEditForm.name || !cameraEditForm.location) {
      setMessage("Nama dan lokasi kamera wajib diisi.");
      return;
    }
    setSaving("camera-edit");
    try {
      await updateCamera(editingCameraId, cameraEditForm);
      setEditingCameraId(null);
      await loadData();
      onChanged?.();
      setMessage("Kamera berhasil diperbarui.");
    } catch (err) {
      setMessage(err.message || "Gagal memperbarui kamera.");
    } finally {
      setSaving("");
    }
  };

  const startEditRule = (rule) => {
    setEditingRuleId(rule.id);
    setRuleEditForm({
      camera_id: String(rule.camera_id || ""),
      name: rule.name || "",
      required_apd: rule.required_apd || [],
      description: rule.description || "",
    });
  };

  const handleUpdateRule = async (event) => {
    event.preventDefault();
    if (!editingRuleId) return;
    if (!ruleEditForm.camera_id || !ruleEditForm.name || ruleEditForm.required_apd.length === 0) {
      setMessage("Kamera, nama aturan, dan APD wajib diisi.");
      return;
    }
    setSaving("rule-edit");
    try {
      await updateRule(editingRuleId, {
        ...ruleEditForm,
        camera_id: Number(ruleEditForm.camera_id),
      });
      setEditingRuleId(null);
      await loadData();
      onChanged?.();
      setMessage("Aturan APD berhasil diperbarui.");
    } catch (err) {
      setMessage(err.message || "Gagal memperbarui aturan.");
    } finally {
      setSaving("");
    }
  };

  const runAction = async (task, successMessage = "Perubahan berhasil disimpan.") => {
    setSaving("action");
    setMessage("");
    try {
      await task();
      await loadData();
      onChanged?.();
      setMessage(successMessage);
    } catch (err) {
      setMessage(err.message || "Aksi gagal diproses.");
    } finally {
      setSaving("");
    }
  };

  const confirmAndRun = ({ title, message: text, confirmLabel, tone = "danger", task, successMessage }) => {
    setConfirmState({ title, message: text, confirmLabel, tone, task, successMessage });
  };

  const handleConfirmAction = async () => {
    if (!confirmState?.task) return;
    const current = confirmState;
    await runAction(current.task, current.successMessage);
    setConfirmState(null);
  };

  if (!isManager) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
        <ShieldCheck size={36} className="mx-auto text-slate-400 mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Akses Manager</h2>
        <p className="text-sm text-slate-500 mt-1">
          Halaman manajemen hanya tersedia untuk Manager/Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        loading={saving === "action"}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleConfirmAction}
      />

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Manajemen Sistem</h2>
            <p className="text-sm text-slate-500 mt-1">
              Kelola user, kamera, dan aturan APD per kamera.
            </p>
          </div>
          <div className="flex rounded-xl bg-slate-100 p-1">
            {tabs.map((tab) => (
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
                        {editingUserId === item.id ? (
                          <form onSubmit={handleUpdateUser} className="col-span-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                            <input className={inputClass()} value={userEditForm.username} onChange={(e) => setUserEditForm({ ...userEditForm, username: e.target.value })} />
                            <select className={inputClass()} value={userEditForm.role} onChange={(e) => setUserEditForm({ ...userEditForm, role: e.target.value })}>
                              {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                            </select>
                            <input type="password" className={inputClass()} value={userEditForm.password} onChange={(e) => setUserEditForm({ ...userEditForm, password: e.target.value })} placeholder="Password baru opsional" />
                            <div className="flex gap-2">
                              <button disabled={saving === "user-edit"} className="h-10 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white inline-flex items-center gap-2">
                                {saving === "user-edit" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Simpan
                              </button>
                              <button type="button" onClick={() => setEditingUserId(null)} className="h-10 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700">
                                Batal
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div>
                              <p className="font-semibold text-slate-900">{item.username}</p>
                              <p className="text-xs text-slate-500">{item.created_at}</p>
                            </div>
                            <span className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                              {ROLE_OPTIONS.find((role) => role.value === (item.role === "admin" ? "manager" : item.role))?.label || item.role}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                disabled={item.role === "admin"}
                                onClick={() => startEditUser(item)}
                                className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 disabled:opacity-30 flex items-center justify-center"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                disabled={item.role === "admin"}
                                onClick={() =>
                                  confirmAndRun({
                                    title: "Hapus User",
                                    message: `User ${item.username} akan dihapus dari sistem.`,
                                    confirmLabel: "Hapus User",
                                    task: () => deleteUser(item.id),
                                    successMessage: "User berhasil dihapus.",
                                  })
                                }
                                className="w-9 h-9 rounded-lg bg-red-50 text-red-600 disabled:opacity-30 flex items-center justify-center"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </>
                        )}
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {cameras.map((camera) => (
                      <div key={camera.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        {editingCameraId === camera.id ? (
                          <form onSubmit={handleUpdateCamera} className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="font-bold text-slate-900">Edit Kamera</h4>
                              <button
                                type="button"
                                onClick={() => setEditingCameraId(null)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                aria-label="Batalkan edit kamera"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <Field label="Nama Kamera">
                              <input className={inputClass()} value={cameraEditForm.name} onChange={(e) => setCameraEditForm({ ...cameraEditForm, name: e.target.value })} />
                            </Field>
                            <Field label="Lokasi">
                              <input className={inputClass()} value={cameraEditForm.location} onChange={(e) => setCameraEditForm({ ...cameraEditForm, location: e.target.value })} />
                            </Field>
                            <Field label="RTSP URL">
                              <input className={inputClass()} value={cameraEditForm.rtsp_url} onChange={(e) => setCameraEditForm({ ...cameraEditForm, rtsp_url: e.target.value })} />
                            </Field>
                            <Field label="Deskripsi">
                              <textarea className={inputClass()} rows={2} value={cameraEditForm.description} onChange={(e) => setCameraEditForm({ ...cameraEditForm, description: e.target.value })} />
                            </Field>
                            <button disabled={saving === "camera-edit"} className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-60">
                              {saving === "camera-edit" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                              Simpan Perubahan
                            </button>
                          </form>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                                  <Camera size={18} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 truncate">{camera.name}</p>
                                  <p className="text-sm text-slate-500 truncate">{camera.location}</p>
                                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{camera.description || "Tanpa deskripsi"}</p>
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  confirmAndRun({
                                    title: camera.is_active ? "Nonaktifkan Kamera" : "Aktifkan Kamera",
                                    message: `${camera.name} akan ${camera.is_active ? "dinonaktifkan dan stream RTSP berhenti" : "diaktifkan kembali"}.`,
                                    confirmLabel: camera.is_active ? "Nonaktifkan" : "Aktifkan",
                                    tone: "primary",
                                    task: () => updateCamera(camera.id, { is_active: !camera.is_active }),
                                    successMessage: "Status kamera berhasil diubah.",
                                  })
                                }
                                className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${camera.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                              >
                                {camera.is_active ? "Aktif" : "Nonaktif"}
                              </button>
                            </div>
                            <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                  <Radio size={13} />
                                  RTSP
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${streamBadgeClass(streamByCameraId[camera.id]?.stream_state)}`}>
                                  {streamByCameraId[camera.id]?.stream_state || "idle"}
                                </span>
                              </div>
                              <p className="mt-1 break-all font-mono text-[11px] text-slate-600">
                                {camera.rtsp_url || "Belum ada URL RTSP"}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {streamByCameraId[camera.id]?.stream_message || "Belum ada stream aktif"}
                              </p>
                              <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-slate-500">
                                <span>Frame terakhir: {streamByCameraId[camera.id]?.last_frame_at || "-"}</span>
                                <span>Deteksi terakhir: {streamByCameraId[camera.id]?.last_detection_at || "-"}</span>
                                <span>Pelanggaran terakhir: {streamByCameraId[camera.id]?.last_violation_at || "-"}</span>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                              <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                                <CheckCircle2 size={14} className={camera.rtsp_url ? "text-emerald-500" : "text-slate-400"} />
                                {camera.rtsp_url ? "Siap monitoring otomatis" : "Data kamera saja"}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => startEditCamera(camera)}
                                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200"
                                >
                                  <Pencil size={14} />
                                  Edit
                                </button>
                                <button
                                  disabled={!camera.rtsp_url || !camera.is_active}
                                  onClick={() =>
                                    confirmAndRun({
                                      title: "Restart Stream",
                                      message: `Stream RTSP ${camera.name} akan direstart.`,
                                      confirmLabel: "Restart",
                                      tone: "primary",
                                      task: () => restartCameraStream(camera.id),
                                      successMessage: "Stream kamera berhasil direstart.",
                                    })
                                  }
                                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-50 px-3 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-40"
                                >
                                  <RotateCcw size={14} />
                                  Restart
                                </button>
                                <button
                                  onClick={() =>
                                    confirmAndRun({
                                      title: "Hapus Kamera",
                                      message: `${camera.name} akan dihapus dari daftar kamera. Stream dan aturan terkait perlu dicek ulang setelahnya.`,
                                      confirmLabel: "Hapus Kamera",
                                      task: () => deleteCamera(camera.id),
                                      successMessage: "Kamera berhasil dihapus.",
                                    })
                                  }
                                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-50 px-3 text-xs font-bold text-red-600 hover:bg-red-100"
                                >
                                  <Trash2 size={14} />
                                  Hapus
                                </button>
                              </div>
                            </div>
                          </>
                        )}
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
                    {cameras.length === 0 && <option value="" disabled>Belum ada kamera terdaftar</option>}
                    {cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name} - {camera.location}</option>)}
                  </select>
                </Field>
                {existingRuleForSelectedCamera && (
                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Kamera ini sudah punya aturan. Gunakan tombol edit pada aturan "{existingRuleForSelectedCamera.name}".
                  </div>
                )}
                <Field label="Nama Aturan">
                  <input className={inputClass()} value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} />
                </Field>
                <Field label="APD Wajib">
                  <div className="grid grid-cols-2 gap-2">
                    {APD_OPTIONS.map((apd) => (
                      <label key={apd.value} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={ruleForm.required_apd.includes(apd.value)}
                          onChange={(e) => {
                            setRuleForm((prev) => ({
                              ...prev,
                              required_apd: e.target.checked
                                ? [...prev.required_apd, apd.value]
                                : prev.required_apd.filter((item) => item !== apd.value),
                            }));
                          }}
                        />
                        {apd.label}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Deskripsi">
                  <textarea className={inputClass()} rows={3} value={ruleForm.description} onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })} />
                </Field>
                <button disabled={saving === "rule" || Boolean(existingRuleForSelectedCamera)} className="w-full h-10 rounded-lg bg-violet-600 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
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
                        {editingRuleId === rule.id ? (
                          <form onSubmit={handleUpdateRule} className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="font-bold text-slate-900">Edit Aturan APD</h4>
                              <button
                                type="button"
                                onClick={() => setEditingRuleId(null)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                aria-label="Batalkan edit aturan"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <Field label="Kamera">
                              <select className={inputClass()} value={ruleEditForm.camera_id} onChange={(e) => setRuleEditForm({ ...ruleEditForm, camera_id: e.target.value })}>
                                <option value="">Pilih kamera</option>
                                {cameras.length === 0 && <option value="" disabled>Belum ada kamera terdaftar</option>}
                                {cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name} - {camera.location}</option>)}
                              </select>
                            </Field>
                            <Field label="Nama Aturan">
                              <input className={inputClass()} value={ruleEditForm.name} onChange={(e) => setRuleEditForm({ ...ruleEditForm, name: e.target.value })} />
                            </Field>
                            <Field label="APD Wajib">
                              <div className="grid grid-cols-2 gap-2">
                                {APD_OPTIONS.map((apd) => (
                                  <label key={apd.value} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={ruleEditForm.required_apd.includes(apd.value)}
                                      onChange={(e) => {
                                        setRuleEditForm((prev) => ({
                                          ...prev,
                                          required_apd: e.target.checked
                                            ? [...prev.required_apd, apd.value]
                                            : prev.required_apd.filter((item) => item !== apd.value),
                                        }));
                                      }}
                                    />
                                    {apd.label}
                                  </label>
                                ))}
                              </div>
                            </Field>
                            <Field label="Deskripsi">
                              <textarea className={inputClass()} rows={2} value={ruleEditForm.description} onChange={(e) => setRuleEditForm({ ...ruleEditForm, description: e.target.value })} />
                            </Field>
                            <button disabled={saving === "rule-edit"} className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-60">
                              {saving === "rule-edit" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                              Simpan Perubahan
                            </button>
                          </form>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-bold text-slate-900">{rule.name}</p>
                                <p className="text-xs text-slate-500">{cameraNameById[rule.camera_id] || `Camera ID ${rule.camera_id}`}</p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {rule.required_apd.map((apd) => <span key={apd} className="rounded-full bg-violet-50 text-violet-700 px-2.5 py-1 text-[10px] font-bold">{APD_LABEL_BY_VALUE[apd] || apd}</span>)}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  confirmAndRun({
                                    title: rule.is_active ? "Nonaktifkan Aturan" : "Aktifkan Aturan",
                                    message: `${rule.name} akan ${rule.is_active ? "dinonaktifkan" : "diaktifkan"}.`,
                                    confirmLabel: rule.is_active ? "Nonaktifkan" : "Aktifkan",
                                    tone: "primary",
                                    task: () => updateRule(rule.id, { is_active: !rule.is_active }),
                                    successMessage: "Status aturan berhasil diubah.",
                                  })
                                }
                                className={`text-[10px] font-bold px-2 py-1 rounded-full ${rule.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                              >
                                {rule.is_active ? "Aktif" : "Nonaktif"}
                              </button>
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                              <button
                                onClick={() => startEditRule(rule)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700"
                              >
                                <Pencil size={14} />
                                Edit aturan
                              </button>
                              <button
                                onClick={() =>
                                  confirmAndRun({
                                    title: "Hapus Aturan",
                                    message: `Aturan ${rule.name} akan dihapus permanen.`,
                                    confirmLabel: "Hapus Aturan",
                                    task: () => deleteRule(rule.id),
                                    successMessage: "Aturan berhasil dihapus.",
                                  })
                                }
                                className="text-xs font-bold text-red-600"
                              >
                                Hapus aturan
                              </button>
                            </div>
                          </>
                        )}
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
