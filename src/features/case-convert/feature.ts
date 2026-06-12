import { actionResult } from "@clipbus/plugin-sdk/runtime";
import type { PluginAutoRunActionHandler } from "@clipbus/plugin-sdk/runtime";
import type { PluginFeature } from "../registry.ts";

// The SDK handler type covers both action lifecycles in one shape, so it lists
// resolveSession as required even for auto-run. These actions never open a
// draft session; the empty resolveSession only satisfies the type contract and
// the host ignores it for auto-run lifecycle.
function createCaseAction(
  transform: (text: string) => string,
  userMessage: string,
): PluginAutoRunActionHandler {
  return {
    async resolveSession() {
      return { buttons: [], initialDraft: {} };
    },
    async runAutoAction(input) {
      if (input.content.kind !== "text") {
        return actionResult.none();
      }
      return actionResult.text(transform(input.content.text), { userMessage });
    },
  };
}

// Break arbitrary text into lowercased words. Splits on any separator
// punctuation (spaces, _, -, etc.) and on camelCase/PascalCase boundaries,
// including acronym runs ("XMLParser" -> "xml", "parser"), so the same input
// converts cleanly between every naming style.
function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

// Words arrive already lowercased from splitWords, so only the first letter
// needs raising.
function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function toCamelCase(text: string): string {
  return splitWords(text)
    .map((word, index) => (index === 0 ? word : capitalize(word)))
    .join("");
}

function toPascalCase(text: string): string {
  return splitWords(text).map(capitalize).join("");
}

function toSnakeCase(text: string): string {
  return splitWords(text).join("_");
}

function toKebabCase(text: string): string {
  return splitWords(text).join("-");
}

export const caseConvertFeature: PluginFeature = {
  actions: {
    uppercase: createCaseAction((text) => text.toUpperCase(), "Converted to uppercase"),
    lowercase: createCaseAction((text) => text.toLowerCase(), "Converted to lowercase"),
    camelCase: createCaseAction(toCamelCase, "Converted to camelCase"),
    pascalCase: createCaseAction(toPascalCase, "Converted to PascalCase"),
    snakeCase: createCaseAction(toSnakeCase, "Converted to snake_case"),
    kebabCase: createCaseAction(toKebabCase, "Converted to kebab-case"),
  },
};
