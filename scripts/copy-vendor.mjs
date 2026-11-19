// Copies the browser runtimes into public/vendor so they are served as static
// files (not bundled): OpenCV.js (~13 MB) and ONNX Runtime Web + its WebAssembly.
// Runs automatically before `dev` and `build`.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'vendor')
rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'ort'), { recursive: true })
mkdirSync(join(out, 'opencv'), { recursive: true })

cpSync(join(root, 'node_modules/@techstark/opencv-js/dist/opencv.js'), join(out, 'opencv/opencv.js'))

// ONNX Runtime Web: the WebGPU entry point plus the one WebAssembly build it
// loads (asyncify), which serves both the WebGPU and the CPU fallback paths.
const ortDist = join(root, 'node_modules/onnxruntime-web/dist')
const ortFiles = readdirSync(ortDist).filter((f) =>
  f === 'ort.webgpu.min.mjs' || /^ort-wasm-simd-threaded\.asyncify\.(mjs|wasm)$/.test(f))
for (const f of ortFiles) cpSync(join(ortDist, f), join(out, 'ort', f))

if (!existsSync(join(root, 'public/models/yolo11n.onnx'))) {
  console.warn('WARNING: public/models/yolo11n.onnx is missing - the detector will not load.')
}
console.log(`vendor ready: opencv.js + ${ortFiles.length} ONNX Runtime files`)
