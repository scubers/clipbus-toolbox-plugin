import { createApp } from "vue";
import { pasty } from "@pasty/plugin-sdk/ui";
import AttachmentDecodeApp from "../../AttachmentDecodeApp.vue";
import "../../shared/base.css";

pasty.ready().then(() => {
  createApp(AttachmentDecodeApp).mount("#app");
});
