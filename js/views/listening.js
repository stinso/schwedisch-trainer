import { h } from "../ui.js";
export function render(root) {
  root.append(h("div", { class: "card" }, "Kommt gleich."));
}
