
// give this tab unique id to be able to target single browser tab with messages
const tabId = Math.random().toString(36).substring(2,5);

// initialize UI slots to be lazily accessible
const slotNames = ["escal", "othere", "creas", "varelse", "trusion", "intar", "clevel", "rement", "eping"];

let componentLazyImport = {};
for (let name of slotNames) {
    componentLazyImport[name] = () => import('./ui/'+name+'/module.js');
}

//Vue main app responsible for handling reactive slots in the UI
new Vue({
    el: '#app',
    data: {
      authors: [],
      slots: [],
      revision: 1
    },
    components: componentLazyImport,
    created() {
        this.setupStream();
    },
    methods: {
        setupStream() {
            let es = new EventSource('/events?tabId='+tabId);
            es.addEventListener('message', event => {
                let data = JSON.parse(event.data);
                switch (data.type) {
                    case 'publish': this.updateComponent(data.value); break;
                    case 'model': this.updateModel(data.value); break;
                }
                console.log(JSON.stringify(data));
            }, false);
        },
        updateModel(components) {
            this.slots = components;
        },
        updateComponent(name) {
            if (!this.slots.includes(name)) {
                this.slots.push(name); //causes re-render
            } else {
                document.location.reload(true);
            }
            this.revision++;
        }
    }
});