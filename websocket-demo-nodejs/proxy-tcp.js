import net from 'net';

//获取本地时间字符串
function getDateStr() {
    return (new Date()).toLocaleString();
}
// 创建 TCP 代理
function proxyTCP(key, conf) {
    let [bind, server] = [conf.bind, conf.server];
    let tcpServer = net.createServer((c) => {
        console.info(`[${getDateStr()}] [${key}] [INFO] - TCP Client connect ${c.remoteAddress}:${c.remotePort}`);
        let client = net.connect({ port: server[1], host: server[0] }, () => {
            c.pipe(client);
        });
        client.pipe(c);
        client.on('error', (err) => {
            console.error(`[${getDateStr()}] [${key}] [ERROR] - ${err}`);
            c.destroy();
        });
        c.on('error', (err) => {
            console.error(`[${getDateStr()}] [${key}] [ERROR] -  ${err}`);
            client.destroy();
        });
    });
    tcpServer.listen({ host: bind[0], port: bind[1], }, () => {
        console.info(`[${getDateStr()}] [${key}] [INFO] - TCP Server start ${bind[0]}:${bind[1]}`);
    });
    return tcpServer;
}

const proxyConfig = {    
    "Remote Debugging Proxy": {
        mode: "tcp",
        bind: ["0.0.0.0", 9229],
        server: ['appserver.coderrr.org', 9229]
    }
};

const servers = {};

for (let k in proxyConfig) {
    let conf = proxyConfig[k];
    if (conf.mode == "tcp") {
        servers[k] = proxyTCP(k, conf);
    }
}