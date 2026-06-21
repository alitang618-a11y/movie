/**
 * Vercel Edge代理请求TMDB
 * @param {string} path TMDB接口路径 /movie/popular
 * @param {Object} params 查询参数
 */
async function fetchTMDB(path, params = {}) {
  const urlParams = new URLSearchParams();
  urlParams.set("path", path);
  Object.entries(params).forEach(([k, v]) => {
    urlParams.set(k, v);
  });
  const res = await fetch(`/api/tmdb-proxy?${urlParams.toString()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.msg);
  return data;
}

let currentLang = 'en'; // 默认英文
let currentPage = 1;
let scrollTimer = null;
let genreListCache = []; // 全局缓存全部分类数据

const ui = {
    zh: {
        trend: "今日趋势",
        popular: "热门电影",
        upcoming: "院线新片",
        topRated: "高分神作",
        tvShows: "📺 热门剧集",
        searchRes: "搜索结果: ",
        rec: "为您推荐",
        watch: "🎬 前往播放源",
        langText: "English",
        placeholder: "搜索电影或电视剧...",
        release: "上映：",
        genreAll: "全部",
        genreTitle: "分类筛选",
        overviewTitle: "剧情简介",
        director: "导演/主创",
        popularity: "热门度",
        castTitle: "演员阵容",
        metaBoxTitle: "影视数据",
        keywordsBoxTitle: "关键词",
        lblStatus: "影视状态",
        lblBudget: "制作预算",
        lblRevenue: "全球票房",
        statusReleased: "已上映/播出",
        statusPlanned: "筹备中",
        statusPost: "后期制作",
        actorInfoTitle: "个人信息",
        actorBioTitle: "生平简介",
        actorKnownTitle: "知名作品",
        lblGender: "性别",
        lblBirthday: "生日",
        lblPlace: "出生地",
        gender1: "女",
        gender2: "男",
        gender0: "未指定",
        noBio: "暂无生平简介。",
        prevPage: "◀ 上一页",
        nextPage: "下一页 ▶",
        topicBlock: "专题观影清单",
        sameDirector: "同导演其他作品",
        sameGenre: "同类型高分推荐"
    },
    en: {
        trend: "🔥 Trending Movies",
        popular: "Popular Movies",
        upcoming: "🍿 Coming Soon",
        topRated: "🏆 Top Rated",
        tvShows: "📺 Popular TV Shows",
        searchRes: "Search Results: ",
        rec: "Recommendations",
        watch: "🎬 Watch Now",
        langText: "中文",
        placeholder: "Search movies or TV shows...",
        release: "Release: ",
        genreAll: "All",
        genreTitle: "Genre Filter",
        overviewTitle: "Overview",
        director: "Creator",
        popularity: "Popularity",
        castTitle: "Series Cast",
        metaBoxTitle: "Facts",
        keywordsBoxTitle: "Keywords",
        lblStatus: "Status",
        lblBudget: "Budget",
        lblRevenue: "Revenue",
        statusReleased: "Released",
        statusPlanned: "Planned",
        statusPost: "Post Production",
        actorInfoTitle: "Personal Info",
        actorBioTitle: "Biography",
        actorKnownTitle: "Known For",
        lblGender: "Gender",
        lblBirthday: "Birthday",
        lblPlace: "Place of Birth",
        gender1: "Female",
        gender2: "Male",
        gender0: "Not specified",
        noBio: "No biography available.",
        prevPage: "◀ Prev",
        nextPage: "Next ▶",
        topicBlock: "Movie Topic Lists",
        sameDirector: "More Films By The Same Director",
        sameGenre: "Top Rated Same Genre"
    }
};

// ===================== 长尾专题库：低竞争精准长尾页面 =====================
const longTailTopics = [
    {
        key: "2026-sci-fi",
        zhTitle: "2026年必看科幻电影大全",
        enTitle: "Best Sci-Fi Movies 2026",
        params: { with_genres: 878, primary_release_year: 2026 },
        longTailZh: "2026科幻片推荐,2026高分科幻电影,今年上映科幻大片合集",
        longTailEn: "2026 sci-fi films, best new sci-fi movies 2026, upcoming sci-fi releases"
    },
    {
        key: "2025-horror",
        zhTitle: "2025高分恐怖电影合集",
        enTitle: "Top Rated Horror Movies 2025",
        params: { with_genres: 27, primary_release_year: 2025 },
        longTailZh: "2025恐怖片推荐,高分惊悚电影,冷门恐怖佳作观看清单",
        longTailEn: "top horror films 2025, underrated scary movies list"
    },
    {
        key: "top250-movie",
        zhTitle: "全球高分电影TOP250观看清单",
        enTitle: "Top 250 Highest Rated Movies Of All Time",
        params: { vote_average_gte: 7.8, sort_by: "vote_average.desc" },
        longTailZh: "高分电影榜单,全球经典影片TOP250,必看高分电影推荐清单",
        longTailEn: "all time top rated movies, must watch classic films list"
    },
    {
        key: "independent-film",
        zhTitle: "小众独立冷门高分电影合集",
        enTitle: "Underrated Independent High Score Movies",
        params: { with_genres: 18, vote_count_gte: 100, vote_average_gte: 7.2 },
        longTailZh: "冷门小众电影,独立高分影片,不为人知优质电影清单",
        longTailEn: "underrated indie films, hidden gem high score movies"
    },
    {
        key: "new-upcoming-2026",
        zhTitle: "2026院线待上映必看电影",
        enTitle: "Must Watch Upcoming Movies 2026",
        params: { primary_release_year: 2026, sort_by: "release_date.asc" },
        longTailZh: "2026即将上映电影,今年院线新片推荐,待上映大片清单",
        longTailEn: "upcoming movies 2026, new theatrical releases list"
    },
    {
        key: "top-animation-tv",
        zhTitle: "高分动画电视剧推荐清单",
        enTitle: "Top Rated Animation TV Series List",
        mediaType: "tv",
        params: { with_genres: 16, sort_by: "vote_average.desc" },
        longTailZh: "高分动画剧集,冷门优质动漫电视剧,必看动画番剧清单",
        longTailEn: "best animation tv shows, hidden gem cartoon series"
    }
];

// 根据专题key生成专题筛选URL参数
function getTopicUrlParams(topicKey) {
    const topic = longTailTopics.find(t => t.key === topicKey);
    if (!topic) return null;
    const urlParams = new URLSearchParams();
    urlParams.set("topic", topicKey);
    urlParams.set("page", 1);
    urlParams.set("lang", currentLang);
    return urlParams.toString();
}

// ===================== 新增：动态设置页面Meta标题&描述核心函数 =====================
function setPageMeta(pageType, data = {}) {
    const t = ui[currentLang];
    const htmlLang = currentLang === "zh" ? "zh-CN" : "en";
    document.documentElement.lang = htmlLang;

    let title = "";
    let desc = "";
    const siteNameZh = "MovieHub TMDB影视资料库";
    const siteNameEn = "MovieHub - TMDB Movie & TV Database";

    switch (pageType) {
        case "home":
            if (currentLang === "zh") {
                title = `${siteNameZh} | 热门电影、高分剧集、院线新片大全`;
                desc = "MovieHub聚合TMDB全球影视数据，浏览热门电影、今日趋势、院线新片、高分电影、热门电视剧，查看评分、演员、票房信息，支持中英文切换。";
            } else {
                title = `${siteNameEn} | Trending Films, Top Rated TV Shows & Upcoming Movies`;
                desc = "Browse full TMDB database of movies and TV series, trending releases, top rated films, cast biography, ratings, budget and box office data.";
            }
            break;
        case "search":
            const q = data.query || "";
            if (currentLang === "zh") {
                title = `${t.searchRes}"${q}" - ${siteNameZh}`;
                desc = `搜索「${q}」相关电影、电视剧、演员，查看完整剧情简介、评分、演员表，TMDB正版影视资料库。`;
            } else {
                title = `${t.searchRes}"${q}" - ${siteNameEn}`;
                desc = `Search movies, TV shows and actors related to "${q}", view plot summary, ratings and cast details on MovieHub.`;
            }
            break;
        case "genre":
            const genreName = data.genreName || t.genreTitle;
            if (currentLang === "zh") {
                title = `${genreName}电影大全 - ${siteNameZh}`;
                desc = `浏览全部${genreName}题材电影，高分、热门、院线影片在线查询，包含评分、上映时间、演员信息。`;
            } else {
                title = `${genreName} Movies - ${siteNameEn}`;
                desc = `Browse all ${genreName} genre films, top rated and trending movies with ratings, release dates and cast info.`;
            }
            break;
        case "topic":
            const topicTitle = currentLang === "zh" ? data.titleZh : data.titleEn;
            const longTail = currentLang === "zh" ? data.longTailZh : data.longTailEn;
            if (currentLang === "zh") {
                title = `${topicTitle} | ${siteNameZh}`;
                desc = `${topicTitle}，完整影片清单、评分、上映信息，长尾关键词：${longTail}`;
            } else {
                title = `${topicTitle} | ${siteNameEn}`;
                desc = `${topicTitle} full list with ratings and release info. Related keywords: ${longTail}`;
            }
            break;
        case "movie":
            const mName = data.title || "";
            const mDate = data.releaseDate || "";
            const mOverview = (data.overview || "").slice(0, 120);
            if (currentLang === "zh") {
                title = `${mName} | 电影剧情、评分、演员、票房 - ${siteNameZh}`;
                desc = `《${mName}》${mDate}上映，${mOverview}查看完整简介、导演、演员阵容、预算票房与推荐影片。`;
            } else {
                title = `${mName} Movie | Plot, Rating, Cast & Box Office - ${siteNameEn}`;
                desc = `${mName} released ${mDate}. ${mOverview} Read full overview, director, cast, budget revenue and similar recommendations.`;
            }
            break;
        case "tv":
            const tvName = data.name || "";
            const tvDate = data.firstAirDate || "";
            const tvOverview = (data.overview || "").slice(0, 120);
            if (currentLang === "zh") {
                title = `${tvName} | 电视剧剧情、评分、演员阵容 - ${siteNameZh}`;
                desc = `《${tvName}》${tvDate}开播，${tvOverview}完整剧集简介、主创演员、高分同类剧集推荐。`;
            } else {
                title = `${tvName} TV Series | Plot, Rating & Full Cast - ${siteNameEn}`;
                desc = `${tvName} first aired ${tvDate}. ${tvOverview} View full series overview, creators, cast and similar tv shows.`;
            }
            break;
        case "actor":
            const aName = data.actorName || "";
            if (currentLang === "zh") {
                title = `${aName} | 演员生平、全部影视作品 - ${siteNameZh}`;
                desc = `演员${aName}完整个人资料，出生日期、出生地、生平简介、所有参演电影电视剧高分作品合集。`;
            } else {
                title = `${aName} | Actor Biography & All Filmography - ${siteNameEn}`;
                desc = `Complete profile of actor ${aName}: birthday, place of birth, biography and all movies & TV series appearances.`;
            }
            break;
    }

    document.title = title;
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
        descMeta = document.createElement('meta');
        descMeta.name = "description";
        document.head.appendChild(descMeta);
    }
    descMeta.setAttribute("content", desc);
}

// 预清空所有首页板块标题，杜绝页面加载瞬间旧文字闪现
function clearAllSectionTitles() {
    document.getElementById('title-popular').innerText = "";
    document.getElementById('title-trending').innerText = "";
    document.getElementById('title-upcoming').innerText = "";
    document.getElementById('title-top-rated').innerText = "";
    document.getElementById('title-tv-shows').innerText = "";
}

// 渲染首页专题标签内链
function renderTopicLinks() {
    const wrap = document.getElementById("topic-list");
    if (!wrap) return;
    wrap.innerHTML = "";
    longTailTopics.forEach(topic => {
        const url = getTopicUrlParams(topic.key);
        const displayName = currentLang === "zh" ? topic.zhTitle : topic.enTitle;
        wrap.innerHTML += `<a href="?${url}" class="topic-tag">${displayName}</a>`;
    })
}

// 2. 📡 路由分发器（异步串行执行，先清标题→加载分类→渲染页面）
async function router() {
    const params = new URLSearchParams(window.location.search);
    const movieId = params.get('id');
    const tvId = params.get('tv_id');
    const actorId = params.get('actor');
    const searchQuery = params.get('search');
    const genreId = params.get('genre');
    const topicKey = params.get("topic"); // 新增专题参数

    currentPage = parseInt(params.get('page')) || 1;
    currentLang = params.get('lang') === 'zh' ? 'zh' : 'en';

    // 【第一步：立刻清空所有板块标题，从根源消除旧文字闪现】
    clearAllSectionTitles();

    document.getElementById('lang-btn').innerText = ui[currentLang].langText;
    document.getElementById('search-input').placeholder = ui[currentLang].placeholder;
    // 专题区块标题多语言
    const topicBlockTitleDom = document.getElementById("topic-block-title");
    if (topicBlockTitleDom) topicBlockTitleDom.innerText = ui[currentLang].topicBlock;

    if (document.getElementById('prev-btn')) document.getElementById('prev-btn').innerText = ui[currentLang].prevPage;
    if (document.getElementById('next-btn')) document.getElementById('next-btn').innerText = ui[currentLang].nextPage;

    document.getElementById('home-view').style.display = 'none';
    document.getElementById('detail-view').style.display = 'none';
    document.getElementById('actor-view').style.display = 'none';
    document.getElementById('pagination-box').style.display = 'none';

    if (actorId) {
        document.getElementById('actor-view').style.display = 'block';
        await loadActorPage(actorId);
    } else if (movieId) {
        document.getElementById('detail-view').style.display = 'block';
        await loadDetailPage(movieId, 'movie');
    } else if (tvId) {
        document.getElementById('detail-view').style.display = 'block';
        await loadDetailPage(tvId, 'tv');
    } else {
        document.getElementById('home-view').style.display = 'block';
        // 先加载分类缓存 + 渲染专题链接
        await loadGenresBar(genreId);
        renderTopicLinks();
        // 传入专题key渲染首页内容
        await loadHomePage(searchQuery, genreId, topicKey);
    }
}

// 3. 🗂️ 加载流派分类栏（缓存全部分类）
async function loadGenresBar(activeGenreId) {
    const t = ui[currentLang];
    const tmdbLang = currentLang === 'zh' ? 'zh-CN' : 'en-US';
    const res = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=${tmdbLang}`);
    const data = await res.json();
    genreListCache = data.genres;

    const bar = document.getElementById('genres-list');
    bar.innerHTML = `<div class="genre-item ${!activeGenreId ? 'active' : ''}" onclick="switchGenre('')">${t.genreAll}</div>`;

    data.genres.forEach(g => {
        const isActive = activeGenreId == g.id ? 'active' : '';
        bar.innerHTML += `<div class="genre-item ${isActive}" onclick="switchGenre('${g.id}')">${g.name}</div>`;
    });

    setTimeout(startGenresAutoScroll, 600);
}

// 根据分类ID获取对应分类名称
function getGenreNameById(gid) {
    if (!gid) return ui[currentLang].genreTitle;
    const target = genreListCache.find(item => item.id == gid);
    return target ? target.name : ui[currentLang].genreTitle;
}

function startGenresAutoScroll() {
    const genresList = document.getElementById('genres-list');
    if (!genresList) return;
    if (typeof scrollTimer !== 'undefined') clearInterval(scrollTimer);

    let step = 1.0;
    let direction = 1; // 1: 右, -1: 左

    scrollTimer = setInterval(() => {
        const maxScrollLeft = genresList.scrollWidth - genresList.clientWidth;

        if (maxScrollLeft <= 0) return;

        if (direction === 1 && (genresList.scrollLeft + 3 >= maxScrollLeft)) {
            genresList.scrollLeft = maxScrollLeft;
            direction = -1;
        } else if (direction === -1 && genresList.scrollLeft <= 3) {
            genresList.scrollLeft = 0;
            direction = 1;
        } else {
            genresList.scrollLeft += step * direction;
        }
    }, 30);

    genresList.onmouseenter = () => clearInterval(scrollTimer);
    genresList.onmouseleave = () => startGenresAutoScroll();
}

// 4. 🏠 首页内容渲染（支持专题页、搜索、分类、默认首页）
async function loadHomePage(query, genreId, topicKey = null) {
    const t = ui[currentLang];
    const tmdbLang = currentLang === 'zh' ? 'zh-CN' : 'en-US';

    const secPopular = document.getElementById('grid-popular').parentElement;
    const secTrending = document.getElementById('grid-trending').parentElement;
    const secUpcoming = document.getElementById('grid-upcoming').parentElement;
    const secTopRated = document.getElementById('grid-top-rated').parentElement;
    const secTvShows = document.getElementById('grid-tv-shows').parentElement;
    secPopular.style.display = 'none';
    secUpcoming.style.display = 'none';
    secTopRated.style.display = 'none';
    secTvShows.style.display = 'none';
    secTrending.style.display = 'none';

    // 分支1：长尾专题页 最高优先级
    if (topicKey) {
        document.getElementById('pagination-box').style.display = 'flex';
        const topic = longTailTopics.find(item => item.key === topicKey);
        if (!topic) return;
        const isTv = topic.mediaType === "tv";
        const pageTitleText = currentLang === "zh" ? topic.zhTitle : topic.enTitle;
        document.getElementById('title-trending').innerText = pageTitleText;

        let discoverUrl = `https://api.themoviedb.org/3/discover/${isTv ? "tv" : "movie"}?api_key=${TMDB_API_KEY}&language=${tmdbLang}&page=${currentPage}`;
        Object.keys(topic.params).forEach(key => {
            discoverUrl += `&${key}=${topic.params[key]}`;
        })
        await renderGrid(discoverUrl, 'grid-trending', false, isTv ? "tv" : "movie");
        secTrending.style.display = 'block';
        document.getElementById('page-num').innerText = currentPage;
        document.getElementById('prev-btn').disabled = currentPage <= 1;

        setPageMeta("topic", {
            titleZh: topic.zhTitle,
            titleEn: topic.enTitle,
            longTailZh: topic.longTailZh,
            longTailEn: topic.longTailEn
        });
        return;
    }

    // 分支2：搜索 / 普通分类页
    if (query || genreId) {
        document.getElementById('pagination-box').style.display = 'flex';
        let url = "";
        if (query) {
            document.getElementById('title-trending').innerText = `${t.searchRes} "${query}"`;
            url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=${tmdbLang}&query=${encodeURIComponent(query)}&page=${currentPage}`;
            setPageMeta("search", { query: query });
        } else {
            const showName = getGenreNameById(genreId);
            document.getElementById('title-trending').innerText = showName;
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=${tmdbLang}&with_genres=${genreId}&page=${currentPage}`;
            setPageMeta("genre", { genreName: showName });
        }
        document.getElementById('page-num').innerText = currentPage;
        document.getElementById('prev-btn').disabled = currentPage <= 1;

        await renderGrid(url, 'grid-trending', true);
        secTrending.style.display = 'block';
    }
    // 分支3：默认首页
    else {
        secPopular.style.display = 'block';
        secUpcoming.style.display = 'block';
        secTopRated.style.display = 'block';
        secTvShows.style.display = 'block';
        secTrending.style.display = 'block';

        document.getElementById('title-popular').innerText = t.popular;
        document.getElementById('title-trending').innerText = t.trend;
        document.getElementById('title-upcoming').innerText = t.upcoming;
        document.getElementById('title-top-rated').innerText = t.topRated;
        document.getElementById('title-tv-shows').innerText = t.tvShows;

        setPageMeta("home");

        renderGrid(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=${tmdbLang}`, 'grid-popular');
        renderGrid(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}&language=${tmdbLang}`, 'grid-trending');
        renderGrid(`https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_API_KEY}&language=${tmdbLang}&region=US`, 'grid-upcoming');
        renderGrid(`https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=${tmdbLang}`, 'grid-top-rated');
        renderGrid(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=${tmdbLang}`, 'grid-tv-shows', false, 'tv');
    }
}

// 5. 详情页加载（新增同导演、同分类双层内链）
async function loadDetailPage(id, type = 'movie') {
    const t = ui[currentLang];
    const tmdbLang = currentLang === 'zh' ? 'zh-CN' : 'en-US';

    const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${tmdbLang}&append_to_response=credits,keywords`);
    const data = await res.json();

    const titleName = data.title || data.name;
    const releaseDate = data.release_date || data.first_air_date;

    // 影视详情页专属Meta
    if (type === "movie") {
        setPageMeta("movie", {
            title: titleName,
            releaseDate: releaseDate,
            overview: data.overview
        });
    } else {
        setPageMeta("tv", {
            name: titleName,
            firstAirDate: releaseDate,
            overview: data.overview
        });
    }

    document.getElementById('detail-backdrop').style.backgroundImage = `url(https://image.tmdb.org/t/p/original${data.backdrop_path})`;
    document.getElementById('detail-img').src = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster';
    document.getElementById('detail-title').innerText = titleName;
    document.getElementById('detail-tagline').innerText = data.tagline || "";
    document.getElementById('detail-date').innerText = `${t.release}${releaseDate || 'N/A'}`;
    document.getElementById('detail-score').innerText = `⭐ ${data.vote_average ? data.vote_average.toFixed(1) : '0.0'}`;
    document.getElementById('detail-popularity').innerText = `🔥 ${t.popularity}: ${data.popularity ? data.popularity.toFixed(0) : '0'}`;

    let directorText = "";
    if (type === 'movie' && data.credits && data.credits.crew) {
        const dir = data.credits.crew.find(person => person.job === 'Director');
        if (dir) directorText = `${t.director}: ${dir.name}`;
    } else if (type === 'tv' && data.created_by && data.created_by.length > 0) {
        directorText = `${t.director}: ${data.created_by.map(c => c.name).join(', ')}`;
    }
    document.getElementById('detail-director-top').innerText = directorText;

    document.getElementById('detail-overview-title').innerText = t.overviewTitle;
    document.getElementById('detail-overview').innerText = data.overview || (currentLang === 'zh' ? "暂无简介。" : "No description available.");
    document.getElementById('watch-btn').href = `https://www.themoviedb.org/${type}/${data.id}`;
    document.getElementById('watch-btn').innerText = t.watch;

    const genresTags = document.getElementById('detail-genres');
    genresTags.innerHTML = "";
    if (data.genres) data.genres.forEach(g => { genresTags.innerHTML += `<span>${g.name}</span>`; });

    document.getElementById('cast-title').innerText = t.castTitle;
    const castBox = document.getElementById('detail-cast');
    castBox.innerHTML = "";
    const topCast = (data.credits && data.credits.cast) ? data.credits.cast.slice(0, 15) : [];

    if (topCast.length === 0) {
        castBox.innerHTML = `<p style="color:#666;">${currentLang === 'zh' ? '暂无演员数据' : 'No cast data'}</p>`;
    } else {
        let castHtml = "";
        topCast.forEach(actor => {
            const avatar = actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : 'https://via.placeholder.com/185x278?text=?';
            castHtml += `
                <a href="?lang=${currentLang}&actor=${actor.id}" class="cast-card">
                    <img class="cast-img" src="${avatar}" alt="${actor.name}">
                    <div class="cast-info">
                        <p class="cast-name" title="${actor.name}">${actor.name}</p>
                        <p class="cast-character" title="${actor.character || actor.roles?.[0]?.character}">${actor.character || actor.roles?.[0]?.character || ''}</p>
                    </div>
                </a>
            `;
        });
        castBox.innerHTML = castHtml;
    }

    document.getElementById('meta-box-title').innerText = t.metaBoxTitle;
    document.getElementById('meta-lbl-status').innerText = t.lblStatus;
    document.getElementById('meta-lbl-budget').innerText = t.lblBudget;
    document.getElementById('meta-lbl-revenue').innerText = t.lblRevenue;

    let statusText = data.status || "-";
    if (data.status === 'Released' || data.status === 'Returning Series') statusText = t.statusReleased;
    document.getElementById('meta-status').innerText = statusText;

    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    document.getElementById('meta-budget').innerText = data.budget > 0 ? formatter.format(data.budget) : "-";
    document.getElementById('meta-revenue').innerText = data.revenue > 0 ? formatter.format(data.revenue) : "-";

    document.getElementById('keywords-box-title').innerText = t.keywordsBoxTitle;
    const kwBox = document.getElementById('detail-keywords');
    kwBox.innerHTML = "";
    const kws = data.keywords ? (data.keywords.keywords || data.keywords.results || []) : [];
    if (kws.length === 0) {
        kwBox.innerHTML = `<p style="color:#666;">-</p>`;
    } else {
        kws.slice(0, 10).forEach(keyword => { kwBox.innerHTML += `<span>${keyword.name}</span>`; });
    }

    // ========== 新增1：同导演作品区块 ==========
    document.getElementById('same-director-title').innerText = t.sameDirector;
    const directorBox = document.getElementById("same-director-grid");
    directorBox.innerHTML = "";
    if (type === "movie") {
        const dirInfo = data.credits?.crew?.find(p => p.job === "Director");
        if (dirInfo) {
            const directorUrl = `https://api.themoviedb.org/3/person/${dirInfo.id}/movie_credits?api_key=${TMDB_API_KEY}&language=${tmdbLang}`;
            await renderGrid(directorUrl, "same-director-grid", false, "movie");
        } else {
            directorBox.innerHTML = `<p style="color:#666">${currentLang === "zh" ? "暂无同导演影片" : "No other films by director"}</p>`;
        }
    } else {
        directorBox.innerHTML = `<p style="color:#666">${currentLang === "zh" ? "剧集无导演合集" : "No director collection for TV"}</p>`;
    }

    // ========== 新增2：同类型高分影片区块 ==========
    document.getElementById('same-genre-title').innerText = t.sameGenre;
    const genreBox = document.getElementById("same-genre-grid");
    genreBox.innerHTML = "";
    if (data.genres && data.genres.length > 0) {
        const firstGenreId = data.genres[0].id;
        const sameGenreUrl = `https://api.themoviedb.org/3/discover/${type}?api_key=${TMDB_API_KEY}&language=${tmdbLang}&with_genres=${firstGenreId}&sort_by=vote_average.desc`;
        await renderGrid(sameGenreUrl, "same-genre-grid", false, type);
    } else {
        genreBox.innerHTML = `<p style="color:#666">${currentLang === "zh" ? "暂无同类影片" : "No same genre content"}</p>`;
    }

    // 原有相似推荐
    document.getElementById('rec-title').innerText = t.rec;
    const recUrl = `https://api.themoviedb.org/3/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=${tmdbLang}`;
    await renderGrid(recUrl, 'recommendations-grid', false, type);
}

// 6. 演员页面
async function loadActorPage(actorId) {
    const t = ui[currentLang];
    const tmdbLang = currentLang === 'zh' ? 'zh-CN' : 'en-US';

    const actorRes = await fetch(`https://api.themoviedb.org/3/person/${actorId}?api_key=${TMDB_API_KEY}&language=${tmdbLang}`);
    const actor = await actorRes.json();

    // 演员页Meta
    setPageMeta("actor", { actorName: actor.name });

    document.getElementById('actor-name').innerText = actor.name;
    document.getElementById('actor-big-img').src = actor.profile_path ? `https://image.tmdb.org/t/p/w500${actor.profile_path}` : 'https://via.placeholder.com/500x750?text=?';
    document.getElementById('actor-biography').innerText = actor.biography || t.noBio;

    document.getElementById('actor-info-title').innerText = t.actorInfoTitle;
    document.getElementById('actor-bio-title').innerText = t.actorBioTitle;
    document.getElementById('actor-known-title').innerText = t.actorKnownTitle;
    document.getElementById('lbl-actor-gender').innerText = t.lblGender;
    document.getElementById('lbl-actor-birthday').innerText = t.lblBirthday;
    document.getElementById('lbl-actor-place').innerText = t.lblPlace;

    let genderText = t.gender0;
    if (actor.gender === 1) genderText = t.gender1;
    if (actor.gender === 2) genderText = t.gender2;
    document.getElementById('actor-gender').innerText = genderText;
    document.getElementById('actor-birthday').innerText = actor.birthday || "-";
    document.getElementById('actor-place').innerText = actor.place_of_birth || "-";

    const creditsUrl = `https://api.themoviedb.org/3/person/${actorId}/combined_credits?api_key=${TMDB_API_KEY}&language=${tmdbLang}`;
    const creditsRes = await fetch(creditsUrl);
    const creditsData = await creditsRes.json();

    let sortedMovies = [];
    if (creditsData.cast) {
        sortedMovies = creditsData.cast
            .filter(m => m.poster_path !== null)
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 18);
    }

    const grid = document.getElementById('actor-movies-grid');
    grid.innerHTML = "";
    if (sortedMovies.length === 0) {
        grid.innerHTML = `<p style='color:#666;'>${currentLang === 'zh' ? '暂无代表作品' : 'No known works'}</p>`;
        return;
    }

    let moviesHtml = "";
    sortedMovies.forEach(item => {
        const isTv = item.media_type === 'tv';
        const itemTitle = item.title || item.name;
        const itemDate = item.release_date || item.first_air_date;
        const routeKey = isTv ? 'tv_id' : 'id';

        moviesHtml += `
            <a href="?lang=${currentLang}&${routeKey}=${item.id}" class="movie-card">
                <img class="movie-img" src="https://image.tmdb.org/t/p/w342${item.poster_path}" alt="${itemTitle}">
                <div class="movie-info">
                    <h3 class="movie-title" title="${itemTitle}">${itemTitle}</h3>
                    <div class="movie-meta">
                        <span>${itemDate ? itemDate.split('-')[0] : 'N/A'}</span>
                        <span class="score">⭐ ${item.vote_average ? item.vote_average.toFixed(1) : '0.0'}</span>
                    </div>
                </div>
            </a>
        `;
    });
    grid.innerHTML = moviesHtml;
}

// 7. 卡片渲染（最多18张，3行6列）
async function renderGrid(apiUrl, targetElementId, isMultiSearch = false, defaultType = 'movie') {
    const grid = document.getElementById(targetElementId);
    if (!grid) return;
    grid.innerHTML = "...";
    try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        grid.innerHTML = "";

        const rawItems = data.results || data.cast || [];
        const items = rawItems.filter(item => item.poster_path).slice(0, 18);
        if (items.length === 0) {
            grid.innerHTML = `<p style='color:#666; padding: 20px;'>${currentLang === 'zh' ? '没有找到相关内容。' : 'No results found.'}</p>`;
            return;
        }

        let gridHtml = "";
        items.forEach(item => {
            let actualType = defaultType;
            if (isMultiSearch && item.media_type) {
                if (item.media_type === 'person') return;
                actualType = item.media_type;
            }

            const routeParam = actualType === 'tv' ? `tv_id=${item.id}` : `id=${item.id}`;
            const displayTitle = item.title || item.name;
            const displayDate = item.release_date || item.first_air_date;

            gridHtml += `
                <a href="?lang=${currentLang}&${routeParam}" class="movie-card">
                    <img class="movie-img" src="https://image.tmdb.org/t/p/w342${item.poster_path}" alt="${displayTitle}">
                    <div class="movie-info">
                        <h3 class="movie-title" title="${displayTitle}">${displayTitle}</h3>
                        <div class="movie-meta">
                            <span>${displayDate ? displayDate.split('-')[0] : 'N/A'}</span>
                            <span class="score">⭐ ${item.vote_average ? item.vote_average.toFixed(1) : '0.0'}</span>
                        </div>
                    </div>
                </a>
            `;
        });
        grid.innerHTML = gridHtml;
    } catch (e) {
        grid.innerHTML = `<p style='color:red;'>${currentLang === 'zh' ? '数据加载失败。' : 'Failed to load data.'}</p>`;
    }
}

// 分页、搜索、切换分类、切换语言
function changePage(direction) {
    const urlParams = new URLSearchParams(window.location.search);
    let nextPage = currentPage + direction;
    if (nextPage < 1) nextPage = 1;
    urlParams.set('page', nextPage);
    window.location.search = urlParams.toString();
}

function handleSearch() {
    const val = document.getElementById('search-input').value.trim();
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.delete('id');
    urlParams.delete('tv_id');
    urlParams.delete('actor');
    urlParams.delete('genre');
    urlParams.delete('topic');
    urlParams.set('page', 1);
    if (val) urlParams.set('search', val);
    else urlParams.delete('search');
    window.location.search = urlParams.toString();
}

function switchGenre(genreId) {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.delete('id');
    urlParams.delete('tv_id');
    urlParams.delete('actor');
    urlParams.delete('search');
    urlParams.delete('topic');
    urlParams.set('page', 1);
    if (genreId) urlParams.set('genre', genreId);
    else urlParams.delete('genre');
    window.location.search = urlParams.toString();
}

function toggleLanguage() {
    const urlParams = new URLSearchParams(window.location.search);
    const nextLang = currentLang === 'zh' ? 'en' : 'zh';
    urlParams.set('lang', nextLang);
    window.location.search = urlParams.toString();
}

document.getElementById('search-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

// 页面初始化
router();
