<template>
  <div class="resource-library">
    <v-card>
      <v-card-title class="d-flex align-center">
        Resources
        <v-spacer />
        <v-btn
          v-if="canAddResources"
          icon="mdi-plus"
          size="small"
          @click="showAddResourceDialog = true"
        />
      </v-card-title>

      <v-card-text>
        <v-text-field
          v-model="searchQuery"
          prepend-inner-icon="mdi-magnify"
          label="Search resources"
          hide-details
          class="mb-4"
          clearable
        />

        <v-tabs v-model="activeTab" class="mb-4">
          <v-tab value="all">All</v-tab>
          <v-tab value="documents">Documents</v-tab>
          <v-tab value="links">Links</v-tab>
          <v-tab value="downloads">Downloads</v-tab>
        </v-tabs>

        <v-list v-if="filteredResources.length > 0">
          <v-list-item
            v-for="resource in filteredResources"
            :key="resource.id"
            :title="resource.title"
            :subtitle="resource.description"
            class="resource-item"
          >
            <template v-slot:prepend>
              <v-icon :color="getResourceColor(resource)">
                {{ getResourceIcon(resource) }}
              </v-icon>
            </template>

            <template v-slot:append>
              <v-btn
                icon="mdi-download"
                size="small"
                variant="text"
                @click="downloadResource(resource)"
                v-if="resource.type === 'download'"
              />
              <v-btn
                icon="mdi-open-in-new"
                size="small"
                variant="text"
                @click="openResource(resource)"
                v-else
              />
              <v-btn
                icon="mdi-delete"
                size="small"
                variant="text"
                color="error"
                @click="confirmDeleteResource(resource)"
                v-if="canAddResources"
              />
            </template>
          </v-list-item>
        </v-list>

        <v-alert
          v-else
          type="info"
          text="No resources found"
          variant="tonal"
        />
      </v-card-text>
    </v-card>

    <!-- Add Resource Dialog -->
    <v-dialog v-model="showAddResourceDialog" max-width="500">
      <v-card>
        <v-card-title>Add Resource</v-card-title>
        <v-card-text>
          <v-form ref="form" @submit.prevent="handleAddResource">
            <v-text-field
              v-model="newResource.title"
              label="Title"
              :rules="[v => !!v || 'Title is required']"
              required
            />

            <v-textarea
              v-model="newResource.description"
              label="Description"
              rows="3"
            />

            <v-select
              v-model="newResource.type"
              label="Type"
              :items="resourceTypes"
              item-title="text"
              item-value="value"
              :rules="[v => !!v || 'Type is required']"
              required
            />

            <v-text-field
              v-if="newResource.type === 'link'"
              v-model="newResource.url"
              label="URL"
              :rules="[
                v => !!v || 'URL is required',
                v => /^https?:\/\/.+/.test(v) || 'Must be a valid URL',
              ]"
              required
            />

            <v-file-input
              v-if="newResource.type === 'download'"
              v-model="newResource.file"
              label="File"
              :rules="[v => !!v || 'File is required']"
              required
              accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
              show-size
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="grey"
            variant="text"
            @click="showAddResourceDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="handleAddResource"
            :loading="loading"
          >
            Add Resource
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title>Delete Resource</v-card-title>
        <v-card-text>
          Are you sure you want to delete this resource?
          This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="grey"
            variant="text"
            @click="showDeleteDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            @click="handleDeleteResource"
            :loading="loading"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSnackbarStore } from '@/stores/snackbar-store';

interface Resource {
  id: string;
  title: string;
  description?: string;
  type: 'document' | 'link' | 'download';
  url?: string;
  file?: File;
  fileSize?: number;
  fileType?: string;
  createdAt: Date;
}

const props = defineProps<{
  resources: Resource[];
  canAddResources?: boolean;
}>();

const emit = defineEmits<{
  (e: 'add', resource: Resource): void;
  (e: 'delete', resourceId: string): void;
}>();

// Store
const snackbarStore = useSnackbarStore();

// State
const searchQuery = ref('');
const activeTab = ref('all');
const showAddResourceDialog = ref(false);
const showDeleteDialog = ref(false);
const loading = ref(false);
const resourceToDelete = ref<Resource | null>(null);
const form = ref<any>(null);

const newResource = ref<Partial<Resource>>({
  title: '',
  description: '',
  type: 'document',
});

// Constants
const resourceTypes = [
  { text: 'Document', value: 'document' },
  { text: 'Link', value: 'link' },
  { text: 'Download', value: 'download' },
];

// Computed
const filteredResources = computed(() => {
  let filtered = props.resources;

  // Filter by tab
  if (activeTab.value !== 'all') {
    filtered = filtered.filter(r => r.type === activeTab.value);
  }

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      r =>
        r.title.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query),
    );
  }

  return filtered;
});

// Methods
const getResourceIcon = (resource: Resource): string => {
  switch (resource.type) {
    case 'document':
      return 'mdi-file-document';
    case 'link':
      return 'mdi-link';
    case 'download':
      return 'mdi-download';
    default:
      return 'mdi-file';
  }
};

const getResourceColor = (resource: Resource): string => {
  switch (resource.type) {
    case 'document':
      return 'primary';
    case 'link':
      return 'info';
    case 'download':
      return 'success';
    default:
      return 'grey';
  }
};

const openResource = (resource: Resource) => {
  if (resource.url) {
    window.open(resource.url, '_blank');
  }
};

const downloadResource = async (resource: Resource) => {
  try {
    // In a real app, this would download from your backend
    const link = document.createElement('a');
    link.href = resource.url;
    link.download = resource.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    snackbarStore.showError('Failed to download resource');
  }
};

const handleAddResource = async () => {
  if (!form.value) return;
  
  const { valid } = await form.value.validate();
  if (!valid) return;

  try {
    loading.value = true;

    // In a real app, you would upload the file if it exists
    if (newResource.value.type === 'download' && newResource.value.file) {
      // Handle file upload
    }

    const resource: Resource = {
      id: Date.now().toString(),
      title: newResource.value.title!,
      description: newResource.value.description,
      type: newResource.value.type as Resource['type'],
      url: newResource.value.url,
      createdAt: new Date(),
    };

    emit('add', resource);
    showAddResourceDialog.value = false;
    snackbarStore.showSuccess('Resource added successfully');

    // Reset form
    newResource.value = {
      title: '',
      description: '',
      type: 'document',
    };
  } catch (error) {
    snackbarStore.showError('Failed to add resource');
  } finally {
    loading.value = false;
  }
};

const confirmDeleteResource = (resource: Resource) => {
  resourceToDelete.value = resource;
  showDeleteDialog.value = true;
};

const handleDeleteResource = async () => {
  if (!resourceToDelete.value) return;

  try {
    loading.value = true;
    emit('delete', resourceToDelete.value.id);
    showDeleteDialog.value = false;
    snackbarStore.showSuccess('Resource deleted successfully');
  } catch (error) {
    snackbarStore.showError('Failed to delete resource');
  } finally {
    loading.value = false;
    resourceToDelete.value = null;
  }
};
</script>

<style scoped>
.resource-library {
  height: 100%;
  overflow: hidden;
}

.resource-item {
  transition: background-color 0.2s;
}

.resource-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>