"use strict";

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

const CONFIG = {
  celebrant: "Pedro",

  dateLabel: "26 DE DEZEMBRO",
  dateISO: "2026-12-26T20:00:00-03:00",

  endISO: "2026-12-27T01:00:00-03:00",

  timeLabel: "20:00",

  locationName: "Patrulha Juvenil de Garça",

  locationAddress:
    "R. Baden Powell, 451 - Williams, Garça - SP, 17402-066",

  mapsQuery:
    "R. Baden Powell, 451 - Williams, Garça - SP, 17402-066",

  confirmationDeadline:
    "2026-12-10T23:59:59-03:00",

  maxGuests: 15,

  apiEndpoint:
    "https://script.google.com/macros/s/AKfycbwNFII405swt7PMhsdNrY9dLeZtOssAJ5wYhTIJZJIvpkN7Mr4_7RXLt09v7xc976JMAQ/exec"
};

const INVITATIONS = window.INVITATION_LINKS || null;


/* =========================================================
   ESTADO
========================================================= */

const state = {
  responsible: "",
  quantity: 1,
  names: [],
  token: null,
  editing: false,
  inviteId: null,
  inviteType: null,
  maxGuests: CONFIG.maxGuests
};


/* =========================================================
   HELPERS DOM
========================================================= */

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}


/* =========================================================
   HELPERS GERAIS
========================================================= */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  const toast = $("#toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timeout);

  showToast.timeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function isConfirmationDeadlinePassed() {
  return new Date() > new Date(CONFIG.confirmationDeadline);
}

function isApiConfigured() {
  try {
    const url = new URL(CONFIG.apiEndpoint);

    return (
      url.protocol === "https:" &&
      url.hostname === "script.google.com" &&
      url.pathname.includes("/macros/s/")
    );
  } catch {
    return false;
  }
}


/* =========================================================
   LOCAL STORAGE
========================================================= */

const STORAGE_KEY = "convite18_token";

function getSavedToken() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveToken(token) {
  if (!token) {
    return;
  }

  state.token = String(token);

  try {
    localStorage.setItem(
      STORAGE_KEY,
      state.token
    );
  } catch {
    // O funcionamento principal continua mesmo
    // se o navegador bloquear localStorage.
  }
}

function removeSavedToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignora erros de armazenamento.
  }

  state.token = null;
}


/* =========================================================
   TOKEN
========================================================= */

function generateToken() {
  const bytes = new Uint8Array(24);

  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getTokenFromHash() {
  const hash = window.location.hash;

  if (!hash.startsWith("#confirmacao=")) {
    return null;
  }

  const rawToken = hash.substring(
    "#confirmacao=".length
  );

  if (!rawToken) {
    return null;
  }

  try {
    return decodeURIComponent(rawToken);
  } catch {
    return rawToken;
  }
}

function removeConfirmationHash() {
  if (!window.location.hash) {
    return;
  }

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`
  );
}

function getInviteIdFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryInvite = params.get("convite");

    if (queryInvite) {
      return queryInvite.trim();
    }
  } catch {
    // Continua tentando pelo hash.
  }

  const hash = window.location.hash;

  if (hash.startsWith("#convite=")) {
    const rawInvite = hash.substring("#convite=".length);

    if (!rawInvite) {
      return null;
    }

    try {
      return decodeURIComponent(rawInvite).trim();
    } catch {
      return rawInvite.trim();
    }
  }

  return null;
}

function getInvitationRuleById(inviteId) {
  if (!inviteId || !INVITATIONS) {
    return null;
  }

  const definitions = [
    INVITATIONS.family,
    INVITATIONS.friend
  ].filter(Boolean);

  const definition =
    definitions.find(item => item.id === inviteId);

  if (!definition) {
    return null;
  }

  return {
    inviteId: definition.id,
    type: definition.type,
    maxGuests: definition.maxGuests
  };
}

function hydrateInvitationContext() {
  const inviteId = getInviteIdFromUrl();
  const rule = getInvitationRuleById(inviteId);
  const info = $("#invite-info");

  state.inviteId = rule ? rule.inviteId : null;
  state.inviteType = rule ? rule.type : null;
  state.maxGuests = rule ? rule.maxGuests : CONFIG.maxGuests;

  if (info) {
    if (rule && rule.type === "amigo") {
      info.textContent =
        "Este convite é individual e é válido somente para 1 participante.";
    } else if (rule && rule.type === "familia") {
      info.textContent =
        "Este convite é familiar e permite até 15 participantes.";
    } else {
      info.textContent = "";
    }
  }

  updateInvitationInterface();

  return Boolean(rule);
}

function updateInvitationInterface() {
  const limit = $("#quantity-limit");
  const notice = $("#quantity-notice");

  const responsibleTitle = $("#responsible-title");
  const responsibleDescription = $("#responsible-description");
  const responsibleLabel = $("#responsible-label");
  const responsibleInput = $("#responsible-input");

  const reviewResponsibleLabel = $("#review-responsible-label");
  const confirmedResponsibleLabel = $("#confirmed-responsible-label");

  const progressDetails = $("#progress-details");
  const progressResponsible = $("#progress-responsible");
  const progressQuantity = $("#progress-quantity");
  const progressNames = $("#progress-names");
  const progressReview = $("#progress-review");

  const isFriendInvite = state.inviteType === "amigo";

  if (limit) {
    limit.textContent =
      state.maxGuests === 1
        ? "Máximo de 1 participante"
        : `Máximo de ${state.maxGuests} participantes`;
  }

  if (notice) {
    notice.textContent =
      isFriendInvite
        ? "Este convite é individual e destinado somente a você."
        : "O responsável pela confirmação também deve ser incluído na quantidade de participantes.";
  }

  /*
   * O backend continua usando o campo "responsible" internamente,
   * mas o convidado individual não precisa conhecer esse conceito.
   * A interface usa uma linguagem pessoal e direta.
   */
  if (responsibleTitle) {
    responsibleTitle.textContent =
      isFriendInvite
        ? "Qual é o seu nome?"
        : "Quem está confirmando?";
  }

  if (responsibleDescription) {
    responsibleDescription.textContent =
      isFriendInvite
        ? "Informe seu nome para confirmar sua presença."
        : "Informe o nome do responsável pela confirmação.";
  }

  if (responsibleLabel) {
    responsibleLabel.textContent =
      isFriendInvite
        ? "SEU NOME"
        : "NOME DO RESPONSÁVEL";
  }

  if (responsibleInput) {
    responsibleInput.placeholder =
      isFriendInvite
        ? "Digite seu nome"
        : "Digite o nome do responsável";
  }

  if (reviewResponsibleLabel) {
    reviewResponsibleLabel.textContent =
      isFriendInvite
        ? "CONVIDADO"
        : "CASA DE";
  }

  if (confirmedResponsibleLabel) {
    confirmedResponsibleLabel.textContent =
      isFriendInvite
        ? "CONVIDADO"
        : "CASA DE";
  }

  /*
   * O convite individual elimina a etapa de quantidade/participantes.
   * Por isso, o contador visual passa de 4 para 3 etapas:
   * detalhes → nome → revisão.
   */
  if (isFriendInvite) {
    if (progressDetails) progressDetails.textContent = "1 DE 3";
    if (progressResponsible) progressResponsible.textContent = "2 DE 3";
    if (progressQuantity) progressQuantity.textContent = "";
    if (progressNames) progressNames.textContent = "";
    if (progressReview) progressReview.textContent = "3 DE 3";
  } else {
    if (progressDetails) progressDetails.textContent = "1 DE 4";
    if (progressResponsible) progressResponsible.textContent = "2 DE 4";
    if (progressQuantity) progressQuantity.textContent = "3 DE 4";
    if (progressNames) progressNames.textContent = "4 DE 4";
    if (progressReview) progressReview.textContent = "4 DE 4";
  }
}


/* =========================================================
   CONFIGURAÇÃO DO EVENTO NO DOM
========================================================= */

function hydrateEvent() {
  const eventDate = $("#event-date");
  const eventTime = $("#event-time");
  const eventLocation = $("#event-location");

  const detailsLocation = $("#details-location");
  const detailsAddress = $("#details-address");

  const reviewDate = $("#review-date");
  const reviewTime = $("#review-time");
  const reviewLocation = $("#review-location");

  const closedLocation = $("#closed-location");
  const closedAddress = $("#closed-address");

  if (eventDate) {
    eventDate.textContent = formatDate(CONFIG.dateISO);
  }

  if (eventTime) {
    eventTime.textContent = CONFIG.timeLabel;
  }

  if (eventLocation) {
    eventLocation.textContent = CONFIG.locationName;
  }

  if (detailsLocation) {
    detailsLocation.textContent = CONFIG.locationName;
  }

  if (detailsAddress) {
    detailsAddress.textContent = CONFIG.locationAddress;
  }

  if (reviewDate) {
    reviewDate.textContent = formatDate(CONFIG.dateISO);
  }

  if (reviewTime) {
    reviewTime.textContent = CONFIG.timeLabel;
  }

  if (reviewLocation) {
    reviewLocation.textContent = CONFIG.locationName;
  }

  if (closedLocation) {
    closedLocation.textContent = CONFIG.locationName;
  }

  if (closedAddress) {
    closedAddress.textContent = CONFIG.locationAddress;
  }
}

function formatDate(isoString) {
  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  );
}


/* =========================================================
   NAVEGAÇÃO
========================================================= */

function showScreen(screenName) {
  const screens = $all(".screen");

  screens.forEach(screen => {
    screen.classList.toggle(
      "active",
      screen.dataset.screen === screenName
    );
  });

  window.scrollTo(0, 0);
}

function setupNavigation() {
  $all("[data-next]").forEach(button => {
    button.addEventListener("click", () => {
      const nextScreen = button.dataset.next;

      if (nextScreen === "responsible") {
        if (!state.inviteType && !getTokenFromHash() && !getSavedToken()) {
          showToast("Abra o convite usando o link recebido.");
          return;
        }

        showScreen("responsible");
        return;
      }

      if (nextScreen === "quantity") {
        if (!validateResponsible()) {
          return;
        }

        if (state.inviteType === "amigo") {
          state.quantity = 1;
          state.names = [state.responsible];
          renderReview();
          showScreen("review");
          return;
        }

        showScreen("quantity");
        return;
      }

      if (nextScreen === "names") {
        renderNames();
        showScreen("names");
        return;
      }

      if (nextScreen === "review") {
        readNames();

        if (!validateNames()) {
          return;
        }

        renderReview();
        showScreen("review");
        return;
      }

      showScreen(nextScreen);
    });
  });

  $all("[data-back]").forEach(button => {
    button.addEventListener("click", () => {
      const previousScreen = button.dataset.back;

      if (previousScreen === "details") {
        showScreen("details");
        return;
      }

      if (previousScreen === "responsible") {
        showScreen("responsible");
        return;
      }

      if (previousScreen === "quantity") {
        readNames();
        showScreen("quantity");
        return;
      }

      if (previousScreen === "names") {
        if (state.inviteType === "amigo") {
          showScreen("responsible");
          return;
        }

        readNames();
        renderNames();
        showScreen("names");
        return;
      }

      showScreen(previousScreen);
    });
  });

  const openButton = $("#open-invitation-button");

  if (openButton) {
    openButton.addEventListener(
      "click",
      openInvitationTransition
    );
  }
}


/* =========================================================
   TRANSIÇÃO — ABRIR CONVITE
========================================================= */

let openingTransitionRunning = false;

function openInvitationTransition() {
  if (openingTransitionRunning) {
    return;
  }

  const opening = $('[data-screen="opening"]');
  const presentation = $('[data-screen="presentation"]');
  const button = $("#open-invitation-button");
  const rightPanel = opening
    ? opening.querySelector(".opening-panel-right")
    : null;

  if (!opening || !presentation) {
    showScreen("presentation");
    return;
  }

  openingTransitionRunning = true;

  if (button) {
    button.disabled = true;
  }

  presentation.classList.add(
    "active",
    "presentation-screen-prep"
  );

  let finished = false;
  let fallbackTimer = null;

  const finishTransition = () => {
    if (finished) {
      return;
    }

    finished = true;

    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
    }

    if (rightPanel) {
      rightPanel.removeEventListener(
        "transitionend",
        handlePanelTransitionEnd
      );
    }

    opening.classList.remove(
      "active",
      "opening-is-opening",
      "opening-ready"
    );

    presentation.classList.remove(
      "presentation-screen-prep",
      "presentation-screen-revealed"
    );

    if (button) {
      button.disabled = false;
    }

    openingTransitionRunning = false;
    window.scrollTo(0, 0);
  };

  const handlePanelTransitionEnd = event => {
    if (event.propertyName === "transform") {
      finishTransition();
    }
  };

  if (rightPanel) {
    rightPanel.addEventListener(
      "transitionend",
      handlePanelTransitionEnd
    );
  }

  /*
   * Dois frames garantem que a apresentação seja renderizada
   * no estado inicial antes de a animação começar. Isso evita
   * que o navegador pule diretamente para o estado final.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      presentation.classList.add(
        "presentation-screen-revealed"
      );

      opening.classList.add(
        "opening-is-opening"
      );
    });
  });

  /*
   * Fallback apenas para navegadores que não disparem
   * transitionend. O tempo é propositalmente maior que
   * a duração visual completa definida no CSS.
   */
  fallbackTimer = window.setTimeout(
    finishTransition,
    3400
  );
}



/* =========================================================
   RESPONSÁVEL
========================================================= */

function validateResponsible() {
  const input = $("#responsible-input");
  const error = $("#responsible-error");

  if (!input) {
    return false;
  }

  const value = input.value.trim();

  if (!value) {
    if (error) {
      error.textContent =
        state.inviteType === "amigo"
          ? "Informe seu nome."
          : "Informe o nome do responsável.";
    }

    input.focus();

    return false;
  }

  if (value.length < 2) {
    if (error) {
      error.textContent =
        "Informe um nome válido.";
    }

    input.focus();

    return false;
  }

  state.responsible = value;

  if (!state.inviteType && !state.editing) {
    if (error) {
      error.textContent =
        "Use o link recebido para acessar este convite.";
    }

    return false;
  }

  if (state.inviteType === "amigo") {
    state.quantity = 1;
    state.names = [state.responsible];
  }

  if (error) {
    error.textContent = "";
  }

  return true;
}

function setupResponsible() {
  const input = $("#responsible-input");

  if (!input) {
    return;
  }

  input.addEventListener("input", () => {
    state.responsible = input.value.trim();

    const error = $("#responsible-error");

    if (error) {
      error.textContent = "";
    }
  });
}


/* =========================================================
   QUANTIDADE
========================================================= */

function updateQuantityDisplay() {
  const quantityElement = $("#quantity");

  if (quantityElement) {
    quantityElement.textContent = String(
      state.quantity
    );
  }

  updateInvitationInterface();
}

function setupQuantity() {
  const minus = $("#minus");
  const plus = $("#plus");

  if (minus) {
    minus.addEventListener("click", () => {

      readNames();

      if (state.quantity <= 1) {
        return;
      }

      state.quantity -= 1;

      state.names = state.names
        .slice(0, state.quantity);

      updateQuantityDisplay();
      renderNames();
    });
  }

  if (plus) {
    plus.addEventListener("click", () => {

      if (state.quantity >= state.maxGuests) {
        showToast(
          `O limite é de ${state.maxGuests} participantes.`
        );

        return;
      }

      readNames();

      state.quantity += 1;

      renderNames();
      updateQuantityDisplay();
    });
  }

  updateQuantityDisplay();
}


/* =========================================================
   NOMES
========================================================= */

function renderNames() {
  const container = $("#names-container");

  if (!container) {
    return;
  }

  const oldNames = state.names.slice();

  container.innerHTML = "";

  for (let index = 0; index < state.quantity; index++) {
    const wrapper = document.createElement("div");
    wrapper.className = "name-input-group";

    const label = document.createElement("label");
    label.className = "name-input-label";
    label.textContent =
      index === 0
        ? "PARTICIPANTE 1 — RESPONSÁVEL"
        : `PARTICIPANTE ${index + 1}`;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "participant-input";
    input.maxLength = 100;
    input.autocomplete = "off";

    if (index === 0) {
      input.value = state.responsible;
      input.readOnly = true;
      input.classList.add("participant-responsible");
    } else {
      input.placeholder = `Nome do participante ${index + 1}`;

      if (oldNames[index]) {
        input.value = oldNames[index];
      }

      input.addEventListener("input", () => {
        state.names[index] = input.value;
      });
    }

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
  }

  state.names[0] = state.responsible.trim();
}

function readNames() {
  const inputs = $all(".participant-input");

  state.names = inputs.map((input, index) => {
    if (index === 0) {
      return state.responsible.trim();
    }

    return input.value.trim();
  });
}


function validateNames() {
  readNames();

  const error = $("#names-error");

  if (state.quantity > state.maxGuests) {
    if (error) {
      error.textContent =
        `Este convite permite no máximo ${state.maxGuests} participantes.`;
    }

    return false;
  }

  state.names[0] = state.responsible.trim();

  if (
    state.names.length !==
    state.quantity
  ) {
    if (error) {
      error.textContent =
        "Confira a quantidade de participantes.";
    }

    return false;
  }

  const hasEmptyName =
    state.names.some(name => !name);

  if (hasEmptyName) {
    if (error) {
      error.textContent =
        "Preencha o nome de todos os participantes.";
    }

    return false;
  }

  if (error) {
    error.textContent = "";
  }

  return true;
}



/* =========================================================
   LISTA DE PARTICIPANTES
========================================================= */

function renderParticipantList(
  element,
  names
) {
  if (!element) {
    return;
  }

  element.innerHTML = names
    .map(
      name => `
        <li class="review-participant">
          <span class="review-participant-bullet">•</span>
          <span class="review-participant-name">
            ${escapeHtml(name)}
          </span>
        </li>
      `
    )
    .join("");
}


/* =========================================================
   REVISÃO
========================================================= */

function renderReview() {
  const responsible =
    $("#review-responsible");

  const count =
    $("#review-count");

  const names =
    $("#review-names");

  if (responsible) {
    responsible.textContent =
      state.responsible;
  }

  if (count) {
    count.textContent =
      `${state.quantity} ${
        state.quantity === 1
          ? "participante"
          : "participantes"
      }`;
  }

  renderParticipantList(
    names,
    state.names
  );
}


/* =========================================================
   API — SALVAR
========================================================= */

async function saveConfirmation() {

  if (!isApiConfigured()) {
    throw new Error(
      "O endereço da API não está configurado corretamente."
    );
  }

  if (isConfirmationDeadlinePassed()) {
    throw new Error(
      "O prazo para confirmação ou alteração terminou."
    );
  }

  if (!state.token) {
    state.token = generateToken();
  }

  if (!state.inviteId && !state.editing) {
    throw new Error(
      "O convite não foi identificado corretamente. Use o link recebido."
    );
  }

  const payload = {
    token: state.token,
    inviteId: state.inviteId,
    inviteType: state.inviteType,
    responsible: state.responsible,
    quantity: state.quantity,
    participants: state.names
  };

  const response = await fetch(
    CONFIG.apiEndpoint,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "text/plain;charset=utf-8"
      },

      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    throw new Error(
      `Erro HTTP ${response.status}.`
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (!result.success) {
    throw new Error(
      result.error ||
      "Não foi possível salvar a confirmação."
    );
  }

  /*
   * O token só é salvo no localStorage
   * depois que o Google Apps Script confirma
   * que o registro foi criado/atualizado.
   */
  saveToken(
    result.token || state.token
  );

  return result;
}


/* =========================================================
   API — CARREGAR
========================================================= */

async function loadConfirmationByToken(
  token
) {

  if (!isApiConfigured()) {
    throw new Error(
      "O endereço da API não está configurado corretamente."
    );
  }

  const url =
    `${CONFIG.apiEndpoint}?token=` +
    encodeURIComponent(token);

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Erro HTTP ${response.status}.`
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (!result.success) {
    throw new Error(
      result.error ||
      "Confirmação não encontrada."
    );
  }

  return result.confirmation;
}


/* =========================================================
   APLICAR CONFIRMAÇÃO
========================================================= */

function applyConfirmation(
  confirmation
) {
  if (!confirmation) {
    return;
  }

  state.token =
    String(confirmation.token || "");

  state.responsible =
    String(
      confirmation.responsible || ""
    ).trim();

  const participants =
    Array.isArray(confirmation.participants)
      ? confirmation.participants
          .flatMap(name =>
            String(name)
              .split(/\s*,\s*|\r?\n+/)
              .map(item => item.trim())
              .filter(Boolean)
          )
      : [];

  state.names = participants;

  state.inviteId =
    String(confirmation.inviteId || "") || null;

  state.inviteType =
    String(confirmation.inviteType || "") || null;

  const returnedMax = Number(confirmation.maxGuests);

  state.maxGuests =
    Number.isInteger(returnedMax) && returnedMax >= 1
      ? Math.min(returnedMax, CONFIG.maxGuests)
      : state.inviteType === "amigo"
        ? 1
        : CONFIG.maxGuests;

  const receivedQuantity = Number(confirmation.quantity);

  if (
    Number.isInteger(receivedQuantity) &&
    receivedQuantity >= 1 &&
    receivedQuantity <= state.maxGuests
  ) {
    state.quantity = receivedQuantity;
  } else {
    state.quantity =
      Math.min(
        Math.max(participants.length, 1),
        state.maxGuests
      );
  }

  if (state.names.length !== state.quantity) {
    state.quantity =
      Math.min(
        Math.max(state.names.length, 1),
        state.maxGuests
      );
  }

  state.names[0] = state.responsible;
  state.editing = false;

  updateQuantityDisplay();
  updateInvitationInterface();
  renderConfirmed();
}



/* =========================================================
   CONFIRMAÇÃO
========================================================= */

function renderConfirmed() {
  const responsible =
    $("#confirmed-responsible");

  const count =
    $("#confirmed-count");

  const names =
    $("#confirmed-names");

  if (responsible) {
    responsible.textContent =
      state.responsible || "—";
  }

  if (count) {
    count.textContent =
      `${state.quantity} ${
        state.quantity === 1
          ? "participante"
          : "participantes"
      }`;
  }

  renderParticipantList(
    names,
    state.names
  );
}

async function handleConfirmation() {
  const button =
    $("#confirm-button");

  if (isConfirmationDeadlinePassed()) {
    showScreen("closed");

    return;
  }

  if (!validateResponsible()) {
    showScreen("responsible");

    return;
  }

  if (state.quantity > state.maxGuests) {
    showToast(
      `Este convite permite no máximo ${state.maxGuests} participantes.`
    );
    return;
  }

  if (!validateNames()) {
    showScreen("names");

    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "SALVANDO...";
  }

  try {

    const result =
      await saveConfirmation();

    state.editing = false;

    renderConfirmed();

    const message =
      $("#confirmed-message");

    if (message) {
      if (result.action === "updated") {
        message.textContent =
          "Sua confirmação foi atualizada com sucesso.";
      } else {
        message.textContent =
          "Sua confirmação foi registrada com sucesso.";
      }
    }

    showScreen("confirmed");

    createConfetti();

    showToast(
      result.action === "updated"
        ? "Confirmação atualizada!"
        : "Presença confirmada!"
    );

  } catch (error) {

    console.error(
      "Erro ao salvar confirmação:",
      error
    );

    showToast(
      error.message ||
      "Não foi possível salvar a confirmação."
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent =
        "CONFIRMAR PRESENÇA";
    }
  }
}

function setupConfirmation() {
  const button =
    $("#confirm-button");

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    handleConfirmation
  );
}


/* =========================================================
   EDIÇÃO
========================================================= */

function setupEdit() {
  const button =
    $("#edit-confirmation");

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    () => {

      if (isConfirmationDeadlinePassed()) {
        showScreen("closed");

        return;
      }

      state.editing = true;

      const responsibleInput =
        $("#responsible-input");

      if (responsibleInput) {
        responsibleInput.value =
          state.responsible;
      }

      renderNames();

      showScreen("responsible");
    }
  );
}


/* =========================================================
   COPIAR LINK
========================================================= */

async function copyConfirmationLink() {

  if (!state.token) {
    showToast(
      "Sua confirmação ainda não possui um link."
    );

    return;
  }

  const inviteQuery = state.inviteId
    ? `?convite=${encodeURIComponent(state.inviteId)}`
    : "";

  const url =
    `${window.location.origin}` +
    `${window.location.pathname}` +
    `${inviteQuery}` +
    `#confirmacao=${encodeURIComponent(state.token)}`;

  try {

    await navigator.clipboard.writeText(
      url
    );

    showToast(
      "Link da confirmação copiado!"
    );

  } catch {

    const textarea =
      document.createElement("textarea");

    textarea.value = url;

    textarea.style.position =
      "fixed";

    textarea.style.opacity = "0";

    document.body.appendChild(
      textarea
    );

    textarea.select();

    try {
      document.execCommand(
        "copy"
      );

      showToast(
        "Link da confirmação copiado!"
      );
    } catch {
      showToast(
        "Não foi possível copiar o link."
      );
    }

    textarea.remove();
  }
}

function setupCopyLink() {
  const button =
    $("#copy-confirmation-link");

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    copyConfirmationLink
  );
}


/* =========================================================
   MAPAS
========================================================= */

function openMaps() {
  const query =
    encodeURIComponent(
      CONFIG.mapsQuery
    );

  const isIOS =
    /iPad|iPhone|iPod/.test(
      navigator.userAgent
    ) ||
    (
      navigator.platform ===
        "MacIntel" &&
      navigator.maxTouchPoints > 1
    );

  const url = isIOS
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;

  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );
}

function setupMaps() {
  const buttons = [
    $("#details-map"),
    $("#confirmed-map"),
    $("#closed-map")
  ].filter(Boolean);

  buttons.forEach(button => {
    button.addEventListener(
      "click",
      openMaps
    );
  });
}


/* =========================================================
   CONFETES
========================================================= */

function createConfetti() {
  const container =
    document.createElement("div");

  container.className =
    "confetti-container";

  const pieces = 90;

  for (
    let index = 0;
    index < pieces;
    index++
  ) {

    const piece =
      document.createElement("span");

    piece.className =
      "confetti-piece";

    piece.style.left =
      `${Math.random() * 100}%`;

    piece.style.animationDuration =
      `${2.5 + Math.random() * 2.5}s`;

    piece.style.animationDelay =
      `${Math.random() * 0.5}s`;

    piece.style.setProperty(
      "--drift",
      `${-120 + Math.random() * 240}`
    );

    /*
     * Cores definidas individualmente para
     * manter o visual do convite.
     */
    const colors = [
      "#d8b36a",
      "#ead39d",
      "#f5efdf",
      "#ffffff"
    ];

    piece.style.background =
      colors[
        Math.floor(
          Math.random() *
          colors.length
        )
      ];

    container.appendChild(piece);
  }

  document.body.appendChild(
    container
  );

  setTimeout(() => {
    container.remove();
  }, 6000);
}


/* =========================================================
   RESTAURAÇÃO DA CONFIRMAÇÃO
========================================================= */

async function tryRestoreConfirmation() {
  const hashToken = getTokenFromHash();
  const inviteId = getInviteIdFromUrl();

  if (hashToken) {
    try {
      const confirmation =
        await loadConfirmationByToken(hashToken);

      applyConfirmation(confirmation);

      saveToken(
        confirmation.token || hashToken
      );

      removeConfirmationHash();

      if (isConfirmationDeadlinePassed()) {
        showScreen("closed");
      } else {
        showScreen("confirmed");
      }

      return true;
    } catch (error) {
      console.warn(
        "Não foi possível restaurar a confirmação:",
        error
      );

      removeConfirmationHash();

      return false;
    }
  }

  /*
   * Quando existe um link de convite explícito,
   * ele tem prioridade sobre qualquer token salvo
   * anteriormente neste mesmo dispositivo.
   */
  if (inviteId) {
    const validInvite = hydrateInvitationContext();

    if (!validInvite) {
      showToast("Este link de convite não é válido.");
    }

    return false;
  }

  const savedToken = getSavedToken();

  if (!savedToken) {
    hydrateInvitationContext();
    return false;
  }

  try {
    const confirmation =
      await loadConfirmationByToken(savedToken);

    applyConfirmation(confirmation);

    saveToken(
      confirmation.token || savedToken
    );

    if (isConfirmationDeadlinePassed()) {
      showScreen("closed");
    } else {
      showScreen("confirmed");
    }

    return true;
  } catch (error) {
    console.warn(
      "Não foi possível restaurar a confirmação salva:",
      error
    );

    return false;
  }
}



/* =========================================================
   ABERTURA
========================================================= */

function setupOpeningAnimation() {
  const opening =
    $('[data-screen="opening"]');

  if (!opening) {
    return;
  }

  opening.classList.add("active");
  opening.classList.remove("opening-is-opening");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      opening.classList.add("opening-ready");
    });
  });
}


/* =========================================================
   PRAZO ENCERRADO
========================================================= */

function handleDeadline() {
  if (
    !isConfirmationDeadlinePassed()
  ) {
    return false;
  }

  const hashToken =
    getTokenFromHash();

  const savedToken =
    getSavedToken();

  /*
   * Mesmo após o prazo, uma confirmação
   * já existente pode ser visualizada.
   *
   * A restauração é feita antes de decidir
   * simplesmente mostrar a tela fechada.
   */
  if (
    hashToken ||
    savedToken
  ) {
    return false;
  }

  showScreen("closed");

  return true;
}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function init() {

  hydrateEvent();
  hydrateInvitationContext();

  setupOpeningAnimation();

  setupNavigation();

  setupResponsible();

  setupQuantity();

  setupConfirmation();

  setupEdit();

  setupCopyLink();

  setupMaps();

  /*
   * Primeiro tenta restaurar uma confirmação existente.
   */
  const restored =
    await tryRestoreConfirmation();

  /*
   * Se não houver confirmação restaurada
   * e o prazo já tiver passado, mostra
   * a tela de encerramento.
   */
  if (!restored) {
    handleDeadline();
  }
}


/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    init
  );
} else {
  init();
}