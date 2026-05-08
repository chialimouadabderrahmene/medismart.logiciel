import { createApp } from "vue";

export function mountVueStats(el, stats) {
  const app = createApp({
    data() {
      return {
        counts: stats?.counts || {},
        monthly: stats?.monthly || []
      };
    },
    computed: {
      totalVisits() {
        return this.counts.consultation || 0;
      },
      maxMonth() {
        return Math.max(...this.monthly.map((item) => Number(item.total)), 1);
      }
    },
    template: `
      <section class="vue-panel" aria-label="Synthese">
        <div class="vue-panel__head">
          <span>VueJS live panel</span>
          <strong>{{ totalVisits.toLocaleString('fr-FR') }}</strong>
        </div>
        <div class="vue-panel__bars">
          <div v-for="item in monthly" :key="item.month" class="vue-panel__bar-row">
            <span>{{ item.month }}</span>
            <div class="vue-panel__bar-track">
              <i :style="{ width: Math.max(8, Number(item.total) / maxMonth * 100) + '%' }"></i>
            </div>
            <b>{{ Number(item.total).toLocaleString('fr-FR') }}</b>
          </div>
        </div>
      </section>
    `
  });

  app.mount(el);
  return () => app.unmount();
}
