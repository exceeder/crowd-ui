import EventBus from './event-bus.js';
export default {
    template: `
    <div class="form-inline float-right">
    <form class="login-form input-group input-group-sm" method="post" @submit.prevent="handleLogin"  v-if="showLogin">
       <div class="input-group-prepend">
          <div class="input-group-text form-control-sm">@</div>
       </div>  
      <input class="form-control form-control-sm" type="text" name="login" placeholder="login" v-model="loginText"/>
    </form>
    <div v-if="!showLogin" class="navbar-nav text-white">
      <span class="nav-item nav-link">{{login}} <b>\${{ formatMoney(balance.total) }}</b> cash: \${{ formatMoney(balance.cash) }} stocks: \${{ formatMoney(balance.invested) }}</span>
      <a class="nav-link" href="#logout" title="logout" v-on:click="handleLogout">logout</a>
    </div>
  </div>
    `,
    data() {
        return {
            balance: {
                total: 0,
                cash: 0,
                invested: 0
            },
            loginText: '',
            login: '',
            showLogin: false
        }
    },
    created() {
        let login = localStorage.getItem('login');
        if (login) {
            setTimeout( () => {
                this.loginText = login;
                this.handleLogin();
            }, 200);
        } else {
            this.showLogin = true;
        }
    },
    methods: {
        handleLogin() {
            let text = this.loginText.trim().toLowerCase();
            if (text.length < 3 || text.length>16) return;
            this.showLogin = false;
            this.login = text;
            EventBus.$emit(`server.main`, { login: this.login });
            EventBus.$emit(`login`, this.login);
            localStorage.setItem('login', this.login);
        },
        handleLogout() {
            this.showLogin = true;
            localStorage.removeItem('login');
            this.login = '';
            EventBus.$emit(`logout`, {});
        },
        formatMoney(value) {
            let val = (value/1).toFixed(2);
            return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
    }
}