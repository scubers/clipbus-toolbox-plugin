import { onMounted, onUnmounted, reactive, readonly } from "vue";
import { pasty } from "@pasty/plugin-sdk/ui";

export function usePluginActionSession() {
  const state = reactive({
    pluginID: "",
    actionID: "",
    action: null,
    item: null,
    displayName: null,
    draft: {},
    buttons: [],
    defaultButtonID: null
  });

  function applySession(session) {
    if (!session) return;
    state.pluginID = session.pluginID || "";
    state.actionID = session.actionID || "";
    state.item = session.item || null;
    state.displayName = session.displayName || null;
    state.draft = session.draft || {};
    state.buttons = session.buttons || [];
    state.defaultButtonID = session.defaultButtonID || null;
  }

  function applyDraft(draft) {
    if (draft != null) state.draft = draft;
  }

  // Initialize from current bootstrap state
  applySession(pasty.action.current());
  applyDraft(pasty.action.draft.current());

  let unsubAction = null;
  let unsubDraft = null;

  onMounted(() => {
    applySession(pasty.action.current());
    applyDraft(pasty.action.draft.current());

    unsubAction = pasty.action.on((session) => {
      applySession(session);
    });

    unsubDraft = pasty.action.draft.on((draft) => {
      applyDraft(draft);
    });
  });

  onUnmounted(() => {
    if (unsubAction) { unsubAction(); unsubAction = null; }
    if (unsubDraft) { unsubDraft(); unsubDraft = null; }
  });

  return {
    session: readonly(state),
    syncDraft(updateDraft) {
      state.draft = { ...updateDraft };
      pasty.action.draft.update({
        draft: state.draft,
        disabledButtonIDs: [],
        defaultButtonID: state.defaultButtonID
      });
    },
    runAction(request) {
      pasty.action.invoke(request.buttonID, { draft: request.draft });
    }
  };
}
