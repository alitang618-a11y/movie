export default async function handler(req, res) {
  // 跨域允许前端访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理浏览器预检OPTIONS请求
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: "仅支持GET请求" });

  const { path, ...queryParams } = req.query;
  // 读取Vercel后台配置的密钥
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) return res.status(500).json({ error: "服务端未配置TMDB密钥" });

  // 拼接TMDB接口路径
  const tmdbApiPath = Array.isArray(path) ? path.join('/') : path;
  const baseUrl = `https://api.themoviedb.org/3/${tmdbApiPath}`;

  // 自动拼接密钥，前端不用携带
  const searchParams = new URLSearchParams();
  searchParams.append("api_key", tmdbKey);
  Object.entries(queryParams).forEach(([key, val]) => {
    if (key !== "path") searchParams.append(key, val);
  });

  const finalUrl = `${baseUrl}?${searchParams.toString()}`;

  try {
    const tmdbResponse = await fetch(finalUrl);
    const data = await tmdbResponse.json();
    return res.status(tmdbResponse.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: "TMDB接口请求失败", detail: err.message });
  }
}
