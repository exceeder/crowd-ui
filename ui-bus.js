const events = require('events');
const bus = new events.EventEmitter();
const connections = [];

// server-sent events support
//Usage in the app:
//  use `bus.emit('component', tabId, vueComponent);` or `bus.emit('model', tabId, model);` to send to a particular tab
//  send empty string as id to broadcast to all, e.g: bus.emit('publish', '', 'going up');

class UiBus {
    //e.g.   ('/events', app) where app is an express app
    constructor(path, app, onConnect) {
        this.app = app;
        this.onConnect = onConnect;
        app.get(path, (req, res) => this.onEventsConnect(req, res));
    }

    static bus() {
        return bus;
    }

    static emit() {
        bus.emit.apply(bus, arguments);
    }

    onEventsConnect(req, res) {
        // Set highest timeout, 100mil is ~27 hours here
        req.socket.setTimeout(100000000);
        // Write headers needed for sse
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        res.write('\n');

        //tabId is there to differentiate browser tabs / users / different browsers
        let tabId = req.query['tabId'];

        //Node's internal event bus listener that pushes events to all web UIs
        let uiListener = (id, data) => {
            if (id === '' || id === tabId) {
                this.sendToUi("component", res, data);
            }
        };
        UiBus.bus().on('component', uiListener);

        let dataListener = (id, data) => {
            if (id === '' || id === tabId) {
                this.sendToUi("model", res, data);
            }
        };
        UiBus.bus().on('model', dataListener);

        connections.push({req:req, listener:dataListener});

        req.on('close', function () {
            for (let i = 0; i < connections.length; i++) {
                let c = connections[i];
                if (c.req === req) {
                    UiBus.bus().removeListener('progress',c.listener);
                    connections.splice(i, 1);
                    break;
                }
            }
        });

        //push initial data state on connect
        if (this.onConnect) {
            let model = this.onConnect(tabId, req);
            if (model) {
                this.sendToUi("model", res, model);
            }
        }

    }

    sendToUi(type, res, data) {
        res.write('data: ' + JSON.stringify({type: type, value: data}) + '\n\n');
    }
}

module.exports = UiBus;



