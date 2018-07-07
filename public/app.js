// give this tab unique id to be able to target single browser tab with messages
const tabId = Math.random().toString(36).substr(2,7);

// initialize UI slots to be lazily accessible
const slotNames = ["escal", "othere", "creas", "varelse", "trusion", "intar", "clevel", "rement", "eping"];

//preapre all slot names to be loadable components
let componentLazyImport = Object.assign(...slotNames.map( name => ({[name]: () => import('./ui/'+name+'/module.js')}) ));

const EventBus = new Vue();

//Vue main app responsible for handling reactive slots in the UI
new Vue({
    el: '#app',
    data: {
       registeredSlots: [],
       componentRegistry: {}
    },

    components: componentLazyImport,

    created() {
        this.setupStream();
    },

    methods: {
        //configure bidirectional web socket event stream
        setupStream() {
            let serverUrl = (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host;
            let ws = new WebSocket(serverUrl + '/events?tabId='+tabId);

            ws.onopen = () => {};
            ws.onclose = () => {};

            ws.onmessage = (event) => {
                let data = JSON.parse(event.data);
                switch (data.type) {
                    case 'component': this.onComponentUpdateFromServer(data.value); break;
                    case 'model': this.onModelUpdateFromServer(data.value); break;
                }
                console.log(JSON.stringify(data));
            };

            //register event bridge from UI to the server
            for (let slot of slotNames) {
                EventBus.$on('server.'+slot,  (payLoad) => ws.send( JSON.stringify({slot:slot, data:payLoad}) ));
            }
            EventBus.$on('server.main',  (payLoad) => ws.send( JSON.stringify({slot:'main', data:payLoad}) ));
        },

        //called when model data update is received from server
        onModelUpdateFromServer(modelDto) {
            if (modelDto.component) {
                //find a child for component and update its data
                this.$children.forEach(v => {
                   if (v.$options._componentTag === modelDto.component) {
                       v[modelDto.data.path] = modelDto.data.value;
                   }
                });
            } else {
                this.registeredSlots = modelDto;
            }
        },

        //called when UI component update is received from server
        onComponentUpdateFromServer(componentDto) {
            let existing = this.registeredSlots.includes(componentDto.component);
            if (!existing) {
                this.registeredSlots.push(componentDto.component); //causes reactive re-render of app
                this.componentRegistry[componentDto.component] = componentDto;
            } else if (!existing.version || existing.version !== componentDto.version) {
                //since components are not easily removable, we reload the ui, but try to make it less often
                document.location.reload(true);
            }
        }
    }
});