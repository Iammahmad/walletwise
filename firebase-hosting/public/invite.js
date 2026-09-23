"use strict";

const token = location.pathname.split("/").filter(Boolean).at(-1) || "";
const openApp = document.querySelector("#open-app");
if (openApp instanceof HTMLAnchorElement) {
  openApp.href = `walletwise://invite/${encodeURIComponent(token)}`;
}
