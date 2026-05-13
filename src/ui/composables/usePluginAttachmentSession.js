import { computed, onMounted, onUnmounted, reactive, readonly } from "vue";
import { pasty } from "@pasty/plugin-sdk/ui";

function safeParsePayload(payloadJson) {
  try {
    return JSON.parse(payloadJson || "{}");
  } catch {
    return null;
  }
}

export function usePluginAttachmentSession() {
  const state = reactive({
    session: null,
    item: null,
    attachment: null,
    searchTerms: [],
    accentHex: null
  });

  function applyItem(item) {
    if (item) state.item = item;
  }

  function applyAttachment(attachment) {
    if (attachment) state.attachment = attachment;
  }

  function applyFromCurrentBootstrap() {
    const item = pasty.item.current();
    const attachment = pasty.item.attachment.current();
    if (item?.id) state.item = item;
    if (attachment) state.attachment = attachment;
    if (item?.id || attachment) state.session = { item, attachment };
    return !!(item?.id);
  }

  // Initialize from current bootstrap state
  applyFromCurrentBootstrap();

  let unsubItem = null;
  let unsubAttachment = null;
  let unsubSearch = null;
  let unsubTheme = null;

  onMounted(() => {
    applyFromCurrentBootstrap();

    unsubItem = pasty.item.on((item) => {
      state.item = item;
      state.session = { item, attachment: state.attachment };
    });

    unsubAttachment = pasty.item.attachment.on((attachment) => {
      state.attachment = attachment;
      state.session = { item: state.item, attachment };
    });

    unsubSearch = pasty.item.search.on((terms) => {
      state.searchTerms = Array.isArray(terms) ? terms : [];
    });

    unsubTheme = pasty.theme.on((snapshot) => {
      state.accentHex = snapshot?.tokens?.["--pasty-accent"] ?? null;
    });
  });

  onUnmounted(() => {
    if (unsubItem) { unsubItem(); unsubItem = null; }
    if (unsubAttachment) { unsubAttachment(); unsubAttachment = null; }
    if (unsubSearch) { unsubSearch(); unsubSearch = null; }
    if (unsubTheme) { unsubTheme(); unsubTheme = null; }
  });

  const payload = computed(() => safeParsePayload(state.attachment?.payloadJson));
  const actions = computed(() => state.session?.buttons ?? state.attachment?.buttons ?? []);

  return {
    actions,
    payload,
    session: readonly(state),
    invokeAction: (buttonID, params) => pasty.item.attachment.invoke(buttonID, params ?? {})
  };
}
