import EventBus from '/event-bus.js';
export default {
    template: `
    <div>
      <form class="form-inline ml-2" @submit.prevent="handleSubmit">
          <div class="input-group is-invalid">
            <div class="input-group-prepend mr-2">
              <div class="input-group-text">$</div>
              <input type="text" class="form-control has-error" id="c2add" placeholder="100" v-model="amountToAdd">         
            </div>
            <button type="submit" class="btn btn-primary">Add</button>
             <div class="invalid-feedback" v-bind:class="{ 'd-block': invalidInput }" style="float:left">
                Please provide a number.
              </div>
          </div>  
      </form>
     <p class="my-info">Current balance: {{ balance }}</p>
    </div>
  `,
    data() {
        return {
            amountToAdd: '',
            balance: '0'
        }
    },
    computed: {
        invalidInput() { return isNaN(this.amountToAdd); }
    },
    methods: {
      handleSubmit() {
          if (isNaN(this.amountToAdd)) {
             return;
          }
          EventBus.$emit('server.escal', {amountToAdd: parseFloat(this.amountToAdd) });
      }
    }

}