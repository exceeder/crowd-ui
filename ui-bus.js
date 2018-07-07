const events = require('events');
const bus = new events.EventEmitter();
const connections = [];

// server-sent events support
//Usage in the app:
//  use `bus.emit('component', tabId, vueComponent);` or `bus.emit('model', tabId, model);` to send to a particular tab
//  send empty string as id to broadcast to all, e.g: bus.emit('publish', '', 'going up');

class UiBus {
    //e.g.   ('/events', app) where app is an express app
    constructor(wsServer, onConnect) {
        this.wsServer = wsServer;
        this.onConnect = onConnect;
        this.wsServer.on('connection', (ws, req) => this.onBrowserConnected(ws, req));
        //app.get(path, (req, res) => this.onEventsConnect(req, res));
    }

    static bus() {
        return bus;
    }

    static emit() {
        bus.emit.apply(bus, arguments);
    }

    onBrowserConnected(ws, req) {
        //tabId is there to differentiate browser tabs / users / different browsers
        let tabId = '';
        if (req.url.indexOf('tabId=') > 0) tabId = req.url.substring(req.url.indexOf('tabId=')+6);
        const remoteAddr = req.connection.remoteAddress;
        console.log('websocket init [%s] for tab [%s]', remoteAddr, tabId);
        ws.isAlive = true;

        //register connection object per browser tab per user, binding server side events to web sockets
        let conn = {
            tabId:tabId,
            ws:ws,
            uiListener: (id, data) => this.pushToUi("component", ws, id, data, tabId),
            dataListener: (id, data) => this.pushToUi("model", ws, id, data, tabId)
        };
        connections.push(conn);
        UiBus.bus().on('component', conn.uiListener);
        UiBus.bus().on('model', conn.dataListener);

        //on initial connection, push all components to the UI
        if (this.onConnect) {
            let model = this.onConnect(tabId, req);
            if (model) {
                this.pushToUi("model", ws, '', model, tabId);
            }
        }

        ws.on('open', () => {
            console.log('ws open for '+tabId);
        });
        ws.on('message', (data) => {
            console.log("==> WS: " + data);
        });
        ws.on('error', (err) => {
            console.log("!==> WS: " + err);
        });
        ws.on('close', (e) => {
            ws.isAlive = false;
            console.log('ws close [%s] - %s', remoteAddr, e);
            for (let i = 0; i < connections.length; i++) {
                let c = connections[i];
                if (ws === c.ws) {
                    UiBus.bus().removeListener('component', c.uiListener);
                    UiBus.bus().removeListener('model', c.dataListener);
                    connections.splice(i, 1);
                    break;
                }
            }
        });
    }

    pushToUi(type, ws, id, data, tabId) {
        try {
            if (id === '' || id === tabId) {
                ws.send(JSON.stringify({type: type, value: data}))
            }
        } catch (e) {
            console.log("Cannot push to UI:",e);
        }
    }
}

module.exports = UiBus;



