require('dotenv').config();
const { VK, Keyboard } = require('vk-io');
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { createCanvas } = require('canvas');
const https = require('https');
const http = require('http');
const { URL } = require('url');

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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

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

  // Полная логика выстрела
  static processShot(board, x, y) {
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

// === БОТ ===
vk.updates.on('message_new', async (ctx) => {
    if (!ctx.text) return;
    const text = ctx.text;
    
    let user = await prisma.user.findUnique({ where: { vkId: ctx.senderId } });
    if (!user) {
        try {
            const [info] = await vk.api.users.get({ user_ids: ctx.senderId });
            user = await prisma.user.create({ data: { vkId: ctx.senderId, firstName: info?.first_name, lastName: info?.last_name } });
        } catch(e) {
            user = await prisma.user.create({ data: { vkId: ctx.senderId } });
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
        const photo = await vk.upload.messagePhoto({ source: { value: buffer } });
        
        return ctx.send({
            message: `Игра #${lastGame.id}. Победитель: ${user.firstName}`,
            attachment: photo,
            keyboard: Keyboard.builder().textButton({ label: 'Старт', color: 'positive' }).oneTime()
        });
    }

    const game = await prisma.game.findFirst({ where: { userId: user.id, status: 'ACTIVE' } });

    if (text.toLowerCase() === 'старт') {
        if (game) await prisma.game.update({ where: { id: game.id }, data: { status: 'FINISHED' } });
        const board = SeaBattleGame.generateBoard();
        await prisma.game.create({ data: { userId: user.id, board: JSON.stringify(board) } });
        return ctx.send({
            message: '🏴‍☠️ Бой начался! Стреляй (А1).',
            keyboard: Keyboard.builder().textButton({ label: 'Сдаться', color: 'negative' }).inline()
        });
    }
    
    if (text.toLowerCase() === 'сдаться' && game) {
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
        keyboard: Keyboard.builder().textButton({ label: 'Старт', color: 'positive' }).oneTime()
    });
});

app.get('/api/users', async (req, res) => res.json(await prisma.user.findMany({ include: { games: true } })));
app.get('/api/dashboard', (req, res) => res.json({ kpi: {}, charts: {}, lists: {} }));

// === Рассылки ===
const loadRecipients = async () => {
    // Берём реальные контакты из базы, если есть хоть один пользователь
    const users = await prisma.user.findMany({ include: { games: true } });

    if (users.length > 0) {
        return users.map((u) => ({
            vkId: u.vkId,
            // Минимальная информация для фильтров
            games_played: (u.games || []).length,
            // Пока нет поля в БД — считаем подписчиком, чтобы не отсечь аудиторию
            is_member: true,
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

const fetchImageBuffer = (imageUrl, redirectDepth = 0) => new Promise((resolve, reject) => {
    if (!imageUrl) return reject(new Error('Image URL not provided'));

    try {
        const url = new URL(imageUrl.trim());
        const client = url.protocol === 'https:' ? https : http;

        const request = client.get({
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || undefined,
            path: url.pathname + (url.search || ''),
            headers: {
                'Accept': 'image/*,*/*;q=0.8',
                'Accept-Encoding': 'identity',
                'User-Agent': 'PizzaBotCampaign/1.0 (+https://example.com)',
                'Host': url.hostname,
            },
        }, (response) => {
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                if (redirectDepth > 3) return reject(new Error('Too many redirects while fetching image'));
                const redirectUrl = new URL(response.headers.location, url);
                return resolve(fetchImageBuffer(redirectUrl.toString(), redirectDepth + 1));
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to fetch image. Status: ${response.statusCode}`));
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
            request.destroy(new Error('Image request timed out'));
        });

        request.on('error', reject);
    } catch (err) {
        reject(err);
    }
});

const pickExtension = (contentType = '', fallback = 'jpg') => {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('jpeg')) return 'jpg';
    if (contentType.includes('jpg')) return 'jpg';
    if (contentType.includes('gif')) return 'gif';
    return fallback;
};

const uploadCampaignImage = async (imageUrl) => {
    if (!imageUrl) return null;

    try {
        try {
            const directPhoto = await vk.upload.messagePhoto({ source: { url: imageUrl } });
            if (directPhoto?.owner_id && directPhoto?.id) {
                return `photo${directPhoto.owner_id}_${directPhoto.id}`;
            }
        } catch (directErr) {
            console.warn('Direct VK upload failed, fallback to buffer', directErr?.message || directErr);
        }

        const { buffer, contentType } = await fetchImageBuffer(imageUrl);
        if (!buffer || buffer.length === 0) throw new Error('Empty image buffer');

        const filename = `campaign.${pickExtension(contentType)}`;
        const photo = await vk.upload.messagePhoto({ source: { value: buffer, filename } });

        if (photo?.owner_id && photo?.id) {
            return `photo${photo.owner_id}_${photo.id}`;
        }
    } catch (err) {
        console.error('Image upload failed', err);
    }

    return null;
};

app.post('/api/campaigns/send', async (req, res) => {
    const { campaignId, message, type, segment = 'ALL', imageUrl, image_url, filters = {} } = req.body || {};

    if (!message) return res.status(400).json({ error: 'Message is required' });

    const audience = filterRecipients(await loadRecipients(), segment, filters);
    if (audience.length === 0) return res.status(400).json({ error: 'No recipients for selected filters' });

    const photoAttachment = await uploadCampaignImage(imageUrl || image_url);
    let sent = 0;
    const errors = [];

    for (const user of audience) {
        try {
            const intro = type === 'GAME_BATTLESHIP'
                ? `${message}\n\n🏴‍☠️ Начни игру: напиши "Старт" или координату (например A1)`
                : message;

            const payload = {
                user_id: user.vkId,
                random_id: Date.now() + Math.floor(Math.random() * 100000),
                message: intro,
            };

            if (photoAttachment) {
                payload.attachment = photoAttachment;
            }

            await vk.api.messages.send(payload);

            sent += 1;
        } catch (err) {
            errors.push({ user: user.vkId, message: err?.message || 'send_failed' });
        }
    }

    res.json({
        sent,
        failed: errors.length,
        errors,
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
