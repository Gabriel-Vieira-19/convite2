"use strict";

(function () {
  const invites = window.INVITATION_LINKS;

  if (!invites) {
    return;
  }

  const baseUrl = new URL("../", window.location.href);
  baseUrl.search = "";
  baseUrl.hash = "";

  function buildInviteUrl(invite) {
    const url = new URL(baseUrl.href);
    url.searchParams.set("convite", invite.id);
    return url.toString();
  }

  const links = {
    family: buildInviteUrl(invites.family),
    friend: buildInviteUrl(invites.friend)
  };

  const familyInput = document.querySelector("#family-link");
  const friendInput = document.querySelector("#friend-link");
  const toast = document.querySelector("#manager-toast");

  if (familyInput) {
    familyInput.value = links.family;
  }

  if (friendInput) {
    friendInput.value = links.friend;
  }

  document.querySelectorAll("[data-open]").forEach(link => {
    const type = link.dataset.open;

    if (links[type]) {
      link.href = links[type];
    }
  });

  function showToast(message) {
    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timeout);

    showToast.timeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2200);
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      const textarea = document.createElement("textarea");

      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.select();

      let copied = false;

      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }

      textarea.remove();
      return copied;
    }
  }

  document.querySelectorAll("[data-copy]").forEach(button => {
    button.addEventListener("click", async () => {
      const type = button.dataset.copy;
      const value = links[type];

      if (!value) {
        return;
      }

      const copied = await copyText(value);

      showToast(
        copied
          ? "Link copiado!"
          : "Não foi possível copiar o link."
      );
    });
  });
})();
