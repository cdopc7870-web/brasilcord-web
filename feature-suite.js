/* BrasilCord feature suite — conversations, calls, community, discovery and security */
(() => {
  "use strict";

  const start = () => {
    const body = document.body;
    if (!body || document.getElementById("bc-feature-center")) return;

    const store = {
      get(key, fallback) {
        try {
          const value = localStorage.getItem(key);
          return value === null ? fallback : value;
        } catch (_) { return fallback; }
      },
      set(key, value) {
        try { localStorage.setItem(key, value); } catch (_) {}
      },
      json(key, fallback) {
        try { return JSON.parse(store.get(key, JSON.stringify(fallback))); } catch (_) { return fallback; }
      }
    };

    const dialog = document.createElement("dialog");
    dialog.id = "bc-feature-center";
    dialog.className = "bc-feature-center";
    dialog.innerHTML = `
      <div class="bc-feature-shell">
        <aside class="bc-feature-sidebar">
          <div class="bc-feature-brand"><small>BrasilCord · central</small><strong>✨ Recursos</strong></div>
          <nav class="bc-feature-nav" role="tablist" aria-label="Recursos do BrasilCord">
            <button class="bc-feature-tab" data-feature-tab="conversation" role="tab" aria-selected="true">💬 Conversas</button>
            <button class="bc-feature-tab" data-feature-tab="calls" role="tab" aria-selected="false">🎙️ Calls</button>
            <button class="bc-feature-tab" data-feature-tab="community" role="tab" aria-selected="false">🏠 Comunidade</button>
            <button class="bc-feature-tab" data-feature-tab="discover" role="tab" aria-selected="false">🧭 Descobrir</button>
            <button class="bc-feature-tab" data-feature-tab="identity" role="tab" aria-selected="false">🏅 Perfil</button>
            <button class="bc-feature-tab" data-feature-tab="security" role="tab" aria-selected="false">🛡️ Segurança</button>
          </nav>
        </aside>
        <div class="bc-feature-content">
          <header class="bc-feature-header">
            <div><span class="bc-feature-kicker">BRASILCORD • CENTRAL DE RECURSOS</span><h2>Faça sua comunidade crescer</h2></div>
            <button class="bc-feature-close" type="button" aria-label="Fechar recursos">×</button>
          </header>

          <section class="bc-feature-panel is-active" data-feature-panel="conversation" role="tabpanel">
            <p class="bc-feature-intro">Ferramentas para deixar a conversa mais organizada, divertida e fácil de encontrar.</p>
            <div class="bc-feature-grid">
              <article class="bc-feature-card">
                <span class="bc-feature-icon">📊</span>
                <div><h3>Enquete rápida</h3><p>Monte uma enquete e insira o texto no canal atual.</p>
                  <div class="bc-feature-field"><label for="bc-feature-poll-question">Pergunta</label><input id="bc-feature-poll-question" placeholder="O que vamos fazer hoje?"></div>
                  <div class="bc-feature-field"><label for="bc-feature-poll-options">Opções</label><input id="bc-feature-poll-options" placeholder="Jogar, Conversar, Assistir filme"></div>
                  <div class="bc-feature-card-actions"><button class="bc-feature-primary" id="bc-feature-poll" type="button">Inserir enquete</button></div>
                </div>
              </article>
              <article class="bc-feature-card">
                <span class="bc-feature-icon">🧵</span>
                <div><h3>Thread e resposta</h3><p>Prepare uma mensagem para abrir uma conversa organizada.</p>
                  <div class="bc-feature-field"><label for="bc-feature-thread">Assunto da thread</label><input id="bc-feature-thread" placeholder="Ideias para o próximo evento"></div>
                  <div class="bc-feature-card-actions"><button class="bc-feature-action" id="bc-feature-thread-button" type="button">Criar thread</button><button class="bc-feature-action" id="bc-feature-draft-button" type="button">Salvar rascunho</button></div>
                </div>
              </article>
              <article class="bc-feature-card bc-feature-card-wide">
                <span class="bc-feature-icon">📝</span>
                <div><h3>Rascunhos e notificações</h3><p>Seu texto fica salvo neste dispositivo e pode ser retomado depois.</p>
                  <label class="bc-feature-switch"><span>Salvar rascunhos automaticamente<small>Somente neste navegador.</small></span><input id="bc-feature-drafts" type="checkbox"></label>
                  <label class="bc-feature-switch"><span>Notificações do BrasilCord<small>Receba avisos quando o navegador permitir.</small></span><input id="bc-feature-notifications" type="checkbox"></label>
                  <div class="bc-feature-card-actions"><button class="bc-feature-action" id="bc-feature-clear-draft" type="button">Limpar rascunho</button></div>
                </div>
              </article>
            </div>
            <p class="bc-feature-status" id="bc-feature-conversation-status" role="status"></p>
          </section>

          <section class="bc-feature-panel" data-feature-panel="calls" role="tabpanel">
            <p class="bc-feature-intro">Controles rápidos para voz, vídeo e transmissões. Alguns recursos aparecem quando você entra em uma call.</p>
            <div class="bc-feature-grid">
              <article class="bc-feature-card">
                <span class="bc-feature-icon">🎧</span>
                <div><h3>Qualidade de áudio</h3>
                  <label class="bc-feature-switch"><span>Supressão de ruído<small>Reduz sons do ambiente.</small></span><input id="bc-feature-noise" type="checkbox"></label>
                  <label class="bc-feature-switch"><span>Cancelamento de eco<small>Evita retorno do microfone.</small></span><input id="bc-feature-echo" type="checkbox"></label>
                  <label class="bc-feature-switch"><span>Ganho automático<small>Equilibra o volume da voz.</small></span><input id="bc-feature-gain" type="checkbox"></label>
                  <div class="bc-feature-card-actions"><button class="bc-feature-action" data-existing-call="#bc-call-share-screen" type="button">🖥️ Compartilhar tela</button><button class="bc-feature-action" data-existing-call="#bc-call-camera" type="button">📷 Câmera</button></div>
                </div>
              </article>
              <article class="bc-feature-card">
                <span class="bc-feature-icon">🎤</span>
                <div><h3>Participação em call</h3>
                  <label class="bc-feature-switch"><span>Levantar a mão<small>Avise que quer falar.</small></span><input id="bc-feature-hand" type="checkbox"></label>
                  <label class="bc-feature-switch"><span>Legendas automáticas<small>Preparado para chamadas compatíveis.</small></span><input id="bc-feature-captions" type="checkbox"></label>
                  <label class="bc-feature-switch"><span>Indicador de ping<small>Mostra a qualidade da conexão.</small></span><input id="bc-feature-ping" type="checkbox"></label>
                  <div class="bc-feature-card-actions"><button class="bc-feature-action" data-existing-call="#bc-call-join" type="button">☎ Entrar na call</button><button class="bc-feature-action" data-existing-call="#bc-call-leave" type="button">Sair da call</button></div>
                </div>
              </article>
            </div>
            <p class="bc-feature-note">A gravação e a transcrição devem exigir consentimento explícito de todos os participantes antes de serem ativadas.</p>
            <p class="bc-feature-status" id="bc-feature-calls-status" role="status"></p>
          </section>

          <section class="bc-feature-panel" data-feature-panel="community" role="tabpanel">
            <p class="bc-feature-intro">Organize sua comunidade com eventos, moderação e convites mais claros.</p>
            <div class="bc-feature-grid">
              <article class="bc-feature-card">
                <span class="bc-feature-icon">📅</span>
                <div><h3>Eventos da comunidade</h3><p>Crie um lembrete local para encontros, campeonatos ou lives.</p>
                  <div class="bc-feature-field"><label for="bc-feature-event-name">Nome do evento</label><input id="bc-feature-event-name" placeholder="Encontro da comunidade"></div>
                  <div class="bc-feature-field"><label for="bc-feature-event-date">Data e hora</label><input id="bc-feature-event-date" type="datetime-local"></div>
                  <div class="bc-feature-card-actions"><button class="bc-feature-primary" id="bc-feature-event-add" type="button">Adicionar evento</button></div>
                  <div id="bc-feature-event-list" class="bc-feature-list"></div>
                </div>
              </article>
              <article class="bc-feature-card">
                <span class="bc-feature-icon">🛡️</span>
                <div><h3>AutoMod e auditoria</h3><p>Prepare regras para spam, links e palavras proibidas.</p>
                  <label class="bc-feature-switch"><span>Filtro anti-spam<small>Proteção local de interface.</small></span><input id="bc-feature-automod-spam" type="checkbox"></label>
                  <label class="bc-feature-switch"><span>Filtro de links<small>Avise antes de abrir links desconhecidos.</small></span><input id="bc-feature-automod-links" type="checkbox"></label>
                  <label class="bc-feature-switch"><span>Registro de ações<small>Registra preferências neste dispositivo.</small></span><input id="bc-feature-audit" type="checkbox"></label>
                  <div class="bc-feature-card-actions"><button class="bc-feature-action" data-existing-call="#bc-server-settings-button" type="button">⚙ Configurar comunidade</button><button class="bc-feature-action" data-existing-call="#bc-platform-invite" type="button">🔗 Criar convite</button></div>
                </div>
              </article>
            </div>
            <p class="bc-feature-note">As regras definitivas de AutoMod, cargos, permissões e auditoria precisam ser aplicadas também no backend para proteger todos os usuários.</p>
            <p class="bc-feature-status" id="bc-feature-community-status" role="status"></p>
          </section>

          <section class="bc-feature-panel" data-feature-panel="discover" role="tabpanel">
            <p class="bc-feature-intro">Encontre canais da comunidade e prepare uma futura vitrine pública do BrasilCord.</p>
            <div class="bc-feature-grid">
              <article class="bc-feature-card bc-feature-card-wide">
                <span class="bc-feature-icon">🧭</span>
                <div><h3>Diretório de comunidades</h3><p>Pesquise por nome, estado ou tema. A busca abaixo filtra os espaços que já estão carregados nesta conta.</p>
                  <div class="bc-feature-field"><label for="bc-feature-discovery-search">Buscar comunidade, canal ou tema</label><input id="bc-feature-discovery-search" placeholder="Ex.: música, São Paulo, jogos"></div>
                  <div class="bc-feature-card-actions"><button class="bc-feature-primary" id="bc-feature-discovery-button" type="button">Pesquisar</button><button class="bc-feature-action" data-existing-call="#bc-create-server-button" type="button">＋ Criar comunidade</button></div>
                  <div id="bc-feature-discovery-results" class="bc-feature-list"></div>
                </div>
              </article>
              <article class="bc-feature-card">
                <span class="bc-feature-icon">🇧🇷</span>
                <div><h3>Temas brasileiros</h3><p>Use tags como música, jogos, estudo, tecnologia, arte e regiões do Brasil.</p><div class="bc-feature-card-actions"><button class="bc-feature-action" id="bc-feature-brazil-tags" type="button">Adicionar tags ao perfil</button></div></div>
              </article>
              <article class="bc-feature-card">
                <span class="bc-feature-icon">📶</span>
                <div><h3>Modo internet lenta</h3><p>Reduz animações e mídias pesadas para melhorar o uso no celular.</p><label class="bc-feature-switch"><span>Ativar modo econômico<small>Preferência salva neste dispositivo.</small></span><input id="bc-feature-low-data" type="checkbox"></label></div>
              </article>
            </div>
            <p class="bc-feature-status" id="bc-feature-discover-status" role="status"></p>
          </section>

          <section class="bc-feature-panel" data-feature-panel="identity" role="tabpanel">
            <p class="bc-feature-intro">Deixe seu perfil mais brasileiro e mostre como você quer aparecer para a comunidade.</p>
            <div class="bc-feature-grid">
              <article class="bc-feature-card">
                <span class="bc-feature-icon">🏅</span>
                <div><h3>Perfil e insígnias</h3><p>Edite sua presença e destaque suas conquistas.</p>
                  <div class="bc-feature-field"><label for="bc-feature-status-text">Status personalizado</label><input id="bc-feature-status-text" maxlength="80" placeholder="🎄 Construindo algo incrível"></div>
                  <div class="bc-feature-card-actions"><button class="bc-feature-primary" id="bc-feature-status-save" type="button">Salvar status</button><button class="bc-feature-action" data-existing-call="#bc-open-badge-gallery" type="button">Ver insígnias</button></div>
                </div>
              </article>
              <article class="bc-feature-card">
                <span class="bc-feature-icon">🎨</span>
                <div><h3>Personalização</h3><p>Use Natal, Carnaval, Festa Junina ou o tema clássico.</p>
                  <div class="bc-feature-card-actions"><button class="bc-feature-action" data-existing-call="#bc-app-christmas-toggle" type="button">🎄 Alternar Natal</button><button class="bc-feature-action" id="bc-feature-density" type="button">Ajustar densidade</button></div>
                </div>
              </article>
            </div>
            <p class="bc-feature-status" id="bc-feature-identity-status" role="status"></p>
          </section>

          <section class="bc-feature-panel" data-feature-panel="security" role="tabpanel">
            <p class="bc-feature-intro">Controles rápidos de privacidade, sessões e proteção da conta.</p>
            <div class="bc-feature-grid">
              <article class="bc-feature-card">
                <span class="bc-feature-icon">🔐</span>
                <div><h3>Proteção da conta</h3>
                  <label class="bc-feature-switch"><span>Alertas de login<small>Avise sobre novas sessões quando o backend oferecer o evento.</small></span><input id="bc-feature-login-alerts" type="checkbox"></label>
                  <label class="bc-feature-switch"><span>Exigir confirmação em ações sensíveis<small>Preferência local até a validação no servidor.</small></span><input id="bc-feature-confirm-actions" type="checkbox"></label>
                  <label class="bc-feature-switch"><span>Bloquear conteúdo desconhecido<small>Reduz previews e links automáticos.</small></span><input id="bc-feature-safe-content" type="checkbox"></label>
                  <div class="bc-feature-card-actions"><button class="bc-feature-action" id="bc-feature-session" type="button">Ver sessão atual</button><button class="bc-feature-danger" id="bc-feature-logout" type="button">Sair desta conta</button></div>
                </div>
              </article>
              <article class="bc-feature-card">
                <span class="bc-feature-icon">✅</span>
                <div><h3>Próxima camada</h3><p>Ative 2FA quando o servidor disponibilizar o método. Nunca compartilhe códigos de recuperação.</p><div class="bc-feature-card-actions"><button class="bc-feature-action" id="bc-feature-security-status" type="button">Ver status de segurança</button><button class="bc-feature-action" data-existing-call="#bc-user-settings" type="button">Abrir configurações da conta</button></div></div>
              </article>
            </div>
            <p class="bc-feature-note">A interface já deixa as preferências organizadas. 2FA, sessões revogáveis e AutoMod precisam de endpoints no backend para serem segurança real.</p>
            <p class="bc-feature-status" id="bc-feature-security-status-text" role="status"></p>
          </section>
        </div>
      </div>`;
    body.appendChild(dialog);

    const qs = (selector, root = dialog) => root.querySelector(selector);
    const qsa = (selector, root = dialog) => Array.from(root.querySelectorAll(selector));
    const toast = (id, message) => {
      const node = qs("#" + id);
      if (node) node.textContent = message;
    };

    const openDialog = () => {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    };

    const closeDialog = () => {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };

    const addTopButton = () => {
      const parent = document.querySelector(".top-actions");
      if (!parent || document.getElementById("bc-feature-center-button")) return;
      const button = document.createElement("button");
      button.id = "bc-feature-center-button";
      button.type = "button";
      button.className = "bc-app-settings-button bc-feature-top-button";
      button.textContent = "✨ Recursos";
      button.setAttribute("aria-label", "Abrir central de recursos");
      button.addEventListener("click", openDialog);
      parent.appendChild(button);
    };

    addTopButton();

    const accountActions = document.querySelector("#bc-account-panel .bc-account-actions");
    if (accountActions && !document.getElementById("bc-feature-account-button")) {
      const button = document.createElement("button");
      button.id = "bc-feature-account-button";
      button.type = "button";
      button.className = "bc-account-quick-settings";
      button.textContent = "✨";
      button.title = "Central de recursos";
      button.setAttribute("aria-label", "Abrir central de recursos");
      button.addEventListener("click", openDialog);
      accountActions.appendChild(button);
    }

    qs(".bc-feature-close").addEventListener("click", closeDialog);

    qsa("[data-feature-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const name = tab.dataset.featureTab;
        qsa("[data-feature-tab]").forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
        qsa("[data-feature-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.featurePanel === name));
      });
    });

    const findComposer = () => document.querySelector("#bc-platform-message-input, #bc-dm-message-input, textarea[placeholder*='mensagem' i]");
    const insertComposer = (text, statusId) => {
      const input = findComposer();
      if (!input) {
        toast(statusId, "Abra um canal de texto para inserir esta mensagem.");
        return;
      }
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      closeDialog();
    };

    const draftInput = findComposer();
    const draftKey = () => "brasilcord-draft-" + (document.querySelector("#bc-workspace-title")?.textContent || "geral").trim().slice(0, 80);
    const draftsToggle = qs("#bc-feature-drafts");
    draftsToggle.checked = store.get("brasilcord-drafts-enabled", "true") !== "false";
    if (draftInput && draftsToggle.checked) {
      const saved = store.get(draftKey(), "");
      if (saved && !draftInput.value) draftInput.value = saved;
      draftInput.addEventListener("input", () => {
        if (draftsToggle.checked) store.set(draftKey(), draftInput.value);
      });
    }
    draftsToggle.addEventListener("change", () => {
      store.set("brasilcord-drafts-enabled", String(draftsToggle.checked));
      toast("bc-feature-conversation-status", draftsToggle.checked ? "Rascunhos automáticos ativados." : "Rascunhos automáticos pausados.");
    });
    qs("#bc-feature-clear-draft").addEventListener("click", () => {
      store.set(draftKey(), "");
      if (draftInput) draftInput.value = "";
      toast("bc-feature-conversation-status", "Rascunho limpo neste dispositivo.");
    });

    qs("#bc-feature-poll").addEventListener("click", () => {
      const question = qs("#bc-feature-poll-question").value.trim();
      const options = qs("#bc-feature-poll-options").value.split(",").map((item) => item.trim()).filter(Boolean);
      if (!question || options.length < 2) {
        toast("bc-feature-conversation-status", "Digite uma pergunta e pelo menos duas opções.");
        return;
      }
      insertComposer("📊 ENQUETE\n" + question + "\n" + options.map((option, index) => (index + 1) + ". " + option).join("\n"), "bc-feature-conversation-status");
    });

    qs("#bc-feature-thread-button").addEventListener("click", () => {
      const subject = qs("#bc-feature-thread").value.trim();
      if (!subject) {
        toast("bc-feature-conversation-status", "Digite um assunto para a thread.");
        return;
      }
      insertComposer("🧵 THREAD: " + subject + "\nResponda nesta conversa para manter o assunto organizado.", "bc-feature-conversation-status");
    });

    qs("#bc-feature-draft-button").addEventListener("click", () => {
      const input = findComposer();
      if (!input || !input.value.trim()) {
        toast("bc-feature-conversation-status", "Escreva uma mensagem no campo do canal antes de salvar.");
        return;
      }
      store.set(draftKey(), input.value);
      toast("bc-feature-conversation-status", "Rascunho salvo neste dispositivo.");
    });

    const notificationToggle = qs("#bc-feature-notifications");
    notificationToggle.checked = store.get("brasilcord-notifications", "false") === "true";
    notificationToggle.addEventListener("change", async () => {
      if (notificationToggle.checked && "Notification" in window && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch (_) {}
      }
      const granted = !("Notification" in window) || Notification.permission === "granted";
      notificationToggle.checked = notificationToggle.checked && granted;
      store.set("brasilcord-notifications", String(notificationToggle.checked));
      toast("bc-feature-conversation-status", notificationToggle.checked ? "Notificações ativadas." : "Notificações não autorizadas ou pausadas.");
    });

    const wireExisting = () => {
      qsa("[data-existing-call]").forEach((button) => {
        button.addEventListener("click", () => {
          const target = document.querySelector(button.dataset.existingCall);
          if (target) {
            target.click();
            closeDialog();
          } else {
            toast("bc-feature-calls-status", "Esse controle aparece quando a call está disponível.");
            toast("bc-feature-community-status", "Esse controle aparece para administradores ou quando a comunidade está pronta.");
          }
        });
      });
    };
    wireExisting();

    const linkToggle = (inputId, selectors, key, statusId) => {
      const input = qs("#" + inputId);
      input.checked = store.get(key, "false") === "true";
      input.addEventListener("change", () => {
        store.set(key, String(input.checked));
        const target = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
        if (target && target.type === "checkbox" && target.checked !== input.checked) {
          target.checked = input.checked;
          target.dispatchEvent(new Event("change", { bubbles: true }));
        }
        toast(statusId, input.checked ? "Ativado para esta conta neste dispositivo." : "Pausado.");
      });
    };

    linkToggle("bc-feature-noise", ["#bc-call-noise-suppression"], "brasilcord-noise-suppression", "bc-feature-calls-status");
    linkToggle("bc-feature-echo", ["#bc-call-echo-cancellation"], "brasilcord-echo-cancellation", "bc-feature-calls-status");
    linkToggle("bc-feature-gain", ["#bc-call-auto-gain"], "brasilcord-auto-gain", "bc-feature-calls-status");
    linkToggle("bc-feature-hand", [], "brasilcord-call-hand", "bc-feature-calls-status");
    linkToggle("bc-feature-captions", [], "brasilcord-call-captions", "bc-feature-calls-status");
    linkToggle("bc-feature-ping", [], "brasilcord-call-ping", "bc-feature-calls-status");
    linkToggle("bc-feature-automod-spam", [], "brasilcord-automod-spam", "bc-feature-community-status");
    linkToggle("bc-feature-automod-links", [], "brasilcord-automod-links", "bc-feature-community-status");
    linkToggle("bc-feature-audit", [], "brasilcord-audit-log", "bc-feature-community-status");
    linkToggle("bc-feature-low-data", [], "brasilcord-low-data", "bc-feature-discover-status");
    linkToggle("bc-feature-login-alerts", [], "brasilcord-login-alerts", "bc-feature-security-status-text");
    linkToggle("bc-feature-confirm-actions", [], "brasilcord-confirm-actions", "bc-feature-security-status-text");
    linkToggle("bc-feature-safe-content", [], "brasilcord-safe-content", "bc-feature-security-status-text");

    const eventsKey = "brasilcord-community-events";
    const renderEvents = () => {
      const container = qs("#bc-feature-event-list");
      const events = store.json(eventsKey, []);
      container.innerHTML = events.length ? events.map((event, index) => `
        <div class="bc-feature-list-item"><span><strong>📅 ${event.name}</strong><small>${event.date || "Data a confirmar"}</small></span><button class="bc-feature-action" type="button" data-event-index="${index}">Remover</button></div>`).join("") : "<span class='bc-feature-event-empty'>Nenhum evento salvo neste dispositivo.</span>";
      qsa("[data-event-index]", container).forEach((button) => button.addEventListener("click", () => {
        const next = store.json(eventsKey, []).filter((_, index) => index !== Number(button.dataset.eventIndex));
        store.set(eventsKey, JSON.stringify(next));
        renderEvents();
      }));
    };
    renderEvents();
    qs("#bc-feature-event-add").addEventListener("click", () => {
      const name = qs("#bc-feature-event-name").value.trim();
      const date = qs("#bc-feature-event-date").value;
      if (!name) {
        toast("bc-feature-community-status", "Digite o nome do evento.");
        return;
      }
      const events = store.json(eventsKey, []);
      events.push({ name, date: date ? new Date(date).toLocaleString("pt-BR") : "" });
      store.set(eventsKey, JSON.stringify(events.slice(-8)));
      qs("#bc-feature-event-name").value = "";
      renderEvents();
      toast("bc-feature-community-status", "Evento salvo neste dispositivo.");
    });

    qs("#bc-feature-discovery-button").addEventListener("click", () => {
      const query = qs("#bc-feature-discovery-search").value.trim().toLowerCase();
      const source = Array.from(document.querySelectorAll("#bc-platform-communities button, #bc-platform-channel-list button, #bc-platform-voice-list button"));
      const results = source.filter((item) => !query || item.textContent.toLowerCase().includes(query)).slice(0, 12);
      qs("#bc-feature-discovery-results").innerHTML = results.length
        ? results.map((item) => "<div class='bc-feature-list-item'><span><strong>🇧🇷 " + item.textContent.trim() + "</strong><small>Espaço carregado na sua conta</small></span><span>›</span></div>").join("")
        : "<span class='bc-feature-event-empty'>Nenhum resultado carregado. Tente outro termo ou crie uma comunidade.</span>";
      toast("bc-feature-discover-status", results.length + " resultado(s) encontrado(s).");
    });

    qs("#bc-feature-brazil-tags").addEventListener("click", () => {
      const input = document.querySelector("#bc-profile-bio, #bc-user-bio, textarea[name='bio']");
      if (input) {
        input.value = (input.value ? input.value + " " : "") + "🇧🇷 comunidade brasileira";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      toast("bc-feature-discover-status", "Tag brasileira preparada no seu perfil.");
    });

    const statusInput = qs("#bc-feature-status-text");
    statusInput.value = store.get("brasilcord-custom-status", "");
    qs("#bc-feature-status-save").addEventListener("click", () => {
      const value = statusInput.value.trim();
      store.set("brasilcord-custom-status", value);
      const dock = document.querySelector("#bc-dock-personal-status");
      if (dock && value) dock.textContent = value;
      toast("bc-feature-identity-status", value ? "Status personalizado salvo." : "Status limpo.");
    });

    qs("#bc-feature-density").addEventListener("click", () => {
      const button = document.querySelector("#bc-app-settings-button, #bc-account-quick-settings");
      if (button) button.click();
      toast("bc-feature-identity-status", "Use Densidade da interface nas configurações rápidas.");
    });

    qs("#bc-feature-session").addEventListener("click", () => {
      const session = store.get("brasilcord-session", "");
      toast("bc-feature-security-status-text", session ? "Sessão salva encontrada neste dispositivo." : "A sessão é gerenciada pelo login seguro.");
    });

    qs("#bc-feature-security-status").addEventListener("click", () => {
      toast("bc-feature-security-status-text", "Proteções locais ativas; 2FA e revogação de sessões dependem do backend.");
    });

    qs("#bc-feature-logout").addEventListener("click", () => {
      const logout = document.querySelector("#logout-button, #bc-logout, [data-action='logout']");
      if (logout) logout.click();
      else toast("bc-feature-security-status-text", "Use o menu da sua conta para sair com segurança.");
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
