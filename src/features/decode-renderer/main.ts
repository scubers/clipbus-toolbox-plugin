import { createApp } from "vue";
import { patchConsole, patchTextInputState } from "@clipbus/plugin-sdk/dom";
import DecodeRendererApp from "./app.vue";
import "../../shared/base.css";

patchConsole();
patchTextInputState();
createApp(DecodeRendererApp).mount("#app");
