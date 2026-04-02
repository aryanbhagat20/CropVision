/* ═══════════════════════════════════════════
   CropVision — App Logic
   ═══════════════════════════════════════════ */

const API = "http://127.0.0.1:8000";

let statsData = null;

// ─── Tab navigation ───
document.querySelectorAll(".nav-item").forEach(link => {
    link.addEventListener("click", e => {
        e.preventDefault();
        const tab = link.dataset.tab;
        document.querySelectorAll(".nav-item").forEach(l => l.classList.remove("active"));
        link.classList.add("active");
        document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
        const target = document.getElementById(tab);
        if (target) target.classList.add("active");
    });
});

// Hero CTA
document.getElementById("heroCta").addEventListener("click", e => {
    e.preventDefault();
    document.querySelectorAll(".nav-item").forEach(l => l.classList.remove("active"));
    document.querySelector('[data-tab="predict"]').classList.add("active");
    document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
    document.getElementById("predict").classList.add("active");
    document.getElementById("predict").scrollIntoView({ behavior: "smooth", block: "start" });
});

// ─── API check ───
async function checkAPI() {
    const pill = document.getElementById("apiPill");
    const label = pill.querySelector(".api-label");
    try {
        const r = await fetch(API + "/");
        if (r.ok) {
            pill.className = "api-pill online";
            label.textContent = "online";
            return true;
        }
    } catch (_) {}
    pill.className = "api-pill offline";
    label.textContent = "offline";
    return false;
}

// ─── Load stats ───
async function loadStats() {
    try {
        const r = await fetch(API + "/api/stats");
        statsData = await r.json();

        const d = statsData.dataset;
        const a = statsData.accuracies;

        // Hero stats
        animateNum("heroSamples", d.total_samples);
        animateNum("heroCrops", d.total_crops);

        const best = Math.max(a.random_forest, a.logistic_regression);
        document.getElementById("heroAccuracy").textContent = (best * 100).toFixed(1) + "%";

        // Model panels
        const rfPct = (a.random_forest * 100).toFixed(1);
        const lrPct = (a.logistic_regression * 100).toFixed(1);
        document.getElementById("rfAccBig").textContent = rfPct + "%";
        document.getElementById("lrAccBig").textContent = lrPct + "%";

        setTimeout(() => {
            document.getElementById("rfFill").style.width = rfPct + "%";
            document.getElementById("lrFill").style.width = lrPct + "%";
        }, 200);

        if (a.logistic_regression > a.random_forest) {
            document.getElementById("rfBestTag").classList.add("hidden");
            document.getElementById("lrBestTag").classList.remove("hidden");
        }

        // Feature importances
        loadImportances();

        // Distribution
        renderDistribution(statsData.crop_distribution);

        // Feature table
        renderFeatureTable(statsData.feature_stats);

        // Crop tags
        renderCropTags(statsData.crop_distribution);

    } catch (e) {
        console.error("Stats load failed:", e);
    }
}

function animateNum(id, target) {
    const el = document.getElementById(id);
    let curr = 0;
    const step = Math.max(1, Math.ceil(target / 35));
    const interval = setInterval(() => {
        curr = Math.min(curr + step, target);
        el.textContent = curr.toLocaleString();
        if (curr >= target) clearInterval(interval);
    }, 25);
}

// ─── Importances ───
async function loadImportances() {
    const r = await fetch(API + "/api/feature-importances");
    const data = await r.json();
    const grid = document.getElementById("importanceGrid");
    grid.innerHTML = "";

    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const max = sorted[0][1];

    const colors = [
        "var(--green-400)", "var(--green-300)",
        "var(--blue-400)", "var(--rust-400)",
        "var(--sand-500)", "var(--sand-400)", "var(--sand-400)"
    ];

    sorted.forEach(([name, val], i) => {
        const pct = ((val / max) * 100).toFixed(0);
        const card = document.createElement("div");
        card.className = "imp-card";
        card.innerHTML = `
            <div class="imp-card-label">${name}</div>
            <div class="imp-card-value">${(val * 100).toFixed(1)}%</div>
            <div class="imp-card-bar">
                <div class="imp-card-fill" style="background:${colors[i]}"></div>
            </div>
        `;
        grid.appendChild(card);
        setTimeout(() => {
            card.querySelector(".imp-card-fill").style.width = pct + "%";
        }, 300 + i * 80);
    });
}

// ─── Distribution ───
function renderDistribution(dist) {
    const container = document.getElementById("distChart");
    container.innerHTML = "";

    const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
    const maxCount = entries[0][1];

    const palette = [
        "#4a9952","#5aaa62","#6bb973","#7ab880","#89c78d",
        "#5b8db8","#6b9cc6","#7babd4","#8bb9e0","#9bc7e8",
        "#c4704a","#d08058","#dc9066","#e8a074","#b5ac99",
        "#a09888","#8f8572","#7e755f","#6d664d","#5c573c",
        "#ab6b8d","#c47fa3"
    ];

    entries.forEach(([crop, count], i) => {
        const h = Math.max(8, (count / maxCount) * 160);
        const g = document.createElement("div");
        g.className = "dist-bar-group";
        g.innerHTML = `
            <div class="dist-bar-count">${count}</div>
            <div class="dist-bar" style="background:${palette[i % palette.length]}" title="${crop}: ${count}"></div>
            <div class="dist-bar-name">${crop}</div>
        `;
        container.appendChild(g);
        setTimeout(() => {
            g.querySelector(".dist-bar").style.height = h + "px";
        }, 200 + i * 40);
    });
}

// ─── Feature table ───
function renderFeatureTable(stats) {
    const tbody = document.getElementById("featureTableBody");
    tbody.innerHTML = "";
    stats.forEach(f => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${f.name}</td><td>${f.min}</td><td>${f.max}</td><td>${f.mean}</td><td>${f.std}</td>`;
        tbody.appendChild(tr);
    });
}

// ─── Crop tags ───
function renderCropTags(dist) {
    const container = document.getElementById("cropTags");
    container.innerHTML = "";
    const sorted = Object.entries(dist).sort((a, b) => a[0].localeCompare(b[0]));
    sorted.forEach(([crop, count]) => {
        const tag = document.createElement("div");
        tag.className = "crop-tag";
        tag.innerHTML = `
            <span>${getCropEmoji(crop)} ${crop}</span>
            <span class="crop-tag-count">${count}</span>
        `;
        container.appendChild(tag);
    });
}

// ─── Crop emojis ───
const cropEmojiMap = {
    rice:"🌾", maize:"🌽", chickpea:"🫘", kidneybeans:"🫘",
    pigeonpeas:"🫛", mothbeans:"🌱", mungbean:"🌿", blackgram:"🌑",
    lentil:"🥗", pomegranate:"🍎", banana:"🍌", mango:"🥭",
    grapes:"🍇", watermelon:"🍉", muskmelon:"🍈", apple:"🍏",
    orange:"🍊", papaya:"🍈", coconut:"🥥", cotton:"🧶",
    jute:"🌿", coffee:"☕"
};
function getCropEmoji(c) { return cropEmojiMap[c.toLowerCase()] || "🌱"; }

// ─── Prediction ───
document.getElementById("predictForm").addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target);

    const placeholder = document.getElementById("resultPlaceholder");
    const loading = document.getElementById("resultLoading");
    const content = document.getElementById("resultContent");

    placeholder.classList.add("hidden");
    content.classList.add("hidden");
    loading.classList.remove("hidden");

    const payload = {
        N: +fd.get("N"), P: +fd.get("P"), K: +fd.get("K"),
        temperature: +fd.get("temperature"), humidity: +fd.get("humidity"),
        ph: +fd.get("ph"), rainfall: +fd.get("rainfall")
    };

    try {
        const r = await fetch(API + "/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        content.innerHTML = "";

        data.predictions.forEach((pred, idx) => {
            const isRF = pred.model.includes("Random Forest");
            const cls = isRF ? "rf" : "lr";
            const emoji = getCropEmoji(pred.predicted_crop);

            const confClass = pred.confidence >= 80 ? "high" : pred.confidence >= 50 ? "mid" : "low";

            let topHTML = "";
            Object.entries(pred.top_predictions).forEach(([name, pct]) => {
                topHTML += `
                    <div class="pred-top-item">
                        <span class="pred-top-name">${getCropEmoji(name)} ${name}</span>
                        <div class="pred-top-bar-bg"><div class="pred-top-bar-fill"></div></div>
                        <span class="pred-top-pct">${pct}%</span>
                    </div>`;
            });

            const block = document.createElement("div");
            block.className = "pred-block";
            block.innerHTML = `
                <div class="pred-block-header">
                    <span class="pred-model-label">${pred.model}</span>
                    <span class="pred-conf-badge ${confClass}">${pred.confidence}%</span>
                </div>
                <div class="pred-crop-name">
                    <span class="pred-crop-emoji">${emoji}</span>
                    <span class="pred-crop-text">${pred.predicted_crop}</span>
                </div>
                <div class="pred-conf-bar"><div class="pred-conf-fill ${cls}"></div></div>
                <div class="pred-top-list">
                    <div class="pred-top-label">Top predictions</div>
                    ${topHTML}
                </div>
            `;
            content.appendChild(block);

            setTimeout(() => {
                block.querySelector(".pred-conf-fill").style.width = pred.confidence + "%";
                const bars = block.querySelectorAll(".pred-top-bar-fill");
                const tops = Object.values(pred.top_predictions);
                tops.forEach((pct, j) => {
                    if (bars[j]) bars[j].style.width = Math.min(pct, 100) + "%";
                });
            }, 150 + idx * 100);
        });

        loading.classList.add("hidden");
        content.classList.remove("hidden");
    } catch (err) {
        loading.classList.add("hidden");
        placeholder.classList.remove("hidden");
        console.error("Predict failed:", err);
    }
});

// ─── Sample data ───
const samples = [
    { N:90, P:42, K:43, temperature:20.87, humidity:82, ph:6.5, rainfall:202.9 },
    { N:40, P:72, K:77, temperature:17.02, humidity:16.98, ph:7.48, rainfall:88.5 },
    { N:20, P:55, K:20, temperature:28.3, humidity:87.1, ph:6.7, rainfall:42.5 },
    { N:56, P:79, K:15, temperature:29.5, humidity:63.2, ph:7.4, rainfall:71.9 },
    { N:10, P:144, K:196, temperature:23.6, humidity:90.7, ph:6.1, rainfall:170.7 },
    { N:19, P:10, K:62, temperature:37.1, humidity:93.2, ph:7.3, rainfall:184.2 },
    { N:118, P:34, K:60, temperature:27, humidity:91.2, ph:6.3, rainfall:58.7 },
    { N:15, P:37, K:52, temperature:27.4, humidity:66.5, ph:5.1, rainfall:144.1 },
];

document.getElementById("btnSample").addEventListener("click", () => {
    const s = samples[Math.floor(Math.random() * samples.length)];
    document.getElementById("inpN").value = s.N;
    document.getElementById("inpP").value = s.P;
    document.getElementById("inpK").value = s.K;
    document.getElementById("inpTemp").value = s.temperature;
    document.getElementById("inpHumidity").value = s.humidity;
    document.getElementById("inpPH").value = s.ph;
    document.getElementById("inpRainfall").value = s.rainfall;

    // Quick flash
    document.querySelectorAll(".field input").forEach(inp => {
        inp.style.borderColor = "var(--green-400)";
        setTimeout(() => inp.style.borderColor = "", 500);
    });
});

// ─── Init ───
(async () => {
    const ok = await checkAPI();
    if (ok) loadStats();
    setInterval(async () => {
        const ok = await checkAPI();
        if (ok && !statsData) loadStats();
    }, 8000);
})();
