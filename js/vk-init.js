(function () {
  const params = new URLSearchParams(window.location.search);
  const referrerHost = (() => {
    try {
      return document.referrer ? new URL(document.referrer).hostname : "";
    } catch (error) {
      return "";
    }
  })();

  const isVkContainer =
    params.has("vk_app_id") ||
    params.has("api_id") ||
    params.has("viewer_id") ||
    /(^|\.)vk\.com$/i.test(referrerHost);

  if (!isVkContainer) {
    return;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initVkBridge() {
    if (!window.vkBridge || typeof window.vkBridge.send !== "function") {
      await loadScript("https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js");
    }

    if (window.vkBridge && typeof window.vkBridge.send === "function") {
      await window.vkBridge.send("VKWebAppInit");
      return true;
    }

    return false;
  }

  async function initLegacyVkApi() {
    if (!window.VK || typeof window.VK.init !== "function") {
      await loadScript("https://vk.com/js/api/xd_connection.js?2");
    }

    if (window.VK && typeof window.VK.init === "function") {
      window.VK.init(
        () => {},
        () => {},
        "5.199"
      );
      return true;
    }

    return false;
  }

  window.addEventListener("load", () => {
    Promise.allSettled([initVkBridge(), initLegacyVkApi()]).then((results) => {
      if (results.every((result) => result.status === "rejected")) {
        console.warn("VK init failed.", results.map((result) => result.reason));
      }
    });
  });
})();
