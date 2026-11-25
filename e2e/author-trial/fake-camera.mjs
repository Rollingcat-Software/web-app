/**
 * Writes a tiny Y4M clip for Chromium's fake camera
 * (`--use-file-for-fake-video-capture=<path>`).
 *
 * 160x120, 30 fps, 30 frames (~0.9 MB), 4:2:0. The luma pattern moves a little
 * per frame so the probe sees a changing frame rather than a frozen one. No
 * face is drawn: the trial e2e intentionally lets the PUZZLE challenge stay
 * incomplete and exercises the per-attempt timeout path.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const WIDTH = 160
const HEIGHT = 120
const FRAMES = 30

export function writeFakeCameraY4m(filePath) {
    mkdirSync(dirname(filePath), { recursive: true })
    const chunks = [Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F30:1 Ip A1:1 C420jpeg\n`)]
    const chroma = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2), 128)
    for (let frame = 0; frame < FRAMES; frame++) {
        chunks.push(Buffer.from('FRAME\n'))
        const luma = Buffer.alloc(WIDTH * HEIGHT)
        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                luma[y * WIDTH + x] = 80 + ((x + y + frame * 9) % 90)
            }
        }
        chunks.push(luma, chroma, chroma)
    }
    writeFileSync(filePath, Buffer.concat(chunks))
    return filePath
}