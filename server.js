const os = require('os');
const express = require('express');
const cors = require('cors');
const config = require('./config.js');
const server = express();

server.use(cors());
server.disable('x-powered-by');

const FoxFileManager = new (require('./server/FoxFileManager.js'))({
    workspace: `${__dirname}/workspace`
});
server.use("/api", FoxFileManager.Router)

server.listen(config.port, () => {
    let ips = [];
    Object.values(os.networkInterfaces()).forEach((iface) => {
        iface?.forEach((alias) => {
            if (alias.family === 'IPv4') {
                ips.push(`${alias.address}:${config.port}`);
            }
        });
    });
    console.log(`\n[server] working under: ${ips.join(", ")}\n`);
});