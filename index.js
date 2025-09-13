// index.js
document.addEventListener("DOMContentLoaded", async () => {
    /* ===== Anti layout-shift por scroll bar ===== */
    const headerEl = document.querySelector(".site-header");
    let scrollLocks = 0;
    let SBW = 0; // ScrollBar Width (px)

    function calcSBW() {
        SBW = window.innerWidth - document.documentElement.clientWidth;
        if (SBW < 0) SBW = 0;
    }
    calcSBW();
    window.addEventListener("resize", calcSBW);

    function lockScroll() {
        if (scrollLocks++ === 0) {
            document.body.classList.add("no-scroll");
            if (SBW > 0) {
                document.body.style.paddingRight = SBW + "px";
                if (headerEl) headerEl.style.paddingRight = SBW + "px";
            }
        }
    }
    function unlockScroll() {
        if (--scrollLocks <= 0) {
            scrollLocks = 0;
            document.body.classList.remove("no-scroll");
            document.body.style.paddingRight = "";
            if (headerEl) headerEl.style.paddingRight = "";
        }
    }

    /* ===== NAV: mostrar/ocultar secciones ===== */
    const sections = {
        "section-home": document.getElementById("section-home"),
        "section-animation": document.getElementById("section-animation"),
        "section-vfx": document.getElementById("section-vfx"),
        "section-about": document.getElementById("section-about"),
    };

    function setActive(targetId) {
        document.querySelectorAll(".nav-link").forEach((a) => {
            const isActive = a.dataset.target === targetId;
            a.classList.toggle("is-active", isActive);
            if (isActive) a.setAttribute("aria-current", "page");
            else a.removeAttribute("aria-current");
        });
        Object.entries(sections).forEach(([id, el]) => {
            const show = id === targetId;
            el.classList.toggle("is-hidden", !show);
            el.setAttribute("aria-hidden", show ? "false" : "true");
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.querySelectorAll(".nav-link").forEach((a) => {
        a.addEventListener("click", (e) => {
            if (a.closest(".mobile-drawer")) closeMobileMenu();
            e.preventDefault();
            const t = a.dataset.target;
            if (t) setActive(t);
        });
    });

    const brand = document.getElementById("brandLink");
    if (brand) {
        brand.addEventListener("click", (e) => {
            e.preventDefault();
            setActive("section-home");
        });
    }

    /* ===== Utils: YouTube + Vimeo detection ===== */
    function getYouTubeId(input) {
        if (!input) return null;
        if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input;
        try {
            const url = new URL(input);
            if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
            if (url.searchParams.get("v")) return url.searchParams.get("v");
            const parts = url.pathname.split("/");
            const i = parts.indexOf("embed");
            if (i !== -1 && parts[i + 1]) return parts[i + 1];
        } catch { }
        return null;
    }

    function getVimeoId(input) {
        if (!input) return null;
        try {
            const url = new URL(input);
            if (url.hostname.includes("vimeo.com")) {
                const parts = url.pathname.split("/").filter(Boolean);
                // player.vimeo.com/video/{id}  OR  vimeo.com/{id}
                const idx = parts.indexOf("video");
                if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
                if (parts.length >= 1 && /^\d+$/.test(parts[0])) return parts[0];
            }
        } catch { }
        return null;
    }

    function makeInfo(label, value) {
        const v = (value ?? "").toString();
        if (v.trim() === "") return ""; // si viene vacío, no pintamos la fila
        const isChange = v.trim().toUpperCase() === "CHANGE";
        return `<li class="${isChange ? 'is-missing' : ''}"><strong>${label}:</strong> ${v}</li>`;
    }

    function makeCard(p) {
        const ytId =
            getYouTubeId(p.youtube_id) ||
            getYouTubeId(p.youtube_url) ||
            getYouTubeId(p.youtube);

        const vimeoId =
            getVimeoId(p.vimeo_id) ||
            getVimeoId(p.vimeo_url) ||
            getVimeoId(p.vimeo) ||
            getVimeoId(p.video_url);

        const videoUrl = vimeoId
            ? `https://vimeo.com/${vimeoId}`
            : ytId
                ? `https://www.youtube.com/watch?v=${ytId}`
                : (p.video_url || "");

        // Thumbnail preferencia:
        // 1) YouTube → miniatura oficial
        // 2) p.thumb → imagen custom
        // 3) Tiene videoUrl pero sin thumb → botón con play
        // 4) No hay video → placeholder visible "NO VIDEO"
        let thumbHtml = "";
        if (ytId) {
            thumbHtml = `
        <button class="thumb" type="button" data-video="${videoUrl}">
          <img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" alt="${p.title || "Project"} thumbnail" loading="lazy">
          <div class="play-btn"></div>
        </button>`;
        } else if (p.thumb) {
            thumbHtml = `
        <button class="thumb" type="button" data-video="${videoUrl}">
          <img src="${p.thumb}" alt="${p.title || "Project"} thumbnail" loading="lazy">
          <div class="play-btn"></div>
        </button>`;
        } else if (videoUrl) {
            thumbHtml = `
        <button class="thumb" type="button" data-video="${videoUrl}">
          <div class="play-btn"></div>
        </button>`;
        } else {
            // Sin vídeo → hueco visible
            thumbHtml = `
        <div class="thumb is-missing" aria-disabled="true" title="No video provided">
          <span class="missing-label">NO VIDEO</span>
        </div>`;
        }

        return `
      <article class="card">
        <header class="card-header">
          <h2 class="card-title">${p.title ?? ""}</h2>
        </header>
        ${thumbHtml}
        <ul class="info-list">
          ${makeInfo("Studio", p.studio)}
          ${makeInfo("Year", p.year)}
          ${makeInfo("Directed by", p.directed_by)}
          ${makeInfo("Comp Supervisor", p.comp_supervisor)}
          ${makeInfo("Comp Lead", p.comp_lead)}
          ${makeInfo("My role", p.role)}
          ${makeInfo("Software", p.software)}
        </ul>
      </article>`;
    }

    /* ===== CARGA Y RENDER (Animation / VFX) ===== */
    const gridAnim = document.getElementById("gridAnimation");
    const gridVfx = document.getElementById("gridVfx");

    async function loadProjects() {
        try {
            const res = await fetch("data.json", { cache: "no-store" });
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();

            if (gridAnim) gridAnim.innerHTML = "";
            if (gridVfx) gridVfx.innerHTML = "";

            data.forEach((proj) => {
                const card = makeCard(proj);
                const type = (proj.type || "").toLowerCase();
                if (type === "animation") {
                    if (gridAnim) gridAnim.insertAdjacentHTML("beforeend", card);
                } else {
                    if (gridVfx) gridVfx.insertAdjacentHTML("beforeend", card);
                }
            });

            // Clic SOLO en thumbs con data-video (los placeholders no tienen)
            document.querySelectorAll(".thumb[data-video]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const url = btn.getAttribute("data-video");
                    if (url) openModalFromUrl(url);
                });
            });
        } catch (e) {
            console.error("Error cargando data.json:", e);
            if (gridAnim) gridAnim.innerHTML = "<p>No se pudieron cargar los proyectos.</p>";
            if (gridVfx) gridVfx.innerHTML = "<p>No se pudieron cargar los proyectos.</p>";
        }
    }

    await loadProjects();

    /* ===== MODAL Video (Home + Cards) ===== */
    const modal = document.getElementById("videoModal");
    const media = document.getElementById("modalMedia");
    const closeBtn = modal ? modal.querySelector(".modal-close") : null;

    function openModalFromUrl(urlOrId) {
        if (!modal || !media) return;

        const vimeoId = getVimeoId(urlOrId);
        const ytId = getYouTubeId(urlOrId);
        let nodeHtml = "";

        // MP4/WEBM/OGG locales o CDN
        if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(urlOrId)) {
            nodeHtml = `<video src="${urlOrId}" controls autoplay playsinline></video>`;
        }
        // Vimeo embebido
        else if (vimeoId) {
            const embed = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=0&controls=1&title=0&byline=0&portrait=0&dnt=1&transparent=0`;
            nodeHtml = `<iframe src="${embed}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
        }
        // YouTube
        else if (ytId) {
            const embed = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`;
            nodeHtml = `<iframe src="${embed}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        }
        // Fallback
        else {
            nodeHtml = `<iframe src="${urlOrId}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
        }

        media.innerHTML = nodeHtml;
        modal.classList.add("open");
        lockScroll();
        modal.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
        if (!modal || !media) return;
        modal.classList.remove("open");
        unlockScroll();
        modal.setAttribute("aria-hidden", "true");
        media.innerHTML = ""; // parar reproducción
    }

    // Abrir desde los dos hero-cards (con URLs de Vimeo)
    document.querySelectorAll(".hero-card").forEach((btn) => {
        btn.addEventListener("click", () => {
            const url = btn.getAttribute("data-video");
            if (url) openModalFromUrl(url);
        });
    });

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target instanceof Element && e.target.hasAttribute("data-close")) closeModal();
        });
    }

    /* ===== Drawer móvil (hamburguesa) ===== */
    const burgerBtn = document.getElementById("burgerBtn");
    const mobileMenu = document.getElementById("mobileMenu");
    const drawerClose = mobileMenu ? mobileMenu.querySelector(".drawer-close") : null;
    const mobileBackdrop = document.getElementById("mobileBackdrop");

    function isMobileMenuOpen() { return mobileMenu && mobileMenu.classList.contains("open"); }

    function openMobileMenu() {
        if (!mobileMenu || !mobileBackdrop || !burgerBtn) return;
        mobileMenu.classList.add("open");
        mobileBackdrop.classList.add("open");
        burgerBtn.setAttribute("aria-expanded", "true");
        mobileMenu.setAttribute("aria-hidden", "false");
        lockScroll();
    }

    function closeMobileMenu() {
        if (!mobileMenu || !mobileBackdrop || !burgerBtn) return;
        mobileMenu.classList.remove("open");
        mobileBackdrop.classList.remove("open");
        burgerBtn.setAttribute("aria-expanded", "false");
        mobileMenu.setAttribute("aria-hidden", "true");
        unlockScroll();
    }

    if (burgerBtn) burgerBtn.addEventListener("click", openMobileMenu);
    if (drawerClose) drawerClose.addEventListener("click", closeMobileMenu);
    if (mobileBackdrop) mobileBackdrop.addEventListener("click", closeMobileMenu);

    // Cerrar al pasar a desktop
    window.addEventListener("resize", () => {
        if (window.innerWidth >= 860 && isMobileMenuOpen()) closeMobileMenu();
    });

    // ESC para cerrar modal o drawer
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (modal && modal.classList.contains("open")) closeModal();
            if (isMobileMenuOpen()) closeMobileMenu();
        }
    });

    // Estado inicial
    setActive("section-home");
});
