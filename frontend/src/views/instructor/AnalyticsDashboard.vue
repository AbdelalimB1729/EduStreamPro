<template>
  <div class="analytics-dashboard">
    <v-container>
      <!-- Header -->
      <v-row class="mb-6">
        <v-col cols="12">
          <v-card>
            <v-card-text>
              <div class="d-flex align-center">
                <div>
                  <h1 class="text-h4 mb-2">Analytics Dashboard</h1>
                  <p class="text-subtitle-1">
                    Track your course performance and student engagement
                  </p>
                </div>
                <v-spacer />
                <v-select
                  v-model="selectedPeriod"
                  :items="analyticsPeriods"
                  label="Time Period"
                  density="compact"
                  class="period-select"
                />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Overview Stats -->
      <v-row class="mb-6">
        <v-col cols="12" md="3">
          <v-card>
            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-icon
                  color="primary"
                  size="32"
                  class="mr-2"
                >
                  mdi-account-group
                </v-icon>
                <span class="text-h6">Total Students</span>
              </div>
              <div class="text-h3">{{ stats.totalStudents }}</div>
              <div
                class="mt-2"
                :class="stats.studentGrowth >= 0 ? 'text-success' : 'text-error'"
              >
                {{ stats.studentGrowth >= 0 ? '+' : '' }}{{ stats.studentGrowth }}%
                <span class="text-caption">vs last period</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3">
          <v-card>
            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-icon
                  color="success"
                  size="32"
                  class="mr-2"
                >
                  mdi-currency-usd
                </v-icon>
                <span class="text-h6">Revenue</span>
              </div>
              <div class="text-h3">${{ stats.revenue }}</div>
              <div
                class="mt-2"
                :class="stats.revenueGrowth >= 0 ? 'text-success' : 'text-error'"
              >
                {{ stats.revenueGrowth >= 0 ? '+' : '' }}{{ stats.revenueGrowth }}%
                <span class="text-caption">vs last period</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3">
          <v-card>
            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-icon
                  color="info"
                  size="32"
                  class="mr-2"
                >
                  mdi-clock-outline
                </v-icon>
                <span class="text-h6">Avg. Watch Time</span>
              </div>
              <div class="text-h3">{{ stats.avgWatchTime }}h</div>
              <div
                class="mt-2"
                :class="stats.watchTimeGrowth >= 0 ? 'text-success' : 'text-error'"
              >
                {{ stats.watchTimeGrowth >= 0 ? '+' : '' }}{{ stats.watchTimeGrowth }}%
                <span class="text-caption">vs last period</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3">
          <v-card>
            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-icon
                  color="warning"
                  size="32"
                  class="mr-2"
                >
                  mdi-star
                </v-icon>
                <span class="text-h6">Avg. Rating</span>
              </div>
              <div class="text-h3">{{ stats.avgRating }}/5</div>
              <div
                class="mt-2"
                :class="stats.ratingGrowth >= 0 ? 'text-success' : 'text-error'"
              >
                {{ stats.ratingGrowth >= 0 ? '+' : '' }}{{ stats.ratingGrowth }}%
                <span class="text-caption">vs last period</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Charts -->
      <v-row class="mb-6">
        <v-col cols="12" md="8">
          <v-card>
            <v-card-title>Enrollment Trends</v-card-title>
            <v-card-text>
              <v-chart
                class="chart"
                :option="enrollmentChartOption"
                autoresize
              />
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card>
            <v-card-title>Course Completion Rates</v-card-title>
            <v-card-text>
              <v-chart
                class="chart"
                :option="completionChartOption"
                autoresize
              />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Course Performance -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title>Course Performance</v-card-title>
            <v-card-text>
              <v-data-table
                :headers="courseHeaders"
                :items="coursePerformance"
                :sort-by="[{ key: 'students', order: 'desc' }]"
              >
                <template v-slot:item.rating="{ item }">
                  <v-rating
                    :model-value="item.rating"
                    color="amber"
                    density="compact"
                    half-increments
                    readonly
                  />
                </template>

                <template v-slot:item.completion="{ item }">
                  <v-progress-linear
                    :model-value="item.completion"
                    color="primary"
                    height="20"
                    rounded
                  >
                    <template v-slot:default="{ value }">
                      {{ Math.ceil(value) }}%
                    </template>
                  </v-progress-linear>
                </template>

                <template v-slot:item.revenue="{ item }">
                  ${{ item.revenue }}
                </template>

                <template v-slot:item.actions="{ item }">
                  <v-btn
                    icon="mdi-chart-box"
                    variant="text"
                    size="small"
                    :to="\`/courses/\${item.id}/analytics\`"
                  />
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import {
  LineChart,
  BarChart,
  PieChart,
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';
import { ANALYTICS_PERIODS } from '@/utils/constants';

// Register ECharts components
use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
]);

// State
const selectedPeriod = ref(ANALYTICS_PERIODS[1].value);
const analyticsPeriods = ANALYTICS_PERIODS;

// Mock Data (In a real app, this would come from the API)
const stats = ref({
  totalStudents: 1250,
  studentGrowth: 15,
  revenue: 25000,
  revenueGrowth: 22,
  avgWatchTime: 4.5,
  watchTimeGrowth: -5,
  avgRating: 4.7,
  ratingGrowth: 2,
});

const enrollmentChartOption = ref({
  tooltip: {
    trigger: 'axis',
  },
  legend: {
    data: ['Enrollments', 'Revenue'],
  },
  xAxis: {
    type: 'category',
    data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  },
  yAxis: [
    {
      type: 'value',
      name: 'Enrollments',
    },
    {
      type: 'value',
      name: 'Revenue',
      axisLabel: {
        formatter: '${value}',
      },
    },
  ],
  series: [
    {
      name: 'Enrollments',
      type: 'bar',
      data: [120, 150, 180, 220, 260, 300],
    },
    {
      name: 'Revenue',
      type: 'line',
      yAxisIndex: 1,
      data: [2400, 3000, 3600, 4400, 5200, 6000],
    },
  ],
});

const completionChartOption = ref({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c} ({d}%)',
  },
  series: [
    {
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2,
      },
      label: {
        show: false,
        position: 'center',
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 20,
          fontWeight: 'bold',
        },
      },
      data: [
        { value: 60, name: 'Completed' },
        { value: 25, name: 'In Progress' },
        { value: 15, name: 'Not Started' },
      ],
    },
  ],
});

const courseHeaders = [
  {
    title: 'Course',
    key: 'title',
  },
  {
    title: 'Students',
    key: 'students',
    align: 'center',
  },
  {
    title: 'Rating',
    key: 'rating',
    align: 'center',
  },
  {
    title: 'Completion Rate',
    key: 'completion',
    align: 'center',
  },
  {
    title: 'Revenue',
    key: 'revenue',
    align: 'end',
  },
  {
    title: 'Actions',
    key: 'actions',
    align: 'center',
    sortable: false,
  },
];

const coursePerformance = ref([
  {
    id: '1',
    title: 'Advanced TypeScript Development',
    students: 450,
    rating: 4.8,
    completion: 85,
    revenue: 9000,
  },
  {
    id: '2',
    title: 'Vue.js Masterclass',
    students: 380,
    rating: 4.6,
    completion: 78,
    revenue: 7600,
  },
  {
    id: '3',
    title: 'Node.js Backend Development',
    students: 420,
    rating: 4.7,
    completion: 82,
    revenue: 8400,
  },
]);

// Methods
const loadAnalytics = async () => {
  // In a real app, this would fetch data from the API
  console.log('Loading analytics for period:', selectedPeriod.value);
};

// Lifecycle
onMounted(() => {
  loadAnalytics();
});
</script>

<style scoped>
.analytics-dashboard {
  min-height: 100%;
  background-color: var(--v-background-base);
}

.period-select {
  max-width: 200px;
}

.chart {
  height: 400px;
}

:deep(.v-data-table) {
  background-color: transparent !important;
}
</style>