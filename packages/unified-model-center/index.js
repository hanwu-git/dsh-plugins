/**
 * Host half of the unified model center.
 *
 * The picker and its settings page live in client.js. This half exists to
 * declare the Config schema: DSH only creates a settings namespace (which the
 * client's `configForms.whileServed` waits for) when a Host row exports one.
 * Without it the settings.section page never registers.
 */
import z from '@deepseek-ai/schemastery'

export const Config = z.object({
  /** Models hidden from the model center. Keys are `connector::modelId`. */
  hidden: z.array(z.string()).default([]).volatile(),
  /** Ordered `connector::modelId` keys; unlisted ones keep catalog order. */
  modelOrder: z.array(z.string()).default([]).volatile(),
  /** Ordered connector ids; unlisted ones keep registration order. */
  providerOrder: z.array(z.string()).default([]).volatile(),
})

export function apply() {}
