/**
 * PHP plugin uses `rlanvin/php-rrule` (port of rrule.js). Same recurrence strings as WordPress admin.
 *
 * `rrule` CJS interop: Node ESM must use the default export, not `import { RRule } from 'rrule'`.
 */
import rruleModule from 'rrule'

export const RRule = rruleModule.RRule
export const RRuleSet = rruleModule.RRuleSet
export const rrulestr = rruleModule.rrulestr
