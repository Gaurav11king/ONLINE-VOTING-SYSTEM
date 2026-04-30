const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10
});
app.use('/register-step1', limiter);

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const voterSchema = new mongoose.Schema({
  voterId: { type: String, unique: true, required: true },
  aadhaar: { type: String, unique: true, required: true },
  name: String,
  documents: [String],
  qrCode: String,
  ipAddress: String,
  hasVoted: { type: Boolean, default: false },
  verified: { type: Boolean, default: true },
  registeredAt: { type: Date, default: Date.now }
});

const partySchema = new mongoose.Schema({
  name: String,
  symbol: String,
  votes: { type: Number, default: 0 }
});

const Voter = mongoose.model('Voter', voterSchema);
const Party = mongoose.model('Party', partySchema);

async function initParties() {
  const count = await Party.countDocuments();
  if (count === 0) {
    await Party.insertMany([
      { name: 'BJP', symbol: '🌺 Lotus' },
      { name: 'Congress', symbol: '✋ Hand' },
      { name: 'AAP', symbol: '🧹 Broom' },
      { name: 'SP', symbol: '🚲 Bicycle' }
    ]);
    console.log('✅ Parties initialized');
  }
}

async function broadcastResults() {
  const parties = await Party.find().sort({ votes: -1 });
  const totalVotes = parties.reduce((sum, p) => sum + p.votes, 0);
  io.emit('voteUpdate', { parties, totalVotes });
}

app.get('/', (req, res) => res.render('index'));

app.get('/register-step1', (req, res) => res.render('register-step1', { error: null }));

app.post('/register-step1', upload.fields([
  { name: 'aadhaar', maxCount: 1 },
  { name: 'voterCard', maxCount: 1 }
]), async (req, res) => {
  try {
    const { voterId, aadhaar, name } = req.body;

    const existing = await Voter.findOne({ $or: [{ voterId }, { aadhaar }] });
    if (existing) {
      return res.render('register-step1', { error: '❌ Already registered!' });
    }

    const voter = new Voter({
      voterId, aadhaar, name,
      documents: [req.files.aadhaar[0].path, req.files.voterCard[0].path],
      ipAddress: req.ip
    });
    await voter.save();

    const qrData = await QRCode.toDataURL(`Voter: ${voter._id}`);
    voter.qrCode = qrData;
    await voter.save();

    res.redirect(`/ballot/${voter._id}`);
  } catch (err) {
    console.error(err);
    res.render('register-step1', { error: 'Registration failed. Try again.' });
  }
});

app.get('/ballot/:voterId', async (req, res) => {
  const voter = await Voter.findById(req.params.voterId);
  if (!voter || voter.hasVoted) return res.render('vote-error');
  const parties = await Party.find();
  res.render('ballot', { voterId: req.params.voterId, parties });
});

app.post('/cast-vote', async (req, res) => {
  const { voterId, partyName } = req.body;
  const voter = await Voter.findById(voterId);

  if (!voter || voter.hasVoted) return res.render('vote-error');

  await Party.updateOne({ name: partyName }, { $inc: { votes: 1 } });
  voter.hasVoted = true;
  await voter.save();

  broadcastResults();
  res.render('vote-success');
});

app.get('/live-results', (req, res) => res.render('live-results'));
app.get('/api/results', async (req, res) => {
  const parties = await Party.find().sort({ votes: -1 });
  res.json(parties);
});

app.get('/admin', async (req, res) => {
  const voters = await Voter.find().sort({ registeredAt: -1 });
  const parties = await Party.find().sort({ votes: -1 });
  res.render('admin', { voters, parties });
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voting')
  .then(async () => {
    console.log('✅ MongoDB Connected');
    await initParties();
    server.listen(process.env.PORT || 5000, () => {
      console.log('🚀 Server: http://localhost:5000');
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Error:', err.message);
    process.exit(1);
  });
