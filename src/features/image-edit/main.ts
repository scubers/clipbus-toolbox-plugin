import { createApp } from "vue";
import { patchConsole, patchTextInputState } from "@pasty/plugin-sdk/dom";
import ImageEditApp from "./app.vue";
import "../../shared/base.css";

patchConsole();
patchTextInputState();
createApp(ImageEditApp).mount("#app");
