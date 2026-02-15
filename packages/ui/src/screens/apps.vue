<template>
    <div id="apps">
        <LoaderModal v-if="isLoading" />

        <template v-else>
            <div class="header">
                <h1>Apps</h1>
                <button v-if="store.isAdmin" class="primary" @click="showCreateForm">Add App</button>
            </div>

            <div class="app-list">
                <div v-if="!apps?.length" class="empty">
                    <i class="fa fa-cube" />
                    <h2>No apps</h2>
                </div>
                <div v-for="app in apps" :key="app.id" class="app" @click="viewApp(app)">
                    <span>{{ app.name }}</span>
                    <div class="app-right">
                        <span>{{ app.buildCount || 'No' }} {{ app.buildCount === 1 ? 'build' : 'builds' }}</span>
                        <i v-if="store.isAdmin" class="fa fa-gear app-settings" @click.stop="openEditModal(app)" />
                    </div>
                </div>
            </div>
        </template>

        <!-- Create App Modal -->
        <VfModal v-if="showCreate" @close="closeCreateModal">
            <!-- Post-creation CI setup view -->
            <div v-if="createdApp" class="ci-setup">
                <h2>App created!</h2>
                <p class="subtitle">Add this to your <code>.gitlab-ci.yml</code>:</p>

                <div class="ci-snippet-header">
                    <span />
                    <button type="button" @click="copyCiSnippet"><i class="fa fa-copy" /> Copy</button>
                </div>
                <pre><code>{{ ciSnippet }}</code></pre>

                <div class="ci-actions">
                    <button type="button" class="primary" @click="closeCreateModal">Done</button>
                </div>
            </div>

            <!-- Create form -->
            <div v-else class="form-modal">
                <h2>Add App</h2>

                <form @submit.prevent="submitCreate">
                    <label>
                        VCS Integration
                        <select v-model="createForm.vcsId" required>
                            <option value="" disabled>Select integration...</option>
                            <option v-for="vcs in vcsIntegrations" :key="vcs.id" :value="vcs.id">
                                {{ vcs.name }}
                            </option>
                        </select>
                    </label>

                    <label>
                        Project
                        <input
                            v-model="projectSearch"
                            type="text"
                            placeholder="Search by name or paste a GitLab URL..."
                            :disabled="!createForm.vcsId"
                            @input="onProjectSearchInput"
                        />
                        <div v-if="projectResults.length" class="project-results">
                            <div
                                v-for="project in projectResults"
                                :key="project.id"
                                class="project-result"
                                @click="selectProject(project)"
                            >
                                <span class="project-name">{{ project.name }}</span>
                                <span class="project-path">{{ project.projectPath }}</span>
                            </div>
                        </div>
                        <div v-if="selectedProject" class="selected-project">
                            <span>{{ selectedProject.projectPath }}</span>
                            <button type="button" class="clear-btn" @click="clearProject">
                                <i class="fa fa-times" />
                            </button>
                        </div>
                    </label>

                    <label>
                        App Name
                        <input v-model="createForm.name" type="text" required />
                    </label>

                    <label>
                        Default Branch Name
                        <input v-model="createForm.defaultBranchName" type="text" placeholder="e.g. main" />
                    </label>

                    <div class="form-actions">
                        <button type="button" @click="closeCreateModal">Cancel</button>
                        <button type="submit" class="primary" :disabled="isSubmitting || !selectedProject">
                            {{ isSubmitting ? 'Creating...' : 'Create App' }}
                        </button>
                    </div>
                </form>
            </div>
        </VfModal>

        <!-- Edit App Modal -->
        <VfModal v-if="editApp" @close="closeEditModal">
            <div class="form-modal">
                <h2>App Settings</h2>

                <form @submit.prevent="submitEdit">
                    <label>
                        App ID
                        <div class="input-with-button">
                            <input :value="editApp.id" type="text" readonly />
                            <button type="button" class="input-button" @click="copyAppId">
                                <i class="fa fa-copy" />
                            </button>
                        </div>
                    </label>

                    <label>
                        App Name
                        <input v-model="editForm.name" type="text" required />
                    </label>

                    <label>
                        Default Branch
                        <select v-model="editForm.defaultBranchId">
                            <option value="" disabled>Select branch...</option>
                            <option v-for="branch in editBranches" :key="branch.id" :value="branch.id">
                                {{ branch.name }}
                            </option>
                        </select>
                    </label>

                    <div class="form-actions">
                        <button type="button" class="danger" @click="deleteApp">Delete</button>
                        <div class="form-actions-right">
                            <button type="button" @click="closeEditModal">Cancel</button>
                            <button type="submit" class="primary" :disabled="isSubmitting">
                                {{ isSubmitting ? 'Saving...' : 'Save' }}
                            </button>
                        </div>
                    </div>
                </form>

                <hr />

                <div class="ci-snippet">
                    <div class="ci-snippet-header">
                        <span class="ci-snippet-label">.gitlab-ci.yml</span>
                        <button type="button" @click="copyEditCiSnippet"><i class="fa fa-copy" /> Copy</button>
                    </div>
                    <pre><code>{{ editCiSnippet }}</code></pre>
                </div>
            </div>
        </VfModal>
    </div>
</template>

<script lang="ts" setup>
import {
    AppsApi,
    BranchesApi,
    VcsIntegrationsApi,
    type IAppIndexResponse,
    type IAppShowResponse,
    type IBranchResponse,
    type IVcsIntegrationListResponse,
    type IVcsProject
} from '@/openapi-client-generated';
import LoaderModal from '@/shared/components/loader-modal.vue';
import { useStore } from '@/store';
import { dataFrom, dataFromAsync } from '@zyno-io/openapi-client-codegen';
import { handleErrorAndAlert, showConfirm, showToast, VfModal } from '@zyno-io/vue-foundation';
import { debounce } from 'lodash';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

const store = useStore();
const router = useRouter();

const apps = ref<IAppIndexResponse[]>();
const vcsIntegrations = ref<IVcsIntegrationListResponse[]>();
const isLoading = ref(true);
const isSubmitting = ref(false);
// Create form state
const showCreate = ref(false);
const createdApp = ref<IAppIndexResponse | null>(null);
const projectSearch = ref('');
const projectResults = ref<IVcsProject[]>([]);
const selectedProject = ref<IVcsProject | null>(null);
const createForm = reactive({
    vcsId: '',
    name: '',
    defaultBranchName: ''
});

const apiUrl = computed(() => window.location.origin);

function buildCiSnippet(appId: string) {
    return `visual-regression:
  stage: test
  image: ghcr.io/zyno-io/pixelci/cli:latest
  variables:
    PIXELCI_API_URL: ${apiUrl.value}
    PIXELCI_APP_ID: ${appId}
    PIXELCI_IMAGES_PATH: ./path/to/screenshots
  script:
    - pixelci`;
}

const ciSnippet = computed(() => buildCiSnippet(createdApp.value?.id ?? '<app-id>'));
const editCiSnippet = computed(() => buildCiSnippet(editApp.value?.id ?? '<app-id>'));

// Edit form state
const editApp = ref<IAppIndexResponse | null>(null);
const editAppDetail = ref<IAppShowResponse | null>(null);
const editBranches = ref<IBranchResponse[]>([]);
const editForm = reactive({
    name: '',
    defaultBranchId: ''
});

onMounted(load);

async function load() {
    try {
        const appsPromise = AppsApi.getAppsIndex();
        const vcsPromise = store.isAdmin ? VcsIntegrationsApi.getVcsIntegrationsIndex() : undefined;
        const [appsResult, vcsResult] = await Promise.all([appsPromise, vcsPromise]);
        apps.value = dataFrom(appsResult);
        if (vcsResult) {
            vcsIntegrations.value = dataFrom(vcsResult);
        }
    } catch (err) {
        handleErrorAndAlert(err);
    } finally {
        isLoading.value = false;
    }
}

function viewApp(app: IAppIndexResponse) {
    router.push({ path: `/apps/${app.id}` });
}

// --- Create App ---

function showCreateForm() {
    createForm.vcsId = vcsIntegrations.value?.[0]?.id ?? '';
    createForm.name = '';
    createForm.defaultBranchName = '';
    projectSearch.value = '';
    projectResults.value = [];
    selectedProject.value = null;
    createdApp.value = null;
    showCreate.value = true;
}

const URL_REGEX = /^https?:\/\//;

const debouncedSearch = debounce(async (search: string) => {
    if (!createForm.vcsId || search.length < 2) {
        projectResults.value = [];
        return;
    }

    try {
        if (URL_REGEX.test(search)) {
            const project = await dataFromAsync(
                AppsApi.getAppsResolveVcsProject({
                    query: { vcsId: createForm.vcsId, url: search }
                })
            );
            selectProject(project);
            return;
        }

        projectResults.value = await dataFromAsync(
            AppsApi.getAppsSearchVcsProjects({
                query: { vcsId: createForm.vcsId, search }
            })
        );
    } catch {
        projectResults.value = [];
    }
}, 300);

function onProjectSearchInput() {
    if (selectedProject.value) return;
    debouncedSearch(projectSearch.value);
}

function selectProject(project: IVcsProject) {
    selectedProject.value = project;
    projectSearch.value = '';
    projectResults.value = [];
    if (!createForm.name) {
        createForm.name = project.name;
    }
    if (!createForm.defaultBranchName && project.defaultBranch) {
        createForm.defaultBranchName = project.defaultBranch;
    }
}

function clearProject() {
    selectedProject.value = null;
    projectSearch.value = '';
}

async function submitCreate() {
    if (!selectedProject.value) return;
    try {
        isSubmitting.value = true;
        const app = await dataFromAsync(
            AppsApi.postAppsCreate({
                body: {
                    name: createForm.name,
                    vcsId: createForm.vcsId,
                    projectPath: selectedProject.value.projectPath,
                    vcsProjectId: Number(selectedProject.value.id),
                    defaultBranchName: createForm.defaultBranchName || undefined
                }
            })
        );
        createdApp.value = app;
    } catch (err) {
        handleErrorAndAlert(err);
    } finally {
        isSubmitting.value = false;
    }
}

function closeCreateModal() {
    const shouldReload = !!createdApp.value;
    showCreate.value = false;
    createdApp.value = null;
    if (shouldReload) {
        isLoading.value = true;
        load();
    }
}

async function copyCiSnippet() {
    await navigator.clipboard.writeText(ciSnippet.value);
    showToast({ message: 'Copied to clipboard', durationSecs: 2, disableClose: true });
}

async function copyEditCiSnippet() {
    await navigator.clipboard.writeText(editCiSnippet.value);
    showToast({ message: 'Copied to clipboard', durationSecs: 2, disableClose: true });
}

async function copyAppId() {
    if (editApp.value?.id) {
        await navigator.clipboard.writeText(editApp.value.id);
        showToast({ message: 'Copied to clipboard', durationSecs: 2, disableClose: true });
    }
}

// --- Edit App ---

async function openEditModal(app: IAppIndexResponse) {
    editApp.value = app;
    editForm.name = app.name ?? '';
    editForm.defaultBranchId = app.defaultBranchId ?? '';

    try {
        const [detail, branches] = await Promise.all([
            dataFromAsync(AppsApi.getAppsShow({ path: { id: app.id! } })),
            dataFromAsync(BranchesApi.getBranchesIndex({ path: { appId: app.id! } }))
        ]);
        editAppDetail.value = detail;
        editBranches.value = branches;
    } catch (err) {
        handleErrorAndAlert(err);
    }
}

function closeEditModal() {
    editApp.value = null;
    editAppDetail.value = null;
    editBranches.value = [];
}

async function submitEdit() {
    if (!editApp.value) return;
    try {
        isSubmitting.value = true;
        const updated = await dataFromAsync(
            AppsApi.putAppsUpdate({
                path: { id: editApp.value.id! },
                body: {
                    name: editForm.name,
                    defaultBranchId: editForm.defaultBranchId || undefined
                }
            })
        );
        const idx = apps.value?.findIndex(a => a.id === editApp.value!.id);
        if (idx !== undefined && idx >= 0 && apps.value) {
            apps.value[idx] = updated;
        }
        closeEditModal();
    } catch (err) {
        handleErrorAndAlert(err);
    } finally {
        isSubmitting.value = false;
    }
}

// --- Delete App ---

async function deleteApp() {
    if (!editApp.value) return;
    const ok = await showConfirm(`Delete "${editApp.value.name}"? This cannot be undone.`);
    if (!ok) return;

    try {
        await dataFromAsync(AppsApi.deleteAppsDelete({ path: { id: editApp.value.id! } }));
        apps.value = apps.value?.filter(a => a.id !== editApp.value!.id);
        closeEditModal();
    } catch (err) {
        handleErrorAndAlert(err);
    }
}
</script>

<style lang="scss" scoped>
@reference "tailwindcss";

#apps {
    .app-list {
        @apply flex flex-col gap-4;
    }

    .empty {
        @apply flex flex-col items-center justify-center min-h-[300px] gap-6 p-4 rounded-md text-neutral-500/50 text-lg;

        i {
            @apply text-5xl;
        }
    }

    .app {
        @apply p-4 bg-neutral-500/10 border border-neutral-500/25 rounded-md duration-75 flex justify-between items-center;

        &:hover {
            @apply bg-neutral-500/15 cursor-pointer;
        }

        .app-right {
            @apply flex items-center gap-4;
        }

        .app-settings {
            @apply text-neutral-400 hover:text-neutral-200 transition-colors;
        }
    }
}

.form-modal {
    @apply flex flex-col gap-4 p-6 w-[520px];

    h2 {
        @apply text-lg font-semibold;
    }

    hr {
        @apply border-neutral-500/25;
    }

    form {
        @apply flex flex-col gap-3;

        label {
            @apply flex flex-col gap-1 text-sm font-medium relative;
        }

        input,
        select {
            @apply border border-neutral-500/25 rounded px-3 py-2 bg-transparent text-sm;
        }

        .project-results {
            @apply absolute top-full left-0 right-0 z-10 bg-white dark:bg-neutral-800 border border-neutral-500/25 rounded mt-1 max-h-60 overflow-y-auto shadow-lg;

            .project-result {
                @apply px-3 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-500/15 flex flex-col;

                .project-name {
                    @apply text-sm text-neutral-900 dark:text-neutral-100;
                }

                .project-path {
                    @apply text-xs text-neutral-500 dark:text-neutral-400;
                }
            }
        }

        .selected-project {
            @apply flex items-center justify-between p-2 bg-neutral-500/10 border border-neutral-500/25 rounded text-sm;

            .clear-btn {
                @apply text-neutral-400 hover:text-neutral-200 p-0;
            }
        }

        .input-with-button {
            @apply flex;

            input {
                @apply flex-1 rounded-r-none;
            }

            .input-button {
                @apply border border-l-0 border-neutral-500/25 !rounded-l-none rounded-r px-3 text-neutral-400 hover:text-neutral-200 transition-colors;
            }
        }
    }

    .form-actions {
        @apply flex gap-2 items-center mt-2;

        .form-actions-right {
            @apply flex gap-2 ml-auto;
        }
    }

    .ci-snippet {
        @apply flex flex-col gap-1;

        .ci-snippet-header {
            @apply flex justify-between items-center;

            .ci-snippet-label {
                @apply text-sm font-medium;
            }

            button {
                @apply text-xs;
            }
        }

        pre {
            @apply bg-neutral-500/15 rounded overflow-x-auto;

            code {
                @apply text-xs font-mono p-3 block;
            }
        }
    }
}

.ci-setup {
    @apply flex flex-col gap-4 p-6 w-[520px];

    h2 {
        @apply text-lg font-semibold;
    }

    .subtitle {
        @apply text-sm text-neutral-400;

        code {
            @apply text-xs font-mono bg-neutral-500/15 px-1.5 py-0.5 rounded;
        }
    }

    .ci-snippet-header {
        @apply flex justify-between items-center mb-[-12px];

        button {
            @apply text-xs;
        }
    }

    pre {
        @apply bg-neutral-500/15 rounded overflow-x-auto;

        code {
            @apply text-xs font-mono p-3 block;
        }
    }

    .ci-actions {
        @apply flex justify-end gap-2;
    }
}
</style>
