require('dotenv').config();
const { VK, Keyboard } = require('vk-io');
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { createCanvas } = require('canvas');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const multer = require('multer');
const ffmpegPath = require('ffmpeg-static');

const TOKEN = process.env.VK_TOKEN;
const PORT = process.env.PORT || 3005;
const staticRecipients = require('./data/recipients');

if (!TOKEN) {
  console.error('ERROR: VK_TOKEN not found');
  process.exit(1);
}

const vk = new VK({ token: TOKEN });
const prisma = new PrismaClient();
const app = express();

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../dist')));
app.use('/api', cors(), express.json({ limit: '50mb' }), express.urlencoded({ extended: true }));

// setup multer for image uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const uploadPath = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
        },
        filename: function (req, file, cb) {
            const ext = path.extname(file.originalname);
            const name = 'img_' + Date.now() + ext;
            cb(null, name);
        }
    })
});

// === ГРАФИКА ===
async function generateBoardImage(board) {
    const cellSize = 50;
    const padding = 40;
    const width = cellSize * 10 + padding + 20;
    const height = cellSize * 10 + padding + 20;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Фон
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Текст
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const letters = 'АБВГДЕЖЗИК';

    // Координаты
    for (let i = 0; i < 10; i++) {
        ctx.fillText(letters[i], padding + i * cellSize + cellSize / 2, padding / 2);
        ctx.fillText(i + 1, padding / 2, padding + i * cellSize + cellSize / 2);
    }

    // Сетка
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            const cell = board[y][x];
            const posX = padding + x * cellSize;
            const posY = padding + y * cellSize;

            ctx.fillStyle = '#f3f4f6'; // EMPTY
            if (cell === 1) ctx.fillStyle = '#2563eb'; // SHIP
            if (cell === 2) ctx.fillStyle = '#e5e7eb'; // MISS
            if (cell === 3) ctx.fillStyle = '#fee2e2'; // HIT
            if (cell === 4) ctx.fillStyle = '#1f2937'; // KILLED

            ctx.fillRect(posX + 2, posY + 2, cellSize - 4, cellSize - 4);

            ctx.font = '30px sans-serif';
            if (cell === 2) { 
                ctx.fillStyle = '#9ca3af'; 
                ctx.fillText('•', posX + cellSize/2, posY + cellSize/2); 
            }
            if (cell === 3) ctx.fillText('🔥', posX + cellSize/2, posY + cellSize/2 + 2);
            if (cell === 4) ctx.fillText('☠️', posX + cellSize/2, posY + cellSize/2 + 2);
        }
    }

    return canvas.toBuffer();
}

// === ЛОГИКА ===
const CellState = { EMPTY: 0, SHIP: 1, MISS: 2, HIT: 3, KILLED: 4 };

class SeaBattleGame {
  static createEmptyBoard() { return Array(10).fill(null).map(() => Array(10).fill(CellState.EMPTY)); }
  static generateBoard() {
    const board = this.createEmptyBoard();
    const ships = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
    const canPlace = (b, x, y, size, isH) => {
        if (isH && x + size > 10) return false;
        if (!isH && y + size > 10) return false;
        const startX = Math.max(0, x - 1), startY = Math.max(0, y - 1);
        const endX = Math.min(9, isH ? x + size : x + 1);
        const endY = Math.min(9, isH ? y + 1 : y + size);
        for (let checkY = startY; checkY <= endY; checkY++) {
            for (let checkX = startX; checkX <= endX; checkX++) {
                if (b[checkY][checkX] !== CellState.EMPTY) return false;
            }
        }
        return true;
    };
    ships.forEach(size => {
      let placed = false, attempts = 0;
      while (!placed && attempts < 200) {
        const isH = Math.random() > 0.5;
        const x = Math.floor(Math.random() * 10), y = Math.floor(Math.random() * 10);
        if (canPlace(board, x, y, size, isH)) {
             for(let k=0; k<size; k++) {
                 const cx = isH ? x+k : x, cy = isH ? y : y+k;
                 board[cy][cx] = CellState.SHIP;
             }
             placed = true;
        }
        attempts++;
      }
    });
    return board;
  }
  static getShipCells(board, x, y) {
    const isShipPart = (cx, cy) => [CellState.SHIP, CellState.HIT, CellState.KILLED].includes(board[cy]?.[cx]);
    const stack = [[x, y]];
    const visited = new Set();
    const cells = [];

    while (stack.length) {
        const [cx, cy] = stack.pop();
        const key = `${cx}:${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (!isShipPart(cx, cy)) continue;
        cells.push({ x: cx, y: cy });

        stack.push([cx + 1, cy]);
        stack.push([cx - 1, cy]);
        stack.push([cx, cy + 1]);
        stack.push([cx, cy - 1]);
    }

    return cells;
  }

  static isInsideBoard(board, x, y) {
    return Array.isArray(board)
      && y >= 0
      && y < board.length
      && Array.isArray(board[y])
      && x >= 0
      && x < board[y].length;
  }

  // Полная логика выстрела
  static processShot(board, x, y) {
    if (!SeaBattleGame.isInsideBoard(board, x, y)) {
        return { res: 'Некорректные координаты.', win: false };
    }
    const cell = board[y][x];
    if (cell === CellState.MISS || cell === CellState.HIT || cell === CellState.KILLED) return { res: 'Сюда уже стреляли!', win: false };
    if (cell === CellState.EMPTY) { board[y][x] = CellState.MISS; return { res: 'Мимо!', win: false }; }

    if (cell === CellState.SHIP) {
        board[y][x] = CellState.HIT;

        const shipCells = SeaBattleGame.getShipCells(board, x, y);
        const shipKilled = shipCells.every(({ x: cx, y: cy }) =>
            [CellState.HIT, CellState.KILLED].includes(board[cy][cx])
        );

        if (shipKilled) {
            shipCells.forEach(({ x: cx, y: cy }) => board[cy][cx] = CellState.KILLED);
        }

        const hasShips = board.some(row => row.includes(CellState.SHIP));
        if (!hasShips) {
             // Красим все HIT в KILLED при победе
             for(let ry=0; ry<10; ry++) for(let rx=0; rx<10; rx++) {
                 if (board[ry][rx] === CellState.HIT) board[ry][rx] = CellState.KILLED;
             }
             return { res: 'ПОБЕДА! 🎉', win: true };
        }

        if (shipKilled) return { res: 'Корабль уничтожен! ☠️', win: false };
        return { res: 'Попал! 🔥', win: false };
    }
    return { res: 'Ошибка', win: false };
  }
}

function parseCoords(text) {
    const m = text.trim().toUpperCase().match(/^([А-ЯA-Z])([0-9]+)$/);
    if (!m) return null;
    const letters = 'АБВГДЕЖЗИКABCDEFGHIJ';
    const x = letters.indexOf(m[1]) % 10;
    const y = parseInt(m[2]) - 1;
    return (x >= 0 && y >= 0 && y < 10) ? {x, y} : null;
}

const updateSubscriptionStatus = async (user, isSubscribed) => {
    if (!user?.id || typeof isSubscribed !== 'boolean') return user;

    // Avoid unnecessary writes when nothing changes
    if (user.isSubscribed === isSubscribed && (isSubscribed || user.unsubscribedAt == null)) {
        return user;
    }

    try {
        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                isSubscribed,
                unsubscribedAt: isSubscribed ? null : new Date(),
            },
        });
        return updated;
    } catch (err) {
        console.error('Failed to update subscription status', err);
        return user;
    }
};

// === БОТ ===
const buildMainMenuKeyboard = (includeStart = false) => {
    const keyboard = Keyboard.builder()
        .inline(false)
        .oneTime(false)
        .textButton({ label: 'Меню', color: 'primary' })
        .textButton({ label: 'Акции', color: 'primary' })
        .row()
        .textButton({ label: 'Время и зона доставки', color: 'secondary' })
        .textButton({ label: 'Вызывать оператора', color: 'secondary' })
        .row()
        .textButton({ label: 'Игры', color: 'positive' })
        .textButton({ label: 'Отписка', color: 'negative' });

    if (includeStart) {
        keyboard.row().textButton({ label: 'Старт', color: 'positive' });
    }

    return keyboard;
};

const buildStartKeyboard = () => buildMainMenuKeyboard(true);

vk.updates.on('message_new', async (ctx) => {
    if (!ctx.text) return;
    const text = ctx.text;
    const normalizedText = text.trim().toLowerCase();
    
    let user = await prisma.user.findUnique({ where: { vkId: ctx.senderId } });
    if (!user) {
        try {
            const [info] = await vk.api.users.get({ user_ids: ctx.senderId });
            user = await prisma.user.create({ data: { vkId: ctx.senderId, firstName: info?.first_name, lastName: info?.last_name, isSubscribed: true } });
        } catch(e) {
            user = await prisma.user.create({ data: { vkId: ctx.senderId, isSubscribed: true } });
        }
    }

    // Обработка кнопки СОХРАНИТЬ
    if (text === '📸 Сохранить результат') {
        const lastGame = await prisma.game.findFirst({
            where: { userId: user.id, status: 'FINISHED' },
            orderBy: { createdAt: 'desc' }
        });
        if (!lastGame) return ctx.send('Нет завершенных игр.');
        
        await ctx.send('🎨 Рисую...');
        const buffer = await generateBoardImage(JSON.parse(lastGame.board));

        const photo = await vk.upload.messagePhoto({
            peer_id: ctx.peerId,
            source: { value: buffer },
        });

        const attachment = photo?.owner_id && photo?.id
            ? `photo${photo.owner_id}_${photo.id}${photo.access_key ? '_' + photo.access_key : ''}`
            : null;

        return ctx.send({
            message: `Игра #${lastGame.id}. Победитель: ${user.firstName}`,
            attachment: attachment || undefined,
            keyboard: Keyboard.builder().textButton({ label: 'Старт', color: 'positive' }).oneTime()
        });
    }

    // Кнопки меню
    if (normalizedText === 'меню') {
        user = await updateSubscriptionStatus(user, true);
        return ctx.send({ message: '📋 Главное меню. Выберите действие:', keyboard: buildMainMenuKeyboard() });
    }

    if (normalizedText === 'акции') {
        return ctx.send({ message: '🎁 Сейчас нет активных акций. Загляните позже!', keyboard: buildMainMenuKeyboard() });
    }

    if (normalizedText === 'время и зона доставки') {
        return ctx.send({ message: '🕑 Время и зона доставки: ежедневно с 10:00 до 22:00 в пределах города.', keyboard: buildMainMenuKeyboard() });
    }

    if (normalizedText === 'вызывать оператора') {
        return ctx.send({ message: '☎️ Оператор скоро свяжется с вами. Напишите ваш вопрос.', keyboard: buildMainMenuKeyboard() });
    }

    if (normalizedText === 'отписка') {
        user = await updateSubscriptionStatus(user, false);
        return ctx.send({ message: 'Вы отписались от рассылки. Если захотите вернуться — напишите "Меню".', keyboard: buildMainMenuKeyboard() });
    }

    if (normalizedText === 'игры') {
        return ctx.send({
            message: '🎮 Доступна игра "Морской бой". Нажмите "Старт", чтобы начать новую партию.',
            keyboard: buildStartKeyboard(),
        });
    }

    const game = await prisma.game.findFirst({ where: { userId: user.id, status: 'ACTIVE' } });

    if (normalizedText === 'старт') {
        user = await updateSubscriptionStatus(user, true);
        if (game) await prisma.game.update({ where: { id: game.id }, data: { status: 'FINISHED' } });
        const board = SeaBattleGame.generateBoard();
        await prisma.game.create({ data: { userId: user.id, board: JSON.stringify(board) } });
        return ctx.send({
            message: '🏴‍☠️ Бой начался! Стреляй (А1).',
            keyboard: Keyboard.builder().textButton({ label: 'Сдаться', color: 'negative' }).inline()
        });
    }

    if (normalizedText === 'сдаться' && game) {
        await prisma.game.update({ where: { id: game.id }, data: { status: 'FINISHED' } });
        return ctx.send({
            message: '🏳️ Вы сдались.',
            keyboard: Keyboard.builder().textButton({ label: 'Старт', color: 'positive' }).oneTime()
        });
    }

    if (game) {
        const coords = parseCoords(text);
        if (!coords) return ctx.send('Не понял. Пример: А1');
        
        const board = JSON.parse(game.board);
        const { res, win } = SeaBattleGame.processShot(board, coords.x, coords.y);
        
        await prisma.game.update({
            where: { id: game.id },
            data: { board: JSON.stringify(board), status: win ? 'FINISHED' : 'ACTIVE', moves: { increment: 1 } }
        });
        
        if (win) {
            return ctx.send({
                message: `🏆 ${res} Поздравляю! Жми кнопку, чтобы получить фото.`,
                keyboard: Keyboard.builder()
                    .textButton({ label: '📸 Сохранить результат', color: 'primary' })
                    .row()
                    .textButton({ label: 'Старт', color: 'positive' })
                    .oneTime()
            });
        }
        return ctx.send(res);
    }

    await ctx.send({
        message: 'Напиши "Старт"!',
        keyboard: buildStartKeyboard()
    });
});

app.get('/api/users', async (req, res) => res.json(await prisma.user.findMany({ include: { games: true } })));
app.get('/api/games/active/:vkId', async (req, res) => {
    const vkId = Number(req.params.vkId);

    if (!Number.isFinite(vkId)) {
        return res.status(400).json({ error: 'Invalid vkId' });
    }

    const user = await prisma.user.findUnique({ where: { vkId } });
    if (!user) return res.status(404).json({});

    const game = await prisma.game.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
    });

    if (!game) return res.status(404).json({});

    let parsedBoard = null;
    try {
        parsedBoard = JSON.parse(game.board);
    } catch (err) {
        console.error('Failed to parse board JSON', err);
    }

    return res.json({ ...game, board: parsedBoard });
});
app.get('/api/dashboard', (req, res) => res.json({ kpi: {}, charts: {}, lists: {} }));

// endpoint for uploading campaign images
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const protocol = req.protocol;
    const host = req.get('host');
    const publicUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    res.json({ url: publicUrl, filename: req.file.filename, size: req.file.size });
});

// === Рассылки ===
const loadRecipients = async () => {
    // Берём реальные контакты из базы, если есть хоть один пользователь
    const users = await prisma.user.findMany({ include: { games: true } });

    if (users.length > 0) {
        return users
            .filter((u) => u.isSubscribed !== false)
            .map((u) => ({
            vkId: u.vkId,
            // Минимальная информация для фильтров
            games_played: (u.games || []).length,
            is_member: u.isSubscribed !== false,
            unsubscribed_at: u.unsubscribedAt,
            segment: 'ALL',
        }));
    }

    // Фолбэк на статичный список для локального стенда
    return staticRecipients;
};

const filterRecipients = (rawRecipients, segment, filters = {}) => {
    return rawRecipients.filter((r) => {
        if (segment && segment !== 'ALL' && r.segment && r.segment !== segment) return false;
        if (typeof filters.min_games === 'number' && r.games_played < filters.min_games) return false;
        if (typeof filters.is_member === 'boolean' && r.is_member !== filters.is_member) return false;
        return true;
    });
};

const zlib = require('zlib');
const { Blob, FormData } = globalThis;

// Кэшируем уже загруженные вложения, чтобы не дергать загрузку при повторных отправках
const cachedCampaignPhotoBuffers = new Map();
const uploadedCampaignVoices = new Map();

const parseBase64DataUri = (dataUri = '', fallbackContentType = 'application/octet-stream') => {
    const trimmed = dataUri.trim();
    const match = trimmed.match(/^data:([^;]+);base64,(.*)$/);

    // data URL с content-type
    if (match) {
        const contentType = match[1];
        const base64Payload = match[2];
        try {
            return {
                buffer: Buffer.from(base64Payload, 'base64'),
                contentType,
            };
        } catch (err) {
            console.error('Failed to parse base64 payload', err);
            return null;
        }
    }

    // «голый» base64 без префикса
    try {
        const clean = trimmed.replace(/\s+/g, '');
        if (!clean) return null;
        return {
            buffer: Buffer.from(clean, 'base64'),
            contentType: fallbackContentType,
        };
    } catch (err) {
        console.error('Failed to parse raw base64 payload', err);
        return null;
    }
};

const fetchImageBuffer = async (imageUrl, redirectDepth = 0) => {
    if (!imageUrl) throw new Error('Image URL not provided');
    if (redirectDepth > 5) throw new Error('Too many redirects');

    return new Promise((resolve, reject) => {
        const currentUrl = new URL(imageUrl);
        const client = currentUrl.protocol === 'https:' ? https : http;

        const req = client.get(currentUrl, (res) => {
            try {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const loc = res.headers.location;
                    if (!loc) return reject(new Error('Redirect without location header'));

                    const nextUrl = new URL(loc, currentUrl);
                    return resolve(fetchImageBuffer(nextUrl.toString(), redirectDepth + 1));
                }

                if (res.statusCode !== 200) {
                    return reject(new Error('Bad status code: ' + res.statusCode));
                }

                const contentType = res.headers['content-type'] || 'application/octet-stream';
                const chunks = [];

                res.on('data', (chunk) => chunks.push(chunk));
                res.on('error', reject);
                res.on('end', () => {
                    try {
                        const buffer = Buffer.concat(chunks);
                        if (!buffer || buffer.length === 0) {
                            return reject(new Error('Empty image buffer'));
                        }
                        resolve({ buffer, contentType });
                    } catch (err) {
                        reject(err);
                    }
                });
            } catch (err) {
                reject(err);
            }
        });

        req.setTimeout(15000, () => req.destroy(new Error('Image request timed out')));
        req.on('error', reject);
        req.end();
    });
};

const fetchAudioBuffer = (audioUrl, redirectDepth = 0) => new Promise((resolve, reject) => {
    if (!audioUrl) return reject(new Error('Audio URL not provided'));

    try {
        const url = new URL(audioUrl.trim());
        const client = url.protocol === 'https:' ? https : http;

        const request = client.get({
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || undefined,
            path: url.pathname + (url.search || ''),
            headers: {
                'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
                'Accept-Encoding': 'identity',
                'User-Agent': 'PizzaBotCampaign/1.0 (+https://example.com)',
                'Host': url.hostname,
            },
        }, (response) => {
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                if (redirectDepth > 3) return reject(new Error('Too many redirects while fetching audio'));
                const redirectUrl = new URL(response.headers.location, url);
                return resolve(fetchAudioBuffer(redirectUrl.toString(), redirectDepth + 1));
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to fetch audio. Status: ${response.statusCode}`));
            }

            const contentType = response.headers['content-type'] || '';
            const encoding = (response.headers['content-encoding'] || 'identity').toLowerCase();
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const rawBuffer = Buffer.concat(chunks);

                const finish = (buffer) => resolve({ buffer, contentType });

                if (encoding === 'gzip') {
                    return zlib.gunzip(rawBuffer, (err, decompressed) => {
                        if (err) return reject(err);
                        return finish(decompressed);
                    });
                }

                if (encoding === 'deflate') {
                    return zlib.inflate(rawBuffer, (err, decompressed) => {
                        if (err) return reject(err);
                        return finish(decompressed);
                    });
                }

                return finish(rawBuffer);
            });
        });

        request.setTimeout(15000, () => {
            request.destroy(new Error('Audio request timed out'));
        });

        request.on('error', reject);
    } catch (err) {
        reject(err);
    }
});

const pickAudioExtension = (contentType = '', fallback = 'mp3') => {
    if (contentType.includes('ogg') || contentType.includes('opus')) return 'ogg';
    if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3';
    if (contentType.includes('wav')) return 'wav';
    return fallback;
};

const pickExtension = (contentType = '', fallback = 'jpg') => {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('jpeg')) return 'jpg';
    if (contentType.includes('jpg')) return 'jpg';
    if (contentType.includes('gif')) return 'gif';
    return fallback;
};

const uploadAudioMessageViaDocs = async ({ buffer, filename, contentType, peerId }) => {
    if (!buffer || buffer.length === 0) return null;

    // Для сообществ VK требует peer_id при загрузке аудиосообщения через docs
    if (!peerId) {
        console.warn('Skipping docs audio_message upload because peerId is missing');
        return null;
    }

    const safeFilename = filename || 'voice.ogg';
    try {
        const uploadServer = await vk.api.docs.getMessagesUploadServer({ type: 'audio_message', peer_id: peerId });
        if (!uploadServer?.upload_url) throw new Error('Missing upload url for audio_message');

        if (typeof fetch !== 'function' || typeof FormData === 'undefined' || typeof Blob === 'undefined') {
            throw new Error('fetch/FormData/Blob not available for docs upload');
        }

        const form = new FormData();
        const blob = new Blob([buffer], { type: contentType || 'audio/ogg' });
        form.append('file', blob, safeFilename);

        const uploadResponse = await fetch(uploadServer.upload_url, {
            method: 'POST',
            body: form,
        });

        const uploadJson = await uploadResponse.json();
        if (!uploadJson?.file) throw new Error('docs upload did not return file token');

        const saved = await vk.api.docs.save({ file: uploadJson.file, title: safeFilename });
        const docPayload = saved?.audio_message || saved?.doc || (Array.isArray(saved) ? (saved[0]?.audio_message || saved[0]?.doc || saved[0]) : saved);

        const ownerId = docPayload?.owner_id;
        const audioId = docPayload?.id;
        const accessKey = docPayload?.access_key;

        if (!ownerId || !audioId) throw new Error('docs.save returned no owner/id for audio_message');

        return `audio_message${ownerId}_${audioId}${accessKey ? '_' + accessKey : ''}`;
    } catch (err) {
        console.error('docs audio_message upload failed', err);
        return null;
    }
};

const ensureOpusAudio = async ({ buffer, contentType, filename }) => {
    const hasData = buffer && buffer.length > 0;
    const alreadyOgg = (contentType || '').includes('ogg') || (contentType || '').includes('opus') || (filename || '').endsWith('.ogg');

    if (!hasData) return { buffer, contentType, filename };

    if (alreadyOgg) {
        return {
            buffer,
            contentType: 'audio/ogg',
            filename: filename && filename.includes('.') ? filename : `${filename || 'voice'}.ogg`,
        };
    }

    if (!ffmpegPath) {
        return {
            buffer,
            contentType: contentType || 'audio/mpeg',
            filename: filename || `voice.${pickAudioExtension(contentType, 'mp3')}`,
        };
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-voice-'));
    const inputPath = path.join(tmpDir, `input.${pickAudioExtension(contentType, 'mp3')}`);
    const outputPath = path.join(tmpDir, 'output.ogg');

    fs.writeFileSync(inputPath, buffer);

    try {
        await new Promise((resolve, reject) => {
            const ff = spawn(ffmpegPath, [
                '-y',
                '-i', inputPath,
                '-ar', '16000',
                '-ac', '1',
                '-b:a', '16k',
                '-c:a', 'libopus',
                outputPath,
            ]);

            ff.on('error', reject);
            ff.on('close', (code) => {
                if (code === 0) return resolve();
                return reject(new Error(`ffmpeg exited with code ${code}`));
            });
        });

        const converted = fs.readFileSync(outputPath);

        return {
            buffer: converted,
            contentType: 'audio/ogg',
            filename: `${(filename || 'voice').replace(/\.[^/.]+$/, '')}.ogg`,
        };
    } catch (err) {
        console.error('FFmpeg opus conversion failed, falling back to original audio', err);
        return {
            buffer,
            contentType: contentType || 'audio/mpeg',
            filename: filename || `voice.${pickAudioExtension(contentType, 'mp3')}`,
        };
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
};

const uploadCampaignImage = async ({ imageUrl, imageBase64, imageName } = {}) => {
    try {
        console.log("UPLOAD IMAGE STEP 1", { imageUrl, imageBase64 });
        const cleanUrl = (imageUrl || '').trim();
        const cleanBase64 = (imageBase64 || '').trim();

        const ensureImageType = (contentType = 'application/octet-stream') => {
            const normalized = (contentType || '').toLowerCase();
            if (normalized && !normalized.startsWith('image')) {
                throw new Error(`Invalid content-type for image: ${contentType}`);
            }
            return normalized || 'application/octet-stream';
        };

        let buffer = null;
        let contentType = 'image/jpeg';
        let filename = imageName || 'campaign.jpg';

        // 1. Файл, загруженный с компьютера (base64)
        if (cleanBase64) {
            const parsed = parseBase64DataUri(cleanBase64, contentType);
            buffer = parsed?.buffer || null;
            contentType = ensureImageType(parsed?.contentType || contentType);
        }

        // 2. URL — скачиваем изображение
        if (!buffer && cleanUrl && (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))) {
            if (cachedCampaignPhotoBuffers.has(cleanUrl)) {
                const cached = cachedCampaignPhotoBuffers.get(cleanUrl);
                buffer = cached.buffer;
                contentType = ensureImageType(cached.contentType || contentType);
                filename = cached.filename || filename;
            } else {
                const fetched = await fetchImageBuffer(cleanUrl);
                console.log("UPLOAD IMAGE STEP 2 fetched", fetched ? { hasBuffer: !!fetched.buffer, contentType: fetched.contentType } : null);
                buffer = fetched?.buffer || null;
                console.log("UPLOAD IMAGE STEP 3 buffer", buffer ? buffer.length : "NO BUFFER");
                contentType = ensureImageType(fetched?.contentType || contentType);
                const entry = {
                    attachment: null,
                    buffer,
                    filename: `image.${pickExtension(contentType)}`,
                    contentType,
                };
                cachedCampaignPhotoBuffers.set(cleanUrl, entry);
                filename = entry.filename;
            }
        }

        console.log("UPLOAD IMAGE STEP 4 — buffer exists?", !!buffer, "len:", buffer?.length);
        if (!buffer || buffer.length === 0) {
            throw new Error('Empty image buffer');
        }

        const ext = pickExtension(contentType || '', filename.split('.').pop() || 'jpg');
        const safeFilename = filename.includes('.') ? filename : `campaign.${ext}`;

        return {
            attachment: null,
            buffer,
            filename: safeFilename,
        };
    } catch (err) {
        console.error("UPLOAD IMAGE FATAL ERROR:", err);
        throw err;
    }
};

const uploadCampaignVoice = async ({ voiceUrl, voiceBase64, voiceName, peerId } = {}) => {
    const cleanUrl = (voiceUrl || '').trim();
    const cleanBase64 = (voiceBase64 || '').trim();
    const cacheKey = cleanBase64 ? `data:${cleanBase64.length}:${cleanBase64.slice(0, 32)}` : cleanUrl;

    if (cacheKey && uploadedCampaignVoices.has(cacheKey)) {
        return { attachment: uploadedCampaignVoices.get(cacheKey) };
    }

    let buffer;
    let contentType = 'audio/mpeg';
    let filename = voiceName || 'voice.mp3';

    try {

        // 1) Пробуем напрямую загрузить с ссылки силами VK, если она валидная
        if (cleanUrl && (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))) {
            try {
                const direct = await vk.upload.audioMessage({ source: { url: cleanUrl } });
                if (direct?.owner_id && direct?.id) {
                    const attachment = `audio_message${direct.owner_id}_${direct.id}${direct.access_key ? '_' + direct.access_key : ''}`;
                    uploadedCampaignVoices.set(cacheKey, attachment);
                    uploadedCampaignVoices.set(cleanUrl, attachment);
                    return { attachment };
                }
            } catch (directErr) {
                console.warn('Direct voice upload failed, fallback to buffer', directErr?.message || directErr);
            }
        }

        // 2) Собираем буфер из base64 или качаем файл
        if (cleanBase64) {
            const parsed = parseBase64DataUri(cleanBase64, 'audio/mpeg') || { buffer: null, contentType: null };
            buffer = parsed.buffer;
            contentType = parsed.contentType || contentType;
        } else if (cleanUrl && (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))) {
            const fetched = await fetchAudioBuffer(cleanUrl);
            buffer = fetched.buffer;
            contentType = fetched.contentType || contentType;
            if (!voiceName) {
                filename = `voice.${pickAudioExtension(contentType, 'mp3')}`;
            }
        }

        if (!buffer || buffer.length === 0) {
            return null;
        }

        const normalized = await ensureOpusAudio({ buffer, contentType, filename });
        buffer = normalized.buffer;
        contentType = normalized.contentType || contentType;
        filename = normalized.filename || filename;

        if (!filename.includes('.')) {
            filename = `${filename}.${pickAudioExtension(contentType, 'ogg')}`;
        }

        let attachment = null;

        if (peerId) {
            try {
                attachment = await uploadAudioMessageViaDocs({ buffer, filename, contentType, peerId });
            } catch (docsErr) {
                console.warn('docs audio_message upload errored, fallback to vk.upload.audioMessage', docsErr);
            }
        }

        if (!attachment) {
            try {
                const audio = await vk.upload.audioMessage({ source: { value: buffer, filename } });
                if (audio?.owner_id && audio?.id) {
                    attachment = `audio_message${audio.owner_id}_${audio.id}${audio.access_key ? '_' + audio.access_key : ''}`;
                }
            } catch (uploadErr) {
                console.error('Fallback VK audioMessage upload failed', uploadErr);
            }
        }

        if (attachment) {
            uploadedCampaignVoices.set(cacheKey, attachment);
            if (cleanUrl) uploadedCampaignVoices.set(cleanUrl, attachment);
            return { attachment };
        }

        // Возвращаем буфер, чтобы можно было попытаться отправить по peer_id в цикле отправки
        return { attachment: null, buffer, filename };
    } catch (err) {
        console.error('Voice upload failed', err);
        return buffer ? { attachment: null, buffer, filename } : null;
    }
};

app.post('/api/campaigns/send', async (req, res) => {
    console.log("CAMPAIGN IMAGE DEBUG:", {
        imageUrl: req.body.imageUrl,
        image_url: req.body.image_url,
        imageBase64: req.body.imageBase64 ? req.body.imageBase64.slice(0,100) : null,
        image_base64: req.body.image_base64 ? req.body.image_base64.slice(0,100) : null,
        imageName: req.body.imageName,
    });
    const {
        campaignId,
        message,
        type,
        messageType,
        campaignType,
        segment = 'ALL',
        imageUrl,
        image_url,
        imageBase64,
        image_base64: imageBase64Snake,
        imageName,
        voiceUrl,
        voice_url,
        voiceBase64,
        voiceName,
        filters = {},
        carousel = [],
    } = req.body || {};

    const effectiveMessageType = messageType || (type === 'CAROUSEL' ? 'CAROUSEL' : 'DEFAULT');
    const effectiveCampaignType = campaignType || type;
    const isCarousel = effectiveMessageType === 'CAROUSEL';
    const carouselItems = Array.isArray(carousel) ? carousel : [];

    if (!message) return res.status(400).json({ error: 'Message is required' });

    const audience = filterRecipients(await loadRecipients(), segment, filters);
    if (audience.length === 0) return res.status(400).json({ error: 'No recipients for selected filters' });

    const rawImage = (imageUrl || image_url || '').trim();
    const requestedImageBase64 = (imageBase64 || imageBase64Snake || (rawImage.startsWith('data:') ? rawImage : '')).trim();
    const requestedImage = (imageBase64 || imageBase64Snake) ? '' : rawImage;
    console.log("UPLOAD DEBUG:", { rawImage, requestedImageBase64, requestedImage });
    const requestedVoice = (voiceUrl || voice_url || '').trim();

    // === FIXED VK CAROUSEL SUPPORT ===
    if (type === 'CAROUSEL') {
        const carouselCardsArray = Array.isArray(carousel) ? carousel : [];
        console.log("CAROUSEL DEBUG:", carouselCardsArray);

        const elements = [];

        for (const card of carouselCardsArray) {
            const { title, description, imageUrl: cardImageUrl, buttonLabel, buttonLink } = card || {};

            if (!cardImageUrl) {
                console.warn('CAROUSEL WARNING: missing imageUrl for card');
                continue;
            }

            try {
                const fetched = await fetchImageBuffer(cardImageUrl);
                const buffer = fetched?.buffer;
                const filename = `carousel_${Date.now()}.${pickExtension(fetched?.contentType || 'image/jpeg')}`;

                if (!buffer || buffer.length === 0) {
                    console.warn('CAROUSEL WARNING: empty buffer for card');
                    continue;
                }

                const uploadedPhoto = await vk.upload.messagePhoto({
                    peer_id: 1,
                    source: { value: buffer, filename },
                });

                console.log("CAROUSEL PHOTO UPLOAD:", uploadedPhoto);

                if (uploadedPhoto?.owner_id && uploadedPhoto?.id) {
                    const photo_id = `photo${uploadedPhoto.owner_id}_${uploadedPhoto.id}${uploadedPhoto.access_key ? '_' + uploadedPhoto.access_key : ''}`;

                    elements.push({
                        title: title || "",
                        description: description || "",
                        photo_id,
                        action: {
                            type: buttonLink ? "open_link" : "open_photo",
                            link: buttonLink || undefined,
                        },
                        buttons: buttonLabel ? [{
                            action: {
                                type: "open_link",
                                link: buttonLink,
                                label: buttonLabel
                            }
                        }] : []
                    });
                } else {
                    console.warn('CAROUSEL WARNING: upload returned without owner/id, skipping card');
                }
            } catch (cardErr) {
                console.warn('CAROUSEL WARNING: failed to process card image', cardErr?.message || cardErr);
            }
        }

        const carouselObject = { type: 'carousel', elements };
        console.log("CAROUSEL FINAL OBJECT:", carouselObject);

        let sent = 0;
        const errors = [];

        for (const user of audience) {
            try {
                await vk.api.messages.send({
                    user_id: user.vkId,
                    random_id: Date.now(),
                    message: message || " ",
                    template: JSON.stringify(carouselObject),
                });
                sent += 1;
            } catch (err) {
                console.error('Failed to send carousel message', { user: user.vkId, err });
                errors.push({ user: user.vkId, message: err?.message || 'send_failed' });
            }
        }

        return res.json({
            sent,
            failed: errors.length,
            errors,
            carousel: carouselObject,
        });
    }
    // === END FIXED VK CAROUSEL SUPPORT ===

    let sharedPhotoBuffer = null;
    let sharedPhotoFilename = 'campaign.jpg';
    let sharedPhotoAttachment = null;

    if (!isCarousel && (requestedImage || requestedImageBase64)) {
        try {
            const photoResult = await uploadCampaignImage({ imageUrl: requestedImage, imageBase64: requestedImageBase64, imageName });
            sharedPhotoBuffer = photoResult.buffer;
            sharedPhotoFilename = photoResult.filename || sharedPhotoFilename;
        } catch (err) {
            console.error('Image processing failed:', err.message || err);
            return res.status(400).json({ error: err.message || 'Failed to process image' });
        }
    }

    // =========================
    // UPLOAD PHOTO TO VK (single correct block)
    // =========================
    if (!isCarousel && sharedPhotoBuffer && !sharedPhotoAttachment) {

        console.log("VK PHOTO UPLOAD: starting…", {
            filename: sharedPhotoFilename,
            bufferLength: sharedPhotoBuffer?.length,
        });

        try {
            const uploadServer = await vk.api.photos.getMessagesUploadServer({ peer_id: 1 });
            console.log("VK PHOTO UPLOAD SERVER:", uploadServer);

            const form = new FormData();
            form.append('photo', new Blob([sharedPhotoBuffer]), sharedPhotoFilename);

            const uploadResponse = await fetch(uploadServer?.upload_url, { method: 'POST', body: form });
            const uploadJson = await uploadResponse.json();
            console.log("VK PHOTO UPLOAD RESPONSE:", uploadJson);

            const saved = await vk.api.photos.saveMessagesPhoto(uploadJson);
            console.log("PHOTO UPLOAD RESULT", saved);

            if (saved?.[0]?.owner_id && saved?.[0]?.id) {
                sharedPhotoAttachment = `photo${saved[0].owner_id}_${saved[0].id}`;

                console.log("VK PHOTO ATTACH READY:", sharedPhotoAttachment);
            } else {
                console.warn("VK PHOTO UPLOAD: no owner_id/id returned");
            }

        } catch (err) {
            console.error("VK PHOTO UPLOAD ERROR:", err);
        }
    }

    const voiceResult = await uploadCampaignVoice({ voiceUrl: requestedVoice, voiceBase64, voiceName });
    let voiceAttachment = voiceResult?.attachment || null;
    let voiceBuffer = voiceResult?.buffer;
    let voiceFilename = voiceResult?.filename;

    if ((requestedVoice || voiceBase64) && !voiceAttachment && !voiceBuffer) {
        try {
            if (voiceBase64) {
                const parsed = parseBase64DataUri(voiceBase64, 'audio/mpeg');
                voiceBuffer = parsed?.buffer;
                voiceFilename = parsed?.filename || voiceFilename || voiceName || 'voice.ogg';
            } else if (requestedVoice && (requestedVoice.startsWith('http://') || requestedVoice.startsWith('https://'))) {
                const fetched = await fetchAudioBuffer(requestedVoice);
                voiceBuffer = fetched?.buffer;
                voiceFilename = voiceFilename || voiceName || `voice.${pickAudioExtension(fetched?.contentType, 'mp3')}`;
            }
        } catch (fallbackErr) {
            console.warn('Unable to recover voice buffer for campaign send', fallbackErr?.message || fallbackErr);
        }
    }

    if ((requestedVoice || voiceBase64) && !voiceAttachment && !voiceBuffer) {
        console.warn('Campaign send without voice attachment despite voice payload', { campaignId, requestedVoice, hasBase64: !!voiceBase64 });
    }
    let sent = 0;
    const errors = [];
    let finalPhotoAttachment = null;

    for (const user of audience) {
        try {
            const intro = effectiveCampaignType === 'GAME_BATTLESHIP'
                ? `${message}\n\n🏴‍☠️ Начни игру: напиши "Старт" или координату (например A1)`
                : message;

            const payload = {
                user_id: user.vkId,
                random_id: Date.now() + Math.floor(Math.random() * 100000),
                message: intro,
            };

            if (isCarousel) {
                const elements = [];
                for (const card of carouselItems) {
                    const base64 = (card?.imageBase64 || card?.image_base64 || '').trim();
                    if (!base64) continue;
                    let parsed = null;
                    try {
                        parsed = parseBase64DataUri(base64, 'image/jpeg');
                    } catch (parseErr) {
                        console.warn('Failed to parse carousel image', parseErr?.message || parseErr);
                        continue;
                    }

                    const buffer = parsed?.buffer;
                    const filename = parsed?.filename || card?.imageName || 'carousel.jpg';
                    if (!buffer) continue;

                    try {
                        const uploadedPhoto = await vk.upload.messagePhoto({
                            peer_id: user.vkId,
                            source: { value: buffer, filename },
                        });
                        console.log("VK PHOTO UPLOAD RESULT:", uploadedPhoto);
                        if (uploadedPhoto?.owner_id && uploadedPhoto?.id) {
                            const photoAttachment = `photo${uploadedPhoto.owner_id}_${uploadedPhoto.id}${uploadedPhoto.access_key ? '_' + uploadedPhoto.access_key : ''}`;
                            elements.push({
                                title: card?.title || '',
                                description: card?.description || '',
                                photo_id: photoAttachment,
                                action: {
                                    type: 'open_link',
                                    link: card?.buttonLink || '',
                                },
                                buttons: [
                                    {
                                        action: {
                                            type: 'open_link',
                                            label: card?.buttonLabel || 'Открыть',
                                            link: card?.buttonLink || '',
                                        }
                                    }
                                ],
                            });
                        }
                    } catch (carouselUploadErr) {
                        console.warn('Carousel photo upload failed', carouselUploadErr?.message || carouselUploadErr);
                    }
                }

                if (elements.length > 0) {
                    payload.template = JSON.stringify({ type: 'carousel', elements });
                }

                await vk.api.messages.send(payload);
                sent += 1;
                continue;
            }

            let photoAttachment = null;
            let photoBuffer = sharedPhotoBuffer;
            let photoFilename = sharedPhotoFilename;
            const attachments = [];

            if (sharedPhotoAttachment) {
                attachments.push(sharedPhotoAttachment);
                photoAttachment = sharedPhotoAttachment;
                finalPhotoAttachment = sharedPhotoAttachment;
            }

            // Используем глобально загруженное фото, без повторного peer upload
            if (!photoAttachment && sharedPhotoAttachment) {
                photoAttachment = sharedPhotoAttachment;
            }

            // Загружаем фото под конкретный peer, если есть готовый буфер
            if (!photoAttachment && photoBuffer) {
                try {
                    const uploadServer = await vk.api.photos.getMessagesUploadServer({ peer_id: user.vkId });
                    console.log("VK PHOTO UPLOAD SERVER:", uploadServer);

                    const form = new FormData();
                    form.append('photo', new Blob([photoBuffer]), photoFilename);

                    const uploadResponse = await fetch(uploadServer?.upload_url, { method: 'POST', body: form });
                    const uploadJson = await uploadResponse.json();
                    console.log("VK PHOTO UPLOAD RESPONSE:", uploadJson);

                    const saved = await vk.api.photos.saveMessagesPhoto(uploadJson);
                    console.log("PHOTO UPLOAD RESULT", saved);

                    if (saved?.[0]?.owner_id && saved?.[0]?.id) {
                        photoAttachment = `photo${saved[0].owner_id}_${saved[0].id}`;
                    }
                } catch (peerPhotoErr) {
                    console.warn('Peer-specific photo upload failed', peerPhotoErr?.message || peerPhotoErr);
                }
            }

            // Если буфер отсутствует, но есть валидная ссылка на картинку — скачиваем и пробуем загрузить под конкретного получателя
            if (!photoAttachment && !photoBuffer && requestedImage && (requestedImage.startsWith('http://') || requestedImage.startsWith('https://'))) {
                try {
                    const fetched = await fetchImageBuffer(requestedImage);
                    if (fetched?.buffer) {
                        photoBuffer = fetched.buffer;
                        photoFilename = `image.${pickExtension(fetched.contentType)}`;
                        sharedPhotoBuffer = photoBuffer;
                        sharedPhotoFilename = photoFilename;
                        const uploadServer = await vk.api.photos.getMessagesUploadServer({ peer_id: user.vkId });
                        console.log("VK PHOTO UPLOAD SERVER:", uploadServer);

                        const form = new FormData();
                        form.append('photo', new Blob([photoBuffer]), photoFilename);

                        const uploadResponse = await fetch(uploadServer?.upload_url, { method: 'POST', body: form });
                        const uploadJson = await uploadResponse.json();
                        console.log("VK PHOTO UPLOAD RESPONSE:", uploadJson);

                        const saved = await vk.api.photos.saveMessagesPhoto(uploadJson);
                        console.log("PHOTO UPLOAD RESULT", saved);

                        if (saved?.[0]?.owner_id && saved?.[0]?.id) {
                            photoAttachment = `photo${saved[0].owner_id}_${saved[0].id}`;
                        }
                    }
                } catch (latePhotoErr) {
                    console.warn('Deferred peer photo upload failed', latePhotoErr?.message || latePhotoErr);
                }
            }

            if (photoAttachment) {
                if (!attachments.includes(photoAttachment)) attachments.push(photoAttachment);
                finalPhotoAttachment = photoAttachment;
            }

            console.log("FINAL PHOTO ATTACHMENT:", photoAttachment);
            // Если общий голосовой аттачмент отсутствует, но есть подготовленный буфер, пробуем загрузить под конкретный peer_id
            if (!voiceAttachment && voiceBuffer) {
                try {
                    voiceAttachment = await uploadAudioMessageViaDocs({ buffer: voiceBuffer, filename: voiceFilename || 'voice.ogg', contentType: 'audio/ogg', peerId: user.vkId });
                } catch (peerDocsErr) {
                    console.warn('Peer docs voice upload failed, fallback to audioMessage', peerDocsErr);
                }

                if (!voiceAttachment) {
                    try {
                        const audio = await vk.upload.audioMessage({ peer_id: user.vkId, source: { value: voiceBuffer, filename: voiceFilename || 'voice.ogg' } });
                        if (audio?.owner_id && audio?.id) {
                            voiceAttachment = `audio_message${audio.owner_id}_${audio.id}${audio.access_key ? '_' + audio.access_key : ''}`;
                            uploadedCampaignVoices.set(requestedVoice || voiceBase64 || `peer:${user.vkId}`, voiceAttachment);
                        }
                    } catch (peerUploadErr) {
                        console.error('Peer-specific voice upload failed', peerUploadErr);
                    }
                }
            }

            if (voiceAttachment) attachments.push(voiceAttachment);

            if (attachments.length > 0) {
                payload.attachment = attachments.join(',');
            }

            await vk.api.messages.send(payload);

            sent += 1;
        } catch (err) {
            console.error('Failed to send campaign message', { user: user.vkId, err });
            errors.push({ user: user.vkId, message: err?.message || 'send_failed' });
        }
    }

    res.json({
        sent,
        failed: errors.length,
        errors,
        photoAttachment: finalPhotoAttachment,
        voiceAttachment,
        recipients: audience.map((u) => ({
            vkId: u.vkId,
            segment: u.segment,
            games_played: u.games_played,
        })),
    });
});

async function start() {
    await vk.updates.start();
    console.log('Bot started on port ' + PORT);
    app.listen(PORT);
}
start();
