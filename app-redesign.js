/* BrasilCord app refresh — quick settings and interaction polish */
(() => {
  "use strict";

  const ready = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  };

  ready(() => {
    const body = document.body;
    if (!body) return;

    body.classList.add("bc-app-refresh");

    const storage = {
      get(key, fallback) {
        try {
          const value = window.localStorage.getItem(key);
          return value === null ? fallback : value;
        } catch (_) {
          return fallback;
        }
      },
      set(key, value) {
        try { window.localStorage.setItem(key, value); } catch (_) {}
      }
    };

    const christmasEnabled = storage.get("brasilcord-christmas-enabled", "true") !== "false";
    body.classList.toggle("christmas-on", christmasEnabled);

    const savedDensity = storage.get("brasilcord-ui-density", "comfortable");
    body.dataset.uiDensity = ["compact", "comfortable", "relaxed"].includes(savedDensity)
      ? savedDensity
      : "comfortable";

    const dialog = document.createElement("dialog");
    dialog.id = "bc-quick-settings";
    dialog.className = "bc-quick-settings";
    dialog.innerHTML = `
      <form method="dialog" class="bc-quick-settings-card">
        <header class="bc-quick-settings-header">
          <div>
            <p class="bc-quick-settings-kicker">BrasilCord · personalização</p>
            <h2>Configurações rápidas</h2>
          </div>
          <button class="bc-quick-settings-close" value="cancel" aria-label="Fechar configurações">×</button>
        </header>
        <div class="bc-settings-grid">
          <label class="bc-settings-row">
            <span><strong>Tema natalino</strong><small>Luzes, cores e detalhes especiais de Natal.</small></span>
            <input id="bc-setting-christmas" type="checkbox" aria-label="Ativar tema natalino">
          </label>
          <label class="bc-settings-row">
            <span><strong>Som da interface</strong><small>Feedback sonoro para ações compatíveis.</small></span>
            <input id="bc-setting-sound" type="checkbox" aria-label="Ativar som da interface">
          </label>
          <label class="bc-settings-row">
            <span><strong>Densidade da interface</strong><small id="bc-setting-density-label">Confortável</small></span>
            <input id="bc-setting-density" type="range" min="0" max="2" step="1" aria-label="Densidade da interface">
          </label>
        </div>
        <div class="bc-settings-actions">
          <button type="button" id="bc-setting-profile">Editar meu perfil</button>
          <button type="button" id="bc-setting-community">Configurar comunidade</button>
          <button type="button" id="bc-setting-badges">Ver insígnias</button>
          <button type="button" id="bc-setting-status">Ver status</button>
        </div>
        <p class="bc-settings-feedback" id="bc-setting-feedback" role="status" aria-live="polite"></p>
      </form>`;
    body.appendChild(dialog);

    const christmasInput = dialog.querySelector("#bc-setting-christmas");
    const soundInput = dialog.querySelector("#bc-setting-sound");
    const densityInput = dialog.querySelector("#bc-setting-density");
    const densityLabel = dialog.querySelector("#bc-setting-density-label");
    const feedback = dialog.querySelector("#bc-setting-feedback");

    const densityValues = ["compact", "comfortable", "relaxed"];
    const densityLabels = ["Compacta", "Confortável", "Espaçosa"];
    const currentDensityIndex = Math.max(0, densityValues.indexOf(body.dataset.uiDensity));

    christmasInput.checked = christmasEnabled;
    soundInput.checked = storage.get("brasilcord-sound-enabled", "true") !== "false";
    densityInput.value = String(currentDensityIndex);
    densityLabel.textContent = densityLabels[currentDensityIndex];

    const showFeedback = (message) => {
      feedback.textContent = message;
      window.clearTimeout(showFeedback.timer);
      showFeedback.timer = window.setTimeout(() => { feedback.textContent = ""; }, 2600);
    };

    const openDialog = () => {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    };

    const addButton = (id, label, parent, className = "bc-app-settings-button") => {
      if (!parent || document.getElementById(id)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.id = id;
      button.className = className;
      button.textContent = label;
      button.setAttribute("aria-label", label);
      parent.appendChild(button);
      return button;
    };

    const topActions = document.querySelector(".top-actions");
    const topSettings = addButton("bc-app-settings-button", "⚙️ Configurações", topActions);
    if (topSettings) topSettings.addEventListener("click", openDialog);

    const accountActions = document.querySelector("#bc-account-panel .bc-account-actions");
    const accountSettings = addButton("bc-account-quick-settings", "⚙", accountActions, "bc-account-quick-settings");
    if (accountSettings) {
      accountSettings.title = "Configurações rápidas";
      accountSettings.addEventListener("click", openDialog);
    }

    const christmasButton = addButton("bc-app-christmas-toggle", christmasEnabled ? "🎄 Natal" : "☼ Normal", topActions);
    if (christmasButton) {
      christmasButton.title = "Alternar tema natalino";
      christmasButton.addEventListener("click", () => {
        christmasInput.checked = !christmasInput.checked;
        christmasInput.dispatchEvent(new Event("change"));
      });
    }

    christmasInput.addEventListener("change", () => {
      const enabled = christmasInput.checked;
      body.classList.toggle("christmas-on", enabled);
      storage.set("brasilcord-christmas-enabled", String(enabled));
      if (christmasButton) christmasButton.textContent = enabled ? "🎄 Natal" : "☼ Normal";
      showFeedback(enabled ? "Tema natalino ativado." : "Tema natalino pausado.");
    });

    soundInput.addEventListener("change", () => {
      storage.set("brasilcord-sound-enabled", String(soundInput.checked));
      const existingSound = document.querySelector("#ui-sound-toggle");
      if (existingSound) existingSound.setAttribute("aria-pressed", String(soundInput.checked));
      showFeedback(soundInput.checked ? "Som da interface ativado." : "Som da interface pausado.");
    });

    densityInput.addEventListener("input", () => {
      const index = Math.min(2, Math.max(0, Number(densityInput.value)));
      body.dataset.uiDensity = densityValues[index];
      densityLabel.textContent = densityLabels[index];
      storage.set("brasilcord-ui-density", densityValues[index]);
    });

    const clickExisting = (selector, fallbackMessage) => {
      const target = document.querySelector(selector);
      if (target) {
        target.click();
        return;
      }
      showFeedback(fallbackMessage);
    };

    dialog.querySelector("#bc-setting-profile").addEventListener("click", () => {
      clickExisting("#bc-user-profile-shortcut, #bc-user-settings", "Abra seu perfil pelo menu da conta.");
    });
    dialog.querySelector("#bc-setting-community").addEventListener("click", () => {
      clickExisting("#bc-server-settings-button, #bc-open-server-settings", "As configurações da comunidade estão disponíveis para administradores.");
    });
    dialog.querySelector("#bc-setting-badges").addEventListener("click", () => {
      clickExisting("#bc-open-badge-gallery, #bc-badge-gallery-open", "A galeria de insígnias está no seu perfil.");
    });
    dialog.querySelector("#bc-setting-status").addEventListener("click", () => {
      window.location.href = "status.html";
    });

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        openDialog();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const search = document.querySelector('input[placeholder*="Buscar"], input[aria-label*="Buscar"]');
        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    });

    document.querySelectorAll("button").forEach((button) => {
      if (!button.getAttribute("aria-label") && !button.textContent.trim() && button.title) {
        button.setAttribute("aria-label", button.title);
      }
    });
  });
})();


/* Christmas everywhere: snowfall and persistent festive chrome */
(() => {
  "use strict";

  const mountHolidayDecor = () => {
    const body = document.body;
    if (!body || document.getElementById("bc-snowfall")) return;

    const snow = document.createElement("div");
    snow.id = "bc-snowfall";
    snow.className = "bc-snowfall";
    snow.setAttribute("aria-hidden", "true");
    snow.innerHTML = Array.from({ length: 15 }, () => "<span>❄</span>").join("");
    body.appendChild(snow);

    const ribbon = document.createElement("div");
    ribbon.className = "bc-holiday-ribbon";
    ribbon.setAttribute("aria-hidden", "true");
    ribbon.innerHTML = "<span>🎄</span><span>Modo Natalino BrasilCord</span><span>🎁</span>";
    body.appendChild(ribbon);

    const syncHolidayDecor = () => {
      const enabled = body.classList.contains("christmas-on");
      snow.hidden = !enabled;
      ribbon.hidden = !enabled;
      body.dataset.holidayTheme = enabled ? "christmas" : "classic";
    };

    syncHolidayDecor();
    const observer = new MutationObserver(syncHolidayDecor);
    observer.observe(body, { attributes: true, attributeFilter: ["class"] });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountHolidayDecor, { once: true });
  } else {
    mountHolidayDecor();
  }
})();
