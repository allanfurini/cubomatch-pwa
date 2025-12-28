if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch (e) {
      // Se der erro, não trava o app
      console.log("SW erro:", e);
    }
  });
}

