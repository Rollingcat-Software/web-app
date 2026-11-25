import { join } from 'node:path'
import { writeFakeCameraY4m } from './fake-camera.mjs'

/** Generates the fake camera clip before any browser launches. */
export default async function globalSetup() {
    const file = writeFakeCameraY4m(join(process.cwd(), 'e2e', 'author-trial', '.artifacts', 'fake-camera.y4m'))
    // eslint-disable-next-line no-console -- Playwright setup output
    console.log(`[author-trial e2e] fake camera: ${file}`)
}