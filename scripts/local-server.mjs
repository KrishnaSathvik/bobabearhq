import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const port = Number(process.env.PORT || 4173)
const root = join(process.cwd(), 'dist')
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  // Chrome will read a manifest served as anything, but it warns — and a local
  // server that answers differently from the host is a local server that hides
  // the problem you came to it to find.
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]/, '')
    let file = join(root, relative || 'index.html')
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    } catch {
      file = join(root, 'index.html')
    }
    const body = await readFile(file)
    response.writeHead(200, {
      'content-type': contentTypes[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    response.end(body)
  } catch {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Run npm run build, then start the server again.')
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Boba Bear HQ is running at http://localhost:${port}`)
})
