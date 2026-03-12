import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Additional routes can be defined here

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});