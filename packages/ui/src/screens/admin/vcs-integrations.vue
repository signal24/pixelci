<template>
    <div id="admin-vcs-integrations">
        <LoaderModal v-if="isLoading" />

        <template v-else>
            <div class="header">
                <h1>VCS Integrations</h1>
                <button class="primary" @click="showCreateForm">Add Integration</button>
            </div>

            <div class="list">
                <div v-if="!integrations?.length" class="empty">
                    <i class="fa fa-plug" />
                    <h2>No VCS integrations</h2>
                </div>
                <div v-for="integration in integrations" :key="integration.id" class="item">
                    <div class="item-info">
                        <span class="name">{{ integration.name }}</span>
                        <span class="platform">{{ integration.platform }}</span>
                    </div>
                    <div class="item-actions">
                        <button @click="editIntegration(integration)">Edit</button>
                        <button class="danger" @click="deleteIntegration(integration)">Delete</button>
                    </div>
                </div>
            </div>
        </template>

        <VfModal v-if="showForm" @close="closeForm">
            <div class="form-modal">
                <h2>{{ editingId ? 'Edit' : 'Add' }} VCS Integration</h2>

                <form @submit.prevent="submitForm">
                    <label>
                        Name
                        <input v-model="form.name" type="text" required />
                    </label>

                    <label v-if="!editingId">
                        Platform
                        <select v-model="form.platform" required>
                            <option value="gitlab">GitLab</option>
                        </select>
                    </label>

                    <label>
                        GitLab URL
                        <input v-model="form.url" type="url" placeholder="https://gitlab.example.com" required />
                    </label>

                    <label>
                        Client ID
                        <input v-model="form.clientId" type="text" required />
                    </label>

                    <label>
                        Client Secret
                        <input v-model="form.clientSecret" type="text" required />
                    </label>

                    <div class="redirect-url">
                        <span class="redirect-label">OAuth Redirect URI</span>
                        <code>{{ redirectUrl }}</code>
                        <p class="hint">Configure this as the redirect URI in your GitLab OAuth application.</p>
                    </div>

                    <div class="form-actions">
                        <button type="button" @click="closeForm">Cancel</button>
                        <button type="submit" class="primary" :disabled="isSubmitting">
                            {{ isSubmitting ? 'Saving...' : 'Save' }}
                        </button>
                    </div>
                </form>
            </div>
        </VfModal>
    </div>
</template>

<script lang="ts" setup>
import { VcsIntegrationsApi, type IVcsIntegrationListResponse } from '@/openapi-client-generated';
import LoaderModal from '@/shared/components/loader-modal.vue';
import { dataFrom, dataFromAsync } from '@zyno-io/openapi-client-codegen';
import { handleErrorAndAlert, showConfirm, VfModal } from '@zyno-io/vue-foundation';
import { computed, onMounted, reactive, ref } from 'vue';

const integrations = ref<IVcsIntegrationListResponse[]>();
const isLoading = ref(true);
const showForm = ref(false);
const isSubmitting = ref(false);
const editingId = ref<string | null>(null);

const form = reactive({
    name: '',
    platform: 'gitlab' as 'gitlab' | 'github',
    url: '',
    clientId: '',
    clientSecret: ''
});

const redirectUrl = computed(() => `${window.location.origin}/login`);

onMounted(load);

async function load() {
    try {
        integrations.value = dataFrom(await VcsIntegrationsApi.getVcsIntegrationsIndex());
    } catch (err) {
        handleErrorAndAlert(err);
    } finally {
        isLoading.value = false;
    }
}

function showCreateForm() {
    editingId.value = null;
    form.name = '';
    form.platform = 'gitlab';
    form.url = '';
    form.clientId = '';
    form.clientSecret = '';
    showForm.value = true;
}

async function editIntegration(integration: IVcsIntegrationListResponse) {
    try {
        const detail = dataFrom(await VcsIntegrationsApi.getVcsIntegrationsShow({ path: { id: integration.id } }));
        editingId.value = integration.id;
        form.name = detail.name;
        form.platform = detail.platform;
        const config = detail.config as { url: string; clientId: string; clientSecret: string };
        form.url = config.url;
        form.clientId = config.clientId;
        form.clientSecret = config.clientSecret;
        showForm.value = true;
    } catch (err) {
        handleErrorAndAlert(err);
    }
}

async function deleteIntegration(integration: IVcsIntegrationListResponse) {
    const ok = await showConfirm(`Delete "${integration.name}"?`);
    if (!ok) return;
    try {
        await dataFromAsync(VcsIntegrationsApi.deleteVcsIntegrationsDelete({ path: { id: integration.id } }));
        integrations.value = integrations.value?.filter(i => i.id !== integration.id);
    } catch (err) {
        handleErrorAndAlert(err);
    }
}

function closeForm() {
    showForm.value = false;
    editingId.value = null;
}

async function submitForm() {
    try {
        isSubmitting.value = true;
        const config = {
            url: form.url,
            clientId: form.clientId,
            clientSecret: form.clientSecret
        };

        if (editingId.value) {
            await dataFromAsync(
                VcsIntegrationsApi.putVcsIntegrationsUpdate({
                    path: { id: editingId.value },
                    body: { name: form.name, config }
                })
            );
        } else {
            await dataFromAsync(
                VcsIntegrationsApi.postVcsIntegrationsCreate({
                    body: { name: form.name, platform: form.platform, config }
                })
            );
        }

        closeForm();
        isLoading.value = true;
        await load();
    } catch (err) {
        handleErrorAndAlert(err);
    } finally {
        isSubmitting.value = false;
    }
}
</script>

<style lang="scss" scoped>
@reference "tailwindcss";

#admin-vcs-integrations {
    .list {
        @apply flex flex-col gap-4;
    }

    .item {
        @apply p-4 bg-neutral-500/10 border border-neutral-500/25 rounded-md flex justify-between items-center;

        .item-info {
            @apply flex items-center gap-4;

            .name {
                @apply font-medium;
            }

            .platform {
                @apply text-sm text-neutral-400 bg-neutral-500/15 px-2 py-0.5 rounded;
            }
        }

        .item-actions {
            @apply flex gap-2;
        }
    }

    .empty {
        @apply flex flex-col items-center justify-center min-h-[300px] gap-6 p-4 rounded-md text-neutral-500/50 text-lg;

        i {
            @apply text-5xl;
        }
    }
}

.form-modal {
    @apply flex flex-col gap-4 p-6 w-[480px];

    h2 {
        @apply text-lg font-semibold;
    }

    form {
        @apply flex flex-col gap-3;

        label {
            @apply flex flex-col gap-1 text-sm font-medium;
        }

        input,
        select {
            @apply border border-neutral-500/25 rounded px-3 py-2 bg-transparent text-sm;
        }

        .redirect-url {
            @apply flex flex-col gap-1 p-3 bg-neutral-500/10 rounded border border-neutral-500/25;

            .redirect-label {
                @apply text-sm font-medium;
            }

            code {
                @apply text-xs bg-neutral-500/15 p-2 rounded break-all select-all;
            }

            .hint {
                @apply text-xs text-neutral-400 mt-1;
            }
        }

        .form-actions {
            @apply flex justify-end gap-2 mt-2;
        }
    }
}
</style>
