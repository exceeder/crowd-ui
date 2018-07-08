import EventBus from '/event-bus.js';
import Sparkline from '/sparkline.js';
const slot = '%SLOTNAME%';
export default {
    template: `
    <div>
      <!-- reactive, validating input form -->
      <form class="form-inline ml-2" @submit.prevent="handleSubmit">
          <div class="input-group w-100 d-flex justify-content-between">
            <div class="input-group-prepend">
              <div class="input-group-text">$</div>
            </div>  
            <input type="text" class="form-control has-error" placeholder="10" 
              v-model="amountToAdd" :class="{'is-invalid': invalidInput}">  
            <div class="input-group-append mr-2">
               <button type="submit" class="btn btn-primary">Add</button>       
            </div>                     
          </div>  
          <div class="invalid-feedback d-block" :class="{ 'invisible': !invalidInput }">
                Please provide a number.
          </div>
      </form>
      <!-- reactive info box -->
      <p class="my-info">Current balance: \${{ balance }}</p>
      <!-- reactive charts -->
      <div class="d-flex flex-row justify-content-between">     
        <div class="p-2">Data:
             <sparkline :width="100">
                 <sparklineBar :data="spBarData"/>
             </sparkline>
        </div>        
        <div class="p-2">Chart:
             <sparkline :width="100">
                 <sparklineLine :data="spLineData" />
             </sparkline>
         </div>
         </section>
      </div>
      <div class="w-100 text-center">
        <sparkline :width="150" :height="150">
            <sparklinePie :data="spPieData" :tooltipProps="pieTooltip"/>
        </sparkline>
      </div>
    </div>
  `,
    data() {
        return {
            amountToAdd: '',
            balance: '0',
            spBarData: [1,5,7,10,23,11,14,17,19,5,11],
            spLineData: [1,5,7,10,23,11,14,17,19,5,11],
            spPieData: [{value:1,color:'#007b90'},{value:5,color:'#007bb0'},{value:7,color:'#007be0'},],
            pieTooltip: {
                formatter (val) {
                    return `At ${val.value} for ${val.color}</label>`
                }
            }
        }
    },
    components: {
        'sparkline': Sparkline
    },
    computed: {
        invalidInput() { return isNaN(this.amountToAdd); }
    },
    methods: {
      handleSubmit() {
          if (isNaN(this.amountToAdd)) {
             return;
          }
          EventBus.$emit(`server.${slot}`, { amountToAdd: parseFloat(this.amountToAdd) });
          //update graphs to some new random data with every form submit
          this.spBarData = Array(10).fill(0).map(x => Math.floor(Math.random()*20)+1);
          this.spLineData = Array(10).fill(0).map(x => Math.floor(Math.random()*20)+1);
          this.spPieData = Array(5).fill(0).map(x => (
              { value: Math.floor(Math.random()*20)+1, color: `#20${Math.floor(Math.random() * 200+20).toString(16)}80`}));
      }
    }

}