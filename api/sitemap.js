export const config = {
  runtime: "edge",
};

export default async function handler() {
  const baseUrl = "https://xiedang.com";
  const staticPages = [
    { path: "/", priority: "1.0", changefreq: "daily" },
  ];

  const topics = [
    "2026-sci-fi",
    "2025-horror",
    "top250-movie",
    "independent-film",
    "new-upcoming-2026",
    "top-animation-tv"
  ];
  const topicUrls = topics.map(key => ({
    path: `/?topic=${key}`,
    priority: "0.8",
    changefreq: "weekly"
  }));

  const allUrls = [...staticPages, ...topicUrls];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  allUrls.forEach(item => {
    xml += `
  <url>
    <loc>${baseUrl}${item.path}</loc>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`;
  });
  xml += "\n</urlset>";

  // 关键：清除所有<script/>污染片段
  const cleanXml = xml.replace(/<script\/>/g, "");

  return new Response(cleanXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600",
    },
  });
}
