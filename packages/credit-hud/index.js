/**
 * @local/credit-hud — Host half.
 *
 * Intentionally empty: the panel is a pure browser-side read of the other
 * plugins' existing read-only routes (each of them already answers on
 * /plugins/<id>/…). Keeping the Host half empty means this bundle adds no
 * services, no timers and no configuration to the profile — uninstalling it
 * leaves nothing behind.
 */
export function apply() {}
