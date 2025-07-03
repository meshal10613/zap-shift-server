const fs = require('fs');
const { buffer } = require('stream/consumers');
const key = fs.readFileSync('./firebase-admin-key.json', 'utf8');
const base64 = Buffer.from(key).toString('base64');