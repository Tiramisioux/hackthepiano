#!/usr/bin/env node
/*
 * Zero-dependency static dev server for HackThePiano.
 *
 *   node scripts/devserver.js [--root DIR] [--port N] [--host H]
 *
 * Why this exists rather than `python3 -m http.server`:
 *   - it never calls process.cwd(), so it starts fine in sandboxed launchers
 *     where getcwd() is not permitted;
 *   - it sends no-cache headers, so editing js/code.js and reloading actually
 *     shows the change;
 *   - it serves correct MIME types for .js/.css/.svg/.woff2, which the Web MIDI
 *     app needs in order to load its modules at all.
 *
 * Bind to 127.0.0.1 (the default): http://localhost and http://127.0.0.1 count
 * as secure contexts, which is what the Web MIDI API requires. Opening
 * index.html over file:// will NOT give you MIDI.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.map': 'application/json; charset=utf-8',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject',
	'.txt': 'text/plain; charset=utf-8'
};

function parseArgs(argv) {
	const opts = { root: path.resolve(__dirname, '..'), port: 8123, host: '127.0.0.1' };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--root' || arg === '-r') opts.root = path.resolve(argv[++i]);
		else if (arg === '--port' || arg === '-p') opts.port = parseInt(argv[++i], 10);
		else if (arg === '--host') opts.host = argv[++i];
		else if (arg === '--help' || arg === '-h') {
			console.log('Usage: node scripts/devserver.js [--root DIR] [--port N] [--host H]');
			process.exit(0);
		}
	}
	return opts;
}

const opts = parseArgs(process.argv.slice(2));

if (!fs.existsSync(path.join(opts.root, 'index.html'))) {
	console.error(`No index.html under ${opts.root} — is --root pointing at the repo?`);
	process.exit(1);
}

const server = http.createServer((req, res) => {
	let urlPath;
	try {
		urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
	} catch (e) {
		res.writeHead(400).end('Bad request');
		return;
	}
	if (urlPath.endsWith('/')) urlPath += 'index.html';

	/* Resolve inside the root, so ../ cannot escape it. */
	const filePath = path.join(opts.root, path.normalize(urlPath));
	if (!filePath.startsWith(opts.root)) {
		res.writeHead(403).end('Forbidden');
		return;
	}

	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
			res.end('404 Not Found: ' + urlPath);
			return;
		}
		res.writeHead(200, {
			'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
			'Cache-Control': 'no-store, no-cache, must-revalidate',
			'Pragma': 'no-cache'
		});
		res.end(data);
	});
});

server.on('error', (err) => {
	if (err.code === 'EADDRINUSE')
		console.error(`Port ${opts.port} is already in use. Try --port ${opts.port + 1}.`);
	else
		console.error(err.message);
	process.exit(1);
});

server.listen(opts.port, opts.host, () => {
	console.log(`HackThePiano dev server`);
	console.log(`  serving : ${opts.root}`);
	console.log(`  url     : http://${opts.host}:${opts.port}/`);
	console.log(`  secure context: yes (Web MIDI works on localhost)`);
	console.log(`Press Ctrl-C to stop.`);
});
