/**
 * CardDetector class-name ordering regression tests.
 *
 * Background: until 2026-05-01, CardDetector hardcoded its class-name array
 * in alphabetical-ish order, but the deployed yolo-card-nano.onnx model was
 * trained with a non-alphabetical class order embedded in
 * `metadata_props.names`:
 *
 *   {0: 'ehliyet', 1: 'pasaport', 2: 'ogrenci_karti',
 *    3: 'tc_kimlik', 4: 'akademisyen_karti'}
 *
 * The mismatch silently mislabelled every detection (e.g. an ehliyet
 * was reported as a tc_kimlik). The user-facing symptom was
 * "Yanlış buluyor".
 *
 * These tests pin:
 *   - the FALLBACK_CLASS_NAMES order shipped in the source file
 *   - the labels.json shape and contents on disk
 *   - that they agree (otherwise we are silently broken again)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FALLBACK_CLASS_NAMES } from '../CardDetector'

// `package.json` declares `"type": "module"`, so this file runs as ESM
// where the CommonJS `__dirname` global is undefined. Derive the directory
// from `import.meta.url` instead — Copilot post-merge on PR #52.
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Canonical training-time class order extracted from the ONNX model on
 *  2026-05-01 by reading the raw bytes of `metadata_props.names`. This is
 *  the SOURCE OF TRUTH against which every other list must agree. */
const CANONICAL_TRAINING_ORDER: readonly string[] = [
    'ehliyet',
    'pasaport',
    'ogrenci_karti',
    'tc_kimlik',
    'akademisyen_karti',
]

describe('CardDetector class label ordering', () => {
    it('FALLBACK_CLASS_NAMES matches the YOLO training-time order', () => {
        expect(FALLBACK_CLASS_NAMES).toEqual(CANONICAL_TRAINING_ORDER)
    })

    it('FALLBACK_CLASS_NAMES is NOT in alphabetical order — alphabetical was the bug', () => {
        const alphabetical = [...CANONICAL_TRAINING_ORDER].sort()
        // If someone "tidies" FALLBACK_CLASS_NAMES into alphabetical order
        // they will reintroduce the off-by-N bug — fail the test loudly.
        expect(FALLBACK_CLASS_NAMES).not.toEqual(alphabetical)
    })

    it('public/models/labels.json is committed and parseable', () => {
        const p = path.resolve(__dirname, '../../../../../public/models/labels.json')
        expect(fs.existsSync(p)).toBe(true)
        const raw = fs.readFileSync(p, 'utf-8')
        const parsed = JSON.parse(raw) as { classes?: unknown }
        expect(Array.isArray(parsed.classes)).toBe(true)
    })

    it('public/models/labels.json.classes matches the canonical training order', () => {
        const p = path.resolve(__dirname, '../../../../../public/models/labels.json')
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as {
            classes: string[]
        }
        expect(parsed.classes).toEqual(CANONICAL_TRAINING_ORDER)
    })

    it('FALLBACK_CLASS_NAMES and labels.json agree (no silent drift)', () => {
        const p = path.resolve(__dirname, '../../../../../public/models/labels.json')
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as {
            classes: string[]
        }
        expect(FALLBACK_CLASS_NAMES).toEqual(parsed.classes)
    })
})
