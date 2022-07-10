const path = require('path');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const multer = require("multer");
const { createCanvas, loadImage } = require('canvas');
require('dotenv').config();

const app = express();
const port = 3000;

var TarantoolConnection = require('tarantool-driver');
var conn = new TarantoolConnection({
    host: process.env.TARANTOOL_HOST || 'localhost',
    port: process.env.TARANTOOL_PORT || '3301',
    username: process.env.TARANTOOL_USER || 'guest',
    password: process.env.TARANTOOL_PASSWORD || '',
});

const handleError = (res) => {
    res
        .status(500)
        .contentType("text/plain")
        .end("Something went wrong!");
};

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: function (req, file, callback) {
        var ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
            return callback(new Error('Only images are allowed'))
        }
        callback(null, true);
    },
    limits: {
        fileSize: 1024 * 1024,
    }
}).single('image');

app.post('/set', upload, async (req, res) => {
    if (!req.body?.u_text && !req.body?.b_text && !req.file)
        return handleError(res);
    if (!req.file) {
        const data = (await conn.eval("return find_meme('" + req.body.u_text + req.body.b_text + "')"))[0];
        res.send(data.id);
    } else if (!req.body.u_text && !req.body.b_text) {
        let mem = (await conn.select('memes', 'image', 1, 0, 'eq', [req.file.buffer.toString('base64')]))[0];
        if (mem) {
            res.send(mem[0]);
        } else {
            mem = (await conn.eval("return box.space.memes.index.image:random(" + getRandomInt(15150) + ")"))[0];
            const id = uuidv4();
            await conn.insert('memes', [id, mem[1], mem[2], req.file.buffer.toString('base64')]);
            res.send(id);
        }
    } else {
        const id = uuidv4();
        await conn.insert('memes', [id, req.body.u_text, req.body.b_text, req.file.buffer.toString('base64')]);
        res.send(id);
    }
})

function getFontSize(canvas, context, text) {
    var fontsize = 100; do {
        fontsize--;
        context.font = fontsize + "px sans-serif";
    } while (context.measureText(text).width > canvas.width)
    return fontsize;
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

app.get('/get', async (req, res) => {
    let mem;
    if (req.query.id) {
        mem = (await conn.select('memes', 0, 1, 0, 'eq', [req.query.id]));
        if (!mem.length)
            return handleError(res);
        mem = mem[0];
    } else {
        let temp = (await conn.eval("return box.space.memes.index.text:random(" + getRandomInt(15150) + ")"));
        if (!temp.length)
            return handleError(res);
        temp = temp[0];
        mem = [
            0,
            temp[1],
            temp[2],
            (await conn.eval("return box.space.memes.index.image:random(" + getRandomInt(15150) + ")"))[0][3],
        ];
    }
    const image = await loadImage(Buffer.from(mem[3], 'base64'));
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = 'center';

    ctx.textBaseline = 'top';
    ctx.font = getFontSize(canvas, ctx, mem[1]) + 'px sans-serif';
    ctx.fillText(mem[1], canvas.width / 2, 20);
    ctx.textBaseline = 'bottom';
    ctx.font = getFontSize(canvas, ctx, mem[2]) + 'px sans-serif';
    ctx.fillText(mem[2], canvas.width / 2, canvas.height - 20);

    res.contentType('image/jpeg');
    res.send(canvas.toBuffer());
})

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
})

conn.eval(require('./schema.js'));

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
})