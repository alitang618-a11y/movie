export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const tmdbPath = searchParams.get("path");
  if (!tmdbPath) {
    return Response.json({ error: "缺少path参数" }, { status: 400 });
  }

  // 取出Vercel后台存放的密钥
  const API_KEY = process.env.TMDB_API_KEY;
  // 删除path，剩余全部透传给TMDB接口
  searchParams.delete("path");

  const tmdbUrl = new URL(`https://api.themoviedb.org/3${tmdbPath}`);
  // 拼接所有查询参数
  tmdbUrl.searchParams.set("api_key", API_KEY);
  for (const [k, v] of searchParams) {
    tmdbUrl.searchParams.set(k, v);
  }

  try {
    const res = await fetch(tmdbUrl.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ error: "TMDB请求失败", msg: err.message }, { status: 500 });
  }
}
