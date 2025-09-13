// index.js
document.addEventListener("DOMContentLoaded", async () => {
    /* ===== Anti layout-shift por scroll bar ===== */
    const headerEl = document.querySelector(".site-header");
    let scrollLocks = 0;
    let SBW = 0; // ScrollBar Width (px)
    let sectionAnimToken = 0;

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

    /* ===== NAV: mostrar/ocultar secciones (con fade out → in) ===== */
    const sections = {
        "section-home": document.getElementById("section-home"),
        "section-animation": document.getElementById("section-animation"),
        "section-vfx": document.getElementById("section-vfx"),
        "section-about": document.getElementById("section-about"),
        "section-cv": document.getElementById("section-cv"),
    };

    function setActive(targetId) {
        const FADE_MS = 100; // 0.25s aprox (ajustado para sensaciones fluidas)
        const token = ++sectionAnimToken;

        const targetEl = sections[targetId];
        if (!targetEl) return;

        // Estado de navegación (active)
        document.querySelectorAll(".nav-link").forEach((a) => {
            const isActive = a.dataset.target === targetId;
            a.classList.toggle("is-active", isActive);
            if (isActive) a.setAttribute("aria-current", "page");
            else a.removeAttribute("aria-current");
        });

        const allSections = Object.values(sections).filter(Boolean);
        const currentEl = allSections.find(el => !el.classList.contains("is-hidden"));

        if (currentEl === targetEl) return;

        const showTarget = () => {
            if (token !== sectionAnimToken) return; // Abort si hubo cambio rápido
            targetEl.classList.remove("is-hidden");
            targetEl.classList.add("is-showing");
            targetEl.setAttribute("aria-hidden", "false");

            // Inicializa los botones del CV (solo una vez cuando se entra)
            if (targetId === "section-cv") initCvButtonsOnce();

            // Forzar reflow y hacer fade-in
            requestAnimationFrame(() => {
                if (token !== sectionAnimToken) return;
                void targetEl.offsetHeight;
                targetEl.classList.remove("is-showing");
            });
        };

        if (currentEl) {
            currentEl.classList.add("is-hiding");
            currentEl.setAttribute("aria-hidden", "true");

            setTimeout(() => {
                if (token !== sectionAnimToken) return;
                currentEl.classList.add("is-hidden");
                currentEl.classList.remove("is-hiding");
                showTarget();
            }, FADE_MS);
        } else {
            showTarget();
        }

        // Subir arriba sin animación de scroll para no pelear con el fade
        window.scrollTo({ top: 0, behavior: "auto" });
    }

    // Clicks en navegación
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
        if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input; // id directo
        try {
            const url = new URL(input);
            if (/youtu\.be$/i.test(url.hostname)) return url.pathname.slice(1);
            if (url.searchParams.get("v")) return url.searchParams.get("v");
            const parts = url.pathname.split("/").filter(Boolean);
            const i = parts.indexOf("embed");
            if (i !== -1 && parts[i + 1]) return parts[i + 1];
        } catch { }
        return null;
    }

    // Detección robusta de ID de Vimeo (player, video, channels, albums…)
    function getVimeoId(input) {
        if (!input) return null;
        // Si ya parece un ID (solo dígitos suficiente largo)
        if (/^\d{6,}$/.test(String(input))) return String(input);
        try {
            const url = new URL(input);
            if (!/vimeo\.com/i.test(url.hostname)) return null;
            const path = url.pathname.replace(/\/+/g, "/");
            // player.vimeo.com/video/ID
            let m = path.match(/\/video\/(\d+)/);
            if (m) return m[1];
            // vimeo.com/channels/xxx/ID  | vimeo.com/album/ALBUMID/video/ID
            m = path.match(/\/(?:channels\/[^/]+|album\/\d+\/video)\/(\d+)/);
            if (m) return m[1];
            // vimeo.com/ID al final
            m = path.match(/\/(\d+)(?:$|[/?#])/);
            if (m) return m[1];
        } catch { }
        return null;
    }

    function makeInfo(label, value) {
        const v = (value ?? "").toString();
        if (v.trim() === "") return ""; // no pintar si viene vacío
        const isChange = v.trim().toUpperCase() === "CHANGE";
        return `<li class="${isChange ? "is-missing" : ""}"><strong>${label}:</strong> ${v}</li>`;
    }

    /* ===============================
       Thumbnails: YouTube + Vimeo
       =============================== */

    // Intenta mejorar la calidad de la miniatura de Vimeo cuando es posible
    function upgradeVimeoThumb(u) {
        if (!u) return u;
        let url = u.replace(/^http:\/\//i, "https://");
        // En i.vimeocdn.com suele haber sufijos con tamaño. Forzamos _640 si existe un sufijo numérico.
        // Ej: ..._295x166.jpg  -> ..._640.jpg  |  ..._200.jpg -> ..._640.jpg
        url = url.replace(/_(\d+x\d+|\d+)(?=\.(jpg|png)$)/i, "_640");
        return url;
    }

    async function fetchVimeoThumb(vimeoUrlOrId) {
        // Acepta ID o URL
        let url = (vimeoUrlOrId || "").toString();
        if (!/vimeo\.com/i.test(url)) url = `https://vimeo.com/${url}`;
        const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
        const noembed = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;

        // 1) Vimeo oEmbed oficial
        try {
            const res = await fetch(oembed, { cache: "no-store" });
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            if (data && data.thumbnail_url) return upgradeVimeoThumb(data.thumbnail_url);
        } catch (e) {
            // sigue al fallback
        }

        // 2) Fallback: noembed (suele devolver thumbnail_url también)
        try {
            const res = await fetch(noembed, { cache: "no-store" });
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            if (data && data.thumbnail_url) return upgradeVimeoThumb(data.thumbnail_url);
        } catch (e) {
            console.warn("No se pudo obtener thumbnail de Vimeo vía oEmbed ni noembed:", e);
        }

        return null;
    }

    function injectThumbIntoButton(btn, thumbUrl, alt) {
        if (!btn || !thumbUrl) return;
        btn.innerHTML = `
        <img src="${thumbUrl}" alt="${alt || "Project thumbnail"}" loading="lazy">
        <div class="play-btn"></div>
    `;
    }

    async function loadVimeoThumbsAfterRender() {
        const vimeoBtns = document.querySelectorAll('.thumb[data-vimeo]:not(.has-thumb)');
        await Promise.all(Array.from(vimeoBtns).map(async (btn) => {
            const src = btn.getAttribute('data-vimeo');
            const title = btn.closest('.card')?.querySelector('.card-title')?.textContent || "Project";
            const idOrUrl = getVimeoId(src) || src;
            const fullUrl = /^\d+$/.test(idOrUrl) ? `https://vimeo.com/${idOrUrl}` : idOrUrl;
            const thumb = await fetchVimeoThumb(fullUrl);
            if (thumb) {
                injectThumbIntoButton(btn, thumb, `${title} thumbnail`);
                btn.classList.add('has-thumb');
            } else {
                // fallback visual si no conseguimos thumb
                btn.classList.add('has-thumb');
                btn.innerHTML = `
                  <div style="width:100%;height:100%;background:
                    repeating-linear-gradient(45deg, rgba(255,255,255,.06) 0 10px, transparent 10px 20px), #0e0e0e;"></div>
                  <div class="play-btn"></div>
                `;
            }
        }));
    }

    /* ===== Card builder (acepta YouTube o Vimeo en `youtube_url`) ===== */
    function makeCard(p) {
        // 1) Fuente única: usamos SIEMPRE `youtube_url` (puede ser YT o Vimeo).
        //    Si no viene, caemos a otros campos opcionales por compatibilidad.
        const vidSrc =
            (p.youtube_url || p.video_url || p.vimeo_url || p.youtube || p.vimeo || "").trim();

        // 2) Detectamos IDs según proveedor a partir del MISMO campo
        const ytId = getYouTubeId(vidSrc);
        const vimeoId = getVimeoId(vidSrc);

        // 3) URL final de reproducción
        let videoUrl = "";
        if (/vimeo\.com/i.test(vidSrc)) {
            // Si ya es una URL de Vimeo, respétala tal cual
            videoUrl = vidSrc;
        } else if (vimeoId) {
            videoUrl = `https://vimeo.com/${vimeoId}`;
        } else if (ytId) {
            videoUrl = `https://www.youtube.com/watch?v=${ytId}`;
        } else if (vidSrc) {
            // Alguna otra URL de vídeo
            videoUrl = vidSrc;
        }

        // 4) Thumbnail:
        //    - YouTube: miniatura directa
        //    - Vimeo: se resuelve asíncronamente vía oEmbed/noembed (ya lo haces en loadVimeoThumbsAfterRender)
        //    - Fallback: placeholder si no hay vídeo
        let thumbHtml = "";

        if (ytId) {
            thumbHtml = `
      <button class="thumb thumb--clean" type="button" data-video="${videoUrl}">
        <img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" alt="${p.title || "Project"} thumbnail" loading="lazy">
        <div class="play-btn"></div>
      </button>`;
        } else if (p.thumb) {
            // Si has provisto una imagen custom de thumb
            thumbHtml = `
      <button class="thumb thumb--clean" type="button" data-video="${videoUrl}">
        <img src="${p.thumb}" alt="${p.title || "Project"} thumbnail" loading="lazy">
        <div class="play-btn"></div>
      </button>`;
        } else if (vimeoId || /vimeo\.com/i.test(videoUrl)) {
            // Marcamos para que `loadVimeoThumbsAfterRender()` pinte la miniatura tras el render
            const mark = vimeoId ? vimeoId : videoUrl;
            thumbHtml = `
      <button class="thumb thumb--clean" type="button" data-video="${videoUrl}" data-vimeo="${mark}">
        <div class="play-btn"></div>
      </button>`;
        } else if (videoUrl) {
            // Otro proveedor: placeholder clicable
            thumbHtml = `
      <button class="thumb thumb--clean" type="button" data-video="${videoUrl}">
        <div class="play-btn"></div>
      </button>`;
        } else {
            // Sin vídeo
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
        ${makeInfo("Comp Supervisor", p.comp_supervisor)}
        ${makeInfo("Comp Lead", p.comp_lead)}
        ${makeInfo("Role", p.role)}
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

            // Cargar miniaturas de Vimeo de forma asíncrona (tras pintar)
            await loadVimeoThumbsAfterRender();

            // Click en los thumbnails con video
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

    /* ===== MODAL Video (reels) ===== */
    const modal = document.getElementById("videoModal");
    const media = document.getElementById("modalMedia");
    const closeBtn = modal ? modal.querySelector(".modal-close") : null;

    function openModalFromUrl(urlOrId) {
        if (!modal || !media) return;

        let nodeHtml = "";

        if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(urlOrId)) {
            nodeHtml = `<video src="${urlOrId}" controls autoplay playsinline></video>`;
        } else if (/vimeo\.com/i.test(urlOrId)) {
            let embed = urlOrId;
            if (!/player\.vimeo\.com\/video\//i.test(embed)) {
                const vid = getVimeoId(embed);
                if (vid) embed = `https://player.vimeo.com/video/${vid}`;
            }
            embed += (embed.includes("?") ? "&" : "?") +
                "autoplay=1&muted=0&controls=1&title=0&byline=0&portrait=0&dnt=1&transparent=0";
            nodeHtml = `<iframe src="${embed}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
        } else {
            const ytId = getYouTubeId(urlOrId);
            if (ytId) {
                const embed = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`;
                nodeHtml = `<iframe src="${embed}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
            } else {
                nodeHtml = `<iframe src="${urlOrId}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
            }
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
        media.innerHTML = "";
    }

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

    /* ===== Drawer móvil ===== */
    const burgerBtn = document.getElementById("burgerBtn");
    const mobileMenu = document.getElementById("mobileMenu");
    const drawerClose = mobileMenu ? mobileMenu.querySelector(".drawer-close") : null;
    const mobileBackdrop = document.getElementById("mobileBackdrop");

    function isMobileMenuOpen() {
        return mobileMenu && mobileMenu.classList.contains("open");
    }
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

    window.addEventListener("resize", () => {
        if (window.innerWidth >= 860 && isMobileMenuOpen()) closeMobileMenu();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (modal && modal.classList.contains("open")) closeModal();
            if (pdfModal && pdfModal.classList.contains("open")) closePdfOverlay();
            if (isMobileMenuOpen()) closeMobileMenu();
        }
    });

    /* ========= PDF overlay (desktop) / descarga (móvil) ========= */
    const pdfModal = document.getElementById("pdfModal");
    const pdfMedia = document.getElementById("pdfMedia");
    const pdfDialog = pdfModal ? pdfModal.querySelector(".modal-dialog") : null;
    const pdfClose = pdfModal ? pdfModal.querySelector(".modal-close") : null;

    function openPdfOverlay(url, title) {
        if (!pdfModal || !pdfMedia) return;
        if (pdfDialog) pdfDialog.classList.add("pdf-wide");
        // Visor nativo del navegador (con controles del propio navegador)
        pdfMedia.innerHTML = `<iframe src="${url}" title="${title || "PDF"}" loading="lazy"></iframe>`;
        pdfModal.classList.add("open");
        lockScroll();
        pdfModal.setAttribute("aria-hidden", "false");
    }

    function closePdfOverlay() {
        if (!pdfModal || !pdfMedia) return;
        pdfModal.classList.remove("open");
        unlockScroll();
        pdfModal.setAttribute("aria-hidden", "true");
        pdfMedia.innerHTML = "";
        if (pdfDialog) pdfDialog.classList.remove("pdf-wide");
    }

    // Botón cerrar (por encima del iframe)
    if (pdfClose) {
        pdfClose.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            closePdfOverlay();
        });
    }

    // Cerrar clicando el backdrop o la X (delegado)
    if (pdfModal) {
        pdfModal.addEventListener("click", (e) => {
            const el = e.target;
            if (!(el instanceof Element)) return;
            if (el.hasAttribute("data-close") || el.closest(".modal-close")) {
                closePdfOverlay();
            }
        });
    }

    function triggerDownload(url, filename) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || url.split("/").pop() || "document.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // Inicializador de los 3 botones CV/Animation/VFX
    let cvButtonsInit = false;
    function initCvButtonsOnce() {
        if (cvButtonsInit) return;
        cvButtonsInit = true;

        const MAP = {
            cv: { title: "Curriculum Vitae", url: "assets/cv_lucas.pdf" },
            anim: { title: "Breakdown Animation", url: "assets/breakdown_animation.pdf" },
            vfx: { title: "Breakdown VFX", url: "assets/breakdown_vfx.pdf" },
        };

        const pills = document.querySelectorAll(".cv-pill");
        pills.forEach((btn) => {
            btn.addEventListener("click", () => {
                const key = btn.dataset.doc;
                const doc = MAP[key];
                if (!doc) return;

                // móvil: descarga; desktop/tablet: overlay
                const isSmall = window.matchMedia("(max-width: 540px)").matches;
                if (isSmall) {
                    const safeName = doc.title.replace(/\s+/g, "_") + ".pdf";
                    triggerDownload(doc.url, safeName);
                } else {
                    openPdfOverlay(doc.url, doc.title);
                }
            });
        });
    }

    /* ===== Utilidad debounce ===== */
    function debounce(fn, ms) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    // Estado inicial
    setActive("section-home");
});
