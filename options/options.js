/**
 * Única opción: la esquina del widget. Va en chrome.storage.sync, así sigue
 * al usuario entre sus navegadores, y se guarda al cambiarla.
 */
const corner = document.getElementById("corner");
const saved = document.getElementById("saved");

corner.addEventListener("change", async () => {
  try {
    await chrome.storage.sync.set({ pillCorner: corner.value });
    saved.textContent = "Guardado";
  } catch (error) {
    saved.textContent = `No se pudo guardar: ${error.message}`;
  }
  setTimeout(() => (saved.textContent = ""), 2000);
});

(async () => {
  ({ pillCorner: corner.value } = await chrome.storage.sync.get({ pillCorner: "top-right" }));
})();
