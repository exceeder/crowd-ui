// give this tab unique id to be able to target single browser tab with messages
const tabId = Math.random().toString(36).substr(2,7);

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
      model: {
          data: ''
      },
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
                    case 'component': this.updateComponent(data.value); break;
                    case 'model': this.updateModel(data.value); break;
                }
                console.log(JSON.stringify(data));
            }, false);
        },
        updateModel(event) {
            if (event.component) {
                //find a child for component and update its data
                this.$children.forEach(v => {
                   if (v.$options._componentTag === event.component) {
                       v[event.data.path] = event.data.value;
                   }
                });
            } else {
                this.slots = event;
            }
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