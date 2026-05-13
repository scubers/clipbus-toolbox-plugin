import type { PluginDefinition } from './types/ctx.js';

export function definePlugin(definition: PluginDefinition): PluginDefinition {
  if (!definition || typeof definition.setup !== 'function') {
    throw new Error('definePlugin(...) requires a setup(init) function.');
  }
  return definition;
}
