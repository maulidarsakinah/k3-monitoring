const BASE_URL = "http://127.0.0.1:8000";

export const getDashboardData = async () => {
  const res = await fetch(`${BASE_URL}/violations`);
  return res.json();
};

export const getStats = async () => {
  const res = await fetch(`${BASE_URL}/violations/stats`);
  return res.json();
};
